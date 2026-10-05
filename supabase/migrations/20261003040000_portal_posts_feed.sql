-- Migration: 20261003040000_portal_posts_feed.sql
-- Description: Community Portal Posts & Feed Schema Extensions
--   1. Enforce research post meta requirements (paper_url required with http/https).
--   2. Enforce tag normalization and validation rules in database (max 5, 1-30 chars, lowercase alphanumeric).
--   3. Enforce rate limiting of 10 posts per hour per user in database.
--   4. Provide optimized feed view & keyset RPC joining author profile data.

-- ==============================================================================
-- 1. RESEARCH POST VALIDATION CONSTRAINT
-- ==============================================================================

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS chk_research_post_paper_url;

ALTER TABLE public.posts
  ADD CONSTRAINT chk_research_post_paper_url CHECK (
    section <> 'research' OR (
      meta IS NOT NULL AND
      meta ? 'paper_url' AND
      (meta->>'paper_url') ~* '^https?://'
    )
  );

-- ==============================================================================
-- 2. TAG HANDLING & NORMALIZATION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_post_tags_sanitization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_tag text;
  clean_tag text;
  sanitized_tags text[] := '{}';
BEGIN
  IF NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    FOREACH raw_tag IN ARRAY NEW.tags LOOP
      clean_tag := lower(trim(raw_tag));
      -- Validate tag format: 1-30 lowercase chars, digits, hyphens or underscores
      IF clean_tag <> '' THEN
        IF length(clean_tag) > 30 THEN
          RAISE EXCEPTION 'Tag "%" exceeds maximum length of 30 characters.', clean_tag USING ERRCODE = 'P0003';
        END IF;
        IF NOT (clean_tag ~ '^[a-z0-9_\-]+$') THEN
          RAISE EXCEPTION 'Tag "%" contains invalid characters. Allowed: lowercase letters, numbers, hyphens, underscores.', clean_tag USING ERRCODE = 'P0003';
        END IF;
        -- Deduplicate
        IF NOT (clean_tag = ANY(sanitized_tags)) THEN
          sanitized_tags := array_append(sanitized_tags, clean_tag);
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF array_length(sanitized_tags, 1) > 5 THEN
    RAISE EXCEPTION 'Too many tags: a post can have at most 5 tags.' USING ERRCODE = 'P0003';
  END IF;

  NEW.tags := sanitized_tags;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sanitize_post_tags ON public.posts;
CREATE TRIGGER tr_sanitize_post_tags
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_tags_sanitization();

-- ==============================================================================
-- 3. RATE LIMITING TRIGGER (10 POSTS PER HOUR)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_post_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  -- Exempt moderators, admins, and service_role from rate limits
  IF public.is_moderator() OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.posts
  WHERE author_id = NEW.author_id
    AND created_at > (now() - interval '1 hour');

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: You can only create up to 10 posts per hour. Please wait before posting again.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_rate_limit_posts ON public.posts;
CREATE TRIGGER tr_rate_limit_posts
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_post_rate_limit();

-- ==============================================================================
-- 4. FEED VIEW & KEYSET RPC (SINGLE REQUEST, ZERO N+1)
-- ==============================================================================

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
  pr.role AS author_role,
  pr.app_role AS author_app_role
FROM public.posts p
JOIN public.profiles pr ON p.author_id = pr.id
WHERE p.status = 'published';

GRANT SELECT ON public.portal_posts_feed_view TO anon, authenticated;

-- Keyset pagination RPC on (created_at, id)
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
  author_role public.profile_role,
  author_app_role public.app_role
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
    pr.role AS author_role,
    pr.app_role AS author_app_role
  FROM public.posts p
  JOIN public.profiles pr ON p.author_id = pr.id
  WHERE p.status = 'published'
    AND (p_section IS NULL OR p.section = p_section)
    AND (p_tag IS NULL OR p_tag = ANY(p.tags))
    AND (
      p_cursor_created_at IS NULL OR
      (p.created_at, p.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(p_limit, 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_portal_posts_feed TO anon, authenticated;
