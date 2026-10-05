import React from 'react';
import { ExperimentDiffResponse } from '../../services/marioEngineApi';

interface UniverseComparisonPanelProps {
  experiment: ExperimentDiffResponse | null;
  onClose: () => void;
}

export const UniverseComparisonPanel: React.FC<UniverseComparisonPanelProps> = ({
  experiment,
  onClose
}) => {
  if (!experiment) return null;

  const { universe_a, universe_b, diff_summary } = experiment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="w-full max-w-4xl bg-slate-900 border border-purple-500/40 rounded-2xl shadow-2xl p-6 text-white flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xl font-bold text-purple-300">Parallel Universes Experiment</h3>
            <p className="text-xs text-slate-400">Comparing Original Physics (Universe A) vs Misconception Variant (Universe B)</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs"
          >
            Close ✕
          </button>
        </div>

        {/* Diff Summary Badge */}
        <div className="flex items-center justify-around bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs">
          <div className="text-center">
            <span className="text-slate-400 block">TVD Distance</span>
            <span className="text-base font-bold text-amber-400">{diff_summary.tvd_distance.toFixed(4)}</span>
          </div>
          <div className="text-center">
            <span className="text-slate-400 block">Purity Delta</span>
            <span className="text-base font-bold text-purple-400">{diff_summary.purity_delta.toFixed(4)}</span>
          </div>
          <div className="text-center">
            <span className="text-slate-400 block">Distinguishable?</span>
            <span className={`text-base font-bold ${diff_summary.is_distinguishable ? 'text-emerald-400' : 'text-red-400'}`}>
              {diff_summary.is_distinguishable ? 'YES (Measurable Diff)' : 'NO (Indistinguishable)'}
            </span>
          </div>
        </div>

        {/* Split Screen Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Universe A */}
          <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-emerald-400 text-sm">{universe_a.label}</span>
              <span className="text-xs text-slate-400">Purity: {universe_a.purity.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block font-semibold">Measurement Probabilities</span>
              {Object.entries(universe_a.probabilities).map(([state, prob]) => (
                <div key={state} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-mono text-emerald-300">|{state}⟩</span>
                  <div className="flex-1 bg-slate-800 h-4 rounded overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${(prob * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-slate-300">{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Universe B */}
          <div className="bg-slate-950 border border-purple-500/30 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold text-purple-400 text-sm">{universe_b.label}</span>
              <span className="text-xs text-slate-400">Purity: {universe_b.purity.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-slate-400 block font-semibold">Measurement Probabilities</span>
              {Object.entries(universe_b.probabilities).map(([state, prob]) => (
                <div key={state} className="flex items-center gap-2 text-xs">
                  <span className="w-8 font-mono text-purple-300">|{state}⟩</span>
                  <div className="flex-1 bg-slate-800 h-4 rounded overflow-hidden">
                    <div
                      className="bg-purple-500 h-full transition-all duration-300"
                      style={{ width: `${(prob * 100).toFixed(1)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right font-mono text-slate-300">{(prob * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
