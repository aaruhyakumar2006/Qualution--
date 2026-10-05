-- Migration: 20261003000000_init_portal.sql
-- Description: Initial schema for QUALUTION Community & Telemetry Portal MVP

-- 1. Enable UUID generation extension
create extension if not exists "uuid-ossp";

-- 2. Telemetry and Community Portal Events table
create table if not exists public.portal_telemetry_events (
    id uuid primary key default gen_random_uuid(),
    session_id text,
    event_type text not null,
    event_payload jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default timezone('utc'::text, now())
);

-- Index on event_type and created_at for fast query performance
create index if not exists idx_portal_telemetry_event_type on public.portal_telemetry_events(event_type);
create index if not exists idx_portal_telemetry_created_at on public.portal_telemetry_events(created_at desc);

-- 3. Row Level Security (RLS) Configuration
alter table public.portal_telemetry_events enable row level security;

-- Policy: Allow anonymous client and authenticated users to log telemetry events
create policy "Allow insert of telemetry events"
    on public.portal_telemetry_events
    for insert
    to anon, authenticated
    with check (true);

-- Policy: Allow read access to community telemetry events
create policy "Allow read access to all users"
    on public.portal_telemetry_events
    for select
    to anon, authenticated
    using (true);
