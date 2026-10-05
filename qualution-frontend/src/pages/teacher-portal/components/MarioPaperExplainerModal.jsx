import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  BrainCircuit,
  GraduationCap,
  Cpu,
  ArrowRight,
  Send,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  GitFork,
  X,
  RefreshCw,
  BookOpen
} from 'lucide-react';
import { explainPaperWithMario } from '../api/portalApi';
import { MARIO_EXPLAINER_STRINGS } from '../constants/portalConstants';

export default function MarioPaperExplainerModal({
  isOpen,
  onClose,
  signalItem,
  onLaunchWorkbench
}) {
  const [selectedTier, setSelectedTier] = useState('beginner'); // 'beginner' | 'undergraduate' | 'practitioner'
  const [explanationData, setExplanationData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userQuery, setUserQuery] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && signalItem) {
      loadExplanation();
    }
  }, [isOpen, signalItem]);

  async function loadExplanation(queryText = '') {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await explainPaperWithMario({
        item_id: signalItem?.id,
        title: signalItem?.title,
        abstract: signalItem?.abstract || signalItem?.summary || signalItem?.note,
        selected_tier: selectedTier,
        user_query: queryText || undefined
      });
      setExplanationData(resp);
    } catch (err) {
      console.error('[MarioPaperExplainerModal] Error loading explanation:', err);
      setError(err?.message || 'Failed to generate Mario Quantum AI explanation.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAskSubmit(e) {
    e.preventDefault();
    if (!userQuery.trim() || isAsking) return;
    setIsAsking(true);
    await loadExplanation(userQuery.trim());
    setIsAsking(false);
    setUserQuery('');
  }

  if (!isOpen) return null;

  const currentTierData = explanationData?.tiers?.[selectedTier];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      data-testid="mario-explainer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mario-explainer-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-900/95 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="mario-explainer-title"
                className="text-lg font-bold tracking-wide text-white flex items-center gap-2"
              >
                {MARIO_EXPLAINER_STRINGS.MODAL_TITLE}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500/40 text-amber-300 font-mono">
                  {MARIO_EXPLAINER_STRINGS.ASSISTANT_NAME}
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xl">
                {signalItem?.title || 'Quantum Research Literature'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
            data-testid="close-mario-explainer"
            aria-label="Close explainer modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Difficulty Tier Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6">
          <button
            onClick={() => setSelectedTier('beginner')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              selectedTier === 'beginner'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-tier-beginner"
          >
            <Lightbulb className="w-4 h-4" />
            {MARIO_EXPLAINER_STRINGS.TIER_BEGINNER_LABEL}
          </button>
          <button
            onClick={() => setSelectedTier('undergraduate')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              selectedTier === 'undergraduate'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-tier-undergrad"
          >
            <GraduationCap className="w-4 h-4" />
            {MARIO_EXPLAINER_STRINGS.TIER_UNDERGRAD_LABEL}
          </button>
          <button
            onClick={() => setSelectedTier('practitioner')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold uppercase tracking-wider border-b-2 transition-all ${
              selectedTier === 'practitioner'
                ? 'border-purple-400 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
            data-testid="tab-tier-practitioner"
          >
            <Cpu className="w-4 h-4" />
            {MARIO_EXPLAINER_STRINGS.TIER_PRACTITIONER_LABEL}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {isLoading && !explanationData ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
              <p className="text-sm">Mario AI is synthesizing multi-tier quantum intuition and concept map...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-sm">
              {error}
            </div>
          ) : currentTierData ? (
            <>
              {/* Core Breakdown Banner */}
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                  <BrainCircuit className="w-4 h-4" />
                  {currentTierData.title}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed font-sans">
                  {currentTierData.summary}
                </p>
              </div>

              {/* Key Breakthrough & Analogy Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {MARIO_EXPLAINER_STRINGS.KEY_BREAKTHROUGH}
                  </h4>
                  <p className="text-xs text-slate-300 leading-normal font-sans">
                    {currentTierData.key_breakthrough}
                  </p>
                </div>

                {currentTierData.analogy && (
                  <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/80 space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                      <Lightbulb className="w-4 h-4" />
                      {MARIO_EXPLAINER_STRINGS.INTUITIVE_ANALOGY}
                    </h4>
                    <p className="text-xs text-slate-300 leading-normal font-sans">
                      {currentTierData.analogy}
                    </p>
                  </div>
                )}
              </div>

              {/* Mathematical Intuition & Formalism */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {MARIO_EXPLAINER_STRINGS.MATHEMATICAL_INTUITION}
                </h4>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
                  {currentTierData.mathematical_intuition}
                </div>
              </div>

              {/* Actionable Takeaways */}
              <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-800 space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {MARIO_EXPLAINER_STRINGS.ACTIONABLE_TAKEAWAYS}
                </h4>
                <ul className="space-y-1.5">
                  {currentTierData.actionable_takeaways?.map((takeaway, tIdx) => (
                    <li key={tIdx} className="text-xs text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{takeaway}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Mathematical Concept Dependency Graph Flowchart */}
              {explanationData.concept_map && explanationData.concept_map.length > 0 && (
                <div className="p-5 rounded-xl bg-slate-800/30 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <GitFork className="w-4 h-4 text-amber-400" />
                      {MARIO_EXPLAINER_STRINGS.CONCEPT_MAP_TITLE}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {explanationData.concept_map.length} Dependency Nodes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {explanationData.concept_map.map((node) => {
                      const categoryColors = {
                        prerequisite: 'border-blue-500/40 bg-blue-950/20 text-blue-300',
                        core_mechanism: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
                        outcome: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
                        hardware_constraint: 'border-rose-500/40 bg-rose-950/20 text-rose-300'
                      };
                      const categoryLabels = {
                        prerequisite: MARIO_EXPLAINER_STRINGS.PREREQUISITE_BADGE,
                        core_mechanism: MARIO_EXPLAINER_STRINGS.CORE_MECHANISM_BADGE,
                        outcome: MARIO_EXPLAINER_STRINGS.OUTCOME_BADGE,
                        hardware_constraint: MARIO_EXPLAINER_STRINGS.HARDWARE_CONSTRAINT_BADGE
                      };

                      return (
                        <div
                          key={node.id}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5 flex flex-col justify-between"
                          data-testid={`concept-node-${node.id}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${categoryColors[node.category] || 'text-slate-300'}`}>
                                {categoryLabels[node.category] || node.category}
                              </span>
                              {node.depends_on?.length > 0 && (
                                <span className="text-[9px] text-slate-500 font-mono">
                                  dep: {node.depends_on.join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-200">
                              {node.label}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                              {node.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-slate-400 text-sm">
              {MARIO_EXPLAINER_STRINGS.NO_EXPLANATION_DATA}
            </div>
          )}
        </div>

        {/* Footer: Interactive Ask Mario Input */}
        <form
          onSubmit={handleAskSubmit}
          className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center gap-3"
          data-testid="mario-ask-form"
        >
          <div className="relative flex-1">
            <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
            <input
              type="text"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder={MARIO_EXPLAINER_STRINGS.ASK_MARIO_PLACEHOLDER}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
              data-testid="ask-mario-input"
            />
          </div>
          <button
            type="submit"
            disabled={!userQuery.trim() || isAsking}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
            data-testid="ask-mario-btn"
          >
            {isAsking ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {MARIO_EXPLAINER_STRINGS.ASKING_MARIO_BTN}
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                {MARIO_EXPLAINER_STRINGS.ASK_MARIO_BTN}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
