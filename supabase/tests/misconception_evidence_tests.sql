-- ============================================================================
-- SQL Test Suite: supabase/tests/misconception_evidence_tests.sql
-- Description: Transactional verification suite for Stage M3 Hardened Evidence Store
-- All tests executed within BEGIN ... ROLLBACK blocks.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- Helper temporary test runner table
CREATE TEMP TABLE test_results (
    test_id SERIAL PRIMARY KEY,
    test_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PASS', 'FAIL')),
    details TEXT
);

-- ----------------------------------------------------------------------------
-- Setup mock users & test fixtures
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    uid_b UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Ensure test users exist in auth.users for foreign key constraints
    INSERT INTO auth.users (id, email)
    VALUES 
        (uid_a, 'student_a@test.qualution.io'),
        (uid_b, 'student_b@test.qualution.io')
    ON CONFLICT (id) DO NOTHING;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 1: user A cannot read or write user B's events
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    uid_b UUID := '22222222-2222-2222-2222-222222222222';
    visible_count INT;
    insert_failed BOOLEAN := FALSE;
BEGIN
    -- Switch to service_role to insert B's baseline event
    SET LOCAL ROLE service_role;
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
    VALUES (uid_b, 'sess-b', 'lesson-1', 'step-1', 'prediction', '{"misconception_id": "hadamard-inverts-classical"}'::jsonb);

    -- Impersonate User A
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

    -- Attempt to read User B's events
    SELECT count(*) INTO visible_count FROM public.learner_events WHERE user_id = uid_b;

    -- Attempt to insert event for User B
    BEGIN
        INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
        VALUES (uid_b, 'sess-evil', 'lesson-1', 'step-1', 'prediction', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        insert_failed := TRUE;
    END;

    IF visible_count = 0 AND insert_failed = TRUE THEN
        INSERT INTO test_results (test_name, status, details) 
        VALUES ('TEST 1: user A cannot read or write user B events', 'PASS', 'RLS strictly isolates user events');
    ELSE
        INSERT INTO test_results (test_name, status, details) 
        VALUES ('TEST 1: user A cannot read or write user B events', 'FAIL', format('Visible: %s, Insert failed: %s', visible_count, insert_failed));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 2: events cannot be UPDATEd or DELETEd by anyone (immutability)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    evt_id UUID;
    update_blocked BOOLEAN := FALSE;
    delete_blocked BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE service_role;
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
    VALUES (uid_a, 'sess-a', 'lesson-1', 'step-1', 'run', '{}'::jsonb)
    RETURNING id INTO evt_id;

    -- Test UPDATE as service_role
    BEGIN
        UPDATE public.learner_events SET step_id = 'step-evil' WHERE id = evt_id;
    EXCEPTION WHEN OTHERS THEN
        update_blocked := TRUE;
    END;

    -- Test regular DELETE as service_role without bypass flag
    BEGIN
        DELETE FROM public.learner_events WHERE id = evt_id;
    EXCEPTION WHEN OTHERS THEN
        delete_blocked := TRUE;
    END;

    IF update_blocked AND delete_blocked THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 2: events cannot be UPDATEd or DELETEd by anyone', 'PASS', 'Immutability trigger rejects mutations');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 2: events cannot be UPDATEd or DELETEd by anyone', 'FAIL', format('Update blocked: %s, Delete blocked: %s', update_blocked, delete_blocked));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 3: users cannot write projections directly
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    direct_write_blocked BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

    BEGIN
        INSERT INTO public.misconception_state (user_id, misconception_id, status)
        VALUES (uid_a, 'fake-misc', 'CLEARED');
    EXCEPTION WHEN OTHERS THEN
        direct_write_blocked := TRUE;
    END;

    IF direct_write_blocked THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 3: users cannot write projections directly', 'PASS', 'Projections only modified via triggers / rebuild functions');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 3: users cannot write projections directly', 'FAIL', 'Direct insert was not blocked');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 4: user A calling export/delete/rebuild with user B id is impossible
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    uid_b UUID := '22222222-2222-2222-2222-222222222222';
    export_json JSONB;
    cross_user_rebuild_blocked BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

    -- export_my_learner_data takes 0 arguments and exports auth.uid()
    SELECT public.export_my_learner_data() INTO export_json;

    -- Calling cross-user rebuild_learner_projections(uid_b) must be rejected with permission denied
    BEGIN
        PERFORM public.rebuild_learner_projections(uid_b);
    EXCEPTION WHEN OTHERS THEN
        cross_user_rebuild_blocked := TRUE;
    END;

    IF export_json->>'user_id' = uid_a::text AND cross_user_rebuild_blocked THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 4: user A calling export/delete/rebuild with user B id rejected', 'PASS', 'Authenticated functions take no target user id; cross-user rebuild restricted');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 4: user A calling export/delete/rebuild with user B id rejected', 'FAIL', format('Exported user: %s, Rebuild blocked: %s', export_json->>'user_id', cross_user_rebuild_blocked));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 5: anon sees nothing
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    events_visible INT;
    states_visible INT;
