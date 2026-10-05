import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Network,
  Activity,
  Layers,
  Sparkles,
  Search,
  CheckCircle2,
  X,
  RefreshCw,
  Cpu,
  Share2,
  BookOpen
} from 'lucide-react';
import {
  fetchPortalAnalyticsOverview,
  fetchTopicClusters
} from '../api/portalApi';
import { ANALYTICS_STRINGS } from '../constants/portalConstants';

export default function PortalAnalyticsModal({
  isOpen,
  onClose,
  onSelectClusterTag
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'clusters'
  const [overviewData, setOverviewData] = useState(null);
  const [clustersData, setClustersData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen]);

  async function loadAnalytics() {
    setIsLoading(true);
    setError(null);
    try {
      const [ov, cl] = await Promise.all([
        fetchPortalAnalyticsOverview(),
        fetchTopicClusters()
      ]);
      setOverviewData(ov);
      setClustersData(cl);
    } catch (err) {
      console.error('[PortalAnalyticsModal] Error loading analytics data:', err);
      setError(err?.message || 'Failed to load portal analytics data.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      data-testid="portal-analytics-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-analytics-title"
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900/95 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="portal-analytics-title"
                className="text-lg font-bold tracking-wide text-white flex items-center gap-2"
              >
                {ANALYTICS_STRINGS.MODAL_TITLE}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-mono">
                  Live Telemetry
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {ANALYTICS_STRINGS.TOPIC_CLUSTERS_SUBTITLE}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAnalytics}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh Analytics Data"
              data-testid="refresh-analytics-btn"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
              data-testid="close-analytics-modal"
              aria-label="Close analytics modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'overview'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-analytics-overview"
          >
            <Activity className="w-4 h-4" />
            {ANALYTICS_STRINGS.OVERVIEW_TAB}
          </button>
          <button
            onClick={() => setActiveTab('clusters')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'clusters'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-analytics-clusters"
          >
            <Network className="w-4 h-4" />
            {ANALYTICS_STRINGS.CLUSTERS_TAB}
            {clustersData?.clusters?.length && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-900/60 text-cyan-300 font-mono">
                {clustersData.clusters.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {isLoading && !overviewData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Synthesizing live research analytics and co-occurrence graphs...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          ) : activeTab === 'overview' && overviewData ? (
            <div className="space-y-6">
              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.TOTAL_SIGNALS}</span>
                  <div className="text-2xl font-bold text-white mt-2 font-mono" data-testid="metric-total-signals">
                    {overviewData.total_signals}
                  </div>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3 h-3" /> Ingested Catalog
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.VERIFIED_SIGNALS}</span>
                  <div className="text-2xl font-bold text-cyan-400 mt-2 font-mono" data-testid="metric-verified-signals">
                    {overviewData.verified_signals}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">Tier 1 & Peer Approved</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.ACTIVE_DISCUSSIONS}</span>
                  <div className="text-2xl font-bold text-amber-400 mt-2 font-mono" data-testid="metric-discussions">
                    {overviewData.active_discussions}
                  </div>
                  <span className="text-[10px] text-amber-400/80 mt-1">Active Debates</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.TOTAL_REVIEWS}</span>
                  <div className="text-2xl font-bold text-purple-400 mt-2 font-mono" data-testid="metric-peer-reviews">
                    {overviewData.total_peer_reviews}
                  </div>
                  <span className="text-[10px] text-purple-400/80 mt-1">Logged Reviews</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.AVG_FIDELITY}</span>
                  <div className="text-2xl font-bold text-emerald-400 mt-2 font-mono" data-testid="metric-avg-fidelity">
                    {(overviewData.avg_fidelity_score * 100).toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-emerald-400/80 mt-1">Hardware Gate Fidelity</span>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
                  <span className="text-[11px] font-medium text-slate-400">{ANALYTICS_STRINGS.WEEKLY_VELOCITY}</span>
                  <div className="text-2xl font-bold text-rose-400 mt-2 font-mono" data-testid="metric-weekly-velocity">
                    +{overviewData.weekly_velocity_signals}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">New Signals / Wk</span>
                </div>
              </div>

              {/* Two Column Section Breakdown & Tag Meter */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Curriculum Tag Frequency */}
                <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-cyan-400" />
                      {ANALYTICS_STRINGS.TOP_CURRICULUM_TAGS}
                    </h3>
                    <span className="text-xs text-slate-400">Frequency Meter</span>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {overviewData.top_curriculum_tags?.map((t, idx) => {
                      const maxCount = overviewData.top_curriculum_tags[0]?.count || 1;
                      const pct = Math.round((t.count / maxCount) * 100);
                      return (
                        <div
                          key={t.tag || idx}
                          className="group flex flex-col gap-1 cursor-pointer"
                          onClick={() => onSelectClusterTag && onSelectClusterTag(t.tag)}
                          title={`Filter signals by tag: ${t.tag}`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-cyan-300 group-hover:text-cyan-200 transition-colors">
                              #{t.tag}
                            </span>
                            <span className="text-slate-400 font-mono">
                              {t.count} {ANALYTICS_STRINGS.SIGNALS_LABEL}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500 group-hover:from-cyan-400 group-hover:to-indigo-400"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section Literature Breakdown */}
                <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-800 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      {ANALYTICS_STRINGS.SECTION_BREAKDOWN}
                    </h3>
                    <span className="text-xs text-slate-400">Distribution %</span>
                  </div>

                  <div className="space-y-3 flex-1">
                    {overviewData.section_breakdown?.map((sec) => (
                      <div key={sec.section_id} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-medium text-slate-200">{sec.section_name}</span>
                          <span className="font-mono text-cyan-400 font-semibold">{sec.percentage}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                            style={{ width: `${Math.min(100, sec.percentage * 2)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span className="font-mono">ID: {sec.section_id}</span>
                          <span>{sec.count} publications</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'clusters' && clustersData ? (
            <div className="space-y-6">
              {/* Cluster Coverage Status Banner */}
              <div className="flex flex-wrap items-center justify-between p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/20 gap-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                      {ANALYTICS_STRINGS.TOPIC_CLUSTERS_TITLE}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {ANALYTICS_STRINGS.TOPIC_CLUSTERS_SUBTITLE}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="px-3 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
                    {ANALYTICS_STRINGS.COVERAGE_LABEL}: <strong className="text-cyan-400">{clustersData.coverage_percentage}%</strong>
                  </span>
                  <span className="text-slate-400">
                    {clustersData.total_clustered_signals} Signals Mapped
                  </span>
                </div>
              </div>

              {/* Research Topic Cluster Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clustersData.clusters?.map((cluster) => (
                  <div
                    key={cluster.id}
                    className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 hover:border-cyan-500/50 transition-all flex flex-col justify-between group"
                    data-testid={`cluster-card-${cluster.id}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors leading-snug">
                          {cluster.label}
                        </h4>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono">
                          {cluster.signal_count} {ANALYTICS_STRINGS.SIGNALS_LABEL}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3 font-mono">
                        <span>{ANALYTICS_STRINGS.RELEVANCE_SCORE}:</span>
                        <span className="text-emerald-400 font-bold">{(cluster.avg_relevance * 100).toFixed(0)}%</span>
                      </div>

                      {/* Keywords */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {cluster.representative_keywords?.map((kw, kIdx) => (
                          <span
                            key={kIdx}
                            className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (onSelectClusterTag && cluster.representative_keywords?.[0]) {
                          onSelectClusterTag(cluster.representative_keywords[0]);
                          onClose();
                        }
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
                      data-testid={`filter-cluster-btn-${cluster.id}`}
                    >
                      <Search className="w-3.5 h-3.5" />
                      {ANALYTICS_STRINGS.FILTER_BY_CLUSTER}
                    </button>
                  </div>
                ))}
              </div>

              {/* Co-occurrence Edges Table */}
              {clustersData.edges && clustersData.edges.length > 0 && (
                <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-800">
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Share2 className="w-4 h-4 text-cyan-400" />
                    Inter-Cluster Co-Occurrence Graph Relationships
                  </div>

                  <div className="space-y-2">
                    {clustersData.edges.map((edge, eIdx) => {
                      const sourceLabel = clustersData.clusters.find(c => c.id === edge.source)?.label || edge.source;
                      const targetLabel = clustersData.clusters.find(c => c.id === edge.target)?.label || edge.target;
                      return (
                        <div
                          key={eIdx}
                          className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 text-slate-200">
                            <span className="font-medium text-cyan-300">{sourceLabel.split(' ')[0]}...</span>
                            <span className="text-slate-500">↔</span>
                            <span className="font-medium text-indigo-300">{targetLabel.split(' ')[0]}...</span>
                          </div>

                          <div className="flex items-center gap-3 font-mono text-[11px]">
                            <span className="text-slate-400">
                              Keywords: {edge.shared_keywords.join(', ')}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 font-bold border border-slate-700">
                              {(edge.weight * 100).toFixed(0)}% affinity
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              {ANALYTICS_STRINGS.NO_ANALYTICS_DATA}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
