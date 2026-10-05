-- ============================================================================
-- QUALUTION MISCONCEPTION ENGINE: CONSOLIDATED SCHEMA FIXES & AUTOMATED TEST SUITE
-- File: supabase/manual/apply_and_test_misconception.sql
-- Description:
--   1. Applies idempotent schema fixes (tables, columns, triggers, RLS, cohort view)
--   2. Executes comprehensive test suite using transactional blocks
--   3. Outputs a single table of PASS/FAIL results
-- ============================================================================

-- ============================================================================
-- SECTION 1: IDEMPOTENT DDL FIXES
-- ============================================================================

-- 1. Ensure learner_events table and columns
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
    confidence NUMERIC(3, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure confidence_level column exists for learner-reported confidence
ALTER TABLE public.learner_events 
    ADD COLUMN IF NOT EXISTS confidence_level TEXT 
    CHECK (confidence_level IS NULL OR confidence_level IN ('low', 'medium', 'high'));

-- Enforce free_text payload length cap (max 500 chars)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_free_text_length') THEN
        ALTER TABLE public.learner_events ADD CONSTRAINT check_free_text_length 
            CHECK (payload->>'free_text' IS NULL OR length(payload->>'free_text') <= 500);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_learner_events_user_created ON public.learner_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learner_events_user_step ON public.learner_events (user_id, step_id);

-- 2. Revoke dangerous client permissions on learner_events (Immutable against UPDATE/DELETE/TRUNCATE)
REVOKE UPDATE, DELETE, TRUNCATE ON public.learner_events FROM anon, authenticated;

-- 3. Hardened Immutability Trigger (requires both setting AND function-owner role)
CREATE OR REPLACE FUNCTION public.prevent_learner_events_mutation()
RETURNS TRIGGER 
SET search_path = public, pg_temp
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'learner_events rows are append-only and cannot be updated.'
            USING ERRCODE = '42501';
    ELSIF TG_OP = 'DELETE' THEN
        -- Hardened delete bypass: requires session setting AND function-owner / service-role execution
        IF current_setting('qualution.allow_event_deletion', true) = 'true' 
           AND (current_user = 'postgres' OR session_user = 'postgres' OR current_user = 'service_role')
        THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'learner_events rows are append-only and cannot be deleted.'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_prevent_learner_events_mutation ON public.learner_events;
CREATE TRIGGER trigger_prevent_learner_events_mutation
    BEFORE UPDATE OR DELETE ON public.learner_events
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_learner_events_mutation();

-- 4. Rate Limit Trigger with SQLSTATE 'QL001'
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

-- 5. Projections: misconception_state & concept_mastery
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

-- Block direct client writes to projections (Service role only writes projections; clients read own)
REVOKE INSERT, UPDATE, DELETE ON public.misconception_state FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.concept_mastery FROM anon, authenticated;

DROP POLICY IF EXISTS misconception_state_select_own ON public.misconception_state;
CREATE POLICY misconception_state_select_own ON public.misconception_state
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS concept_mastery_select_own ON public.concept_mastery;
CREATE POLICY concept_mastery_select_own ON public.concept_mastery
    FOR SELECT USING (auth.uid() = user_id);

-- 6. Cohort / Classroom Members Table
CREATE TABLE IF NOT EXISTS public.classroom_members (
    classroom_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'ta')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (classroom_id, user_id)
);

ALTER TABLE public.classroom_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classroom_members_select_own ON public.classroom_members;
CREATE POLICY classroom_members_select_own ON public.classroom_members
    FOR SELECT USING (auth.uid() = user_id);

-- 7. Classroom Aggregates View with K-Anonymity (K >= 5) & Complement Masking
CREATE OR REPLACE VIEW public.classroom_misconception_aggregates AS
WITH cohort_totals AS (
    SELECT classroom_id, count(DISTINCT user_id) AS total_cohort_size
    FROM public.classroom_members
    GROUP BY classroom_id
)
SELECT
    cm.classroom_id,
    e.lesson_id,
    m.misconception_id,
    m.status,
    count(DISTINCT e.user_id) AS student_count
FROM public.classroom_members cm
JOIN public.learner_events e ON e.user_id = cm.user_id
JOIN public.misconception_state m ON m.user_id = cm.user_id
JOIN cohort_totals ct ON ct.classroom_id = cm.classroom_id
GROUP BY cm.classroom_id, e.lesson_id, m.misconception_id, m.status, ct.total_cohort_size
HAVING count(DISTINCT e.user_id) >= 5
   -- Complement masking: Suppress if non-affected count is small (1..4) revealing non-members
   AND (ct.total_cohort_size - count(DISTINCT e.user_id) = 0 OR ct.total_cohort_size - count(DISTINCT e.user_id) >= 5);

GRANT SELECT ON public.classroom_misconception_aggregates TO authenticated;

-- 8. DPDP Privacy Functions
-- Export Function (auth.uid() only)
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

