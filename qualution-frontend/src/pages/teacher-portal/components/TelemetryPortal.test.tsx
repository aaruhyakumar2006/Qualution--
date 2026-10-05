import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, configure, act } from '@testing-library/react';
import TelemetryPortal from './TelemetryPortal';
import * as portalApi from '../api/portalApi';
import {
  portalDb,
  savePortalItemsToCache,
  getPortalItemsFromCache,
  savePortalSectionsToCache,
  getPortalSectionsFromCache,
} from '../../../services/db/portalDexieDb';
import { PORTAL_UI_TEXT, PORTAL_BRAND, STREAM_STRINGS } from '../constants/portalConstants';

configure({ asyncUtilTimeout: 5000 });

const MOCK_SECTIONS = [
  {
    id: 'news',
    num: '01',
    title: 'QUANTUM DISPATCHES',
    subtitle: 'Global industry announcements & hardware roadmaps',
    accent: '#C1F8FF',
    accentDark: '#00B8D9',
    item_count: 5,
  },
  {
    id: 'research',
    num: '02',
    title: 'THEORY & ARTIFACTS',
    subtitle: 'Peer-reviewed preprints & breakthroughs',
    accent: '#FFD700',
    accentDark: '#FFA500',
    item_count: 3,
  },
];

const MOCK_ITEMS = [
  {
    id: 'arxiv-2401-0001',
    source: 'arXiv:quant-ph',
    source_tier: 1,
    section: 'research',
    title: 'Fault-Tolerant Surface Codes Under Biased Noise',
    canonical_url: 'https://arxiv.org/abs/2401.0001',
    published_at: '2026-10-01T12:00:00Z',
    abstract: 'We introduce an optimized surface code decoding strategy under severe noise asymmetry.',
    summary: 'Demonstrates a fault-tolerant decoder achieving a 2.3x threshold improvement under asymmetric phase-flip noise.',
    level: 'Advanced',
    tags: ['surface-code', 'fault-tolerance'],
    curriculum_tags: ['Error Correction', 'Superposition'],
    enriched: true,
  },
  {
    id: 'news-2026-0002',
    source: 'IBM Quantum Blog',
    source_tier: 2,
    section: 'news',
    title: 'Heron Processor Scaling to 5,000 Gates with 99.9% 2Q Fidelity',
    canonical_url: 'https://ibm.com/quantum/blog/heron-scaling',
    published_at: '2026-09-28T09:00:00Z',
    abstract: 'Announcing 2-qubit fidelity records on the modular Heron architecture.',
    summary: 'Hardware milestone demonstrating multi-chip modular quantum communication at scale.',
    level: 'Intermediate',
    tags: ['superconducting', 'heron'],
    curriculum_tags: ['Hardware'],
    enriched: true,
  },
];

