-- Migration: 20261003070000_portal_submissions_and_moderation.sql
-- Description: Community Telemetry Portal "Submit a Signal" data model and moderation schema
-- Adds submission lifecycle, moderation logs, report queue, and strict RLS.

-- 1. Extend content_items table
ALTER TABLE public.content_items 
    ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
    ADD COLUMN IF NOT EXISTS submission_type text NULL CHECK (submission_type IS NULL OR submission_type IN ('news', 'resource', 'event', 'opportunity', 'project')),
    ADD COLUMN IF NOT EXISTS note text NULL,
    ADD COLUMN IF NOT EXISTS screening jsonb NULL,
    ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS review_reason text NULL,
    ADD COLUMN IF NOT EXISTS submitted_at timestamptz NULL,
    ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'public' CHECK (audience IN ('public', 'class')),
    ADD COLUMN IF NOT EXISTS class_id uuid NULL;

-- Backfill submitted_at for existing rows if null
UPDATE public.content_items 
SET submitted_at = created_at 
WHERE submitted_at IS NULL;

-- Indexes for efficient querying by status and submission timeline
CREATE INDEX IF NOT EXISTS idx_content_items_status_submitted 
    ON public.content_items(status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_items_author_status 
    ON public.content_items(author_id, status);

CREATE INDEX IF NOT EXISTS idx_content_items_audience 
    ON public.content_items(audience, class_id);

-- 2. Create post_reports table
CREATE TABLE IF NOT EXISTS public.post_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
    reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_post_reports_item 
    ON public.post_reports(item_id);

CREATE INDEX IF NOT EXISTS idx_post_reports_reporter 
    ON public.post_reports(reporter_id);

CREATE INDEX IF NOT EXISTS idx_post_reports_status 
    ON public.post_reports(status);

-- 3. Create moderation_log table (append-only audit trail)
CREATE TABLE IF NOT EXISTS public.moderation_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
    actor_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    action text NOT NULL CHECK (action IN ('submitted', 'auto_screened', 'approved', 'rejected', 'removed', 'reported', 'deleted_by_author')),
    reason text NULL,
    ts timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_moderation_log_item_ts 
    ON public.moderation_log(item_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_log_actor 
    ON public.moderation_log(actor_id);

-- 4. Row Level Security (RLS) Configuration

-- 4.1 content_items RLS updates
DROP POLICY IF EXISTS "Allow public read access to content_items" ON public.content_items;
DROP POLICY IF EXISTS "Allow read access to approved content or own submissions" ON public.content_items;

CREATE POLICY "Allow read access to approved content or own submissions"
    ON public.content_items
    FOR SELECT
    TO anon, authenticated
    USING (
        (status = 'approved' AND audience = 'public')
        OR
        (auth.uid() IS NOT NULL AND author_id = auth.uid())
    );

-- 4.2 post_reports RLS
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own reports" ON public.post_reports;
CREATE POLICY "Users can insert own reports"
    ON public.post_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own reports" ON public.post_reports;
CREATE POLICY "Users can view own reports"
    ON public.post_reports
    FOR SELECT
    TO authenticated
    USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Allow service role all operations on post_reports" ON public.post_reports;
CREATE POLICY "Allow service role all operations on post_reports"
    ON public.post_reports
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 4.3 moderation_log RLS
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow service role all operations on moderation_log" ON public.moderation_log;
CREATE POLICY "Allow service role all operations on moderation_log"
    ON public.moderation_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
