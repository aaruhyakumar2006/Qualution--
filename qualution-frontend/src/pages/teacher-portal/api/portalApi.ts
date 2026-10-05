import {
  savePortalItemsToCache,
  getPortalItemsFromCache,
  savePortalSectionsToCache,
  getPortalSectionsFromCache,
  saveCurriculumTagsToCache,
  getCurriculumTagsFromCache,
  type CachedPortalSection,
  type CachedCurriculumTag,
} from '../../../services/db/portalDexieDb';
import { FALLBACK_CURRICULUM_LESSON_MAP } from '../constants/portalConstants';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '');

// Dynamic in-memory cache for loaded tag mappings
let runtimeTagMap: Record<string, string> = { ...FALLBACK_CURRICULUM_LESSON_MAP };

export interface FetchItemsParams {
  section?: string | null;
  level?: string | null;
  q?: string | null;
  cursor?: string | null;
  limit?: number;
}

export interface FetchItemsResponse {
  items: any[];
  next_cursor: string | null;
  has_more: boolean;
  limit: number;
  isOffline?: boolean;
}

/**
 * Fetches the dynamic list of portal sections with online-first behavior and Dexie fallback.
 */
export async function fetchPortalSections(): Promise<{ sections: CachedPortalSection[]; isOffline: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/portal/sections`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch sections`);
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      await savePortalSectionsToCache(data);
      return { sections: data, isOffline: false };
    }
  } catch (err) {
    console.warn('[PortalAPI] Network fetch failed for sections, loading offline cache:', err);
  }

  // Offline Dexie fallback
  const cached = await getPortalSectionsFromCache();
  return { sections: cached, isOffline: true };
}

/**
 * Fetches curriculum tags from database/API, caches in Dexie, and falls back gracefully.
 */
export async function fetchCurriculumTags(): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API_BASE_URL}/portal/tags`);
    if (res.ok) {
      const data: CachedCurriculumTag[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        await saveCurriculumTagsToCache(data);
        const map: Record<string, string> = {};
        for (const item of data) {
          if (item.tag && item.lesson_id) {
            map[item.tag] = item.lesson_id;
          }
        }
        runtimeTagMap = { ...runtimeTagMap, ...map };
        return runtimeTagMap;
      }
    }
  } catch (err) {
    console.warn('[PortalAPI] Network fetch failed for curriculum tags, checking Dexie cache:', err);
  }

  // Check Dexie cache
  const cached = await getCurriculumTagsFromCache();
  if (cached && cached.length > 0) {
    const map: Record<string, string> = {};
    for (const item of cached) {
      if (item.tag && item.lesson_id) {
        map[item.tag] = item.lesson_id;
      }
    }
    runtimeTagMap = { ...runtimeTagMap, ...map };
    return runtimeTagMap;
  }

  // Static fallback
  return runtimeTagMap;
}

/**
 * Fetches portal items with search, level, and section filters, caching to Dexie.
 */
export async function fetchPortalItems(params: FetchItemsParams = {}): Promise<FetchItemsResponse> {
  const query = new URLSearchParams();
  if (params.section && params.section !== 'all') query.set('section', params.section);
  if (params.level && params.level !== 'ALL') query.set('level', params.level);
  if (params.q) query.set('q', params.q);
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', params.limit.toString());

  try {
    const res = await fetch(`${API_BASE_URL}/portal/items?${query.toString()}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to fetch items`);
    }
    const data: FetchItemsResponse = await res.json();
    if (data.items && data.items.length > 0) {
      await savePortalItemsToCache(data.items);
    }
    return { ...data, isOffline: false };
  } catch (err) {
    console.warn('[PortalAPI] Network fetch failed for items, reading from Dexie offline cache:', err);
  }

  // Offline Dexie fallback
  const cachedItems = await getPortalItemsFromCache(params.section, params.level, params.q);
  return {
    items: cachedItems.slice(0, params.limit || 10),
    next_cursor: null,
    has_more: false,
    limit: params.limit || 10,
    isOffline: true,
  };
}

/**
 * Maps curriculum tag strings to a practical Workbench lesson ID using DB-driven mappings.
 */
export function resolveLessonIdForTags(tags?: string[], customMap?: Record<string, string>): string | null {
  if (!tags || tags.length === 0) return null;
  const mapping = customMap || runtimeTagMap || FALLBACK_CURRICULUM_LESSON_MAP;
  for (const tag of tags) {
    if (mapping[tag]) {
      return mapping[tag];
    }
  }
  return null;
}

// ─── USER SUBMISSIONS & MODERATION (PHASE 1) ───────────────────────────────────

export interface SubmitSignalPayload {
  title: string;
  submission_type: string;
  note?: string;
  url?: string;
}

export interface SubmissionItem {
  id: string;
  title: string;
  submission_type: string;
  section: string;
  canonical_url: string;
  note?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'removed';
  author_id?: string | null;
  author_display_name: string;
  author_role: string;
  audience: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_reason?: string | null;
  created_at: string;
  screening?: {
    relevance_score: number;
    spam_likelihood: number;
    flags: string[];
    reason: string;
  } | null;
  report_count?: number;
  reports?: Array<{ id: string; reporter_id: string; reason: string; created_at: string }>;
}

/**
 * Submits a new community signal.
 */
export async function submitPortalSignal(
  payload: SubmitSignalPayload,
  token?: string | null
): Promise<SubmissionItem> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to submit signal (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retrieves the current authenticated user's submissions.
 */
export async function fetchMySubmissions(token?: string | null): Promise<SubmissionItem[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/submissions/mine`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch submissions (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Deletes a submission authored by the current user.
 */
export async function deletePortalSubmission(itemId: string, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/submissions/${itemId}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to delete submission (HTTP ${res.status})`);
  }
}

/**
 * Submits a moderation report for a content item.
 */
export async function reportPortalItem(
  itemId: string,
  reason: string,
  token?: string | null
): Promise<{ status: string; message: string; report_id: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/items/${itemId}/report`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to report item (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Retrieves moderation queue items for educators and admins.
 */
export async function fetchModerationQueue(
  status: string = 'pending',
  token?: string | null
): Promise<SubmissionItem[]> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/moderation/queue?status=${encodeURIComponent(status)}`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch moderation queue (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Approves a pending community submission.
 */
export async function approveSubmission(itemId: string, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/moderation/${itemId}/approve`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to approve submission (HTTP ${res.status})`);
  }
}

/**
 * Rejects a community submission with a reason.
 */
export async function rejectSubmission(
  itemId: string,
  reason: string,
  token?: string | null
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/moderation/${itemId}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to reject submission (HTTP ${res.status})`);
  }
}