describe('TelemetryPortal Component and Offline Architecture', () => {
  let originalSpeechSynthesis: any;
  let originalGetContext: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear Dexie database tables
    await portalDb.items.clear();
    await portalDb.sections.clear();
    await portalDb.curriculum_tags.clear();

    // Default WebGL mock support in jsdom
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
      if (contextId === 'webgl' || contextId === 'experimental-webgl') {
        return {} as any;
      }
      return null;
    });

    // Mock window.speechSynthesis
    originalSpeechSynthesis = window.speechSynthesis;
    (window as any).speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
    };
    (window as any).SpeechSynthesisUtterance = function (text: string) {
      this.text = text;
      this.rate = 1.0;
    };
  });

  afterEach(() => {
    (window as any).speechSynthesis = originalSpeechSynthesis;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('renders landing page with dynamic sections and hero elements', async () => {
    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: MOCK_ITEMS,
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    // Brand and header copy should be rendered
    expect(await screen.findByText(PORTAL_BRAND.SUBTITLE)).toBeInTheDocument();
    expect(screen.getByText('IN MOTION.')).toBeInTheDocument();

    // Both dynamic books should appear in the editorial index
    expect(await screen.findByText('QUANTUM DISPATCHES')).toBeInTheDocument();
    expect(screen.getByText('THEORY & ARTIFACTS')).toBeInTheDocument();
  });

  it('toggles smoothly between 3D Book view and 2D Plain List View', async () => {
    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: MOCK_ITEMS,
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    // Initially in 3D mode: view switcher button says "Plain List View"
    const toggleButton = await screen.findByTitle('Toggle between 3D Book and Plain List view');
    expect(toggleButton).toHaveTextContent(PORTAL_UI_TEXT.SWITCH_TO_LIST);

    // Click to switch to 2D list-view fallback
    fireEvent.click(toggleButton);

    // Now plain list view header should be visible
    expect(await screen.findByText(/FEATURED QUANTUM TELEMETRY FOLIOS/i)).toBeInTheDocument();
    expect(toggleButton).toHaveTextContent(PORTAL_UI_TEXT.SWITCH_TO_3D);

    // Switch back to 3D book
    fireEvent.click(toggleButton);
    expect(screen.queryByText(/FEATURED QUANTUM TELEMETRY FOLIOS/i)).not.toBeInTheDocument();
  });

  it('navigates into FeedView and verifies all required card elements', async () => {
    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockImplementation(async (params) => {
      if (params?.section === 'research') {
        return {
          items: [MOCK_ITEMS[0]],
          next_cursor: null,
          has_more: false,
          limit: 10,
          isOffline: false,
        };
      }
      return {
        items: MOCK_ITEMS,
        next_cursor: null,
        has_more: false,
        limit: 10,
        isOffline: false,
      };
    });

    render(<TelemetryPortal />);

    // Click the Research book
    const researchCard = await screen.findByRole('button', { name: /Open THEORY & ARTIFACTS feed/i });
    fireEvent.click(researchCard);

    // FeedView header
    expect(await screen.findByRole('heading', { level: 1, name: 'THEORY & ARTIFACTS' })).toBeInTheDocument();

    // Verify Card Elements for the signal:
    // 1. Title (targeting card heading with findByRole for async resolution)
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: 'Fault-Tolerant Surface Codes Under Biased Noise',
      })
    ).toBeInTheDocument();

    // 2. Source & Trust Tier Badge
    expect(screen.getByText('arXiv:quant-ph')).toBeInTheDocument();
    expect(screen.getByText(`${PORTAL_UI_TEXT.TIER_BADGE_PREFIX} 1`)).toBeInTheDocument();

    // 3. AI Summary label and text
    expect(screen.getByText(PORTAL_UI_TEXT.AI_SUMMARY_LABEL)).toBeInTheDocument();
    expect(
      screen.getByText('Demonstrates a fault-tolerant decoder achieving a 2.3x threshold improvement under asymmetric phase-flip noise.')
    ).toBeInTheDocument();

    // 4. Canonical source link
    const originalLink = screen.getByRole('link', { name: new RegExp(PORTAL_UI_TEXT.ORIGINAL_SOURCE, 'i') });
    expect(originalLink).toHaveAttribute('href', 'https://arxiv.org/abs/2401.0001');
    expect(originalLink).toHaveAttribute('target', '_blank');
    expect(originalLink).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders "Try it in the Workbench" action button for curriculum tags and handles click', async () => {
    const handleWorkbenchAction = vi.fn();

    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: [MOCK_ITEMS[0]], // Contains curriculum_tags: ['Error Correction', 'Superposition']
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal onLaunchIDE={handleWorkbenchAction} />);

    // Open Research feed
    const researchCard = await screen.findByRole('button', { name: /Open THEORY & ARTIFACTS feed/i });
    fireEvent.click(researchCard);

    // 'Error Correction' maps to lesson 's1-theory-what-is-quantum'
    const tryButton = await screen.findByRole('button', { name: new RegExp(PORTAL_UI_TEXT.TRY_IN_WORKBENCH, 'i') });
    expect(tryButton).toBeInTheDocument();

    // Clicking button triggers onLaunchIDE with mapped practical lesson ID
    fireEvent.click(tryButton);
    expect(handleWorkbenchAction).toHaveBeenCalledWith(undefined, undefined, 's1-theory-what-is-quantum');
  });

  it('initiates audio speech synthesis when clicking speaker button', async () => {
    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: [MOCK_ITEMS[0]],
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    const researchCard = await screen.findByRole('button', { name: /Open THEORY & ARTIFACTS feed/i });
    fireEvent.click(researchCard);

    const audioButton = await screen.findByRole('button', { name: /Listen to audio summary/i });
    fireEvent.click(audioButton);

    expect(window.speechSynthesis.speak).toHaveBeenCalled();
  });

  it('falls back to Dexie offline cache when network request fails', async () => {
    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: true,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: [MOCK_ITEMS[1]],
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: true,
    });

    render(<TelemetryPortal />);

    // Should load sections from offline cache
    expect(await screen.findByText('QUANTUM DISPATCHES')).toBeInTheDocument();

    // Open book in offline mode
    const bookBtn = await screen.findByRole('button', { name: /Open QUANTUM DISPATCHES feed/i });
    fireEvent.click(bookBtn);

    // Wait for FeedView header to transition in
    expect(await screen.findByRole('heading', { level: 1, name: 'QUANTUM DISPATCHES' })).toBeInTheDocument();

    // Verify offline banner appears
    expect(await screen.findByText(/Offline Archive Active/i)).toBeInTheDocument();

    // Verify cached items are displayed from Dexie
    expect(
      await screen.findByRole('heading', {
        level: 3,
        name: /Heron Processor Scaling/i,
      })
    ).toBeInTheDocument();
  });

  it('verifies Dexie DB cache functions save, retrieve and limit count', async () => {
    // Test cache functions directly
    await savePortalItemsToCache(MOCK_ITEMS);
    const cached = await getPortalItemsFromCache('research');
    expect(cached.length).toBe(1);
    expect(cached[0].id).toBe('arxiv-2401-0001');

    const sectionsCached = await getPortalSectionsFromCache();
    expect(Array.isArray(sectionsCached)).toBe(true);
  });

  it('loads dynamic curriculum tags from API, caches in Dexie, and resolves custom lesson mapping', async () => {
    const mockTags = [
      { tag: 'CustomTag', lesson_id: 'custom-lesson-42', label: 'Custom Quantum Lesson' },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/portal/tags')) {
        return {
          ok: true,
          json: async () => mockTags,
        } as any;
      }
      return {
        ok: true,
        json: async () => [],
      } as any;
    });

    const mapping = await portalApi.fetchCurriculumTags();
    expect(mapping['CustomTag']).toBe('custom-lesson-42');

    // Verify resolveLessonIdForTags resolves using the dynamically loaded DB mapping
    const resolved = portalApi.resolveLessonIdForTags(['CustomTag']);
    expect(resolved).toBe('custom-lesson-42');

    // Test Dexie caching directly
    const { saveCurriculumTagsToCache, getCurriculumTagsFromCache } = await import('../../../services/db/portalDexieDb');
    await saveCurriculumTagsToCache(mockTags);
    const cachedTags = await getCurriculumTagsFromCache();
    expect(cachedTags.length).toBe(1);
    expect(cachedTags[0].tag).toBe('CustomTag');
    expect(cachedTags[0].lesson_id).toBe('custom-lesson-42');
  });

  it('renders "AI summary" for enriched items and "Original abstract" for unenriched items', async () => {
    const mixedItems = [
      {
        id: 'enriched-1',
        source: 'arXiv quant-ph',
        source_tier: 1,
        section: 'research',
        title: 'Enriched Quantum Circuit Item',
        canonical_url: 'https://arxiv.org/abs/2601.0001',
        published_at: '2026-10-01T12:00:00Z',
        summary: 'AI generated summary for quantum research.',
        abstract: 'Original un-enriched abstract text.',
        level: 'Advanced',
        tags: ['qec'],
        enriched: true,
        prompt_version: 'enrich_item.v1',
      },
      {
        id: 'raw-2',
        source: 'Nature Quantum Information',
        source_tier: 1,
        section: 'news',
        title: 'Raw Unenriched Quantum News Item',
        canonical_url: 'https://nature.com/articles/npjqi.2026.1',
        published_at: '2026-10-02T12:00:00Z',
        summary: 'Author summary directly from press release.',
        abstract: 'Raw abstract from publication.',
        level: 'Beginner',
        tags: ['news'],
        enriched: false,
      },
    ];

    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: mixedItems,
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    // Navigate to Research feed
    const researchCard = await screen.findByRole('button', { name: /Open THEORY & ARTIFACTS feed/i });
    fireEvent.click(researchCard);

    // 1. Enriched item renders "AI summary" label and prompt version
    expect(await screen.findByText(new RegExp(PORTAL_UI_TEXT.AI_SUMMARY_LABEL, 'i'))).toBeInTheDocument();
    expect(screen.getByText('(enrich_item.v1)')).toBeInTheDocument();

    // 2. Unenriched item renders "Original abstract" label
    expect(await screen.findByText(PORTAL_UI_TEXT.ORIGINAL_ABSTRACT_LABEL)).toBeInTheDocument();

    // 3. Both items render origin source attribution
    expect(screen.getByText('via arXiv quant-ph')).toBeInTheDocument();
    expect(screen.getByText('via Nature Quantum Information')).toBeInTheDocument();
  });

  it('automatically falls back to 2D view and shows friendly notice when WebGL fails', async () => {
    // Mock HTMLCanvasElement.prototype.getContext to return null simulating WebGL failure
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: MOCK_ITEMS,
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    // 1. Should display friendly notice
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(PORTAL_UI_TEXT.WEBGL_UNAVAILABLE_NOTICE, 'i'))).toBeInTheDocument();

    // 2. Should automatically render 2D List View fallback without crashing
    expect(await screen.findByText(/FEATURED QUANTUM TELEMETRY FOLIOS/i)).toBeInTheDocument();

    // Restore original getContext
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('receives real-time signals via SSE stream and displays live toast alert', async () => {
    let mockEventSourceInstance: any = null;

    class MockEventSource {
      url: string;
      listeners: Record<string, ((e: any) => void)[]>;
      constructor(url: string) {
        this.url = url;
        this.listeners = {};
        mockEventSourceInstance = this;
        setTimeout(() => {
          if (this.listeners['connected']) {
            this.listeners['connected'].forEach((h) => h({ data: '{}' }));
          }
        }, 10);
      }
      addEventListener(event: string, handler: (e: any) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
      }
      close() {}
    }

    (window as any).EventSource = MockEventSource;
    (globalThis as any).EventSource = MockEventSource;

    vi.spyOn(portalApi, 'fetchPortalSections').mockResolvedValue({
      sections: MOCK_SECTIONS,
      isOffline: false,
    });
    vi.spyOn(portalApi, 'fetchPortalItems').mockResolvedValue({
      items: MOCK_ITEMS,
      next_cursor: null,
      has_more: false,
      limit: 10,
      isOffline: false,
    });

    render(<TelemetryPortal />);

    // 1. Wait for initial mount and data load to complete
    expect(await screen.findByText('QUANTUM DISPATCHES')).toBeInTheDocument();
    expect(await screen.findByText(/LIVE TELEMETRY STREAM/i)).toBeInTheDocument();

    // 2. Trigger live incoming signal via EventSource
    const incomingSignal = {
      id: 'sig-live-stream-999',
      title: 'Diamond NV-Center Quantum Repeater Reaches 1,000 Nodes',
      section: 'research',
      source: 'arXiv:quant-ph',
      summary: 'Quantum repeater breakthrough',
    };

    expect(mockEventSourceInstance).not.toBeNull();
    await act(async () => {
      if (mockEventSourceInstance?.listeners['signal']) {
        mockEventSourceInstance.listeners['signal'].forEach((h: any) =>
          h({ data: JSON.stringify({ event: 'signal', data: incomingSignal }) })
        );
      }
    });

    // 3. Verify live toast pops up with signal title and toast header
    const titleElements = await screen.findAllByText(incomingSignal.title);
    expect(titleElements.length).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(STREAM_STRINGS.NEW_SIGNAL_TOAST, 'i'))).toBeInTheDocument();

    // Clean up
    delete (window as any).EventSource;
    delete (globalThis as any).EventSource;
  });
});

