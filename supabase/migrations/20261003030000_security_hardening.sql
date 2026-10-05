-- Migration: 20261003030000_security_hardening.sql
-- Description: Security hardening for QUALUTION Community Portal
--   1. Fix tr_opportunity_status_guard to allow moderators/admins to approve pending opportunities.
--   2. Enforce status and author_id immutability for non-moderators across posts, comments, opportunities.
--   3. Restrict portal_telemetry_events to allow-listed event types, payload size bounds, server-side user_id, moderator-only raw reads, and aggregated summary view with 90-day retention cleanup function.
--   4. Enhance handle generation with reserved handles list, collision resolution, and 3-30 lowercase validation.

-- ==============================================================================
-- 1. FIX OPPORTUNITY STATUS GUARD (ALLOW MODERATOR APPROVALS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_opportunity_status_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_is_verified boolean;
BEGIN
  -- Moderators, admins, and service_role can create or publish opportunities directly
  IF public.is_moderator() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT is_verified INTO author_is_verified
  FROM public.profiles
  WHERE id = NEW.author_id;

  IF author_is_verified IS TRUE THEN
    -- Verified authors can publish directly
    IF NEW.status IS NULL OR NEW.status = 'pending' THEN
      NEW.status := 'published';
    END IF;
  ELSE
    -- Non-verified authors are forced to pending on insert
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger executes strictly BEFORE INSERT
DROP TRIGGER IF EXISTS tr_opportunity_status_guard ON public.opportunities;
CREATE TRIGGER tr_opportunity_status_guard
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_opportunity_status_on_insert();


-- ==============================================================================
-- 2. ENFORCE STATUS & AUTHOR_ID IMMUTABILITY FOR NON-MODERATORS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_content_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. author_id is strictly immutable for non-service_role
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Permission denied: Cannot reassign author_id.';
    END IF;
  END IF;

  -- 2. status is strictly immutable for non-moderators
  -- Non-moderator authors cannot un-remove moderated content or transition status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
      RAISE EXCEPTION 'Permission denied: Non-moderators cannot alter content status.';
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_posts_update ON public.posts;
CREATE TRIGGER tr_guard_posts_update
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_content_update_guard();

DROP TRIGGER IF EXISTS tr_guard_comments_update ON public.comments;
CREATE TRIGGER tr_guard_comments_update
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_content_update_guard();

DROP TRIGGER IF EXISTS tr_guard_opportunities_update ON public.opportunities;
CREATE TRIGGER tr_guard_opportunities_update
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_content_update_guard();


-- ==============================================================================
-- 3. TELEMETRY EVENTS SECURITY HARDENING & RETENTION
-- ==============================================================================

-- 3.1 Add user_id column referencing auth.users if not present
ALTER TABLE public.portal_telemetry_events
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3.2 Enforce allow-listed event types
ALTER TABLE public.portal_telemetry_events
  DROP CONSTRAINT IF EXISTS chk_telemetry_event_type;

ALTER TABLE public.portal_telemetry_events
  ADD CONSTRAINT chk_telemetry_event_type CHECK (
    event_type IN (
      'portal_view',
      'circuit_simulation_run',
      'challenge_start',
      'challenge_complete',
      'opportunity_view',
      'post_view',
      'resource_click',
      'search_query',
      'telemetry_heartbeat',
      'portal_init_verified',
      'quantum_simulation',
      'community_share'
    )
  );

-- 3.3 Enforce payload size limit (max 10 KB per event)
ALTER TABLE public.portal_telemetry_events
  DROP CONSTRAINT IF EXISTS chk_telemetry_payload_size;

ALTER TABLE public.portal_telemetry_events
  ADD CONSTRAINT chk_telemetry_payload_size CHECK (
    octet_length(event_payload::text) <= 10240
  );

-- 3.4 Server-side user_id assignment & PII payload stripping trigger
CREATE OR REPLACE FUNCTION public.handle_telemetry_event_insert_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Server-side authoritative assignment of user_id from auth context
  NEW.user_id := auth.uid();

  -- Strip client-supplied user identifiers from payload to prevent spoofing or leakage
  IF NEW.event_payload ? 'user_id' OR NEW.event_payload ? 'email' OR NEW.event_payload ? 'user_name' OR NEW.event_payload ? 'handle' THEN
    NEW.event_payload := NEW.event_payload - 'user_id' - 'email' - 'user_name' - 'handle';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_guard_telemetry_insert ON public.portal_telemetry_events;
CREATE TRIGGER tr_guard_telemetry_insert
  BEFORE INSERT ON public.portal_telemetry_events
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_telemetry_event_insert_guard();

-- 3.5 Restrict raw read access on portal_telemetry_events to moderators and admins only
DROP POLICY IF EXISTS "Allow read access to all users" ON public.portal_telemetry_events;
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.portal_telemetry_events;
DROP POLICY IF EXISTS "Only moderators and admins can read raw telemetry events" ON public.portal_telemetry_events;

CREATE POLICY "Only moderators and admins can read raw telemetry events"
  ON public.portal_telemetry_events
  FOR SELECT
  TO authenticated
  USING (public.is_moderator());

-- 3.6 Aggregated public summary view exposing counts only
CREATE OR REPLACE VIEW public.portal_telemetry_summary
WITH (security_invoker = false)
AS
SELECT
  event_type,
  date_trunc('day', created_at) AS event_date,
  count(*)::bigint AS event_count
FROM public.portal_telemetry_events
GROUP BY event_type, date_trunc('day', created_at);

GRANT SELECT ON public.portal_telemetry_summary TO anon, authenticated;

-- 3.7 Retention policy function: Purge telemetry events older than 90 days
CREATE OR REPLACE FUNCTION public.cleanup_expired_telemetry_events(retention_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.portal_telemetry_events
  WHERE created_at < (now() - (retention_days || ' days')::interval);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_telemetry_events(integer) TO authenticated, service_role;


-- ==============================================================================
-- 4. PROFILE HANDLE GENERATION: RESERVED NAMES & COLLISION RESOLUTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_handle text;
  final_handle text;
  raw_name text;
  final_role public.profile_role;
  reserved_handles text[] := ARRAY[
    'admin', 'qualution', 'erwin', 'moderator', 'support', 'root',
    'superuser', 'staff', 'system', 'help', 'api', 'security', 'official'
  ];
  collision_counter integer := 0;
BEGIN
  -- Extract raw handle from user metadata or email prefix
  raw_handle := lower(coalesce(
    new.raw_user_meta_data->>'handle',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  ));
  
  -- Sanitize: lowercase alphanumeric and underscores only
  raw_handle := regexp_replace(raw_handle, '[^a-z0-9_]', '_', 'g');

  -- Intercept reserved handles and append suffix
  IF raw_handle = ANY(reserved_handles) THEN
    raw_handle := substr(raw_handle, 1, 23) || '_' || substr(md5(random()::text), 1, 4);
  END IF;

  -- Enforce length bounds (3-25 chars base)
  IF length(raw_handle) < 3 THEN
    raw_handle := 'user_' || substr(md5(new.id::text || random()::text), 1, 6);
  ELSIF length(raw_handle) > 25 THEN
    raw_handle := substr(raw_handle, 1, 25);
  END IF;

  final_handle := raw_handle;

  -- Collision resolution: append short random suffix until unique
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) AND collision_counter < 10 LOOP
    final_handle := substr(raw_handle, 1, 24) || '_' || substr(md5(random()::text), 1, 4);
    collision_counter := collision_counter + 1;
  END LOOP;

  -- Extreme fallback
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) THEN
    final_handle := 'u_' || substr(replace(new.id::text, '-', ''), 1, 20);
  END IF;

  -- Final format normalization
  final_handle := lower(substr(final_handle, 1, 30));

  raw_name := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'Quantum Pioneer'
  );

  BEGIN
    final_role := (new.raw_user_meta_data->>'role')::public.profile_role;
  EXCEPTION WHEN OTHERS THEN
    final_role := 'student';
  END;

  INSERT INTO public.profiles (
    id,
    handle,
    display_name,
    role,
    avatar_url,
    institution,
    bio,
    interests,
    links,
    is_verified,
    app_role,
    created_at,
    updated_at
  )
  VALUES (
    new.id,
    final_handle,
    raw_name,
    final_role,
    CASE WHEN (new.raw_user_meta_data->>'avatar_url') ~* '^https?://' THEN new.raw_user_meta_data->>'avatar_url' ELSE NULL END,
    new.raw_user_meta_data->>'institution',
    new.raw_user_meta_data->>'bio',
    '{}',
    '{}'::jsonb,
    false,
    'user',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;