/**
 * Removes an item from public view.
 */
export async function removeSubmission(
  itemId: string,
  reason?: string,
  token?: string | null
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/moderation/${itemId}/remove`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to remove item (HTTP ${res.status})`);
  }
}

export interface IngestionStatusResponse {
  scheduler_running: boolean;
  cycle_in_progress: boolean;
  interval_minutes: number;
  last_run_at?: string | null;
  last_stats?: {
    sources_processed: number;
    sources_failed: number;
    items_discovered: number;
    items_deduplicated: number;
    items_inserted: number;
    items_enriched: number;
  } | null;
}

/**
 * Retrieves the current ingestion scheduler and worker status.
 */
export async function fetchIngestionStatus(token?: string | null): Promise<IngestionStatusResponse> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/ingest/status`, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to fetch crawler status (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Triggers an immediate ingestion crawl across all active RSS/arXiv sources.
 */
export async function triggerIngestionCycle(token?: string | null): Promise<{ status: string; stats?: any }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/ingest/trigger`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to trigger ingestion (HTTP ${res.status})`);
  }

  return res.json();
}

/**
 * Updates the scheduler crawler interval dynamically in minutes.
 */
export async function updateIngestionInterval(minutes: number, token?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/ingest/interval?minutes=${minutes}`, {
    method: 'PUT',
    headers,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to update interval (HTTP ${res.status})`);
  }
}

/**
 * Subscribes to the live Server-Sent Events (SSE) telemetry stream.
 * Automatically attempts reconnects with exponential backoff on network interruption.
 */
export function subscribeToPortalStream(
  onSignal: (signal: any) => void,
  onStatusChange?: (status: 'connected' | 'disconnected' | 'connecting') => void
): () => void {
  const EventSourceImpl =
    (typeof window !== 'undefined' && (window as any).EventSource) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).EventSource) ||
    (typeof EventSource !== 'undefined' ? EventSource : null);

  if (!EventSourceImpl) {
    return () => {};
  }

  let eventSource: any = null;
  let isClosed = false;
  let reconnectTimer: any = null;
  let retryCount = 0;

  function connect() {
    if (isClosed) return;
    onStatusChange?.('connecting');

    try {
      eventSource = new EventSourceImpl(`${API_BASE_URL}/portal/stream`);

      eventSource.addEventListener('connected', () => {
        retryCount = 0;
        onStatusChange?.('connected');
      });

      eventSource.addEventListener('signal', (e: MessageEvent) => {
        try {
          const parsed = JSON.parse(e.data);
          const signalData = parsed.data || parsed;
          if (signalData && signalData.title) {
            onSignal(signalData);
          }
        } catch (err) {
          console.warn('[PortalSSE] Failed to parse stream event payload:', err);
        }
      });

      eventSource.onerror = () => {
        onStatusChange?.('disconnected');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          const backoff = Math.min(30000, 1000 * Math.pow(1.5, retryCount));
          retryCount++;
          reconnectTimer = setTimeout(connect, backoff);
        }
      };
    } catch {
      onStatusChange?.('disconnected');
      if (!isClosed) {
        reconnectTimer = setTimeout(connect, 5000);
      }
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    onStatusChange?.('disconnected');
  };
}

export interface QPUTopologyNode {
  qubit_id: number;
  t1_us: number;
  t2_us: number;
  readout_error: number;
  neighbors: number[];
}

export interface QPUCalibrationMetrics {
  avg_1q_error: number;
  avg_2q_error: number;
  avg_t1_us: number;
  avg_t2_us: number;
  readout_fidelity: number;
  calibration_timestamp: string;
}

export interface QPUHardwareProvider {
  id: string;
  name: string;
  provider: string;
  architecture: string;
  qubit_count: number;
  status: string;
  queue_depth: number;
  est_wait_time_sec: number;
  topology_type: string;
  calibration: QPUCalibrationMetrics;
  topology_nodes: QPUTopologyNode[];
  tags: string[];
}

export interface HardwareTelemetryResponse {
  timestamp: string;
  total_qpus: number;
  online_qpus: number;
  providers: QPUHardwareProvider[];
}

export interface HardwareStatusSummary {
  online_count: number;
  total_count: number;
  system_status: string;
  best_2q_fidelity: number;
  lowest_queue_provider: string;
}

/**
 * Fetches full live hardware calibration metrics and QPU topology nodes.
 */
export async function fetchHardwareTelemetry(): Promise<HardwareTelemetryResponse> {
  const res = await fetch(`${API_BASE_URL}/portal/hardware/telemetry`);
  if (!res.ok) {
    throw new Error(`Failed to fetch hardware telemetry (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetches high-level hardware status summary for banner indicator.
 */
export async function fetchHardwareStatus(): Promise<HardwareStatusSummary> {
  const res = await fetch(`${API_BASE_URL}/portal/hardware/status`);
  if (!res.ok) {
    throw new Error(`Failed to fetch hardware status (HTTP ${res.status})`);
  }
  return res.json();
}

export interface BenchmarkPresetItem {
  id: string;
  name: string;
  algorithm: string;
  num_qubits: number;
  circuit_depth: number;
  gate_count: number;
  description: string;
  qasm: string;
}

export interface QPUTranspileResultItem {
  provider_id: string;
  provider_name: string;
  architecture: string;
  status: string;
  original_depth: number;
  transpiled_depth: number;
  gate_count_1q: number;
  gate_count_2q: number;
  estimated_fidelity: number;
  estimated_runtime_ms: number;
  queue_wait_sec: number;
  recommended_reason?: string;
}

export interface BenchmarkComparisonResponse {
  timestamp: string;
  benchmark_name: string;
  num_qubits: number;
  original_depth: number;
  recommended_provider_id: string;
  results: QPUTranspileResultItem[];
}

/**
 * Fetches standard quantum algorithm presets for cross-QPU benchmarking.
 */
export async function fetchBenchmarkPresets(): Promise<BenchmarkPresetItem[]> {
  const res = await fetch(`${API_BASE_URL}/portal/benchmark/presets`);
  if (!res.ok) {
    throw new Error(`Failed to fetch benchmark presets (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Compares transpilation depth, gate decomposition, and predicted fidelity across all QPUs.
 */
export async function compareCircuitAcrossQPUs(
  presetId?: string | null,
  customQasm?: string | null
): Promise<BenchmarkComparisonResponse> {
  const payload: any = {};
  if (presetId) payload.preset_id = presetId;
  if (customQasm) payload.custom_qasm = customQasm;

  const res = await fetch(`${API_BASE_URL}/portal/benchmark/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to compare circuit benchmark (HTTP ${res.status})`);
  }
  return res.json();
}

export interface TagCountItem {
  tag: string;
  count: number;
  category?: string;
}

export interface SectionBreakdownItem {
  section_id: string;
  section_name: string;
  count: number;
  percentage: number;
}

export interface AnalyticsOverviewData {
  total_signals: number;
  verified_signals: number;
  active_discussions: number;
  total_peer_reviews: number;
  avg_fidelity_score: number;
  weekly_velocity_signals: number;
  top_curriculum_tags: TagCountItem[];
  section_breakdown: SectionBreakdownItem[];
  last_updated_iso: string;
}

export interface ClusterNodeItem {
  id: string;
  label: string;
  signal_count: number;
  avg_relevance: number;
  representative_keywords: string[];
  sample_signal_ids: string[];
}

export interface ClusterEdgeItem {
  source: string;
  target: string;
  weight: number;
  shared_keywords: string[];
}

export interface TopicClustersData {
  clusters: ClusterNodeItem[];
  edges: ClusterEdgeItem[];
  total_clustered_signals: number;
  coverage_percentage: number;
  computed_at_iso: string;
}

/**
 * Fetches portal overview metrics, curriculum tag frequency distributions, and section breakdowns.
 */
export async function fetchPortalAnalyticsOverview(): Promise<AnalyticsOverviewData> {
  const res = await fetch(`${API_BASE_URL}/portal/analytics/overview`);
  if (!res.ok) {
    throw new Error(`Failed to fetch portal analytics overview (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Fetches research cluster nodes and co-occurrence graph edges.
 */
export async function fetchTopicClusters(): Promise<TopicClustersData> {
  const res = await fetch(`${API_BASE_URL}/portal/analytics/clusters`);
  if (!res.ok) {
    throw new Error(`Failed to fetch topic clusters (HTTP ${res.status})`);
  }
  return res.json();
}

export interface ConceptMapNodeItem {
  id: string;
  label: string;
  category: 'prerequisite' | 'core_mechanism' | 'outcome' | 'hardware_constraint' | string;
  description: string;
  depends_on: string[];
}

export interface ExplanationTierItem {
  tier: string;
  title: string;
  summary: string;
  key_breakthrough: string;
  mathematical_intuition: string;
  analogy?: string;
  actionable_takeaways: string[];
}

export interface ExplainPaperResponse {
  item_id?: string;
  paper_title: string;
  assistant_name: string;
  tiers: Record<string, ExplanationTierItem>;
  concept_map: ConceptMapNodeItem[];
  generated_at_iso: string;
}

export interface ExplainPaperPayload {
  item_id?: string;
  title?: string;
  abstract?: string;
  selected_tier?: string;
  user_query?: string;
}

/**
 * Generates tiered quantum explanations and concept dependency maps powered by Mario Quantum AI.
 */
export async function explainPaperWithMario(
  payload: ExplainPaperPayload
): Promise<ExplainPaperResponse> {
  const res = await fetch(`${API_BASE_URL}/portal/explain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to generate Mario AI paper explanation (HTTP ${res.status})`);
  }
  return res.json();
}

export interface BatchImportResultItemData {
  title: string;
  status: 'imported' | 'skipped_duplicate' | 'invalid' | string;
  item_id?: string;
  reason?: string;
}

export interface BatchImportResponseData {
  total_received: number;
  imported_count: number;
  skipped_count: number;
  results: BatchImportResultItemData[];
  timestamp_iso: string;
}

export interface BatchImportPayload {
  raw_bibtex?: string;
  items?: any[];
  format: 'bibtex' | 'json' | 'manual';
  default_section?: string;
}

/**
 * Batch imports signals from raw BibTeX entries or JSON items with automated title deduplication.
 */
export async function batchImportSignals(
  payload: BatchImportPayload,
  token?: string | null
): Promise<BatchImportResponseData> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}/portal/ingest/batch-import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to batch import signals (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Gets the direct syndicated RSS 2.0 XML feed URL.
 */
export function getPortalRssUrl(): string {
  return `${API_BASE_URL}/portal/export/rss`;
}

/**
 * Gets the direct master BibTeX catalog export URL.
 */
export function getPortalBibtexUrl(): string {
  return `${API_BASE_URL}/portal/export/bibtex`;
}

// =========================================================================
// PHASE 12: REAL-TIME COLLABORATION ROOMS & LIVE CO-ANNOTATIONS
// =========================================================================

export interface CollaborationUser {
  user_id: string;
  user_name: string;
  role: string;
  avatar_color: string;
  active_section?: string;
  joined_at: string;
}

export interface SignalAnnotation {
  id: string;
  item_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  selected_text: string;
  paragraph_ref: string;
  comment: string;
  tag: string;
  color: string;
  created_at: string;
  likes_count: number;
}

export interface RoomChatMessage {
  id: string;
  item_id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  message: string;
  timestamp: string;
}

export interface JoinRoomResponse {
  room_id: string;
  item_id: string;
  paper_title: string;
  active_participants: CollaborationUser[];
  annotations: SignalAnnotation[];
  recent_messages: RoomChatMessage[];
}

export interface CreateAnnotationPayload {
  item_id: string;
  selected_text: string;
  paragraph_ref?: string;
  comment: string;
  tag?: string;
  color?: string;
}

export async function joinCollaborationRoom(
  itemId: string,
  userInfo?: { user_id?: string; user_name?: string; user_role?: string },
  token?: string | null
): Promise<JoinRoomResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/portal/rooms/${encodeURIComponent(itemId)}/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify(userInfo || {}),
  });
  if (!res.ok) throw new Error(`Failed to join collaboration room (HTTP ${res.status})`);
  return res.json();
}

export async function fetchRoomAnnotations(itemId: string): Promise<SignalAnnotation[]> {
  const res = await fetch(`${API_BASE_URL}/portal/rooms/${encodeURIComponent(itemId)}/annotations`);
  if (!res.ok) throw new Error(`Failed to fetch room annotations (HTTP ${res.status})`);
  return res.json();
}

export async function createRoomAnnotation(
  itemId: string,
  payload: CreateAnnotationPayload,
  token?: string | null
): Promise<SignalAnnotation> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/portal/rooms/${encodeURIComponent(itemId)}/annotations`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create annotation (HTTP ${res.status})`);
  return res.json();
}

