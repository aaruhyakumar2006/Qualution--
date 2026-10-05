-- Migration: 20261003020000_community_portal_schema.sql
-- Description: Core Schema, Enums, Constraints, Triggers, and RLS for QUALUTION Community Portal MVP

-- 1. Idempotent Custom Enum Types
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_role') THEN
        CREATE TYPE public.profile_role AS ENUM ('student', 'researcher', 'teacher', 'professional');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM ('user', 'moderator', 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_section') THEN
        CREATE TYPE public.post_section AS ENUM ('courses', 'news', 'research', 'events', 'qualution');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'post_status') THEN
        CREATE TYPE public.post_status AS ENUM ('pending', 'published', 'removed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_kind') THEN
        CREATE TYPE public.opportunity_kind AS ENUM ('internship', 'fellowship', 'hackathon', 'job', 'scholarship', 'other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_status') THEN
        CREATE TYPE public.opportunity_status AS ENUM ('pending', 'published', 'expired', 'removed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'comment_status') THEN
        CREATE TYPE public.comment_status AS ENUM ('published', 'removed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_target_type') THEN
        CREATE TYPE public.report_target_type AS ENUM ('post', 'comment', 'opportunity', 'profile');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM ('open', 'actioned', 'dismissed');
    END IF;
END $$;

-- 2. Core Tables

-- 2.1 PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    handle text UNIQUE NOT NULL,
    display_name text NOT NULL,
    role public.profile_role NOT NULL DEFAULT 'student',
    institution text,
    bio text,
    interests text[] NOT NULL DEFAULT '{}',
    links jsonb NOT NULL DEFAULT '{}'::jsonb,
    avatar_url text,
    is_verified boolean NOT NULL DEFAULT false,
    app_role public.app_role NOT NULL DEFAULT 'user',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_profile_handle_length CHECK (char_length(handle) >= 3 AND char_length(handle) <= 30),
    CONSTRAINT chk_profile_handle_chars CHECK (handle = lower(handle) AND handle ~ '^[a-z0-9_]{3,30}$'),
    CONSTRAINT chk_profile_display_name_length CHECK (char_length(display_name) >= 1 AND char_length(display_name) <= 100),
    CONSTRAINT chk_profile_institution_length CHECK (institution IS NULL OR char_length(institution) <= 200),
    CONSTRAINT chk_profile_bio_length CHECK (bio IS NULL OR char_length(bio) <= 1000),
    CONSTRAINT chk_profile_avatar_url CHECK (avatar_url IS NULL OR avatar_url ~* '^https?://')
);

-- Helper: Security definer function to check if current user is moderator or admin
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND app_role IN ('moderator', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_moderator() TO anon, authenticated, service_role;

-- 2.2 POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    section public.post_section NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    link_url text,
    tags text[] NOT NULL DEFAULT '{}',
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    status public.post_status NOT NULL DEFAULT 'published',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_post_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 300),
    CONSTRAINT chk_post_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 50000),
    CONSTRAINT chk_post_link_url CHECK (link_url IS NULL OR (char_length(link_url) <= 2000 AND link_url ~* '^https?://'))
);

-- 2.3 OPPORTUNITIES TABLE
CREATE TABLE IF NOT EXISTS public.opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text NOT NULL,
    organisation text NOT NULL,
    kind public.opportunity_kind NOT NULL,
    description text NOT NULL,
    apply_url text NOT NULL,
    location text,
    deadline date,
    status public.opportunity_status NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_opportunity_title_length CHECK (char_length(title) >= 3 AND char_length(title) <= 300),
    CONSTRAINT chk_opportunity_organisation_length CHECK (char_length(organisation) >= 1 AND char_length(organisation) <= 200),
    CONSTRAINT chk_opportunity_description_length CHECK (char_length(description) >= 1 AND char_length(description) <= 20000),
    CONSTRAINT chk_opportunity_apply_url CHECK (char_length(apply_url) <= 2000 AND apply_url ~* '^https?://'),
    CONSTRAINT chk_opportunity_location_length CHECK (location IS NULL OR char_length(location) <= 200)
);

