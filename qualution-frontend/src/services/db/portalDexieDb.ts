import Dexie, { type Table } from 'dexie';

export interface CachedPortalItem {
  id: string;
  source: string;
  source_tier: number;
  section: string;
  title: string;
  canonical_url: string;
  title_hash?: string;
  published_at: string;
  abstract?: string;
  summary?: string;
  level?: string;
  tags?: string[];
  curriculum_tags?: string[];
  enriched?: boolean;
  prompt_version?: string;
  cached_at: number;
}

export interface CachedPortalSection {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  accent: string;
  accentDark: string;
  item_count: number;
}

export interface CachedCurriculumTag {
  tag: string;
  lesson_id: string;
  label: string;
}

const DEXIE_MAX_ITEMS = Number(import.meta.env.VITE_DEXIE_CACHE_SIZE) || 50;

export class PortalOfflineDatabase extends Dexie {
  items!: Table<CachedPortalItem, string>;
  sections!: Table<CachedPortalSection, string>;
  curriculum_tags!: Table<CachedCurriculumTag, string>;

  constructor() {
    super('QualutionPortalDb');
    this.version(1).stores({
      items: 'id, section, level, published_at, canonical_url, cached_at',
      sections: 'id',
      curriculum_tags: 'tag, lesson_id',
    });
  }
}

export const portalDb = new PortalOfflineDatabase();

/**
 * Persists an array of items to Dexie IndexedDB and trims older entries beyond DEXIE_MAX_ITEMS.
 */
export async function savePortalItemsToCache(items: any[]): Promise<void> {
  if (!items || items.length === 0) return;
  try {
    const now = Date.now();
    const rows: CachedPortalItem[] = items.map((it) => ({
      ...it,
      cached_at: now,
    }));
    await portalDb.items.bulkPut(rows);

    // Keep cache bounded to DEXIE_MAX_ITEMS
    const count = await portalDb.items.count();
    if (count > DEXIE_MAX_ITEMS) {
      const excess = count - DEXIE_MAX_ITEMS;
      const oldestKeys = await portalDb.items
        .orderBy('cached_at')
        .limit(excess)
        .primaryKeys();
      await portalDb.items.bulkDelete(oldestKeys);
    }
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to cache items:', err);
  }
}

import { FALLBACK_SECTIONS, FALLBACK_ITEMS } from '../../pages/teacher-portal/data/portalSeedFallback';

/**
 * Retrieves cached portal items filtered by section, level, or search term for offline browsing.
 */
export async function getPortalItemsFromCache(
  section?: string | null,
  level?: string | null,
  searchQuery?: string | null
): Promise<any[]> {
  try {
    let items = await portalDb.items.orderBy('published_at').reverse().toArray();

    // If Dexie is empty on initial boot, auto-populate with FALLBACK_ITEMS
    if (!items || items.length === 0) {
      items = FALLBACK_ITEMS.map((it) => ({ ...it, cached_at: Date.now() }));
      savePortalItemsToCache(items).catch(() => {});
    }

    if (section && section.toLowerCase() !== 'all') {
      items = items.filter((i) => i.section?.toLowerCase() === section.toLowerCase());
    }

    if (level && level !== 'ALL') {
      items = items.filter((i) => i.level?.toLowerCase() === level.toLowerCase());
    }

    if (searchQuery && searchQuery.trim().length >= 2) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title?.toLowerCase().includes(q) ||
          i.summary?.toLowerCase().includes(q) ||
          i.abstract?.toLowerCase().includes(q) ||
          i.tags?.some((t: string) => t.toLowerCase().includes(q))
      );
    }

    return items;
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to read items from cache:', err);
    let items: any[] = FALLBACK_ITEMS;
    if (section && section.toLowerCase() !== 'all') {
      items = items.filter((i) => i.section?.toLowerCase() === section.toLowerCase());
    }
    if (level && level !== 'ALL') {
      items = items.filter((i) => i.level?.toLowerCase() === level.toLowerCase());
    }
    return items;
  }
}

/**
 * Caches section metadata.
 */
export async function savePortalSectionsToCache(sections: CachedPortalSection[]): Promise<void> {
  try {
    await portalDb.sections.bulkPut(sections);
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to cache sections:', err);
  }
}

/**
 * Retrieves cached sections metadata.
 */
export async function getPortalSectionsFromCache(): Promise<CachedPortalSection[]> {
  try {
    const list = await portalDb.sections.toArray();
    if (list && list.length > 0) return list;
    // Auto-populate Dexie with FALLBACK_SECTIONS
    savePortalSectionsToCache(FALLBACK_SECTIONS).catch(() => {});
    return FALLBACK_SECTIONS;
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to read sections from cache:', err);
    return FALLBACK_SECTIONS;
  }
}

/**
 * Caches curriculum tags mapping.
 */
export async function saveCurriculumTagsToCache(tags: CachedCurriculumTag[]): Promise<void> {
  if (!tags || tags.length === 0) return;
  try {
    await portalDb.curriculum_tags.bulkPut(tags);
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to cache curriculum tags:', err);
  }
}

/**
 * Retrieves cached curriculum tags mapping.
 */
export async function getCurriculumTagsFromCache(): Promise<CachedCurriculumTag[]> {
  try {
    return await portalDb.curriculum_tags.toArray();
  } catch (err) {
    console.warn('[PortalDexieDb] Failed to read curriculum tags from cache:', err);
    return [];
  }
}
