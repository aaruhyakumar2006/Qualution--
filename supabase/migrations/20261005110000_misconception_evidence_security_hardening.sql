-- ============================================================================
-- Migration: 20261005110000_misconception_evidence_security_hardening.sql
-- Description: Security hardening for Evidence Store functions & triggers:
--   1. Immutability trigger with controlled bypass for GDPR/DPDP deletions
--   2. Custom SQLSTATE 'QL001' on rate limit trigger (600/hr)
--   3. SET search_path = public, pg_temp on all SECURITY DEFINER functions
--   4. User-callable functions act strictly on auth.uid() without target user arguments
--   5. Separate export_my_learner_data() and delete_my_learner_data(confirm_text)
--   6. Maintenance functions (purge, cross-user rebuild) restricted to service_role
--   7. Default retention updated to 180 days
--   8. Confidence column widened to NUMERIC(3,2) supporting both 0..1 and 1..3
-- ============================================================================

-- 1. Ensure confidence column supports floats and integers
ALTER TABLE public.learner_events 
    ALTER COLUMN confidence TYPE NUMERIC(3, 2);

ALTER TABLE public.learner_events 
    DROP CONSTRAINT IF EXISTS learner_events_confidence_check;

ALTER TABLE public.learner_events 
    ADD CONSTRAINT learner_events_confidence_check 
    CHECK (confidence IS NULL OR (confidence >= 0.00 AND confidence <= 3.00));

-- 2. Hardened Immutability Trigger with Controlled Session Bypass
CREATE OR REPLACE FUNCTION public.prevent_learner_events_mutation()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'learner_events rows are append-only and cannot be updated.'
            USING ERRCODE = '42501';
    ELSIF TG_OP = 'DELETE' THEN
        -- Check if controlled bypass flag is active for GDPR deletion or automated retention purge
        IF current_setting('qualution.allow_event_deletion', true) = 'true' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'learner_events rows are append-only and cannot be deleted.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Hardened Rate Limiter Trigger with Custom SQLSTATE 'QL001'
CREATE OR REPLACE FUNCTION public.check_learner_events_rate_limit()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
DECLARE
    recent_count INTEGER;
BEGIN
    SELECT count(*) INTO recent_count
    FROM public.learner_events
    WHERE user_id = NEW.user_id
      AND created_at >= (now() - INTERVAL '1 hour');

    IF recent_count >= 600 THEN
        RAISE EXCEPTION 'Rate limit exceeded: Maximum 600 events per hour allowed.'
            USING ERRCODE = 'QL001';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. User-Facing Projection Rebuild (auth.uid() only)
CREATE OR REPLACE FUNCTION public.rebuild_my_projections()
RETURNS VOID 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    rec RECORD;
    v_touchpoints INT;
    v_status TEXT;
    v_misc_id TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    -- Clear current projections for caller
    DELETE FROM public.misconception_state WHERE user_id = v_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = v_user_id;

    -- Replay all learner events sequentially
    FOR rec IN 
        SELECT * FROM public.learner_events
        WHERE user_id = v_user_id
        ORDER BY created_at ASC
    LOOP
        v_misc_id := rec.payload->>'misconception_id';
        IF v_misc_id IS NOT NULL THEN
            SELECT count(*) INTO v_touchpoints
            FROM public.learner_events
            WHERE user_id = v_user_id
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
                v_user_id,
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

        IF rec.payload->>'concept_id' IS NOT NULL THEN
            INSERT INTO public.concept_mastery (user_id, concept_id, score, evidence_count, updated_at)
            VALUES (
                v_user_id,
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.rebuild_my_projections() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rebuild_my_projections() FROM anon, PUBLIC;

-- 5. Administrative Cross-User Rebuild (Service Role Only)
CREATE OR REPLACE FUNCTION public.rebuild_learner_projections(p_user_id UUID)
RETURNS VOID 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    rec RECORD;
    v_touchpoints INT;
    v_status TEXT;
    v_misc_id TEXT;
BEGIN
    DELETE FROM public.misconception_state WHERE user_id = p_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = p_user_id;

    FOR rec IN 
        SELECT * FROM public.learner_events
        WHERE user_id = p_user_id
        ORDER BY created_at ASC
    LOOP
        v_misc_id := rec.payload->>'misconception_id';
        IF v_misc_id IS NOT NULL THEN
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
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.rebuild_learner_projections(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_learner_projections(UUID) TO service_role;

-- 6. Export Function (Separate, auth.uid() only)
CREATE OR REPLACE FUNCTION public.export_my_learner_data()
RETURNS JSONB 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    result JSONB;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    SELECT jsonb_build_object(
        'user_id', v_user_id,
        'exported_at', now(),
        'events', coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM public.learner_events e WHERE e.user_id = v_user_id), '[]'::jsonb),
        'misconceptions', coalesce((SELECT jsonb_agg(to_jsonb(m)) FROM public.misconception_state m WHERE m.user_id = v_user_id), '[]'::jsonb),
        'mastery', coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM public.concept_mastery c WHERE c.user_id = v_user_id), '[]'::jsonb)
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.export_my_learner_data() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.export_my_learner_data() FROM anon, PUBLIC;

-- 7. Delete Function (Separate, requires explicit confirmation, bypasses immutability trigger safely)
CREATE OR REPLACE FUNCTION public.delete_my_learner_data(p_confirmation TEXT)
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;

    IF p_confirmation != 'DELETE MY DATA' THEN
        RAISE EXCEPTION 'Confirmation mismatch. Expected literal string: DELETE MY DATA' 
            USING ERRCODE = '22023';
    END IF;

    -- Enable controlled immutability bypass for this session transaction
    PERFORM set_config('qualution.allow_event_deletion', 'true', true);

    DELETE FROM public.learner_events WHERE user_id = v_user_id;
    DELETE FROM public.misconception_state WHERE user_id = v_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = v_user_id;

    -- Reset bypass flag
    PERFORM set_config('qualution.allow_event_deletion', 'false', true);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.delete_my_learner_data(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_learner_data(TEXT) FROM anon, PUBLIC;

-- Drop deprecated combined function
DROP FUNCTION IF EXISTS public.export_and_delete_user_data(UUID);

-- 8. Retention Purge Function (Default 180 days, Service Role Only, controlled bypass)
CREATE OR REPLACE FUNCTION public.purge_old_learner_events(p_retention_days INTEGER DEFAULT 180)
RETURNS INTEGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    IF p_retention_days IS NULL OR p_retention_days < 30 THEN
        RAISE EXCEPTION 'Retention window must be at least 30 days.' USING ERRCODE = '22023';
    END IF;

    -- Enable controlled immutability bypass for retention purge
    PERFORM set_config('qualution.allow_event_deletion', 'true', true);

    WITH deleted AS (
        DELETE FROM public.learner_events
        WHERE created_at < (now() - (p_retention_days || ' days')::INTERVAL)
        RETURNING id
    )
    SELECT count(*) INTO deleted_count FROM deleted;

    PERFORM set_config('qualution.allow_event_deletion', 'false', true);

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Revoke permissions safely without failing if signature doesn't exist
DO $$ BEGIN
    BEGIN
        REVOKE EXECUTE ON FUNCTION public.purge_old_learner_events(INTEGER) FROM PUBLIC, anon, authenticated;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
    BEGIN
        REVOKE EXECUTE ON FUNCTION public.purge_old_learner_events() FROM PUBLIC, anon, authenticated;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
END $$;

GRANT EXECUTE ON FUNCTION public.purge_old_learner_events(INTEGER) TO service_role;