-- 2.4 FOLLOWS TABLE
CREATE TABLE IF NOT EXISTS public.follows (
    follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_cannot_follow_self CHECK (follower_id <> following_id)
);

-- 2.5 REACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.reactions (
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    kind text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (user_id, post_id, kind),
    CONSTRAINT chk_reaction_kind_format CHECK (char_length(kind) >= 1 AND char_length(kind) <= 50 AND kind ~ '^[a-z0-9_\-]+$')
);

-- 2.6 COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body text NOT NULL,
    status public.comment_status NOT NULL DEFAULT 'published',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_comment_body_length CHECK (char_length(body) >= 1 AND char_length(body) <= 5000)
);

-- 2.7 REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type public.report_target_type NOT NULL,
    target_id uuid NOT NULL,
    reason text NOT NULL,
    status public.report_status NOT NULL DEFAULT 'open',
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT chk_report_reason_length CHECK (char_length(reason) >= 3 AND char_length(reason) <= 2000)
);

-- 3. Indexes for Optimized Feed Queries & Lookups
CREATE INDEX IF NOT EXISTS idx_posts_section_created_at ON public.posts(section, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON public.posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_tags_gin ON public.posts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_opportunities_status_deadline ON public.opportunities(status, deadline);
CREATE INDEX IF NOT EXISTS idx_opportunities_author_id ON public.opportunities(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_target ON public.reports(status, target_type);

-- 4. Triggers & Automated Business Rules

-- 4.1 Auto-create profile on auth.users signup
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
BEGIN
  -- Extract handle or sanitize email prefix
  raw_handle := lower(coalesce(
    new.raw_user_meta_data->>'handle',
    new.raw_user_meta_data->>'user_name',
    split_part(new.email, '@', 1)
  ));
  
  raw_handle := regexp_replace(raw_handle, '[^a-z0-9_]', '_', 'g');
  IF length(raw_handle) < 3 THEN
    raw_handle := 'user_' || substr(new.id::text, 1, 6);
  ELSIF length(raw_handle) > 25 THEN
    raw_handle := substr(raw_handle, 1, 25);
  END IF;

  final_handle := raw_handle;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE handle = final_handle) THEN
    final_handle := substr(raw_handle, 1, 23) || '_' || substr(new.id::text, 1, 4);
  END IF;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- 4.2 Security Guard: Prevent unauthorized role escalation and verification tampering
CREATE OR REPLACE FUNCTION public.handle_profile_escalation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- If non-service_role inserts, ensure user cannot self-assign admin/moderator or verified
    IF auth.role() <> 'service_role' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'admin') THEN
      NEW.app_role := 'user';
      NEW.is_verified := false;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if app_role changed
    IF (NEW.app_role IS DISTINCT FROM OLD.app_role) THEN
      IF auth.role() <> 'service_role' AND NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND app_role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Permission denied: Cannot alter app_role without admin privileges.';
      END IF;
    END IF;

    -- Check if is_verified changed
    IF (NEW.is_verified IS DISTINCT FROM OLD.is_verified) THEN
      IF auth.role() <> 'service_role' AND NOT public.is_moderator() THEN
        RAISE EXCEPTION 'Permission denied: Cannot alter verification status without moderator or admin privileges.';
      END IF;
    END IF;

    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_escalation ON public.profiles;
CREATE TRIGGER tr_protect_profile_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_escalation_guard();

-- 4.3 Opportunities verification check: Non-verified authors land as 'pending'
CREATE OR REPLACE FUNCTION public.handle_opportunity_status_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  author_is_verified boolean;
BEGIN
  SELECT is_verified INTO author_is_verified
  FROM public.profiles
  WHERE id = NEW.author_id;

  IF author_is_verified IS TRUE THEN
    -- Verified authors can publish directly
    IF NEW.status IS NULL OR NEW.status = 'pending' THEN
      NEW.status := 'published';
    END IF;
  ELSE
    -- Non-verified authors are forced to pending
    NEW.status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_opportunity_status_guard ON public.opportunities;
CREATE TRIGGER tr_opportunity_status_guard
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_opportunity_status_on_insert();

