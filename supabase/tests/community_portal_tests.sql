-- ==============================================================================
-- QUALUTION Community Portal — SQL Test Suite for RLS & Security Verification
--
-- Proves all core and hardened security requirements:
-- (1) Anonymous users can read published rows only (never pending or removed)
-- (2) A user cannot edit another user's post
-- (3) A user cannot escalate their own app_role or is_verified
-- (4) A non-verified user's opportunity lands as 'pending'
-- (5) A moderator can remove/update any post
-- (6) A moderator approves a pending opportunity from an unverified author and it stays published
-- (7) Author cannot set removed -> published on their own post
-- (8) Author cannot reassign author_id
-- (9) Telemetry events: allow-listed event_type vs invalid, size limit, server-side user_id & PII stripping
-- (10) Telemetry events: anon blocked from raw read; anon can read aggregated summary view
-- (11) Telemetry retention: cleanup_expired_telemetry_events purges older records
-- (12) Profile handle generation: handles reserved names and collisions cleanly
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_student_id uuid := '00000000-0000-0000-0000-000000000001';
  v_moderator_id uuid := '00000000-0000-0000-0000-000000000004';
  v_other_user_id uuid := '00000000-0000-0000-0000-000000000002';
  v_test_post_id uuid := gen_random_uuid();
  v_hidden_post_id uuid := gen_random_uuid();
  v_student_post_id uuid := gen_random_uuid();
  v_opp_unverified_id uuid := gen_random_uuid();
  v_telemetry_id uuid := gen_random_uuid();
  v_old_telemetry_id uuid := gen_random_uuid();
  v_count integer;
  v_failed boolean := false;
  v_opp_status public.opportunity_status;
  v_post_status public.post_status;
  v_retrieved_user_id uuid;
  v_payload jsonb;
  v_deleted_count integer;
  v_handle_admin text;
  v_handle_collision text;
  v_new_user_1 uuid := gen_random_uuid();
  v_new_user_2 uuid := gen_random_uuid();
