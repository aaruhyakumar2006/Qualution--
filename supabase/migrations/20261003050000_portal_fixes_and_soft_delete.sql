-- ==============================================================================
-- Migration: 20261003050000_portal_fixes_and_soft_delete.sql
-- Description:
--   1. Add 'deleted' status to public.post_status enum.
--   2. Implement soft-delete for post authors via public.soft_delete_post(p_post_id)
--      and allow status transition to 'deleted' in handle_content_update_guard.
--   3. Revoke hard delete for regular authors; keep hard delete restricted to moderators.
--   4. Update rate limiter to use custom SQLSTATE 'PT429' and count soft-deleted/removed
--      posts so authors cannot bypass the 10 posts/hour limit by deleting and reposting.
--   5. Refactor portal_posts_feed_view and get_portal_posts_feed: confirm security_invoker,
--      remove app_role from public view/RPC columns, and filter to status = 'published'.
--   6. Update SELECT RLS on posts so deleted/removed posts are hidden from anon/regular users
--      but remain visible to moderators (preserving reports audit trails).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD 'deleted' TO post_status ENUM
-- ------------------------------------------------------------------------------
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'deleted';

-- ------------------------------------------------------------------------------
-- 2. UPDATE CONTENT UPDATE GUARD TRIGGER (ALLOW AUTHOR SOFT-DELETE ONLY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_content_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. author_id is strictly immutable once set
  IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'Permission denied: Cannot reassign author_id.';
    END IF;
  END IF;

  -- 2. status transition rules:
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
      -- Allow an author to transition their own post to 'deleted' (soft delete)
      IF OLD.author_id = auth.uid() AND OLD.status IN ('published', 'pending') AND NEW.status = 'deleted' THEN
        -- Allowed soft-delete path
      ELSE
        RAISE EXCEPTION 'Permission denied: Non-moderators cannot alter content status.';
      END IF;
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. SOFT-DELETE RPC FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id uuid;
  v_current_status public.post_status;
BEGIN
  SELECT author_id, status INTO v_author_id, v_current_status
  FROM public.posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post % not found', p_post_id;
  END IF;

  -- Check authorization: author or moderator
  IF auth.uid() <> v_author_id AND NOT public.is_moderator() THEN
    RAISE EXCEPTION 'Unauthorized: Only author or moderator can delete this post';
  END IF;

  UPDATE public.posts
  SET status = 'deleted',
      updated_at = timezone('utc'::text, now())
  WHERE id = p_post_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.soft_delete_post(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR POSTS (REVOKE HARD DELETE FOR AUTHORS, SECURE SELECT)
-- ------------------------------------------------------------------------------

-- Authors can no longer hard delete; only moderators can hard delete
DROP POLICY IF EXISTS "Allow authors to delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Allow moderators to hard delete posts" ON public.posts;

CREATE POLICY "Allow moderators to hard delete posts"
    ON public.posts
    FOR DELETE
    TO authenticated
    USING (public.is_moderator());

-- Select policy: public sees published; author can preview pending; mods see all (including deleted/removed)
DROP POLICY IF EXISTS "Allow public read of published posts" ON public.posts;

CREATE POLICY "Allow public read of published posts"
    ON public.posts
    FOR SELECT
    TO anon, authenticated
    USING (
      status = 'published'
      OR (status = 'deleted' AND public.is_moderator())
      OR (status = 'pending' AND (author_id = auth.uid() OR public.is_moderator()))
      OR (status = 'removed' AND public.is_moderator())
    );

-- ------------------------------------------------------------------------------
-- 5. RATE LIMIT TRIGGER FIX (SQLSTATE 'PT429' & INCLUDE DELETED POSTS IN COUNT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_post_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Skip rate limiting for moderators and service_role
  IF public.is_moderator() OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Count ALL posts created by this author in the last 1 hour,
  -- including 'deleted' and 'removed' posts to prevent delete-and-repost bypass!
  SELECT count(*) INTO recent_count
  FROM public.posts
  WHERE author_id = NEW.author_id
    AND created_at > (now() - interval '1 hour');

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only create up to 10 posts per hour. Please wait before posting again.'
      USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_rate_limit_posts ON public.posts;
CREATE TRIGGER tr_rate_limit_posts
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_rate_limit();

-- ------------------------------------------------------------------------------
-- 6. REFACTOR FEED VIEW & RPC (REMOVE app_role, CONFIRM security_invoker)
-- ------------------------------------------------------------------------------

DROP VIEW IF EXISTS public.portal_posts_feed_view CASCADE;

CREATE OR REPLACE VIEW public.portal_posts_feed_view
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.author_id,
  p.section,
  p.title,
  p.body,
  p.link_url,
  p.tags,
  p.meta,
  p.status,
  p.created_at,
  p.updated_at,
  pr.handle AS author_handle,
  pr.display_name AS author_display_name,
  pr.avatar_url AS author_avatar_url,
  pr.is_verified AS author_is_verified,
  pr.role AS author_role
FROM public.posts p
JOIN public.profiles pr ON p.author_id = pr.id
WHERE p.status = 'published';

GRANT SELECT ON public.portal_posts_feed_view TO anon, authenticated;

-- Keyset pagination RPC on (created_at, id) without app_role
CREATE OR REPLACE FUNCTION public.get_portal_posts_feed(
  p_section public.post_section DEFAULT NULL,
  p_tag text DEFAULT NULL,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  section public.post_section,
  title text,
  body text,
  link_url text,
  tags text[],
  meta jsonb,
  status public.post_status,
  created_at timestamptz,
  updated_at timestamptz,
  author_handle text,
  author_display_name text,
  author_avatar_url text,
  author_is_verified boolean,
  author_role public.user_role
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.section,
    p.title,
    p.body,
    p.link_url,
    p.tags,
    p.meta,
    p.status,
    p.created_at,
    p.updated_at,
    pr.handle AS author_handle,
    pr.display_name AS author_display_name,
    pr.avatar_url AS author_avatar_url,
    pr.is_verified AS author_is_verified,
    pr.role AS author_role
  FROM public.posts p
  JOIN public.profiles pr ON p.author_id = pr.id
  WHERE p.status = 'published'
    AND (p_section IS NULL OR p.section = p_section)
    AND (p_tag IS NULL OR p.tags @> ARRAY[lower(trim(p_tag))])
    AND (
      p_cursor_created_at IS NULL
      OR (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_posts_feed(public.post_section, text, timestamptz, uuid, integer) TO anon, authenticated;
