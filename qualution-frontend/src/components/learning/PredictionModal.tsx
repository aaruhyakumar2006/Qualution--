import React, { useState } from 'react';

interface PredictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitPrediction: (prediction: string, confidence: number) => void;
  numQubits?: number;
}

export const PredictionModal: React.FC<PredictionModalProps> = ({
  isOpen,
  onClose,
  onSubmitPrediction,
  numQubits = 1
}) => {
  const [prediction, setPrediction] = useState('0');
  const [confidence, setConfidence] = useState(2); // 1=Low, 2=Med, 3=High

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitPrediction(prediction, confidence);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl p-6 text-white">
        <h3 className="text-lg font-bold text-purple-300 mb-2">Predict Quantum Outcome</h3>
        <p className="text-xs text-slate-400 mb-4">
          Before running the simulator, what outcome do you expect to measure?
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Expected Outcome / Bitstring
            </label>
            <input
              type="text"
              value={prediction}
              onChange={(e) => setPrediction(e.target.value)}
              placeholder="e.g. 0 or 1 or 50/50"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Self-Reported Confidence
            </label>
            <div className="flex items-center gap-2">
              {[
                { val: 1, label: 'Low (Guess)' },
                { val: 2, label: 'Medium' },
                { val: 3, label: 'High (Certain)' }
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setConfidence(val)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                    confidence === val
                      ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs rounded-lg shadow-lg"
            >
              Submit Prediction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
