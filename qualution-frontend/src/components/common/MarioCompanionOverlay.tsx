import React, { useState } from 'react';
import type { MarioTurnResponse } from '../../services/marioEngineApi';

interface MarioCompanionOverlayProps {
  currentTurn: MarioTurnResponse | null;
  onStuckClick?: () => void;
  onRequestExperiment?: () => void;
  isLoading?: boolean;
}

export const MarioCompanionOverlay: React.FC<MarioCompanionOverlayProps> = ({
  currentTurn,
  onStuckClick,
  onRequestExperiment,
  isLoading = false
}) => {
  const [collapsed, setCollapsed] = useState(false);

  if (!currentTurn) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
        collapsed ? 'w-16 h-16 rounded-full' : 'w-96 rounded-2xl'
      } bg-slate-900/95 border border-purple-500/30 shadow-2xl backdrop-blur-md p-4 text-white font-sans`}
      style={{ pointerEvents: 'auto' }}
    >
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-full h-full flex items-center justify-center rounded-full bg-purple-600 hover:bg-purple-500 text-2xl shadow-lg transition-transform hover:scale-105"
          title="Open Mario Companion"
          aria-label="Open Mario Companion"
        >
          🍄
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍄</span>
              <div>
                <div className="font-bold text-sm tracking-wide text-purple-300">MARIO TUTOR</div>
                <div className="text-xs text-slate-400">
                  Level {currentTurn.hint_level || 1} • {currentTurn.state}
                </div>
              </div>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700"
              title="Collapse Panel"
              aria-label="Collapse Panel"
            >
              ✕
            </button>
          </div>

          {/* Turn Text */}
          <div className="text-sm text-slate-200 leading-relaxed min-h-[48px] flex items-center">
            {isLoading ? (
              <span className="text-purple-400 animate-pulse">Mario is analyzing quantum physics...</span>
            ) : (
              currentTurn.text
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onStuckClick}
              className="flex-1 py-1.5 px-3 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 rounded-lg text-xs font-medium text-amber-200 transition-colors"
              title="Request next hint"
            >
              💡 I'm Stuck
            </button>
            {currentTurn.experiment_id && (
              <button
                onClick={onRequestExperiment}
                className="flex-1 py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 rounded-lg text-xs font-medium text-purple-200 transition-colors"
                title="Run Universe A vs Universe B experiment"
              >
                🔬 Run Experiment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