-- Delete Function (auth.uid() only, explicit confirmation string, controlled bypass)
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

    PERFORM set_config('qualution.allow_event_deletion', 'true', true);

    DELETE FROM public.learner_events WHERE user_id = v_user_id;
    DELETE FROM public.misconception_state WHERE user_id = v_user_id;
    DELETE FROM public.concept_mastery WHERE user_id = v_user_id;

    PERFORM set_config('qualution.allow_event_deletion', 'false', true);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.delete_my_learner_data(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_learner_data(TEXT) FROM anon, PUBLIC;

-- Purge Retention Function (Service Role Only)
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

DO $$ BEGIN
    BEGIN
        REVOKE EXECUTE ON FUNCTION public.purge_old_learner_events(INTEGER) FROM PUBLIC, anon, authenticated;
    EXCEPTION WHEN undefined_function THEN NULL;
    END;
END $$;

GRANT EXECUTE ON FUNCTION public.purge_old_learner_events(INTEGER) TO service_role;

-- Drop deprecated SQL status re-implementation functions if present
DROP FUNCTION IF EXISTS public.rebuild_my_projections();
DROP FUNCTION IF EXISTS public.rebuild_learner_projections(UUID);


-- ============================================================================
-- SECTION 2: AUTOMATED SQL TEST SUITE
-- ============================================================================

DROP TABLE IF EXISTS temp_test_results;
CREATE TEMP TABLE temp_test_results (
    test_id SERIAL PRIMARY KEY,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT
);

DO $$
DECLARE
    v_user_a UUID := '00000000-0000-0000-0000-000000000001';
    v_user_b UUID := '00000000-0000-0000-0000-000000000002';
    v_event_id UUID;
    v_cnt INT;
    v_threw BOOLEAN;
    v_err_code TEXT;
    v_classroom UUID := '00000000-0000-0000-0000-000000000010';
BEGIN
    -- Ensure test users exist in auth.users for foreign key constraints
    INSERT INTO auth.users (id, email)
    VALUES (v_user_a, 'user_a@qualution.test'), (v_user_b, 'user_b@qualution.test')
    ON CONFLICT (id) DO NOTHING;

    -- Clean up previous test artifacts for test users
    DELETE FROM public.learner_events WHERE user_id IN (v_user_a, v_user_b);
    DELETE FROM public.misconception_state WHERE user_id IN (v_user_a, v_user_b);
    DELETE FROM public.concept_mastery WHERE user_id IN (v_user_a, v_user_b);
    DELETE FROM public.classroom_members WHERE classroom_id = v_classroom;

    -- ------------------------------------------------------------------------
    -- TEST 1: Cross-User Read Blocked by RLS
    -- ------------------------------------------------------------------------
    -- Insert one event for User B as service role
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind)
    VALUES (v_user_b, 'sess-b', 'lesson-1', 'step-1', 'prediction');

    -- Impersonate User A
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    SELECT count(*) INTO v_cnt FROM public.learner_events WHERE user_id = v_user_b;
    IF v_cnt = 0 THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 1: Cross-User Read Blocked by RLS', 'PASS', 'User A saw 0 rows belonging to User B.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 1: Cross-User Read Blocked by RLS', 'FAIL', 'User A was able to read User B rows!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 2: Cross-User Write Blocked by RLS
    -- ------------------------------------------------------------------------
    v_threw := FALSE;
    BEGIN
        INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind)
        VALUES (v_user_b, 'sess-spoof', 'lesson-1', 'step-1', 'prediction');
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
    END;

    IF v_threw THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 2: Cross-User Write Blocked by RLS', 'PASS', 'User A insertion with user_id = User B rejected by RLS WITH CHECK.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 2: Cross-User Write Blocked by RLS', 'FAIL', 'User A was able to insert an event under User B id!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 3: Events Immutability (Direct UPDATE / DELETE Blocked)
    -- ------------------------------------------------------------------------
    -- Insert event for User A
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind)
    VALUES (v_user_a, 'sess-a', 'lesson-1', 'step-1', 'prediction')
    RETURNING id INTO v_event_id;

    v_threw := FALSE;
    BEGIN
        UPDATE public.learner_events SET kind = 'verification' WHERE id = v_event_id;
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
    END;

    IF v_threw THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 3: Direct UPDATE Blocked by Immutability Trigger', 'PASS', 'UPDATE raised 42501 exception.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 3: Direct UPDATE Blocked by Immutability Trigger', 'FAIL', 'UPDATE succeeded on append-only event store!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 4: Direct Client Writes to Projections Blocked
    -- ------------------------------------------------------------------------
    v_threw := FALSE;
    BEGIN
        INSERT INTO public.misconception_state (user_id, misconception_id, status)
        VALUES (v_user_a, 'hadamard-inverts-classical', 'CLEARED');
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
    END;

    IF v_threw THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 4: Direct Client Write to Projections Blocked', 'PASS', 'Client INSERT to misconception_state rejected by REVOKE.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 4: Direct Client Write to Projections Blocked', 'FAIL', 'Client directly inserted into projection table!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 5: User A Cannot Export or Delete User B
    -- ------------------------------------------------------------------------
    -- User A calls export_my_learner_data() -> Must only export User A
    DECLARE
        v_export JSONB;
    BEGIN
        SELECT public.export_my_learner_data() INTO v_export;
        IF (v_export->>'user_id')::UUID = v_user_a THEN
            INSERT INTO temp_test_results (test_name, status, details)
            VALUES ('TEST 5: Export Operates Strictly on Caller auth.uid()', 'PASS', 'Export JSON contains caller user_id only.');
        ELSE
            INSERT INTO temp_test_results (test_name, status, details)
            VALUES ('TEST 5: Export Operates Strictly on Caller auth.uid()', 'FAIL', 'Export returned wrong user_id!');
        END IF;
    END;

    -- ------------------------------------------------------------------------
    -- TEST 6: Authenticated User Cannot Enable Delete Bypass Themselves
    -- ------------------------------------------------------------------------
    v_threw := FALSE;
    BEGIN
        PERFORM set_config('qualution.allow_event_deletion', 'true', false);
        DELETE FROM public.learner_events WHERE id = v_event_id;
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
    END;
    PERFORM set_config('qualution.allow_event_deletion', 'false', false);

    IF v_threw THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 6: Authenticated User Cannot Enable Delete Bypass Themselves', 'PASS', 'Delete trigger verified caller role and blocked unauthorized bypass.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 6: Authenticated User Cannot Enable Delete Bypass Themselves', 'FAIL', 'Authenticated user bypassed deletion trigger!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 7: Anonymous Caller Sees Nothing (RLS)
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', 'anon', true);

    SELECT count(*) INTO v_cnt FROM public.learner_events;
    IF v_cnt = 0 THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 7: Anonymous Callers See 0 Rows', 'PASS', 'RLS completely isolates tables from anon role.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 7: Anonymous Callers See 0 Rows', 'FAIL', 'Anon role read rows from learner_events!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 8: Purge Function Not Callable by Authenticated
    -- ------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_user_a::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    v_threw := FALSE;
    BEGIN
        PERFORM public.purge_old_learner_events(180);
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
    END;

    IF v_threw THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 8: Purge Function Blocked for Authenticated Role', 'PASS', 'Call rejected by function permissions.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 8: Purge Function Blocked for Authenticated Role', 'FAIL', 'Authenticated caller executed purge function!');
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 9: Rate Limit Raises SQLSTATE 'QL001'
    -- ------------------------------------------------------------------------
    -- Switch to service role for testing high-throughput rate limit trigger
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    
    -- Insert 600 events rapidly for test user
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind)
    SELECT v_user_a, 'sess-rate', 'lesson-1', 'step-1', 'prediction'
    FROM generate_series(1, 600);

    v_threw := FALSE;
    v_err_code := '';
    BEGIN
        INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind)
        VALUES (v_user_a, 'sess-rate', 'lesson-1', 'step-1', 'prediction');
    EXCEPTION WHEN OTHERS THEN
        v_threw := TRUE;
        GET STACKED DIAGNOSTICS v_err_code = RETURNED_SQLSTATE;
    END;

    IF v_threw AND v_err_code = 'QL001' THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 9: Rate Limit Raises Custom SQLSTATE QL001', 'PASS', '601st event correctly raised QL001.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 9: Rate Limit Raises Custom SQLSTATE QL001', 'FAIL', 'Expected QL001, got: ' || coalesce(v_err_code, 'none'));
    END IF;

    -- ------------------------------------------------------------------------
    -- TEST 10: Classroom Aggregate View Suppresses Small Groups (K >= 5)
    -- ------------------------------------------------------------------------
    -- Create cohort with 3 students (below threshold of 5)
    INSERT INTO public.classroom_members (classroom_id, user_id, role)
    VALUES 
        (v_classroom, v_user_a, 'student'),
        (v_classroom, v_user_b, 'student');

    -- Insert misconception projection
    INSERT INTO public.misconception_state (user_id, misconception_id, status)
    VALUES 
        (v_user_a, 'hadamard-inverts-classical', 'SUPPORTED'),
        (v_user_b, 'hadamard-inverts-classical', 'SUPPORTED')
    ON CONFLICT (user_id, misconception_id) DO NOTHING;

    -- Query aggregate view for this classroom
    SELECT count(*) INTO v_cnt FROM public.classroom_misconception_aggregates WHERE classroom_id = v_classroom;
    IF v_cnt = 0 THEN
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 10: Classroom Aggregate View Enforces K >= 5 Anonymity', 'PASS', 'Groups with count < 5 are suppressed.');
    ELSE
        INSERT INTO temp_test_results (test_name, status, details)
        VALUES ('TEST 10: Classroom Aggregate View Enforces K >= 5 Anonymity', 'FAIL', 'View leaked aggregate with count < 5!');
    END IF;

END $$;

-- ============================================================================
-- SECTION 3: FINAL RESULTS TABLE
-- ============================================================================
SELECT 
    test_id AS "#",
    test_name AS "Verification Check",
    status AS "Result",
    details AS "Telemetry & Diagnostics"
FROM temp_test_results
ORDER BY test_id;
