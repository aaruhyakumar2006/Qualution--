import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Rss,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  X,
  RefreshCw,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  batchImportSignals,
  getPortalRssUrl,
  getPortalBibtexUrl
} from '../api/portalApi';
import { IMPORT_STRINGS } from '../constants/portalConstants';
import { supabase } from '../../../lib/supabase';

export default function BatchImportSignalsModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const [activeTab, setActiveTab] = useState('paste'); // 'paste' | 'file' | 'syndication'
  const [rawText, setRawText] = useState('');
  const [defaultSection, setDefaultSection] = useState('papers');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [copiedRss, setCopiedRss] = useState(false);
  const [copiedBibtex, setCopiedBibtex] = useState(false);

  if (!isOpen) return null;

  async function handleImportSubmit(e) {
    e.preventDefault();
    if (!rawText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setImportResult(null);

    try {
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      } catch (e) {}
      if (!token) token = localStorage.getItem('token') || 'usr-teacher-prof-ram';

      const format = rawText.trim().startsWith('[') || rawText.trim().startsWith('{')
        ? 'json'
        : 'bibtex';

      const payload = {
        raw_bibtex: format === 'bibtex' ? rawText : undefined,
        items: format === 'json' ? JSON.parse(rawText) : undefined,
        format,
        default_section: defaultSection
      };

      const resp = await batchImportSignals(payload, token);
      setImportResult(resp);
      if (resp.imported_count > 0 && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('[BatchImportSignalsModal] Error importing signals:', err);
      setError(err?.message || 'Failed to batch import signals.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setRawText(content);
        setActiveTab('paste');
      }
    };
    reader.readAsText(file);
  }

  const copyToClipboard = (text, isRss = true) => {
    navigator.clipboard.writeText(text);
    if (isRss) {
      setCopiedRss(true);
      setTimeout(() => setCopiedRss(false), 2000);
    } else {
      setCopiedBibtex(true);
      setTimeout(() => setCopiedBibtex(false), 2000);
    }
  };

  const rssUrl = getPortalRssUrl();
  const bibtexUrl = getPortalBibtexUrl();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      data-testid="batch-import-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-import-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="batch-import-title"
                className="text-lg font-bold tracking-wide text-white flex items-center gap-2"
              >
                {IMPORT_STRINGS.MODAL_TITLE}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/40 text-indigo-300 font-mono">
                  Syndication Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Directly import research bibliographies or subscribe via RSS / Overleaf LaTeX feeds
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
            data-testid="close-import-modal"
            aria-label="Close batch import modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'paste'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-import-paste"
          >
            <FileText className="w-4 h-4" />
            {IMPORT_STRINGS.PASTE_TAB}
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-import-file"
          >
            <Upload className="w-4 h-4" />
            {IMPORT_STRINGS.FILE_TAB}
          </button>
          <button
            onClick={() => setActiveTab('syndication')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'syndication'
                ? 'border-indigo-400 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-import-syndication"
          >
            <Rss className="w-4 h-4" />
            {IMPORT_STRINGS.SYNDICATION_TAB}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {importResult && (
            <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-4" data-testid="import-results-summary">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                {IMPORT_STRINGS.IMPORT_SUCCESS}
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-slate-400">{IMPORT_STRINGS.TOTAL_RECEIVED}:</span>
                  <div className="text-lg font-bold text-white mt-1">{importResult.total_received}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-emerald-400">{IMPORT_STRINGS.IMPORTED_COUNT}:</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1" data-testid="imported-count-result">{importResult.imported_count}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="text-amber-400">{IMPORT_STRINGS.SKIPPED_DUPLICATE}:</span>
                  <div className="text-lg font-bold text-amber-400 mt-1">{importResult.skipped_count}</div>
                </div>
              </div>

              {importResult.results?.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
                  {importResult.results.map((res, rIdx) => (
                    <div key={rIdx} className="flex items-center justify-between p-2 rounded bg-slate-950/50 border border-slate-800/60">
                      <span className="text-slate-200 truncate max-w-md">{res.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                        res.status === 'imported'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                      }`}>
                        {res.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'paste' && (
            <form onSubmit={handleImportSubmit} className="space-y-4" data-testid="batch-import-paste-form">
              <div className="flex items-center justify-between gap-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {IMPORT_STRINGS.DEFAULT_SECTION_LABEL}
                </label>
                <select
                  value={defaultSection}
                  onChange={(e) => setDefaultSection(e.target.value)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-400"
                >
                  <option value="papers">Peer-Reviewed Papers</option>
                  <option value="preprints">arXiv Preprints</option>
                  <option value="hardware">Hardware Telemetry</option>
                  <option value="research">Research Insights</option>
                  <option value="news">Community News</option>
                </select>
              </div>

              <div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={IMPORT_STRINGS.RAW_INPUT_PLACEHOLDER}
                  rows={9}
                  className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-400 transition-colors custom-scrollbar"
                  data-testid="raw-bibtex-input"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!rawText.trim() || isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                  data-testid="submit-batch-import-btn"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {IMPORT_STRINGS.IMPORTING_BTN}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {IMPORT_STRINGS.IMPORT_BTN}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'file' && (
            <div className="p-8 border-2 border-dashed border-slate-700 hover:border-indigo-400/60 rounded-2xl flex flex-col items-center justify-center gap-3 transition-colors bg-slate-950/40">
              <Upload className="w-10 h-10 text-indigo-400" />
              <p className="text-sm text-slate-300 font-medium text-center">
                {IMPORT_STRINGS.DRAG_DROP_PROMPT}
              </p>
              <label className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition-colors">
                Browse Files
                <input
                  type="file"
                  accept=".bib,.json,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="file-upload-input"
                />
              </label>
            </div>
          )}

          {activeTab === 'syndication' && (
            <div className="space-y-4">
              {/* RSS 2.0 Card */}
              <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Rss className="w-5 h-5 text-amber-400" />
                    <h4 className="text-sm font-semibold text-white">
                      {IMPORT_STRINGS.RSS_FEED_TITLE}
                    </h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 border border-amber-500/30 text-amber-300 font-mono">
                    RSS 2.0 XML
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {IMPORT_STRINGS.RSS_FEED_DESC}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={rssUrl}
                    className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-cyan-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(rssUrl, true)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedRss ? 'Copied!' : IMPORT_STRINGS.COPY_FEED_URL}
                  </button>
                  <a
                    href={rssUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 transition-colors"
                    title="Open RSS Feed"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Master BibTeX Catalog Card */}
              <div className="p-5 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    <h4 className="text-sm font-semibold text-white">
                      {IMPORT_STRINGS.BIBTEX_FEED_TITLE}
                    </h4>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-300 font-mono">
                    BibTeX UTF-8
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {IMPORT_STRINGS.BIBTEX_FEED_DESC}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={bibtexUrl}
                    className="flex-1 p-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-cyan-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(bibtexUrl, false)}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedBibtex ? 'Copied!' : IMPORT_STRINGS.COPY_FEED_URL}
                  </button>
                  <a
                    href={bibtexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 transition-colors"
                    title="Open BibTeX Catalog"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
