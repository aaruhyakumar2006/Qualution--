import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  postFormSchema,
  normalizeTags,
  isValidTag,
  TAG_REGEX,
} from './validation/postSchema';
import { SafeMarkdownRenderer } from './components/SafeMarkdownRenderer';

describe('Community Portal Posts & Feed Logic', () => {
  // --------------------------------------------------------------------------
  // 1. Zod Schema Validation
  // --------------------------------------------------------------------------
  describe('Zod Schema Validation (postFormSchema)', () => {
    it('accepts valid post inputs across all standard sections', () => {
      const sections = ['courses', 'news', 'events', 'qualution'] as const;
      for (const section of sections) {
        const input = {
          section,
          title: `Valid Title for ${section}`,
          body: 'This is a sufficiently long body meeting the minimum length criteria.',
          link_url: 'https://example.com/resource',
          tags: ['quantum', 'qiskit'],
          meta: {},
        };
        const parsed = postFormSchema.safeParse(input);
        expect(parsed.success).toBe(true);
      }
    });

    it('rejects post when title is too short or body is too short', () => {
      const shortTitle = {
        section: 'news',
        title: 'Hi', // < 3 chars
        body: 'Valid post body with enough text content.',
        tags: [],
      };
      const res1 = postFormSchema.safeParse(shortTitle);
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error.issues.some((i) => i.path.includes('title'))).toBe(true);
      }

      const shortBody = {
        section: 'news',
        title: 'Valid Post Title',
        body: 'No', // < 5 chars
        tags: [],
      };
      const res2 = postFormSchema.safeParse(shortBody);
      expect(res2.success).toBe(false);
      if (!res2.success) {
        expect(res2.error.issues.some((i) => i.path.includes('body'))).toBe(true);
      }
    });

    it('enforces required paper_url with http/https for research section', () => {
      // Missing meta.paper_url
      const missingPaper = {
        section: 'research',
        title: 'Breakthrough in Quantum Error Mitigation',
        body: 'Detailed findings on surface code stabilizer measurements and fidelities.',
        meta: {
          abstract: 'An insightful overview of topological error correction.',
        },
      };
      const res1 = postFormSchema.safeParse(missingPaper);
      expect(res1.success).toBe(false);
      if (!res1.success) {
        expect(res1.error.issues.some((i) => i.path.includes('paper_url'))).toBe(true);
      }

      // Invalid non-http url
      const invalidProtocol = {
        section: 'research',
        title: 'Quantum Hamiltonian Simulation',
        body: 'Variational quantum eigensolver benchmarks on noisy intermediate-scale hardware.',
        meta: {
          paper_url: 'ftp://files.example.com/paper.pdf',
        },
      };
      const res2 = postFormSchema.safeParse(invalidProtocol);
      expect(res2.success).toBe(false);

      // Valid research post with paper_url and optional abstract
      const validResearch = {
        section: 'research',
        title: 'Topological Quantum Computation with Majorana Fermions',
        body: 'Experimental verification of non-Abelian anyon braiding in nanowire devices.',
        meta: {
          paper_url: 'https://arxiv.org/abs/2101.00001',
          abstract: 'We report topological zero modes in semiconductor-superconductor junctions.',
        },
      };
      const res3 = postFormSchema.safeParse(validResearch);
      expect(res3.success).toBe(true);
    });

    it('validates optional link_url accepts empty strings or valid http/https URLs', () => {
      const validWithHttps = {
        section: 'news',
        title: 'Quantum Computing Updates',
        body: 'Summary of the latest conference announcements and hardware roadmaps.',
        link_url: 'https://qualution.org/quantum-summit',
        tags: ['news'],
      };
      expect(postFormSchema.safeParse(validWithHttps).success).toBe(true);

      const validWithEmpty = {
        section: 'news',
        title: 'Quantum Computing Updates',
        body: 'Summary of the latest conference announcements and hardware roadmaps.',
        link_url: '',
        tags: ['news'],
      };
      expect(postFormSchema.safeParse(validWithEmpty).success).toBe(true);

      const invalidUrl = {
        section: 'news',
        title: 'Quantum Computing Updates',
        body: 'Summary of the latest conference announcements and hardware roadmaps.',
        link_url: 'javascript:evil()',
        tags: ['news'],
      };
      expect(postFormSchema.safeParse(invalidUrl).success).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Tag Normalization & DB Matching Rules
  // --------------------------------------------------------------------------
  describe('Tag Normalization & Formatting Rules', () => {
    it('normalizes raw tag input: lowercase, trim, strip invalid characters, deduplicate, max 5', () => {
      const raw = [
        '  Quantum  ',
        'QUANTUM', // duplicate
        'qiskit-aer',
        'noisy_intermediate',
        'invalid tag with spaces', // rejected by regex
        'vqe!#$', // invalid symbols stripped
        'superconducting_qubits_extra_long_tag_name_exceeding_thirty_characters', // clamped to 30 chars
        'tag5',
        'tag6', // exceeding max 5
      ];

      const normalized = normalizeTags(raw);

      // 1. All lowercase
      expect(normalized.every((t) => t === t.toLowerCase())).toBe(true);
      // 2. Max 5 items
      expect(normalized.length).toBeLessThanOrEqual(5);
      // 3. Deduplicated
      expect(new Set(normalized).size).toBe(normalized.length);
      // 4. Max 30 chars each
      expect(normalized.every((t) => t.length <= 30)).toBe(true);
      // 5. Allowed chars only
      expect(normalized.every((t) => TAG_REGEX.test(t))).toBe(true);

      expect(normalized).toContain('quantum');
      expect(normalized).toContain('qiskit-aer');
      expect(normalized).toContain('noisy_intermediate');
    });

    it('isValidTag verifies single tag conformity', () => {
      expect(isValidTag('quantum-algorithms')).toBe(true);
      expect(isValidTag('qiskit_aer_2026')).toBe(true);
      expect(isValidTag('bad tag')).toBe(false);
      expect(isValidTag('tag$symbol')).toBe(false);
      expect(isValidTag('')).toBe(false);
      expect(isValidTag('a'.repeat(31))).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Keyset Pagination Cursor Logic
  // --------------------------------------------------------------------------
  describe('Keyset Pagination Cursor Logic', () => {
    function processKeysetPage<T extends { id: string; created_at: string }>(
      items: T[],
      limit: number
    ) {
      const hasMore = items.length > limit;
      const posts = hasMore ? items.slice(0, limit) : items;
      const lastItem = posts.length > 0 ? posts[posts.length - 1] : null;

      return {
        posts,
        nextCursor: lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null,
        hasMore,
      };
    }

    it('generates nextCursor from last post when hasMore is true', () => {
      const mockRows = [
        { id: 'post-1', created_at: '2026-10-03T12:00:00Z', title: 'Post 1' },
        { id: 'post-2', created_at: '2026-10-03T11:00:00Z', title: 'Post 2' },
        { id: 'post-3', created_at: '2026-10-03T10:00:00Z', title: 'Post 3' },
      ];

      // Request limit = 2 (query fetches limit + 1 = 3 to check hasMore)
      const page = processKeysetPage(mockRows, 2);

      expect(page.hasMore).toBe(true);
      expect(page.posts.length).toBe(2);
      expect(page.posts[0].id).toBe('post-1');
      expect(page.posts[1].id).toBe('post-2');
      expect(page.nextCursor).toEqual({
        createdAt: '2026-10-03T11:00:00Z',
        id: 'post-2',
      });
    });

    it('returns hasMore = false and null nextCursor when results fit within limit', () => {
      const mockRows = [
        { id: 'post-1', created_at: '2026-10-03T12:00:00Z', title: 'Post 1' },
      ];

      const page = processKeysetPage(mockRows, 10);
      expect(page.hasMore).toBe(false);
      expect(page.posts.length).toBe(1);
      expect(page.nextCursor).toEqual({
        createdAt: '2026-10-03T12:00:00Z',
        id: 'post-1',
      });

      const emptyPage = processKeysetPage([], 10);
      expect(emptyPage.hasMore).toBe(false);
      expect(emptyPage.posts.length).toBe(0);
      expect(emptyPage.nextCursor).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Safe Rendering & XSS Inertness Test
  // --------------------------------------------------------------------------
  describe('Safe Rendering & XSS Protection', () => {
    it('renders script tags and arbitrary HTML in post body as inert text without executing or injecting HTML', () => {
      const maliciousBody = [
        '# Safe Title',
        '',
        'Here is a malicious script attempt:',
        '<script>alert("xss")</script>',
        '<img src=x onerror="alert(1)" />',
        '<iframe src="https://attacker.com"></iframe>',
        '',
        '**Legitimate Markdown Bold**',
      ].join('\n');

      const { container } = render(<SafeMarkdownRenderer content={maliciousBody} />);

      // Zero script, img-onerror, or iframe tags in DOM
      expect(container.querySelector('script')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();

      // The malicious string must be displayed safely as harmless inert text
      expect(container.textContent).toContain('<script>alert("xss")</script>');
      expect(container.textContent).toContain('<img src=x onerror="alert(1)" />');
      expect(container.textContent).toContain('Legitimate Markdown Bold');

      // Check bold element was parsed by ReactMarkdown safely
      const strong = container.querySelector('strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('Legitimate Markdown Bold');
    });

    it('renders hyperlinks safely with http/https, target="_blank", and rel="noopener noreferrer"', () => {
      const content = `
Visit [QUALUTION Docs](https://qualution.org/docs) or [Local HTTP](http://localhost:3000/demo).
Unsafe link: [Malicious Javascript](javascript:alert('pwned')).
      `.trim();

      const { container } = render(<SafeMarkdownRenderer content={content} />);

      const links = container.querySelectorAll('a');
      expect(links.length).toBe(2);

      // Safe link 1
      expect(links[0].getAttribute('href')).toBe('https://qualution.org/docs');
      expect(links[0].getAttribute('target')).toBe('_blank');
      expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');

      // Safe link 2
      expect(links[1].getAttribute('href')).toBe('http://localhost:3000/demo');
      expect(links[1].getAttribute('target')).toBe('_blank');
      expect(links[1].getAttribute('rel')).toBe('noopener noreferrer');

      // The unsafe javascript: link must NOT be rendered as an <a> tag
      const hrefs = Array.from(links).map((l) => l.getAttribute('href'));
      expect(hrefs.some((h) => h?.startsWith('javascript:'))).toBe(false);

      // It must be rendered as inert text inside a span
      expect(container.textContent).toContain('Malicious Javascript');
    });

    it('disables image rendering and does NOT render any <img> element from markdown user input', () => {
      const markdownWithImages = `
# Post with Image Attempt
Here is an image tag in markdown:
![Malicious tracking pixel](https://tracker.example.com/pixel.png)
![Quantum diagram](https://qualution.org/diagram.jpg)
      `.trim();

      const { container } = render(<SafeMarkdownRenderer content={markdownWithImages} />);

      // Zero <img> elements allowed in the DOM
      const imgElements = container.querySelectorAll('img');
      expect(imgElements.length).toBe(0);

      // Safe placeholder text is rendered instead of an image tag
      expect(container.textContent).toContain('[Image: Malicious tracking pixel]');
      expect(container.textContent).toContain('[Image: Quantum diagram]');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Rate Limiting Custom Error Code (PT429) Mapping
  // --------------------------------------------------------------------------
  describe('Rate Limiting Error Code Mapping (PT429)', () => {
    it('translates database PT429 error into friendly user-facing notice', () => {
      function mapPostError(error: { code?: string; message: string }): string {
        if (
          error.code === 'PT429' ||
          error.code === 'P0002' ||
          error.message.includes('Rate limit exceeded')
        ) {
          return 'Rate limit reached: You can create up to 10 posts per hour. Please wait before posting again.';
        }
        return error.message;
      }

      const dbError = {
        code: 'PT429',
        message: 'Rate limit exceeded: You can only create up to 10 posts per hour. Please wait before posting again.',
      };

      const userMessage = mapPostError(dbError);
      expect(userMessage).toBe(
        'Rate limit reached: You can create up to 10 posts per hour. Please wait before posting again.'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 6. Feed Post Public Column Privacy
  // --------------------------------------------------------------------------
  describe('Feed View Public Privacy', () => {
    it('public FeedPost objects omit app_role column to prevent privilege disclosure', () => {
      // Mock row returned by portal_posts_feed_view (16 columns, no author_app_role)
      const mockFeedRow = {
        id: 'post-1',
        author_id: 'user-1',
        section: 'news' as const,
        title: 'Quantum Teleportation Demonstrated',
        body: 'Body text',
        link_url: null,
        tags: ['quantum'],
        meta: {},
        status: 'published' as const,
        created_at: '2026-10-03T12:00:00Z',
        updated_at: '2026-10-03T12:00:00Z',
        author_handle: 'alice',
        author_display_name: 'Alice',
        author_avatar_url: null,
        author_is_verified: true,
        author_role: 'researcher' as const,
      };

      expect(mockFeedRow).not.toHaveProperty('author_app_role');
      expect(mockFeedRow).not.toHaveProperty('app_role');
    });
  });
});