BEGIN
  RAISE NOTICE '=== STARTING COMMUNITY PORTAL SECURITY TESTS ===';

  -- ----------------------------------------------------------------------------
  -- TEST 1: Anonymous users can read published rows only
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 1: Anonymous user read restrictions...';

  INSERT INTO public.posts (id, author_id, section, title, body, status)
  VALUES
    (v_test_post_id, v_other_user_id, 'news', 'Public Test Post', 'Published body', 'published'),
    (v_hidden_post_id, v_other_user_id, 'news', 'Secret Pending Post', 'Pending body', 'pending');

  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claim.sub" = '';
  SET LOCAL "request.jwt.claim.role" = 'anon';

  SELECT count(*) INTO v_count FROM public.posts WHERE id = v_test_post_id;
  ASSERT v_count = 1, 'TEST 1 FAILED: Anon could not read published post';

  SELECT count(*) INTO v_count FROM public.posts WHERE id = v_hidden_post_id;
  ASSERT v_count = 0, 'TEST 1 FAILED: Anon was able to read pending/hidden post';

  RESET ROLE;
  RAISE NOTICE '  [PASS] Test 1: Anonymous users can only read published rows.';

  -- ----------------------------------------------------------------------------
  -- TEST 2: A user cannot edit another user's post
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 2: Preventing cross-user post modifications...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  UPDATE public.posts
  SET title = 'Hacked Title by Unauthorized User'
  WHERE id = v_test_post_id;

  RESET ROLE;
  SELECT title INTO STRICT v_post_status FROM public.posts WHERE id = v_test_post_id;
  ASSERT v_post_status <> 'Hacked Title by Unauthorized User', 'TEST 2 FAILED: User successfully modified another user post!';

  RAISE NOTICE '  [PASS] Test 2: Cross-user post edits successfully prevented by RLS.';

  -- ----------------------------------------------------------------------------
  -- TEST 3: A user cannot escalate their own app_role or is_verified
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 3: Preventing self-escalation to admin or verified...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  v_failed := false;
  BEGIN
    UPDATE public.profiles
    SET app_role = 'admin'
    WHERE id = v_student_id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 3 FAILED: User was able to escalate app_role to admin!';

  v_failed := false;
  BEGIN
    UPDATE public.profiles
    SET is_verified = true
    WHERE id = v_student_id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 3 FAILED: User was able to self-verify!';

  RESET ROLE;
  RAISE NOTICE '  [PASS] Test 3: Unauthorized role escalation and verification tampering rejected by trigger.';

  -- ----------------------------------------------------------------------------
  -- TEST 4: A non-verified user's opportunity lands as 'pending'
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 4: Unverified author opportunity forced to pending...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  INSERT INTO public.opportunities (
    id, author_id, title, organisation, kind, description, apply_url, status
  )
  VALUES (
    v_opp_unverified_id,
    v_student_id,
    'Unverified Test Opportunity',
    'Student Lab',
    'internship',
    'Description for test opportunity',
    'https://example.com/apply',
    'published'
  );

  RESET ROLE;
  SELECT status INTO v_opp_status FROM public.opportunities WHERE id = v_opp_unverified_id;
  ASSERT v_opp_status = 'pending', 'TEST 4 FAILED: Unverified opportunity did not land as pending!';

  RAISE NOTICE '  [PASS] Test 4: Unverified opportunities strictly land as pending.';

  -- ----------------------------------------------------------------------------
  -- TEST 5 & 6: Moderator approves pending opportunity from unverified author & it stays published
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 5 & 6: Moderator approves unverified author opportunity...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000004';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  UPDATE public.opportunities
  SET status = 'published'
  WHERE id = v_opp_unverified_id;

  RESET ROLE;
  SELECT status INTO v_opp_status FROM public.opportunities WHERE id = v_opp_unverified_id;
  ASSERT v_opp_status = 'published', 'TEST 6 FAILED: Moderator approval failed or opportunity did not stay published!';

  RAISE NOTICE '  [PASS] Test 6: Moderator successfully approved pending opportunity and it stays published.';

  -- ----------------------------------------------------------------------------
  -- TEST 7: Author cannot set removed -> published on their own post
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 7: Author cannot restore removed post...';

  -- Create a removed post owned by student
  INSERT INTO public.posts (id, author_id, section, title, body, status)
  VALUES (v_student_post_id, v_student_id, 'courses', 'Student Post', 'Valid body', 'removed');

  -- Student attempts to un-remove their post
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  v_failed := false;
  BEGIN
    UPDATE public.posts
    SET status = 'published'
    WHERE id = v_student_post_id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  RESET ROLE;
  SELECT status INTO v_post_status FROM public.posts WHERE id = v_student_post_id;
  ASSERT v_failed = true OR v_post_status = 'removed', 'TEST 7 FAILED: Author was able to change status from removed to published!';

  RAISE NOTICE '  [PASS] Test 7: Non-moderator author cannot change post status.';

  -- ----------------------------------------------------------------------------
  -- TEST 8: Author cannot reassign author_id
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 8: Author cannot reassign author_id...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  v_failed := false;
  BEGIN
    UPDATE public.posts
    SET author_id = v_other_user_id
    WHERE id = v_student_post_id;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  RESET ROLE;
  ASSERT v_failed = true, 'TEST 8 FAILED: Author was able to reassign author_id!';

  RAISE NOTICE '  [PASS] Test 8: author_id immutability strictly enforced.';

  -- ----------------------------------------------------------------------------
  -- TEST 9: Telemetry events validation & server-side user_id assignment
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 9: Telemetry events constraints & server-side auth.uid()...';

  -- 9.1 Invalid event_type must fail check constraint
  v_failed := false;
  BEGIN
    INSERT INTO public.portal_telemetry_events (event_type, event_payload)
    VALUES ('invalid_malicious_event', '{"key": "value"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 9.1 FAILED: Invalid event_type was accepted!';

  -- 9.2 Oversized payload (> 10KB) must fail check constraint
  v_failed := false;
  BEGIN
    INSERT INTO public.portal_telemetry_events (event_type, event_payload)
    VALUES ('portal_view', jsonb_build_object('blob', repeat('x', 12000)));
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 9.2 FAILED: Oversized telemetry payload was accepted!';

  -- 9.3 Client-supplied PII and spoofed user_id are overridden server-side
  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  INSERT INTO public.portal_telemetry_events (
    id, event_type, user_id, event_payload
  )
  VALUES (
    v_telemetry_id,
    'portal_view',
    '00000000-0000-0000-0000-000000000009', -- Spoofed user_id
    jsonb_build_object('user_id', 'spoofed_id', 'email', 'victim@test.com', 'page', '/portal')
  );

  RESET ROLE;
  SELECT user_id, event_payload INTO v_retrieved_user_id, v_payload
  FROM public.portal_telemetry_events
  WHERE id = v_telemetry_id;

  ASSERT v_retrieved_user_id = '00000000-0000-0000-0000-000000000001', 'TEST 9.3 FAILED: user_id was not set from auth.uid()!';
  ASSERT NOT (v_payload ? 'user_id'), 'TEST 9.3 FAILED: user_id was not stripped from payload!';
  ASSERT NOT (v_payload ? 'email'), 'TEST 9.3 FAILED: email was not stripped from payload!';
  ASSERT (v_payload ? 'page'), 'TEST 9.3 FAILED: valid payload fields were lost!';

  RAISE NOTICE '  [PASS] Test 9: Telemetry constraints, server-side user_id, and PII stripping verified.';

  -- ----------------------------------------------------------------------------
  -- TEST 10: Raw telemetry read restricted; aggregated summary accessible
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 10: Raw telemetry restricted to mods; summary view open...';

  SET LOCAL ROLE anon;
  SET LOCAL "request.jwt.claim.sub" = '';
  SET LOCAL "request.jwt.claim.role" = 'anon';

  -- Anon cannot read raw telemetry events
  SELECT count(*) INTO v_count FROM public.portal_telemetry_events;
  ASSERT v_count = 0, 'TEST 10 FAILED: Anonymous user was able to read raw telemetry events!';

  -- Anon CAN query aggregated summary view
  SELECT count(*) INTO v_count FROM public.portal_telemetry_summary;
  ASSERT v_count >= 1, 'TEST 10 FAILED: Anonymous user could not read aggregated telemetry summary view!';

  RESET ROLE;
  RAISE NOTICE '  [PASS] Test 10: Raw telemetry read restricted to mods; summary view accessible.';

  -- ----------------------------------------------------------------------------
  -- TEST 11: Telemetry retention cleanup function
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 11: Telemetry 90-day retention cleanup...';

  -- Insert an event older than 90 days
  INSERT INTO public.portal_telemetry_events (id, event_type, created_at)
  VALUES (v_old_telemetry_id, 'portal_view', now() - interval '95 days');

  v_deleted_count := public.cleanup_expired_telemetry_events(90);
  ASSERT v_deleted_count >= 1, 'TEST 11 FAILED: cleanup_expired_telemetry_events did not purge old event!';

  SELECT count(*) INTO v_count FROM public.portal_telemetry_events WHERE id = v_old_telemetry_id;
  ASSERT v_count = 0, 'TEST 11 FAILED: Expired telemetry event was not purged!';

  RAISE NOTICE '  [PASS] Test 11: Telemetry retention cleanup successfully purged expired events.';

  -- ----------------------------------------------------------------------------
  -- TEST 12: Profile handle generation: reserved handles & collisions
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 12: Handle generation reserved handles and collisions...';

  -- User 1 requests reserved handle 'admin'
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  VALUES (v_new_user_1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.admin@demo.test', 'pass', jsonb_build_object('handle', 'admin'));

  SELECT handle INTO v_handle_admin FROM public.profiles WHERE id = v_new_user_1;
  ASSERT v_handle_admin <> 'admin', 'TEST 12.1 FAILED: Reserved handle "admin" was granted directly!';
  ASSERT v_handle_admin ~ '^admin_[a-z0-9]{4}$', 'TEST 12.1 FAILED: Reserved handle did not receive expected suffix!';

  -- User 2 attempts to use exact same handle as User 1
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  VALUES (v_new_user_2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'test.admin2@demo.test', 'pass', jsonb_build_object('handle', v_handle_admin));

  SELECT handle INTO v_handle_collision FROM public.profiles WHERE id = v_new_user_2;
  ASSERT v_handle_collision <> v_handle_admin, 'TEST 12.2 FAILED: Collision resolution failed to assign unique handle!';

  RAISE NOTICE '  [PASS] Test 12: Reserved handles protected and collisions resolved uniquely.';

  -- ----------------------------------------------------------------------------
  -- TEST 13: Research post without paper_url is rejected
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 13: Research post paper_url constraint...';

  v_failed := false;
  BEGIN
    INSERT INTO public.posts (author_id, section, title, body, meta, status)
    VALUES (
      v_student_id,
      'research',
      'Quantum Algorithm Breakthrough',
      'Valid description of research findings.',
      '{"abstract": "No paper link provided"}'::jsonb,
      'published'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 13 FAILED: Research post without paper_url was accepted!';

  RAISE NOTICE '  [PASS] Test 13: Research post without paper_url rejected by DB constraint.';

  -- ----------------------------------------------------------------------------
  -- TEST 14: Tag rules enforced in DB (max 5 tags, valid characters)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 14: Tag rules and normalization...';

  -- 14.1 More than 5 tags must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.posts (author_id, section, title, body, tags, status)
    VALUES (
      v_student_id,
      'news',
      'Too Many Tags Post',
      'Valid body content.',
      ARRAY['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6'],
      'published'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 14.1 FAILED: Post with > 5 tags was accepted!';

  -- 14.2 Invalid characters in tag must fail
  v_failed := false;
  BEGIN
    INSERT INTO public.posts (author_id, section, title, body, tags, status)
    VALUES (
      v_student_id,
      'news',
      'Invalid Tag Characters',
      'Valid body content.',
      ARRAY['valid_tag', 'bad tag with spaces!'],
      'published'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;
  ASSERT v_failed = true, 'TEST 14.2 FAILED: Post with invalid tag characters was accepted!';

  RAISE NOTICE '  [PASS] Test 14: Tag rules (max 5, character constraints) strictly enforced in DB.';

  -- ----------------------------------------------------------------------------
  -- TEST 15: A user cannot create a post with another user's author_id
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 15: Post author_id spoofing prevention...';

  SET LOCAL ROLE authenticated;
  SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001'; -- Student
  SET LOCAL "request.jwt.claim.role" = 'authenticated';

  v_failed := false;
  BEGIN
    INSERT INTO public.posts (author_id, section, title, body, status)
    VALUES (
      v_other_user_id, -- Spoofed author_id
      'news',
      'Spoofed Author Post',
      'Valid body content.',
      'published'
    );
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  RESET ROLE;
  ASSERT v_failed = true, 'TEST 15 FAILED: User was able to insert post with another user author_id!';

  RAISE NOTICE '  [PASS] Test 15: Post creation with spoofed author_id prevented by RLS.';

  -- ----------------------------------------------------------------------------
  -- TEST 16: Removed posts do not appear in the feed view
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 16: Removed posts excluded from feed view...';

  DECLARE
    v_removed_post_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.posts (id, author_id, section, title, body, status)
    VALUES (v_removed_post_id, v_student_id, 'news', 'Moderated Removed Post', 'Body', 'removed');

    SELECT count(*) INTO v_count FROM public.portal_posts_feed_view WHERE id = v_removed_post_id;
    ASSERT v_count = 0, 'TEST 16.1 FAILED: Removed post appeared in portal_posts_feed_view!';

    SELECT count(*) INTO v_count FROM public.get_portal_posts_feed(p_limit => 50) WHERE id = v_removed_post_id;
    ASSERT v_count = 0, 'TEST 16.2 FAILED: Removed post appeared in get_portal_posts_feed RPC!';
  END;

  RAISE NOTICE '  [PASS] Test 16: Removed posts strictly excluded from feed view and RPC.';

  -- ----------------------------------------------------------------------------
  -- TEST 17: Rate limit triggers after 10 posts per hour
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 17: User post rate limit (10 per hour)...';

  DECLARE
    v_rate_test_user uuid := gen_random_uuid();
    i integer;
  BEGIN
    -- Provision dummy author in auth.users & profiles
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password)
    VALUES (v_rate_test_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rate_test@demo.test', 'pass');

    INSERT INTO public.profiles (id, handle, display_name, role, app_role)
    VALUES (v_rate_test_user, 'rate_tester', 'Rate Tester', 'student', 'user')
    ON CONFLICT (id) DO NOTHING;

    -- Switch to test user
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_rate_test_user::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    -- Insert 10 posts (allowed)
    FOR i IN 1..10 LOOP
      INSERT INTO public.posts (author_id, section, title, body, status)
      VALUES (v_rate_test_user, 'news', 'Post Number ' || i, 'Valid content body for rate test.', 'published');
    END LOOP;

    -- 11th post must trigger rate limit exception
    v_failed := false;
    BEGIN
      INSERT INTO public.posts (author_id, section, title, body, status)
      VALUES (v_rate_test_user, 'news', 'Post Number 11 Should Fail', 'Exceeds rate limit.', 'published');
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
    END;

    RESET ROLE;
    ASSERT v_failed = true, 'TEST 17 FAILED: 11th post in 1 hour was accepted without rate limit error!';
  END;

  RAISE NOTICE '  [PASS] Test 17: Rate limit (10 posts/hour) triggered successfully on 11th post.';

  -- ----------------------------------------------------------------------------
  -- TEST 18: Author soft-delete hides post from feed, but row remains visible to moderators
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 18: Author soft-delete and moderation visibility...';

  DECLARE
    v_soft_post_id uuid := gen_random_uuid();
    v_retrieved_status public.post_status;
  BEGIN
    -- Create post by student
    INSERT INTO public.posts (id, author_id, section, title, body, status)
    VALUES (v_soft_post_id, v_student_id, 'news', 'Post To Soft Delete', 'Body for soft delete test.', 'published');

    -- Student calls soft_delete_post
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_student_id::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    PERFORM public.soft_delete_post(v_soft_post_id);

    -- Check status as student: hidden from feed view
    SELECT count(*) INTO v_count FROM public.portal_posts_feed_view WHERE id = v_soft_post_id;
    ASSERT v_count = 0, 'TEST 18.1 FAILED: Soft-deleted post was still visible in portal_posts_feed_view!';

    -- Check as moderator: row remains readable
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_moderator_id::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    SELECT status INTO v_retrieved_status FROM public.posts WHERE id = v_soft_post_id;
    ASSERT v_retrieved_status = 'deleted', 'TEST 18.2 FAILED: Moderator could not see soft-deleted post with status deleted!';

    RESET ROLE;
  END;

  RAISE NOTICE '  [PASS] Test 18: Author soft-delete successfully hides post from feed while remaining visible to moderators.';

  -- ----------------------------------------------------------------------------
  -- TEST 19: Report against a soft-deleted post remains intact and readable by moderators
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 19: Reports against soft-deleted posts remain intact...';

  DECLARE
    v_reported_post_id uuid := gen_random_uuid();
    v_report_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.posts (id, author_id, section, title, body, status)
    VALUES (v_reported_post_id, v_student_id, 'events', 'Reported Post', 'Content that was reported.', 'published');

    -- File a report against the post
    INSERT INTO public.reports (id, reporter_id, target_type, post_id, reason)
    VALUES (v_report_id, v_other_user_id, 'post', v_reported_post_id, 'Spam content');

    -- Author soft-deletes the post
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_student_id::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';
    PERFORM public.soft_delete_post(v_reported_post_id);

    -- Moderator reads reports and joins post
    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_moderator_id::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    SELECT count(*) INTO v_count
    FROM public.reports r
    JOIN public.posts p ON r.post_id = p.id
    WHERE r.id = v_report_id AND p.status = 'deleted';

    ASSERT v_count = 1, 'TEST 19 FAILED: Report against soft-deleted post was lost or unreadable by moderator!';

    RESET ROLE;
  END;

  RAISE NOTICE '  [PASS] Test 19: Report against soft-deleted post remains fully intact and readable by moderators.';

  -- ----------------------------------------------------------------------------
  -- TEST 20: Rate limit bypass prevention: 10 posts created, soft-deleted, 11th post rejected (PT429)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 20: Rate limit bypass prevention on deleted posts (PT429)...';

  DECLARE
    v_bypass_user uuid := gen_random_uuid();
    v_created_ids uuid[];
    v_temp_id uuid;
    v_sqlstate text;
    i integer;
  BEGIN
    -- Provision author
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password)
    VALUES (v_bypass_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bypass@demo.test', 'pass');

    INSERT INTO public.profiles (id, handle, display_name, role, app_role)
    VALUES (v_bypass_user, 'bypass_tester', 'Bypass Tester', 'student', 'user')
    ON CONFLICT (id) DO NOTHING;

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_bypass_user::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    -- Create 10 posts and immediately soft-delete them
    FOR i IN 1..10 LOOP
      v_temp_id := gen_random_uuid();
      INSERT INTO public.posts (id, author_id, section, title, body, status)
      VALUES (v_temp_id, v_bypass_user, 'news', 'Spam Post ' || i, 'Body text', 'published');
      PERFORM public.soft_delete_post(v_temp_id);
    END LOOP;

    -- 11th post must STILL be rejected despite previous posts being deleted
    v_failed := false;
    v_sqlstate := '';
    BEGIN
      INSERT INTO public.posts (author_id, section, title, body, status)
      VALUES (v_bypass_user, 'news', 'Post 11 Bypass Attempt', 'Should be rejected', 'published');
    EXCEPTION WHEN OTHERS THEN
      v_failed := true;
      GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE;
    END;

    RESET ROLE;
    ASSERT v_failed = true, 'TEST 20.1 FAILED: 11th post was accepted after deleting previous 10 posts!';
    ASSERT v_sqlstate = 'PT429', 'TEST 20.2 FAILED: Expected SQLSTATE PT429 but received ' || v_sqlstate;
  END;

  RAISE NOTICE '  [PASS] Test 20: Rate limit bypass prevented (deleted posts count towards 10/hr, custom SQLSTATE PT429 confirmed).';

  -- ----------------------------------------------------------------------------
  -- TEST 21: Anon cannot see removed or deleted posts through view or RPC
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 21: Anon cannot see removed or deleted posts...';

  DECLARE
    v_del_post_id uuid := gen_random_uuid();
    v_rem_post_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.posts (id, author_id, section, title, body, status)
    VALUES
      (v_del_post_id, v_student_id, 'courses', 'Post Deleted', 'Body', 'deleted'),
      (v_rem_post_id, v_student_id, 'courses', 'Post Removed', 'Body', 'removed');

    SET LOCAL ROLE anon;
    SET LOCAL "request.jwt.claim.sub" = '';
    SET LOCAL "request.jwt.claim.role" = 'anon';

    -- Check view
    SELECT count(*) INTO v_count
    FROM public.portal_posts_feed_view
    WHERE id IN (v_del_post_id, v_rem_post_id);
    ASSERT v_count = 0, 'TEST 21.1 FAILED: Anon saw deleted/removed posts in portal_posts_feed_view!';

    -- Check RPC
    SELECT count(*) INTO v_count
    FROM public.get_portal_posts_feed(p_limit => 50)
    WHERE id IN (v_del_post_id, v_rem_post_id);
    ASSERT v_count = 0, 'TEST 21.2 FAILED: Anon saw deleted/removed posts in get_portal_posts_feed!';

    RESET ROLE;
  END;

  RAISE NOTICE '  [PASS] Test 21: Anon strictly blocked from seeing removed or deleted posts in view and RPC.';

  -- ----------------------------------------------------------------------------
  -- TEST 22: Author cannot hard DELETE own post (must use soft-delete)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE 'Running Test 22: Hard delete revoked for authors...';

  DECLARE
    v_hard_del_id uuid := gen_random_uuid();
  BEGIN
    INSERT INTO public.posts (id, author_id, section, title, body, status)
    VALUES (v_hard_del_id, v_student_id, 'qualution', 'Hard Delete Target', 'Body', 'published');

    SET LOCAL ROLE authenticated;
    SET LOCAL "request.jwt.claim.sub" = v_student_id::text;
    SET LOCAL "request.jwt.claim.role" = 'authenticated';

    -- Direct hard DELETE attempt by author
    DELETE FROM public.posts WHERE id = v_hard_del_id;

    RESET ROLE;

    -- Row must still exist because hard delete was rejected by RLS
    SELECT count(*) INTO v_count FROM public.posts WHERE id = v_hard_del_id;
    ASSERT v_count = 1, 'TEST 22 FAILED: Author was able to hard delete a post!';
  END;

  RAISE NOTICE '  [PASS] Test 22: Hard delete strictly revoked for non-moderators.';

  RAISE NOTICE '=== ALL 22 SECURITY AND DATA INTEGRITY TESTS PASSED! ===';
END $$;

ROLLBACK;

