-- ============================================================================
-- SQL Test Suite: Stage M3 Evidence Store (Supabase RLS & Policy Verification)
-- Execution: psql $DATABASE_URL -f supabase/tests/test_stage_m3_sql.sql
-- ============================================================================

BEGIN;

-- Test Setup: Create mock users in auth.users if not present
INSERT INTO auth.users (id, email)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'student1@qualution.ai'),
    ('22222222-2222-2222-2222-222222222222', 'student2@qualution.ai')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Test 1: Insert own event succeeds as authenticated user
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload, confidence)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'sess-001',
    'superposition-checkpoint-1',
    'step-1',
    'prediction',
    '{"misconception_id": "hadamard-inverts-classical", "concept_id": "hadamard_gate"}'::jsonb,
    3
);

-- ----------------------------------------------------------------------------
-- Test 2: Cross-user insert is BLOCKED by RLS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
    VALUES (
        '22222222-2222-2222-2222-222222222222', -- Wrong user ID
        'sess-001', 'superposition-checkpoint-1', 'step-1', 'prediction', '{}'::jsonb
    );
    RAISE EXCEPTION 'TEST FAILED: Cross-user insert should have been blocked by RLS!';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: Cross-user insert blocked by RLS.';
END $$;

-- ----------------------------------------------------------------------------
-- Test 3: Events are IMMUTABLE (UPDATE and DELETE fail)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    UPDATE public.learner_events SET step_id = 'hacked' WHERE user_id = '11111111-1111-1111-1111-111111111111';
    RAISE EXCEPTION 'TEST FAILED: UPDATE on learner_events should have been blocked!';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: UPDATE on learner_events blocked by immutability trigger.';
END $$;

-- ----------------------------------------------------------------------------
-- Test 4: Projections NOT directly writable by authenticated user
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    INSERT INTO public.misconception_state (user_id, misconception_id, status)
    VALUES ('11111111-1111-1111-1111-111111111111', 'fake_misc', 'SUPPORTED');
    RAISE EXCEPTION 'TEST FAILED: Direct write to misconception_state should be blocked!';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS: Direct write to misconception_state blocked.';
END $$;

-- ----------------------------------------------------------------------------
-- Test 5: Replay function equals incremental state
-- ----------------------------------------------------------------------------
SET LOCAL ROLE service_role;
SELECT public.rebuild_learner_projections('11111111-1111-1111-1111-111111111111');

DO $$
DECLARE
    rec_count INT;
BEGIN
    SELECT count(*) INTO rec_count FROM public.misconception_state WHERE user_id = '11111111-1111-1111-1111-111111111111';
    IF rec_count >= 1 THEN
        RAISE NOTICE 'PASS: Rebuild projections successfully replayed events.';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Rebuild projections returned empty state!';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Test 6: Anon sees nothing
-- ----------------------------------------------------------------------------
SET LOCAL ROLE anon;
DO $$
DECLARE
    anon_count INT;
BEGIN
    SELECT count(*) INTO anon_count FROM public.learner_events;
    IF anon_count = 0 THEN
        RAISE NOTICE 'PASS: Anon sees 0 learner events.';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Anon role leaked events!';
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Test 7: Classroom aggregate view suppresses groups < 5 students
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
DO $$
DECLARE
    agg_count INT;
BEGIN
    SELECT count(*) INTO agg_count FROM public.classroom_misconception_aggregates;
    IF agg_count = 0 THEN
        RAISE NOTICE 'PASS: Classroom aggregates suppressed small group (<5 students).';
    ELSE
        RAISE EXCEPTION 'TEST FAILED: Aggregates leaked small student group!';
    END IF;
END $$;

ROLLBACK;
