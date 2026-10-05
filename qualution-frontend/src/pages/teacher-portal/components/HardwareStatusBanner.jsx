import React, { useState, useEffect } from 'react';
import { fetchHardwareStatus } from '../api/portalApi';
import { HARDWARE_STRINGS } from '../constants/portalConstants';
import { Cpu, Activity, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function HardwareStatusBanner({
  onOpenTelemetryModal,
  onOpenBenchmarkModal,
  onOpenAnalyticsModal,
  onOpenPulseVisualizerModal
}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadStatus() {
      try {
        const data = await fetchHardwareStatus();
        if (isMounted) setStatus(data);
      } catch (err) {
        console.warn('[HardwareStatus] Failed to fetch hardware status:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadStatus();
    return () => { isMounted = false; };
  }, []);

  if (!status && !loading) return null;

  return (
    <div
      className="tmt-hardware-banner"
      data-testid="hardware-status-banner"
      style={{
        background: '#FFFFFF',
        border: '2.5px solid #000',
        borderLeft: '10px solid var(--tmt-cyan, #C1F8FF)',
        boxShadow: '3px 3px 0px #000',
        padding: '0.85rem 1.25rem',
        margin: '1rem 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        fontFamily: 'var(--font-mono, monospace)',
        color: '#1F1F1F'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--tmt-cyan, #C1F8FF)',
              border: '2px solid #000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '1.5px 1.5px 0 #000'
            }}
          >
            <Cpu size={18} color="#000" />
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 900, color: '#1F1F1F' }}>
            {HARDWARE_STRINGS.BANNER_TITLE}
          </span>
        </div>

        {status && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#4B5563', fontWeight: 700 }}>
            <span
              className="neo-badge neo-badge-lime"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: '#B0EF9E',
                color: '#000',
                border: '1.5px solid #000',
                padding: '2px 8px',
                fontWeight: 900
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#000' }} />
              {status.online_count}/{status.total_count} QPUs Online
            </span>
            <span>·</span>
            <span>2Q Fidelity: <strong style={{ color: '#000' }}>{status.best_2q_fidelity}%</strong></span>
            <span>·</span>
            <span>Lowest Queue: <strong style={{ color: '#000' }}>{status.lowest_queue_provider}</strong></span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {onOpenAnalyticsModal && (
          <button
            onClick={onOpenAnalyticsModal}
            className="btn-neo btn-neo-lime btn-neo-sm"
            data-testid="open-analytics-btn"
          >
            <span>Portal Analytics</span>
            <Activity size={13} />
          </button>
        )}

        {onOpenBenchmarkModal && (
          <button
            onClick={onOpenBenchmarkModal}
            className="btn-neo btn-neo-pink btn-neo-sm"
            data-testid="open-benchmark-btn"
          >
            <span>Q-Eval Benchmarks</span>
            <ArrowRight size={13} />
          </button>
        )}

        {onOpenPulseVisualizerModal && (
          <button
            onClick={onOpenPulseVisualizerModal}
            className="btn-neo btn-neo-cyan btn-neo-sm"
            data-testid="open-pulse-visualizer-btn"
          >
            <span>Pulse Calibration</span>
            <Zap size={13} />
          </button>
        )}

        <button
          onClick={onOpenTelemetryModal}
          className="btn-neo btn-neo-yellow btn-neo-sm"
        >
          <span>{HARDWARE_STRINGS.VIEW_DETAILS_BTN}</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}

