import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Activity,
  Zap,
  Sliders,
  Sparkles,
  BarChart3,
  ShieldCheck,
  X,
  Play,
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';
import {
  fetchPulsePresets,
  simulatePulseWaveform
} from '../api/portalApi';
import { PULSE_VISUALIZER_STRINGS } from '../constants/portalConstants';

export default function PulseCalibrationVisualizerModal({
  isOpen,
  onClose,
  onLaunchWorkbench
}) {
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState('ibm-heron-drag-x90');
  const [activeTab, setActiveTab] = useState('waveform'); // 'waveform' | 'spectrum'

  // Parameters
  const [pulseType, setPulseType] = useState('drag');
  const [durationNs, setDurationNs] = useState(32.0);
  const [amplitude, setAmplitude] = useState(0.85);
  const [sigmaNs, setSigmaNs] = useState(6.5);
  const [betaDrag, setBetaDrag] = useState(0.34);
  const [detuningMhz, setDetuningMhz] = useState(0.0);

  const [simResult, setSimResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    loadPresets();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    runSimulation();
  }, [isOpen, pulseType, durationNs, amplitude, sigmaNs, betaDrag, detuningMhz]);

  async function loadPresets() {
    try {
      const data = await fetchPulsePresets();
      setPresets(data);
    } catch (err) {
      console.error('[PulseCalibrationVisualizerModal] Failed to fetch presets:', err);
    }
  }

  function handleSelectPreset(presetId) {
    setSelectedPresetId(presetId);
    const p = presets.find((item) => item.id === presetId);
    if (p) {
      setPulseType(p.pulse_type);
      setDurationNs(p.duration_ns);
      setAmplitude(p.amplitude);
      setSigmaNs(p.sigma_ns);
      setBetaDrag(p.beta_drag);
      setDetuningMhz(p.detuning_mhz);
    }
  }

  async function runSimulation() {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await simulatePulseWaveform({
        pulse_type: pulseType,
        duration_ns: durationNs,
        amplitude,
        sigma_ns: sigmaNs,
        beta_drag: betaDrag,
        detuning_mhz: detuningMhz,
        samples_count: 100
      });
      setSimResult(resp);
    } catch (err) {
      console.error('[PulseCalibrationVisualizerModal] Simulation error:', err);
      setError(err?.message || 'Failed to simulate pulse calibration.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isOpen) return null;

  // Render SVG Path for time domain samples
  const width = 600;
  const height = 180;
  const samples = simResult?.samples || [];
  const maxAmp = Math.max(1.0, ...samples.map((s) => Math.max(Math.abs(s.i_real), Math.abs(s.q_imag), s.envelope)));

  const getSvgY = (val) => height / 2 - (val / maxAmp) * (height / 2 - 15);
  const getSvgX = (t) => (t / Math.max(1, durationNs)) * width;

  const iPath = samples.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(s.t_ns).toFixed(1)} ${getSvgY(s.i_real).toFixed(1)}`).join(' ');
  const qPath = samples.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(s.t_ns).toFixed(1)} ${getSvgY(s.q_imag).toFixed(1)}`).join(' ');
  const envPath = samples.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${getSvgX(s.t_ns).toFixed(1)} ${getSvgY(s.envelope).toFixed(1)}`).join(' ');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in"
      data-testid="pulse-visualizer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pulse-modal-title"
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-indigo-500/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h2
                id="pulse-modal-title"
                className="text-lg font-bold tracking-wide text-white flex items-center gap-2"
              >
                {PULSE_VISUALIZER_STRINGS.MODAL_TITLE}
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-mono">
                  DRAG Microwave Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                {PULSE_VISUALIZER_STRINGS.SUBTITLE}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors"
            data-testid="close-pulse-modal"
            aria-label="Close pulse visualizer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Selector Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3 bg-slate-950/50 border-b border-slate-800 gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase text-slate-400">
              {PULSE_VISUALIZER_STRINGS.SELECT_PRESET}
            </span>
          </div>

          <div className="flex flex-wrap gap-2" data-testid="pulse-presets-list">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  selectedPresetId === p.id
                    ? 'bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                }`}
                data-testid={`preset-btn-${p.id}`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top KPI Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                {PULSE_VISUALIZER_STRINGS.DRAG_LEAKAGE_SUPPRESSION}
              </span>
              <div className="text-xl font-mono font-bold text-emerald-400" data-testid="leakage-suppression-kpi">
                {simResult?.leakage_suppression_ratio || 99.4}%
              </div>
              <span className="text-[10px] text-slate-500">|1⟩ → |2⟩ non-computational</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                {PULSE_VISUALIZER_STRINGS.ESTIMATED_FIDELITY}
              </span>
              <div className="text-xl font-mono font-bold text-cyan-300" data-testid="fidelity-kpi">
                {(simResult?.estimated_gate_fidelity ? (simResult.estimated_gate_fidelity * 100).toFixed(2) : 99.94)}%
              </div>
              <span className="text-[10px] text-slate-500">State overlap tomography</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                {PULSE_VISUALIZER_STRINGS.EFFECTIVE_AREA}
              </span>
              <div className="text-xl font-mono font-bold text-amber-400">
                {simResult?.effective_area_pi || 1.0} π rad
              </div>
              <span className="text-[10px] text-slate-500">Rabi oscillation angle</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                Gate Target
              </span>
              <div className="text-xl font-mono font-bold text-indigo-400">
                {simResult?.gate_name || 'X (π-pulse)'}
              </div>
              <span className="text-[10px] text-slate-500">{pulseType.toUpperCase()} envelope</span>
            </div>
          </div>

          {/* Interactive Graph Tabs */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex gap-3">
                <button
                  onClick={() => setActiveTab('waveform')}
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'waveform'
                      ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="tab-pulse-waveform"
                >
                  {PULSE_VISUALIZER_STRINGS.WAVEFORM_TAB}
                </button>
                <button
                  onClick={() => setActiveTab('spectrum')}
                  className={`text-xs font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === 'spectrum'
                      ? 'bg-cyan-500/10 border border-cyan-500/40 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  data-testid="tab-pulse-spectrum"
                >
                  {PULSE_VISUALIZER_STRINGS.SPECTRUM_TAB}
                </button>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-emerald-400" />
                  <span>I(t) Real</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-indigo-400" />
                  <span>Q(t) DRAG</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-t border-dashed border-cyan-400" />
                  <span>|Ω(t)| Envelope</span>
                </div>
              </div>
            </div>

            {/* SVG Waveform Visualizer */}
            {activeTab === 'waveform' ? (
              <div className="relative w-full h-[200px] bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden p-2">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-full"
                  data-testid="pulse-waveform-svg"
                >
                  {/* Grid Lines */}
                  <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#334155" strokeDasharray="3,3" strokeWidth="1" />
                  <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="#334155" strokeDasharray="3,3" strokeWidth="1" />

                  {/* Waveform Paths */}
                  <path d={envPath} fill="none" stroke="#22D3EE" strokeWidth="1.5" strokeDasharray="4,4" opacity="0.6" />
                  <path d={iPath} fill="none" stroke="#34D399" strokeWidth="2.5" />
                  {pulseType === 'drag' && (
                    <path d={qPath} fill="none" stroke="#818CF8" strokeWidth="2" />
                  )}
                </svg>

                <div className="absolute bottom-2 left-4 text-[10px] font-mono text-slate-500">
                  t = 0.0 ns
                </div>
                <div className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-500">
                  t = {durationNs} ns
                </div>
              </div>
            ) : (
              /* FFT Power Spectrum Bar Chart */
              <div className="h-[200px] flex items-end justify-between gap-1 p-4 bg-slate-950 rounded-xl border border-slate-800" data-testid="spectrum-bars-container">
                {simResult?.spectrum?.map((pt, pIdx) => {
                  const normalizedH = Math.max(10, Math.min(180, (pt.power_db + 40) * 3));
                  return (
                    <div key={pIdx} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        className="w-full rounded-t bg-cyan-500/60 group-hover:bg-cyan-400 transition-all"
                        style={{ height: `${normalizedH}px` }}
                        title={`Freq: ${pt.frequency_mhz} MHz, Power: ${pt.power_db} dB`}
                      />
                      <span className="text-[9px] font-mono text-slate-500">{pt.frequency_mhz}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interactive Sliders Control Panel */}
          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Dynamic Microwave Pulse Synthesis Controls
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              {/* Duration Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>{PULSE_VISUALIZER_STRINGS.DURATION_LABEL}</span>
                  <span className="font-mono text-white font-bold">{durationNs} ns</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  step={2}
                  value={durationNs}
                  onChange={(e) => setDurationNs(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                  data-testid="slider-duration"
                />
              </div>

              {/* Amplitude Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>{PULSE_VISUALIZER_STRINGS.AMPLITUDE_LABEL}</span>
                  <span className="font-mono text-white font-bold">{amplitude}</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  value={amplitude}
                  onChange={(e) => setAmplitude(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                  data-testid="slider-amplitude"
                />
              </div>

              {/* Sigma (Width) Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>{PULSE_VISUALIZER_STRINGS.SIGMA_LABEL}</span>
                  <span className="font-mono text-white font-bold">{sigmaNs} ns</span>
                </div>
                <input
                  type="range"
                  min={1.0}
                  max={40.0}
                  step={0.5}
                  value={sigmaNs}
                  onChange={(e) => setSigmaNs(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                  data-testid="slider-sigma"
                />
              </div>

              {/* DRAG Beta Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>{PULSE_VISUALIZER_STRINGS.BETA_DRAG_LABEL}</span>
                  <span className="font-mono text-white font-bold">{betaDrag}</span>
                </div>
                <input
                  type="range"
                  min={-1.0}
                  max={1.0}
                  step={0.02}
                  value={betaDrag}
                  onChange={(e) => setBetaDrag(parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 cursor-pointer"
                  data-testid="slider-beta"
                />
              </div>

              {/* Detuning Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>{PULSE_VISUALIZER_STRINGS.DETUNING_LABEL}</span>
                  <span className="font-mono text-white font-bold">{detuningMhz} MHz</span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={5}
                  value={detuningMhz}
                  onChange={(e) => setDetuningMhz(parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                  data-testid="slider-detuning"
                />
              </div>

              {/* Pulse Type Selector */}
              <div className="space-y-1.5">
                <label className="text-slate-400 block">Envelope Function:</label>
                <select
                  value={pulseType}
                  onChange={(e) => setPulseType(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
                  data-testid="select-pulse-type"
                >
                  <option value="drag">DRAG Derivative</option>
                  <option value="gaussian">Gaussian</option>
                  <option value="gaussian_square">Gaussian Square</option>
                  <option value="cross_resonance">Cross-Resonance Echo</option>
                  <option value="square">Square / Slepian</option>
                </select>
              </div>
            </div>
          </div>

          {/* Qubit Architecture & Calibration Advice */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Info className="w-4 h-4" />
              {PULSE_VISUALIZER_STRINGS.RECOMMENDED_QUBIT}: {simResult?.recommended_qubit_type}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {simResult?.calibration_advice}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              if (onLaunchWorkbench) onLaunchWorkbench(selectedPresetId);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-600/20"
            data-testid="launch-workbench-pulse-btn"
          >
            <Zap className="w-4 h-4" />
            {PULSE_VISUALIZER_STRINGS.LAUNCH_WORKBENCH_PULSE}
          </button>
        </div>
      </div>
    </div>
  );
}