export async function deleteRoomAnnotation(
  itemId: string,
  annotationId: string,
  token?: string | null
): Promise<{ status: string; message: string }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/portal/rooms/${encodeURIComponent(itemId)}/annotations/${encodeURIComponent(annotationId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete annotation (HTTP ${res.status})`);
  return res.json();
}

export async function postRoomChatMessage(
  itemId: string,
  message: string,
  token?: string | null
): Promise<RoomChatMessage> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/portal/rooms/${encodeURIComponent(itemId)}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ item_id: itemId, message }),
  });
  if (!res.ok) throw new Error(`Failed to post room chat (HTTP ${res.status})`);
  return res.json();
}

// =========================================================================
// PHASE 13: QUANTUM HARDWARE PULSE-LEVEL CALIBRATION VISUALIZER
// =========================================================================

export interface PulsePreset {
  id: string;
  name: string;
  target_qpu: string;
  pulse_type: string;
  gate_name: string;
  duration_ns: number;
  sample_rate_ghz: number;
  amplitude: number;
  sigma_ns: number;
  beta_drag: number;
  phase_rad: number;
  detuning_mhz: number;
  description: string;
}

export interface PulseSamplePoint {
  t_ns: number;
  i_real: number;
  q_imag: number;
  envelope: number;
  phase: number;
}

export interface PulseFrequencyPoint {
  frequency_mhz: number;
  power_db: number;
}

export interface PulseSimulateResponse {
  pulse_type: string;
  duration_ns: number;
  gate_name: string;
  samples: PulseSamplePoint[];
  spectrum: PulseFrequencyPoint[];
  leakage_suppression_ratio: number;
  estimated_gate_fidelity: number;
  effective_area_pi: number;
  recommended_qubit_type: string;
  calibration_advice: string;
}

export interface PulseSimulatePayload {
  pulse_type?: string;
  duration_ns?: number;
  sample_rate_ghz?: number;
  amplitude?: number;
  sigma_ns?: number;
  beta_drag?: number;
  phase_rad?: number;
  detuning_mhz?: number;
  samples_count?: number;
}

export async function fetchPulsePresets(): Promise<PulsePreset[]> {
  const res = await fetch(`${API_BASE_URL}/portal/hardware/pulses/presets`);
  if (!res.ok) throw new Error(`Failed to fetch pulse presets (HTTP ${res.status})`);
  return res.json();
}

export async function simulatePulseWaveform(
  payload?: PulseSimulatePayload
): Promise<PulseSimulateResponse> {
  const res = await fetch(`${API_BASE_URL}/portal/hardware/pulses/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error(`Failed to simulate pulse waveform (HTTP ${res.status})`);
  return res.json();
}








