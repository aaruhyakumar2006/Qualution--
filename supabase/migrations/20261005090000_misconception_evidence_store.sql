-- ============================================================================
-- Migration: 20261005090000_misconception_evidence_store.sql
-- Description: Misconception Engine M3 Evidence Store (learner_events, projections, RLS, DPDP)
-- ============================================================================

-- 1. Learner Events Table (Append-Only)
CREATE TABLE IF NOT EXISTS public.learner_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    step_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (
        kind IN (
            'prediction', 'run', 'edit', 'hint_shown', 'hint_level_up',
            'answer', 'experiment_run', 'reflection', 'verification', 'free_text'
        )
    ),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence SMALLINT CHECK (confidence IS NULL OR (confidence >= 1 AND confidence <= 3)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce free_text payload length cap (max 500 chars)
ALTER TABLE public.learner_events ADD CONSTRAINT check_free_text_length 
    CHECK (
        payload->>'free_text' IS NULL OR length(payload->>'free_text') <= 500
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_learner_events_user_created ON public.learner_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learner_events_user_step ON public.learner_events (user_id, step_id);

-- 2. Immutability Trigger (Prevent UPDATE and DELETE on learner_events)
CREATE OR REPLACE FUNCTION public.prevent_learner_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'learner_events rows are append-only and cannot be updated or deleted.'
        USING ERRCODE = '42501'; -- insufficient_privilege
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_learner_events_mutation ON public.learner_events;
CREATE TRIGGER trigger_prevent_learner_events_mutation
    BEFORE UPDATE OR DELETE ON public.learner_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_learner_events_mutation();

-- 3. Per-User Rate Limit Trigger (600 events / hour)
CREATE OR REPLACE FUNCTION public.check_learner_events_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    SELECT count(*) INTO recent_count
    FROM public.learner_events
    WHERE user_id = NEW.user_id
      AND created_at >= (now() - INTERVAL '1 hour');

    IF recent_count >= 600 THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 600 events per hour allowed.'
            USING ERRCODE = 'P0001'; -- Custom app rate limit error
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_learner_events_rate_limit ON public.learner_events;
CREATE TRIGGER trigger_check_learner_events_rate_limit
    BEFORE INSERT ON public.learner_events
    FOR EACH ROW
    EXECUTE FUNCTION public.check_learner_events_rate_limit();

-- Enable RLS on learner_events
ALTER TABLE public.learner_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_events_select_own ON public.learner_events;
CREATE POLICY learner_events_select_own ON public.learner_events
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS learner_events_insert_own ON public.learner_events;
CREATE POLICY learner_events_insert_own ON public.learner_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4. Projections: misconception_state & concept_mastery
CREATE TABLE IF NOT EXISTS public.misconception_state (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    misconception_id TEXT NOT NULL,
    concept_ids TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('POSSIBLE', 'SUPPORTED', 'CLEARED')),
    touchpoints INTEGER NOT NULL DEFAULT 0,
    last_evidence_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, misconception_id)
);

CREATE TABLE IF NOT EXISTS public.concept_mastery (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    concept_id TEXT NOT NULL,
    score NUMERIC(3, 2) NOT NULL DEFAULT 0.00 CHECK (score >= 0.00 AND score <= 1.00),
    evidence_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, concept_id)
);

ALTER TABLE public.misconception_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS misconception_state_select_own ON public.misconception_state;
CREATE POLICY misconception_state_select_own ON public.misconception_state
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS concept_mastery_select_own ON public.concept_mastery;
CREATE POLICY concept_mastery_select_own ON public.concept_mastery
    FOR SELECT USING (auth.uid() = user_id);

-- 5. Projection Rebuild Function
CREATE OR REPLACE FUNCTION public.rebuild_learner_projections(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    rec RECORD;
    v_touchpoints INT;
    v_status TEXT;
    v_misc_id TEXT;
BEGIN
    -- Clear current projections for user
    DELETE FROM public.misconception_state WHERE user_id = p_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = p_user_id;

    -- Replay all learner events sequentially
    FOR rec IN 
        SELECT * FROM public.learner_events
        WHERE user_id = p_user_id
        ORDER BY created_at ASC
    LOOP
        v_misc_id := rec.payload->>'misconception_id';
        IF v_misc_id IS NOT NULL THEN
            -- Calculate touchpoints and status from accumulated evidence
            SELECT count(*) INTO v_touchpoints
            FROM public.learner_events
            WHERE user_id = p_user_id
              AND payload->>'misconception_id' = v_misc_id
              AND created_at <= rec.created_at;

            IF rec.kind = 'verification' AND (rec.payload->>'is_correct')::boolean IS TRUE THEN
                v_status := 'CLEARED';
            ELSIF v_touchpoints >= 2 THEN
                v_status := 'SUPPORTED';
            ELSE
                v_status := 'POSSIBLE';
            END IF;

            INSERT INTO public.misconception_state (
                user_id, misconception_id, concept_ids, status, touchpoints, last_evidence_at, updated_at
            )
            VALUES (
                p_user_id,
                v_misc_id,
                ARRAY[rec.payload->>'concept_id'],
                v_status,
                v_touchpoints,
                rec.created_at,
                now()
            )
            ON CONFLICT (user_id, misconception_id) DO UPDATE SET
                status = EXCLUDED.status,
                touchpoints = EXCLUDED.touchpoints,
                last_evidence_at = EXCLUDED.last_evidence_at,
                updated_at = now();
        END IF;

        -- Update Concept Mastery
        IF rec.payload->>'concept_id' IS NOT NULL THEN
            INSERT INTO public.concept_mastery (user_id, concept_id, score, evidence_count, updated_at)
            VALUES (
                p_user_id,
                rec.payload->>'concept_id',
                CASE WHEN rec.kind = 'verification' THEN 1.00 ELSE 0.50 END,
                1,
                now()
            )
            ON CONFLICT (user_id, concept_id) DO UPDATE SET
                evidence_count = concept_mastery.evidence_count + 1,
                score = LEAST(1.00, concept_mastery.score + 0.10),
                updated_at = now();
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. DPDP Privacy & Retention Functions
CREATE OR REPLACE FUNCTION public.purge_old_learner_events()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    WITH deleted AS (
        DELETE FROM public.learner_events
        WHERE created_at < (now() - INTERVAL '180 days')
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.export_and_delete_user_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Verify ownership if called by authenticated user
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Access denied.' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'user_id', p_user_id,
        'exported_at', now(),
        'events', coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.learner_events e WHERE e.user_id = p_user_id), '[]'::jsonb),
        'misconceptions', coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.misconception_state m WHERE m.user_id = p_user_id), '[]'::jsonb),
        'mastery', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.concept_mastery c WHERE c.user_id = p_user_id), '[]'::jsonb)
    ) INTO result;

    -- Delete user data
    DELETE FROM public.learner_events WHERE user_id = p_user_id;
    DELETE FROM public.misconception_state WHERE user_id = p_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = p_user_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Classroom Aggregates View (K-Anonymity >= 5)
CREATE OR REPLACE VIEW public.classroom_misconception_aggregates AS
SELECT
    lesson_id,
    misconception_id,
    status,
    count(DISTINCT user_id) AS student_count
FROM (
    SELECT e.lesson_id, m.misconception_id, m.status, m.user_id
    FROM public.misconception_state m
    JOIN public.learner_events e ON e.user_id = m.user_id
) sub
GROUP BY lesson_id, misconception_id, status
HAVING count(DISTINCT user_id) >= 5;

GRANT SELECT ON public.classroom_misconception_aggregates TO authenticated;
