import React, { useState, useEffect } from 'react';
import {
  X, Cpu, Zap, Play, RefreshCw, BarChart2, Layers,
  CheckCircle, ArrowUpRight, Code, ShieldCheck, Sparkles, AlertCircle
} from 'lucide-react';
import { BENCHMARK_STRINGS } from '../constants/portalConstants';
import {
  fetchBenchmarkPresets,
  compareCircuitAcrossQPUs,
} from '../api/portalApi';

export default function QuantumBenchmarkModal({
  isOpen,
  onClose,
  onLaunchWorkbench,
  initialPresetId = 'grover_3q',
}) {
  const [presets, setPresets] = useState([]);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customQasm, setCustomQasm] = useState(`OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\nh q[0];\ncx q[0], q[1];\ncx q[1], q[2];`);
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    async function loadPresets() {
      try {
        const list = await fetchBenchmarkPresets();
        if (isMounted) {
          setPresets(list);
          if (list.length > 0 && !selectedPresetId) {
            setSelectedPresetId(list[0].id);
          }
        }
      } catch (err) {
        console.warn('[QuantumBenchmark] Failed to load presets:', err);
      }
    }
    loadPresets();
    return () => { isMounted = false; };
  }, [isOpen]);

  const runBenchmark = async (presetIdToUse, qasmToUse) => {
    try {
      setLoading(true);
      const res = await compareCircuitAcrossQPUs(
        isCustomMode ? null : (presetIdToUse || selectedPresetId),
        isCustomMode ? (qasmToUse || customQasm) : null
      );
      setComparison(res);
    } catch (err) {
      console.error('[QuantumBenchmark] Comparison failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runBenchmark(selectedPresetId, customQasm);
    }
  }, [isOpen, selectedPresetId, isCustomMode]);

  if (!isOpen) return null;

  const currentPreset = presets.find(p => p.id === selectedPresetId) || presets[0];

  const handleLaunch = (providerId) => {
    const qasmCode = isCustomMode ? customQasm : (currentPreset?.qasm || '');
    if (typeof onLaunchWorkbench === 'function') {
      onLaunchWorkbench({ qasm: qasmCode, targetProvider: providerId });
    }
  };

  return (
    <div
      className="tmt-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="tmt-modal-card"
        data-testid="quantum-benchmark-modal"
        style={{
          background: '#0B0D10',
          border: '2px solid #38BDF8',
          boxShadow: '6px 6px 0px #38BDF8',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          color: '#F8FAFC',
          fontFamily: 'var(--font-mono, monospace)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1.5px solid #38BDF8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(56, 189, 248, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BarChart2 size={20} color="#38BDF8" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, letterSpacing: '0.02em' }}>
              {BENCHMARK_STRINGS.MODAL_TITLE}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => runBenchmark(selectedPresetId, customQasm)}
              className="btn-neo btn-neo-sm"
              style={{
                background: '#38BDF8',
                color: '#0B0D10',
                fontWeight: 900,
                fontSize: '0.72rem',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
              <span>Transpile</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Algorithm Presets Tabs */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            background: '#0F131A',
          }}
        >
          {presets.map(p => {
            const isActive = !isCustomMode && selectedPresetId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedPresetId(p.id);
                  setIsCustomMode(false);
                }}
                style={{
                  background: isActive ? '#38BDF8' : '#1E293B',
                  color: isActive ? '#0B0D10' : '#CBD5E1',
                  border: '1px solid #38BDF8',
                  borderRadius: '4px',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>{p.name}</span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 4px',
                    borderRadius: '2px',
                    background: isActive ? '#0B0D10' : '#38BDF8',
                    color: isActive ? '#38BDF8' : '#0B0D10',
                    fontWeight: 900,
                  }}
                >
                  {p.num_qubits}Q
                </span>
              </button>
            );
          })}

          {/* Custom QASM Tab */}
          <button
            onClick={() => setIsCustomMode(true)}
            style={{
              background: isCustomMode ? '#FE90E9' : '#1E293B',
              color: isCustomMode ? '#0B0D10' : '#FE90E9',
              border: '1px solid #FE90E9',
              borderRadius: '4px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <Code size={13} />
            <span>{BENCHMARK_STRINGS.CUSTOM_QASM_TAB}</span>
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Custom QASM Editor (if active) */}
          {isCustomMode && (
            <div style={{ background: '#131822', border: '1px solid #FE90E9', borderRadius: '6px', padding: '0.75rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#FE90E9', fontWeight: 800, marginBottom: '0.4rem' }}>
                Paste or Edit OpenQASM 2.0 Circuit to Benchmark Across QPUs:
              </div>
              <textarea
                value={customQasm}
                onChange={e => setCustomQasm(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  background: '#0B0D10',
                  border: '1px solid #334155',
                  borderRadius: '4px',
                  color: '#F8FAFC',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
            </div>
          )}

          {/* Description & Circuit Specs */}
          {!isCustomMode && currentPreset && (
            <div style={{ background: '#131822', border: '1px solid #1E293B', borderRadius: '6px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 800, margin: '0 0 2px 0', color: '#F8FAFC' }}>
                  {currentPreset.name}
                </h3>
                <p style={{ fontSize: '0.74rem', color: '#94A3B8', margin: 0 }}>
                  {currentPreset.description}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: '#CBD5E1' }}>
                <div><strong>Qubits:</strong> {currentPreset.num_qubits}</div>
                <div><strong>Original Depth:</strong> {currentPreset.circuit_depth}</div>
                <div><strong>Gate Count:</strong> {currentPreset.gate_count}</div>
              </div>
            </div>
          )}

          {/* Comparison Matrix Cards */}
          {loading && !comparison ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94A3B8' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem auto' }} />
              <div>Simulating QPU transpilation, routing overhead, and error decay...</div>
            </div>
          ) : !comparison ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#EF4444' }}>
              {BENCHMARK_STRINGS.NO_BENCHMARK_DATA}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
              {comparison.results.map(res => {
                const isRecommended = res.provider_id === comparison.recommended_provider_id;
                const isGpu = res.architecture === 'gpu_accelerator';
                const fidColor = res.estimated_fidelity > 98 ? '#4ADE80' : res.estimated_fidelity > 85 ? '#38BDF8' : '#FCD34D';

                return (
                  <div
                    key={res.provider_id}
                    style={{
                      background: '#131822',
                      border: `1.5px solid ${isRecommended ? '#38BDF8' : '#1E293B'}`,
                      borderRadius: '6px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      position: 'relative',
                      boxShadow: isRecommended ? '0 0 12px rgba(56, 189, 248, 0.15)' : 'none',
                    }}
                  >
                    <div>
                      {/* Provider Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <h4 style={{ fontSize: '0.88rem', fontWeight: 900, margin: 0, color: '#F8FAFC' }}>
                          {res.provider_name}
                        </h4>
                        {isRecommended && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              background: '#38BDF8',
                              color: '#0B0D10',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Sparkles size={10} />
                            Best Physical
                          </span>
                        )}
                        {isGpu && (
                          <span
                            style={{
                              fontSize: '0.62rem',
                              background: '#FE90E9',
                              color: '#0B0D10',
                              fontWeight: 900,
                              padding: '1px 6px',
                              borderRadius: '3px',
                            }}
                          >
                            Zero Noise Sim
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: '0.75rem' }}>
                        Architecture: <strong style={{ color: '#CBD5E1' }}>{res.architecture}</strong>
                      </div>

                      {/* Fidelity Meter */}
                      <div style={{ background: '#0B0D10', border: '1px solid #1E293B', borderRadius: '4px', padding: '0.5rem 0.75rem', marginBottom: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: '3px' }}>
                          <span style={{ color: '#94A3B8' }}>{BENCHMARK_STRINGS.ESTIMATED_FIDELITY}</span>
                          <strong style={{ color: fidColor, fontSize: '0.82rem' }}>{res.estimated_fidelity}%</strong>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#1E293B', borderRadius: '3px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, res.estimated_fidelity))}%`,
                              height: '100%',
                              background: fidColor,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Transpiled Specs Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.72rem', color: '#94A3B8' }}>
                        <div>
                          {BENCHMARK_STRINGS.TRANSPILED_DEPTH}: <strong style={{ color: '#F8FAFC' }}>{res.transpiled_depth}</strong>
                          <span style={{ fontSize: '0.62rem', color: res.transpiled_depth > res.original_depth ? '#FCD34D' : '#4ADE80', marginLeft: '3px' }}>
                            (+{res.transpiled_depth - res.original_depth})
                          </span>
                        </div>
                        <div>
                          {BENCHMARK_STRINGS.TWO_QUBIT_GATES}: <strong style={{ color: '#F8FAFC' }}>{res.gate_count_2q}</strong>
                        </div>
                        <div>
                          {BENCHMARK_STRINGS.ESTIMATED_RUNTIME}: <strong style={{ color: '#F8FAFC' }}>{res.estimated_runtime_ms} ms</strong>
                        </div>
                        <div>
                          {BENCHMARK_STRINGS.QUEUE_TIME}: <strong style={{ color: '#F8FAFC' }}>{res.queue_wait_sec}s</strong>
                        </div>
                      </div>

                      {res.recommended_reason && (
                        <p style={{ fontSize: '0.68rem', color: '#64748B', marginTop: '0.6rem', lineHeight: 1.35, fontStyle: 'italic' }}>
                          💡 {res.recommended_reason}
                        </p>
                      )}
                    </div>

                    {/* Launch in Workbench Button */}
                    <button
                      onClick={() => handleLaunch(res.provider_id)}
                      className="btn-neo btn-neo-sm"
                      style={{
                        width: '100%',
                        background: isRecommended ? '#38BDF8' : '#1E293B',
                        color: isRecommended ? '#0B0D10' : '#F8FAFC',
                        fontWeight: 800,
                        fontSize: '0.72rem',
                        padding: '0.35rem 0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <Play size={11} />
                      <span>{BENCHMARK_STRINGS.LAUNCH_WORKBENCH_BTN}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