-- 4.4 Scheduled-friendly SQL function to expire opportunities past deadline
CREATE OR REPLACE FUNCTION public.expire_opportunities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE public.opportunities
  SET status = 'expired',
      updated_at = now()
  WHERE deadline < CURRENT_DATE
    AND status = 'published';

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_opportunities() TO authenticated, service_role;

-- 5. Row Level Security (RLS) Configuration

-- Enable RLS across all portal tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 5.1 PROFILES POLICIES
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
CREATE POLICY "Public can view profiles"
  ON public.profiles FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_moderator())
  WITH CHECK (auth.uid() = id OR public.is_moderator());

-- 5.2 POSTS POLICIES
DROP POLICY IF EXISTS "Anyone can read published posts or author/moderator" ON public.posts;
CREATE POLICY "Anyone can read published posts or author/moderator"
  ON public.posts FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Authors can create posts" ON public.posts;
CREATE POLICY "Authors can create posts"
  ON public.posts FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND (status IN ('pending', 'published') OR public.is_moderator()));

DROP POLICY IF EXISTS "Authors can update own posts, moderators can update any" ON public.posts;
CREATE POLICY "Authors can update own posts, moderators can update any"
  ON public.posts FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator())
  WITH CHECK (author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Authors and moderators can delete posts" ON public.posts;
CREATE POLICY "Authors and moderators can delete posts"
  ON public.posts FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator());

-- 5.3 OPPORTUNITIES POLICIES
DROP POLICY IF EXISTS "Anyone can read published opportunities or author/moderator" ON public.opportunities;
CREATE POLICY "Anyone can read published opportunities or author/moderator"
  ON public.opportunities FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Authors can create opportunities" ON public.opportunities;
CREATE POLICY "Authors can create opportunities"
  ON public.opportunities FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can update own opportunities, moderators can update any" ON public.opportunities;
CREATE POLICY "Authors can update own opportunities, moderators can update any"
  ON public.opportunities FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator())
  WITH CHECK (author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Authors and moderators can delete opportunities" ON public.opportunities;
CREATE POLICY "Authors and moderators can delete opportunities"
  ON public.opportunities FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator());

-- 5.4 FOLLOWS POLICIES
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
CREATE POLICY "Anyone can view follows"
  ON public.follows FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;
CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- 5.5 REACTIONS POLICIES
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.reactions;
CREATE POLICY "Anyone can view reactions"
  ON public.reactions FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can react" ON public.reactions;
CREATE POLICY "Users can react"
  ON public.reactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove reaction" ON public.reactions;
CREATE POLICY "Users can remove reaction"
  ON public.reactions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 5.6 COMMENTS POLICIES
DROP POLICY IF EXISTS "Anyone can read published comments or author/moderator" ON public.comments;
CREATE POLICY "Anyone can read published comments or author/moderator"
  ON public.comments FOR SELECT
  TO anon, authenticated
  USING (status = 'published' OR author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Users can comment" ON public.comments;
CREATE POLICY "Users can comment"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid() AND status = 'published');

DROP POLICY IF EXISTS "Authors can update own comments, moderators can update any" ON public.comments;
CREATE POLICY "Authors can update own comments, moderators can update any"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator())
  WITH CHECK (author_id = auth.uid() OR public.is_moderator());

DROP POLICY IF EXISTS "Authors and moderators can delete comments" ON public.comments;
CREATE POLICY "Authors and moderators can delete comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid() OR public.is_moderator());

-- 5.7 REPORTS POLICIES
DROP POLICY IF EXISTS "Moderators can view reports" ON public.reports;
CREATE POLICY "Moderators can view reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (public.is_moderator());

DROP POLICY IF EXISTS "Authenticated users can submit reports" ON public.reports;
CREATE POLICY "Authenticated users can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open');

DROP POLICY IF EXISTS "Moderators can update reports" ON public.reports;
CREATE POLICY "Moderators can update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_moderator())
  WITH CHECK (public.is_moderator());

DROP POLICY IF EXISTS "Moderators can delete reports" ON public.reports;
CREATE POLICY "Moderators can delete reports"
  ON public.reports FOR DELETE
  TO authenticated
  USING (public.is_moderator());
