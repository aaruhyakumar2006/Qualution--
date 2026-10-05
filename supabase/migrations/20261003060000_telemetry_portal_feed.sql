-- Migration: 20261003060000_telemetry_portal_feed.sql
-- Description: Community Telemetry Portal MVP schema (content_items, portal_sources, curriculum_tags)
-- Enables live feeds, AI-enriched quantum news, deduplication, and RLS policies.

-- 1. Enable vector extension if available for future embedding deduplication / semantic search
create extension if not exists vector;

-- 2. Curriculum Tags Table
-- Maps educational quantum concepts to interactive workbench lessons
create table if not exists public.curriculum_tags (
    tag text primary key,
    lesson_id text not null,
    label text not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Portal Sources Table
-- Configures dynamic ingestion feeds (arXiv, RSS, GitHub Releases) without code changes
create table if not exists public.portal_sources (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    type text not null check (type in ('arxiv', 'rss', 'github')),
    url_or_query text not null,
    section text not null,
    source_tier int not null default 1 check (source_tier between 1 and 3),
    enabled boolean not null default true,
    fetch_interval_minutes int not null default 60,
    rate_limit_per_minute int not null default 30,
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- 4. Content Items Table
-- Living archive of quantum computing research, industry news, courses, and opportunities
create table if not exists public.content_items (
    id uuid primary key default gen_random_uuid(),
    source text not null,
    source_tier int not null default 1 check (source_tier between 1 and 3),
    section text not null,
    title text not null,
    canonical_url text not null unique,
    title_hash text not null,
    published_at timestamptz not null default timezone('utc'::text, now()),
    abstract text,
    summary text,
    level text default 'Beginner',
    tags text[] not null default '{}'::text[],
    curriculum_tags text[] not null default '{}'::text[],
    enriched boolean not null default false,
    prompt_version text,
    embedding vector(1536),
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- Indexes for performance & search
create index if not exists idx_content_items_section_published 
    on public.content_items(section, published_at desc);

create index if not exists idx_content_items_title_hash 
    on public.content_items(title_hash);

create index if not exists idx_content_items_fts 
    on public.content_items using gin (to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || coalesce(abstract, '')));

create index if not exists idx_content_items_tags 
    on public.content_items using gin (tags);

create index if not exists idx_content_items_curriculum_tags 
    on public.content_items using gin (curriculum_tags);

-- 5. Row Level Security (RLS) Configuration
alter table public.curriculum_tags enable row level security;
alter table public.portal_sources enable row level security;
alter table public.content_items enable row level security;

-- Public Read Policies (Frontend anon & authenticated users)
create policy "Allow public read access to curriculum_tags"
    on public.curriculum_tags
    for select
    to anon, authenticated
    using (true);

create policy "Allow public read access to enabled portal_sources"
    on public.portal_sources
    for select
    to anon, authenticated
    using (enabled = true);

create policy "Allow public read access to content_items"
    on public.content_items
    for select
    to anon, authenticated
    using (true);

-- Restrict Writes Strictly to Backend Service Role
create policy "Allow service role all operations on curriculum_tags"
    on public.curriculum_tags
    for all
    to service_role
    using (true)
    with check (true);

create policy "Allow service role all operations on portal_sources"
    on public.portal_sources
    for all
    to service_role
    using (true)
    with check (true);

create policy "Allow service role all operations on content_items"
    on public.content_items
    for all
    to service_role
    using (true)
    with check (true);
