import React, { useState, useEffect } from 'react';
import { fetchHardwareTelemetry } from '../api/portalApi';
import { HARDWARE_STRINGS } from '../constants/portalConstants';
import {
  X, Cpu, Activity, Zap, CheckCircle2, Clock,
  Layers, ShieldAlert, Sparkles, RefreshCw, BarChart3
} from 'lucide-react';

export default function HardwareTelemetryModal({ isOpen, onClose }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [selectedQubit, setSelectedQubit] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchHardwareTelemetry();
      setTelemetry(data);
      if (data && data.providers && data.providers.length > 0 && !selectedProviderId) {
        setSelectedProviderId(data.providers[0].id);
      }
    } catch (err) {
      console.error('[HardwareModal] Failed to load telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProvider = (telemetry?.providers || []).find(p => p.id === selectedProviderId) || telemetry?.providers?.[0];

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
        data-testid="hardware-telemetry-modal"
        style={{
          background: '#0B0D10',
          border: '2px solid #38BDF8',
          boxShadow: '6px 6px 0px #38BDF8',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '900px',
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
            <Cpu size={20} color="#38BDF8" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, letterSpacing: '0.02em' }}>
              {HARDWARE_STRINGS.MODAL_TITLE}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={loadData}
              title="Refresh Telemetry"
              style={{
                background: 'transparent',
                border: '1px solid #38BDF8',
                borderRadius: '4px',
                color: '#38BDF8',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: 700,
              }}
            >
              <RefreshCw size={12} className={loading ? 'spin' : ''} />
              <span>Sync</span>
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

        {/* Content Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading && !telemetry ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94A3B8' }}>
              Loading real-time QPU calibration telemetry...
            </div>
          ) : !currentProvider ? (
            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#EF4444' }}>
              {HARDWARE_STRINGS.NO_HARDWARE_DATA}
            </div>
          ) : (
            <>
              {/* Provider Selection Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid #1E293B', paddingBottom: '0.75rem' }}>
                {(telemetry.providers || []).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedProviderId(p.id);
                      setSelectedQubit(null);
                    }}
                    style={{
                      background: p.id === currentProvider.id ? '#38BDF8' : '#1E293B',
                      color: p.id === currentProvider.id ? '#0B0D10' : '#CBD5E1',
                      border: '1px solid #38BDF8',
                      borderRadius: '4px',
                      padding: '0.4rem 0.85rem',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span>{p.name}</span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        padding: '1px 4px',
                        borderRadius: '2px',
                        background: p.status === 'ONLINE' ? '#16A34A' : '#D97706',
                        color: '#FFF',
                      }}
                    >
                      {p.qubit_count}Q
                    </span>
                  </button>
                ))}
              </div>

              {/* Active Provider Info Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.75rem',
                }}
              >
                {/* 2Q Gate Fidelity */}
                <div
                  style={{
                    background: '#131822',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase' }}>
                    {HARDWARE_STRINGS.GATE_ERROR_2Q}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38BDF8', marginTop: '2px' }}>
                    {((1 - currentProvider.calibration.avg_2q_error) * 100).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                    Avg Error: {(currentProvider.calibration.avg_2q_error * 100).toFixed(3)}%
                  </div>
                </div>

                {/* T1 / T2 Coherence */}
                <div
                  style={{
                    background: '#131822',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase' }}>
                    Coherence Times
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#B0EF9E', marginTop: '2px' }}>
                    T1: {currentProvider.calibration.avg_t1_us > 10000 ? '>10 ms' : `${currentProvider.calibration.avg_t1_us.toFixed(1)} µs`}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                    T2: {currentProvider.calibration.avg_t2_us > 10000 ? '>1 ms' : `${currentProvider.calibration.avg_t2_us.toFixed(1)} µs`}
                  </div>
                </div>

                {/* Readout Fidelity */}
                <div
                  style={{
                    background: '#131822',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase' }}>
                    {HARDWARE_STRINGS.READOUT_FIDELITY}
                  </div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#FFC83B', marginTop: '2px' }}>
                    {(currentProvider.calibration.readout_fidelity * 100).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                    Architecture: {currentProvider.architecture}
                  </div>
                </div>

                {/* Queue & Status */}
                <div
                  style={{
                    background: '#131822',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    padding: '0.75rem 1rem',
                  }}
                >
                  <div style={{ fontSize: '0.68rem', color: '#94A3B8', textTransform: 'uppercase' }}>
                    Status & Queue
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: currentProvider.status === 'ONLINE' ? '#16A34A' : '#D97706',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ fontSize: '0.85rem', fontWeight: 900 }}>{currentProvider.status}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: '2px' }}>
                    {HARDWARE_STRINGS.QUEUE_LABEL}: {currentProvider.queue_depth} ({currentProvider.est_wait_time_sec}s wait)
                  </div>
                </div>
              </div>

              {/* Topology Grid & Coupling Map (if available) */}
              {currentProvider.topology_nodes && currentProvider.topology_nodes.length > 0 && (
                <div
                  style={{
                    background: '#131822',
                    border: '1px solid #1E293B',
                    borderRadius: '6px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#E2E8F0' }}>
                      {HARDWARE_STRINGS.TOPOLOGY_LABEL} ({currentProvider.topology_type})
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>
                      Click qubit node to inspect readout error & coherence
                    </div>
                  </div>

                  {/* Qubit Nodes Grid */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {currentProvider.topology_nodes.map(node => {
                      const isSelected = selectedQubit?.qubit_id === node.qubit_id;
                      return (
                        <button
                          key={node.qubit_id}
                          onClick={() => setSelectedQubit(node)}
                          style={{
                            background: isSelected ? '#38BDF8' : '#0B0D10',
                            color: isSelected ? '#0B0D10' : '#E2E8F0',
                            border: `1.5px solid ${isSelected ? '#FFF' : '#38BDF8'}`,
                            borderRadius: '6px',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                            minWidth: '65px',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: 900 }}>Q[{node.qubit_id}]</span>
                          <span style={{ fontSize: '0.62rem', opacity: 0.85 }}>
                            T1: {node.t1_us.toFixed(0)}µs
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Qubit Inspection Drawer */}
                  {selectedQubit && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.6rem 0.85rem',
                        background: '#0B0D10',
                        border: '1px solid #38BDF8',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        color: '#E2E8F0',
                      }}
                    >
                      <div><strong>Inspecting:</strong> Q[{selectedQubit.qubit_id}]</div>
                      <div><strong>T1 Relaxation:</strong> {selectedQubit.t1_us} µs</div>
                      <div><strong>T2 Dephasing:</strong> {selectedQubit.t2_us} µs</div>
                      <div><strong>Readout Error:</strong> {(selectedQubit.readout_error * 100).toFixed(2)}%</div>
                      <div><strong>Coupled Qubits:</strong> {selectedQubit.neighbors.map(n => `Q[${n}]`).join(', ')}</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
