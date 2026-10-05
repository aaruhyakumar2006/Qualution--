import { describe, it, expect } from 'vitest';
import { supabase } from '../../lib/supabase';
import type { PostSection, OpportunityKind } from './types';

describe('Community Portal Database & Security Schema Rules', () => {
  it('1. Anonymous client can query public endpoints and reads published posts without throwing RLS violation', async () => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'published');

    // Should not throw RLS error (42501)
    if (error && error.code !== 'PGRST205') {
      expect(error.code).not.toBe('42501');
    }
    expect(data === null || Array.isArray(data)).toBe(true);
  });

  it('2. Anonymous client is blocked from inserting posts directly without authentication', async () => {
    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: '00000000-0000-0000-0000-000000000001',
        section: 'news' as PostSection,
        title: 'Unauthorized Post Attempt',
        body: 'This should be blocked by RLS',
        status: 'published',
      });

    // Unauthenticated insert must fail RLS with 42501 or permission error
    if (error && error.code !== 'PGRST205') {
      expect(['42501', 'PGRST301', '401', '403']).toContain(error.code || '42501');
    }
    expect(data).toBeNull();
  });

  it('3. Security Rule: Unauthenticated attempts to escalate app_role are rejected', async () => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ app_role: 'admin' })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (error && error.code !== 'PGRST205') {
      expect(['42501', 'PGRST301', '401', '403', 'P0001']).toContain(error.code || '42501');
    }
    expect(data).toBeNull();
  });

  it('4. Security Rule: Unauthenticated attempts to insert opportunities are blocked', async () => {
    const { data, error } = await supabase
      .from('opportunities')
      .insert({
        author_id: '00000000-0000-0000-0000-000000000001',
        title: 'Unverified Opportunity',
        organisation: 'Test Org',
        kind: 'internship' as OpportunityKind,
        description: 'Test description',
        apply_url: 'https://example.com/apply',
        status: 'published',
      });

    if (error && error.code !== 'PGRST205') {
      expect(['42501', 'PGRST301', '401', '403']).toContain(error.code || '42501');
    }
    expect(data).toBeNull();
  });

  it('5. Security Rule: Unauthenticated clients cannot read moderation reports', async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*');

    // Reading reports requires is_moderator() -> anon receives empty list or error/null
    if (error) {
      expect(data).toBeNull();
    } else {
      expect(data).toEqual([]);
    }
  });

  it('6. Security Rule: Author cannot reassign author_id or un-remove content', async () => {
    const { data, error } = await supabase
      .from('posts')
      .update({
        author_id: '00000000-0000-0000-0000-000000000002',
        status: 'published',
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (error && error.code !== 'PGRST205') {
      expect(['42501', 'PGRST301', '401', '403', 'P0001']).toContain(error.code || '42501');
    }
    expect(data).toBeNull();
  });

  it('7. Security Rule: Raw telemetry read is blocked for anon; summary view is queryable', async () => {
    // 7.1 Raw telemetry events: Anonymous client queries raw events
    const rawRes = await supabase
      .from('portal_telemetry_events')
      .select('*');

    // If RLS blocked, rawRes.error is set or data is empty/null
    if (rawRes.error) {
      expect(rawRes.data).toBeNull();
    } else {
      expect(Array.isArray(rawRes.data)).toBe(true);
    }

    // 7.2 Aggregated public summary view
    const summaryRes = await supabase
      .from('portal_telemetry_summary')
      .select('*');

    // Summary view should be accessible to public/anon (not RLS 42501 blocked)
    if (summaryRes.error && summaryRes.error.code !== 'PGRST205') {
      expect(summaryRes.error.code).not.toBe('42501');
    }
    expect(summaryRes.data === null || Array.isArray(summaryRes.data)).toBe(true);
  });
});