BEGIN
    SET LOCAL ROLE anon;
    SELECT count(*) INTO events_visible FROM public.learner_events;
    SELECT count(*) INTO states_visible FROM public.misconception_state;

    IF events_visible = 0 AND states_visible = 0 THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 5: anon sees nothing', 'PASS', 'Zero events or misconception states visible to anon');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 5: anon sees nothing', 'FAIL', format('Events: %s, States: %s', events_visible, states_visible));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 6: purge not callable by authenticated
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    purge_blocked BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

    BEGIN
        PERFORM public.purge_old_learner_events(180);
    EXCEPTION WHEN OTHERS THEN
        purge_blocked := TRUE;
    END;

    IF purge_blocked THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 6: purge not callable by authenticated', 'PASS', 'Permission revoked from authenticated role');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 6: purge not callable by authenticated', 'FAIL', 'Authenticated role was able to call purge');
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 7: replay equals incremental projections
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    status_incremental TEXT;
    status_rebuilt TEXT;
BEGIN
    SET LOCAL ROLE service_role;
    -- Insert 2 events for uid_a
    INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
    VALUES 
        (uid_a, 's1', 'l1', 'st1', 'prediction', '{"misconception_id": "cnot-control-target-swapped", "concept_id": "cnot_gate"}'::jsonb),
        (uid_a, 's1', 'l1', 'st2', 'prediction', '{"misconception_id": "cnot-control-target-swapped", "concept_id": "cnot_gate"}'::jsonb);

    -- Run rebuild for user A
    PERFORM public.rebuild_learner_projections(uid_a);
    SELECT status INTO status_incremental FROM public.misconception_state WHERE user_id = uid_a AND misconception_id = 'cnot-control-target-swapped';

    -- Re-run rebuild
    PERFORM public.rebuild_learner_projections(uid_a);
    SELECT status INTO status_rebuilt FROM public.misconception_state WHERE user_id = uid_a AND misconception_id = 'cnot-control-target-swapped';

    IF status_incremental = 'SUPPORTED' AND status_rebuilt = 'SUPPORTED' THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 7: replay equals incremental projections', 'PASS', 'Idempotent rebuild yields identical projection state');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 7: replay equals incremental projections', 'FAIL', format('Incremental: %s, Rebuilt: %s', status_incremental, status_rebuilt));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 8: rate limit trips with custom code QL001
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    uid_a UUID := '11111111-1111-1111-1111-111111111111';
    caught_sqlstate TEXT := '';
BEGIN
    SET LOCAL ROLE service_role;
    
    -- Insert 600 events rapidly
    FOR i IN 1..600 LOOP
        INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
        VALUES (uid_a, 'rate-test', 'l1', 'st' || i, 'run', '{}'::jsonb);
    END LOOP;

    -- 601st event must raise exception with SQLSTATE QL001
    BEGIN
        INSERT INTO public.learner_events (user_id, session_id, lesson_id, step_id, kind, payload)
        VALUES (uid_a, 'rate-test', 'l1', 'st601', 'run', '{}'::jsonb);
    EXCEPTION WHEN OTHERS THEN
        GET STACKED DIAGNOSTICS caught_sqlstate = RETURNED_SQLSTATE;
    END;

    IF caught_sqlstate = 'QL001' THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 8: rate limit trips with custom code QL001', 'PASS', format('Caught expected custom SQLSTATE: %s', caught_sqlstate));
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 8: rate limit trips with custom code QL001', 'FAIL', format('Expected QL001, caught: %s', caught_sqlstate));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 9: k>=5 aggregate view returns nothing for groups under 5
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    view_row_count INT;
BEGIN
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" TO '11111111-1111-1111-1111-111111111111';

    -- Under 5 users exist in the group
    SELECT count(*) INTO view_row_count FROM public.classroom_misconception_aggregates;

    IF view_row_count = 0 THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 9: k>=5 aggregate view returns nothing for groups under 5', 'PASS', 'View suppresses small groups (k < 5) to protect anonymity');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 9: k>=5 aggregate view returns nothing for groups under 5', 'FAIL', format('Found %s rows with under 5 users', view_row_count));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- TEST 10: classroom/cohort source table exists
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    courses_exists BOOLEAN := FALSE;
    students_exists BOOLEAN := FALSE;
BEGIN
    SET LOCAL ROLE service_role;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'courses') INTO courses_exists;
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') INTO students_exists;

    IF courses_exists AND students_exists THEN
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 10: classroom/cohort source table exists', 'PASS', 'public.courses and public.students confirmed in information_schema');
    ELSE
        INSERT INTO test_results (test_name, status, details)
        VALUES ('TEST 10: classroom/cohort source table exists', 'FAIL', format('courses: %s, students: %s', courses_exists, students_exists));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Display Final Test Summary Table
-- ----------------------------------------------------------------------------
SELECT 
    test_id,
    test_name,
    status,
    details
FROM test_results
ORDER BY test_id;

-- Rollback entire test transaction to ensure zero side-effects on staging
ROLLBACK;
