import React, { useState, useEffect, useMemo } from 'react';
import type { CircuitRequest, Gate } from '../../features/circuit/types';
import type { DigitalTwinBackendResponse } from '../../features/circuit/digitalTwinTypes';
import { Cpu, X, AlertTriangle, CheckCircle2, ArrowRightLeft, Activity } from 'lucide-react';
import './DigitalTwinTopologyOverlay.css';

// Calibrated offline snapshot for FakeManilaV2 (Phase 0 verified)
const DEFAULT_MANILA_SNAPSHOT: DigitalTwinBackendResponse = {
  backend_name: 'fake_manila',
  backend_display_name: 'FakeManilaV2',
  qubit_count: 5,
  circuit_qubits: 5,
  shots: 1000,
  ideal_probabilities: {},
  noisy_probabilities: {},
  ideal_counts: {},
  noisy_counts: {},
  coupling_map: [
    [0, 1], [1, 0],
    [1, 2], [2, 1],
    [2, 3], [3, 2],
    [3, 4], [4, 3],
  ],
  qubit_properties: [
    { qubit: 0, t1: 0.000132, t2: 0.000102, t1_us: 131.53, t2_us: 102.20, frequency_ghz: 4.9624 },
    { qubit: 1, t1: 0.000125, t2: 0.000079, t1_us: 124.54, t2_us: 79.01, frequency_ghz: 4.8379 },
    { qubit: 2, t1: 0.000159, t2: 0.000025, t1_us: 158.62, t2_us: 25.15, frequency_ghz: 5.0373 },
    { qubit: 3, t1: 0.000179, t2: 0.000054, t1_us: 179.10, t2_us: 54.36, frequency_ghz: 4.9510 },
    { qubit: 4, t1: 0.000145, t2: 0.000040, t1_us: 144.67, t2_us: 40.33, frequency_ghz: 5.0652 },
  ],
  gate_errors: [
    { gate: 'cx', qubits: [0, 1], error: 0.0088277, duration_ns: 277.33 },
    { gate: 'cx', qubits: [1, 0], error: 0.0088277, duration_ns: 312.89 },
    { gate: 'cx', qubits: [1, 2], error: 0.0139404, duration_ns: 469.33 },
    { gate: 'cx', qubits: [2, 1], error: 0.0139404, duration_ns: 504.89 },
    { gate: 'cx', qubits: [2, 3], error: 0.0113541, duration_ns: 355.56 },
    { gate: 'cx', qubits: [3, 2], error: 0.0113541, duration_ns: 391.11 },
    { gate: 'cx', qubits: [3, 4], error: 0.0056963, duration_ns: 334.22 },
    { gate: 'cx', qubits: [4, 3], error: 0.0056963, duration_ns: 298.67 },
  ],
  runtime_ms: 24.5,
  execution_location: 'local_python',
};

export interface DigitalTwinTopologyOverlayProps {
  isOpen: boolean;
  onClose?: () => void;
  circuit?: CircuitRequest;
  backendName?: string;
  onSelectQubit?: (qubitIndex: number) => void;
  onOpenComparison?: () => void;
}

export const DigitalTwinTopologyOverlay: React.FC<DigitalTwinTopologyOverlayProps> = ({
  isOpen,
  onClose,
  circuit,
  backendName = 'fake_manila',
  onOpenComparison,
}) => {
  const safeCircuit: CircuitRequest = circuit || { qubits: 5, gates: [] };
  const [telemetry, setTelemetry] = useState<DigitalTwinBackendResponse>(DEFAULT_MANILA_SNAPSHOT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBackendOffline, setIsBackendOffline] = useState<boolean>(false);

  // Fetch live backend topology on mount or open
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchTopology = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/simulate/digital-twin?backend_name=${encodeURIComponent(backendName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qubits: Math.max(safeCircuit.qubits || 5, 5),
            gates: (safeCircuit.gates || []).map((g) => ({
              id: g.id,
              type: g.gate,
              gate: g.gate,
              targets: g.targets,
              column: g.column,
            })),
            shots: 1000,
          }),
        });

        if (res.ok) {
          const data: DigitalTwinBackendResponse = await res.json();
          if (isMounted) {
            setTelemetry(data);
            setIsBackendOffline(false);
          }
        } else {
          if (isMounted) setIsBackendOffline(true);
        }
      } catch (err) {
        // Graceful fallback to verified snapshot
        console.warn('[DigitalTwinTopology] Live endpoint unreachable, operating on verified offline snapshot:', err);
        if (isMounted) {
          setIsBackendOffline(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTopology();
    return () => {
      isMounted = false;
    };
  }, [isOpen, backendName, safeCircuit.qubits, safeCircuit.gates?.length]);

  if (!isOpen) return null;

  // Node coordinates (Falcon r5.4 linear geometry: 5 physical qubits)
  const nodeCoords = useMemo(() => [
    { qubit: 0, x: 80, y: 110 },
    { qubit: 1, x: 220, y: 110 },
    { qubit: 2, x: 360, y: 110 },
    { qubit: 3, x: 500, y: 110 },
    { qubit: 4, x: 640, y: 110 },
  ], []);

  // Set of qubits used in the current circuit
  const activeQubitIndices = useMemo(() => {
    const set = new Set<number>();
    for (const g of safeCircuit.gates || []) {
      for (const t of g.targets) {
        set.add(t);
      }
    }
    return set;
  }, [safeCircuit.gates]);

  // Two-qubit gates extracted from circuit
  const twoQubitGates = useMemo(() => {
    return (safeCircuit.gates || []).filter((g) => g.targets && g.targets.length >= 2);
  }, [safeCircuit.gates]);

  // Directed coupling map from telemetry
  const couplingEdges = useMemo(() => {
    return telemetry.coupling_map || DEFAULT_MANILA_SNAPSHOT.coupling_map;
  }, [telemetry.coupling_map]);

  // Check if two qubits have a direct hardware coupling
  const isDirectlyCoupled = (qA: number, qB: number) => {
    return couplingEdges.some(
      (e) => (e[0] === qA && e[1] === qB) || (e[0] === qB && e[1] === qA)
    );
  };

  // Undirected unique physical edges with error rate
  const uniquePhysicalEdges = useMemo(() => {
    const edgeMap = new Map<string, { q1: number; q2: number; error: number }>();
    for (const e of couplingEdges) {
      const qMin = Math.min(e[0], e[1]);
      const qMax = Math.max(e[0], e[1]);
      const key = `${qMin}-${qMax}`;
      if (!edgeMap.has(key)) {
        // Find gate error
        const gateErr = telemetry.gate_errors.find(
          (ge) =>
            ge.gate === 'cx' &&
            ((ge.qubits[0] === e[0] && ge.qubits[1] === e[1]) ||
             (ge.qubits[0] === e[1] && ge.qubits[1] === e[0]))
        );
        const error = gateErr ? gateErr.error : 0.01;
        edgeMap.set(key, { q1: qMin, q2: qMax, error });
      }
    }
    return Array.from(edgeMap.values());
  }, [couplingEdges, telemetry.gate_errors]);

  // Partition circuit's 2-qubit interactions into Direct vs Non-Adjacent (Violations)
  const { directGates, nonAdjacentGates } = useMemo(() => {
    const direct: Array<{ gate: Gate; q1: number; q2: number }> = [];
    const nonAdjacent: Array<{ gate: Gate; q1: number; q2: number }> = [];

    for (const g of twoQubitGates) {
      const q1 = g.targets[0];
      const q2 = g.targets[1];
      if (isDirectlyCoupled(q1, q2)) {
        direct.push({ gate: g, q1, q2 });
      } else {
        nonAdjacent.push({ gate: g, q1, q2 });
      }
    }
    return { directGates: direct, nonAdjacentGates: nonAdjacent };
  }, [twoQubitGates, couplingEdges]);

  // Error color token classification
  const getErrorColorClass = (error: number) => {
    if (error < 0.009) return 'error-low'; // < 0.9% -> --wb-status-success
    if (error < 0.012) return 'error-med'; // 0.9% - 1.2% -> --wb-status-warning
    return 'error-high'; // > 1.2% -> --wb-status-danger
  };

  return (
    <div
      className="dt-topology-overlay-container"
      data-testid="digital-twin-topology-overlay"
    >
      {/* Header */}
      <div className="dt-topology-header">
        <div className="dt-topology-title-area">
          <div className="dt-topology-title">
            <Cpu size={16} color="var(--wb-status-cyan, #1192e8)" />
            <span>Digital Twin Hardware Topology</span>
          </div>

          <div className="dt-topology-device-badge" data-testid="topology-device-badge">
            <span className="dt-active-pulse-dot" />
            <span>{telemetry.backend_display_name} (Falcon r5.4)</span>
          </div>
        </div>

        <div className="dt-topology-stats-row">
          <div className="dt-topology-stat-pill" title="Physical Qubits on device">
            <span>Qubits:</span>
            <strong>{telemetry.qubit_count}</strong>
          </div>
          <div className="dt-topology-stat-pill" title="Average 2-qubit CX gate error rate">
            <span>Avg CX Error:</span>
            <strong>
              {(
                (telemetry.gate_errors.reduce((acc, g) => acc + g.error, 0) /
                  (telemetry.gate_errors.length || 1)) *
                100
              ).toFixed(2)}
              %
            </strong>
          </div>
          <div className="dt-topology-stat-pill" title="Average T1 coherence time">
            <span>Avg T1:</span>
            <strong>
              {(
                telemetry.qubit_properties.reduce((acc, q) => acc + (q.t1_us || 0), 0) /
                (telemetry.qubit_properties.length || 1)
              ).toFixed(1)}
              µs
            </strong>
          </div>

          {onOpenComparison && (
            <button
              type="button"
              className="dt-topology-compare-btn"
              onClick={onOpenComparison}
              title="Open side-by-side distribution and fidelity comparison"
              data-testid="dt-topology-open-compare-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(17, 146, 232, 0.2)',
                color: 'var(--wb-status-cyan, #00d2ff)',
                border: '1px solid rgba(17, 146, 232, 0.4)',
                borderRadius: 4,
                padding: '4px 9px',
                fontSize: '0.74rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              <Activity size={12} />
              <span>Compare Fidelity</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              className="dt-topology-close-btn"
              onClick={onClose}
              title="Close Topology Mirror"
              data-testid="close-topology-overlay-btn"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Backend offline warning banner */}
      {isBackendOffline && (
        <div
          className="dt-topology-offline-notice"
          data-testid="dt-topology-offline-notice"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 16px',
            background: 'rgba(241, 194, 27, 0.12)',
            borderBottom: '1px solid rgba(241, 194, 27, 0.25)',
            color: 'var(--wb-status-warning, #f1c21b)',
            fontSize: '0.74rem',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>
            Local backend unreachable (http://127.0.0.1:8000). Operating in verified offline snapshot mode for FakeManilaV2.
          </span>
        </div>
      )}

      {/* SVG Coupling Graph Area */}
      <div className="dt-graph-wrapper" data-testid="topology-graph-area">
        <svg
          viewBox="0 0 720 220"
          className="dt-topology-svg"
          data-testid="topology-svg-graph"
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="4"
              markerHeight="4"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--wb-status-danger, #e05252)" />
            </marker>
          </defs>

          {/* 1. Physical Coupling Bus Edges */}
          {uniquePhysicalEdges.map(({ q1, q2, error }) => {
            const n1 = nodeCoords[q1];
            const n2 = nodeCoords[q2];
            if (!n1 || !n2) return null;

            const isGateActive = directGates.some(
              (dg) =>
                (dg.q1 === q1 && dg.q2 === q2) || (dg.q1 === q2 && dg.q2 === q1)
            );

            const midX = (n1.x + n2.x) / 2;
            const midY = (n1.y + n2.y) / 2;
            const colorClass = getErrorColorClass(error);

            return (
              <g key={`edge-${q1}-${q2}`} data-testid={`physical-edge-${q1}-${q2}`}>
                {/* Physical Resonator Bus Line */}
                <line
                  x1={n1.x}
                  y1={n1.y}
                  x2={n2.x}
                  y2={n2.y}
                  className={`dt-physical-edge ${colorClass} ${isGateActive ? 'gate-active' : ''}`}
                />

                {/* Error Rate Label Badge */}
                <g transform={`translate(${midX}, ${midY - 14})`}>
                  <rect
                    x="-32"
                    y="-8"
                    width="64"
                    height="16"
                    className="dt-edge-badge-rect"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className="dt-edge-badge-text"
                    fill={
                      error < 0.009
                        ? 'var(--wb-status-success, #21c79a)'
                        : error < 0.012
                        ? 'var(--wb-status-warning, #e7a93b)'
                        : 'var(--wb-status-danger, #e05252)'
                    }
                  >
                    {(error * 100).toFixed(2)}% CX
                  </text>
                </g>

                {/* Active Gate Direct Link Indicator */}
                {isGateActive && (
                  <g transform={`translate(${midX}, ${midY + 16})`}>
                    <rect
                      x="-42"
                      y="-7"
                      width="84"
                      height="14"
                      rx="3"
                      fill="rgba(33, 199, 154, 0.2)"
                      stroke="var(--wb-status-success, #21c79a)"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="var(--wb-status-success, #21c79a)"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      DIRECT LINK ✓
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* 2. Non-Adjacent Circuit Gate Violations (Curved Dashed Arches) */}
          {nonAdjacentGates.map(({ gate, q1, q2 }, idx) => {
            const n1 = nodeCoords[q1];
            const n2 = nodeCoords[q2];
            if (!n1 || !n2) return null;

            const minX = Math.min(n1.x, n2.x);
            const maxX = Math.max(n1.x, n2.x);
            const span = Math.abs(q1 - q2);
            // Dynamic arch height proportional to span
            const archHeight = 45 + (span - 2) * 25;
            const midX = (n1.x + n2.x) / 2;
            const apexY = n1.y - archHeight;

            const pathD = `M ${n1.x},${n1.y - 20} Q ${midX},${apexY} ${n2.x},${n2.y - 20}`;

            return (
              <g
                key={`non-adjacent-${gate.id || idx}`}
                data-testid={`non-adjacent-arch-${q1}-${q2}`}
              >
                {/* Glowing Dashed Routing Penalty Arch */}
                <path d={pathD} className="dt-non-adjacent-arch" />

                {/* Warning Badge over apex */}
                <g transform={`translate(${midX}, ${apexY - 14})`}>
                  <rect
                    x="-90"
                    y="-10"
                    width="180"
                    height="20"
                    className="dt-non-adjacent-marker-rect"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className="dt-non-adjacent-marker-text"
                  >
                    ⚠️ {gate.gate.toUpperCase()}(q{q1}, q{q2}): SWAP Chain Required
                  </text>
                </g>
              </g>
            );
          })}

          {/* 3. Physical Qubit Nodes */}
          {nodeCoords.map(({ qubit, x, y }) => {
            const qProps = telemetry.qubit_properties.find((p) => p.qubit === qubit);
            const isUsedInCircuit = activeQubitIndices.has(qubit);

            return (
              <g
                key={`node-${qubit}`}
                transform={`translate(${x}, ${y})`}
                className={`dt-qubit-node ${isUsedInCircuit ? 'in-circuit' : ''}`}
                data-testid={`qubit-node-${qubit}`}
              >
                {/* Node Outer Ring */}
                <circle r="22" className="dt-qubit-circle" />

                {/* Qubit Label */}
                <text x="0" y="4" textAnchor="middle" className="dt-qubit-label">
                  Q{qubit}
                </text>

                {/* Coherence Time Sublabels */}
                <text x="0" y="38" textAnchor="middle" className="dt-qubit-sublabel">
                  T₁: {qProps?.t1_us ? `${Math.round(qProps.t1_us)}µs` : '—'}
                </text>
                <text x="0" y="50" textAnchor="middle" className="dt-qubit-sublabel">
                  T₂: {qProps?.t2_us ? `${Math.round(qProps.t2_us)}µs` : '—'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Footer & Educational Feedback */}
      <div className="dt-topology-footer">
        {/* Legend */}
        <div className="dt-legend-row">
          <div className="dt-legend-item">
            <span className="dt-legend-color-box success" />
            <span>Low CX Error (&lt; 0.9%)</span>
          </div>
          <div className="dt-legend-item">
            <span className="dt-legend-color-box warning" />
            <span>Moderate CX Error (0.9% – 1.2%)</span>
          </div>
          <div className="dt-legend-item">
            <span className="dt-legend-color-box danger" />
            <span>High CX Error (&gt; 1.2%)</span>
          </div>
          <div className="dt-legend-item">
            <span className="dt-legend-color-box dashed" />
            <span>Non-Adjacent (Requires SWAP Routing)</span>
          </div>
        </div>

        {/* Educational Callout Card */}
        {nonAdjacentGates.length > 0 ? (
          <div
            className="dt-educational-card violation"
            data-testid="topology-violation-callout"
          >
            <div className="dt-educational-card-header">
              <AlertTriangle size={15} />
              <span>Hardware Routing Penalty: Non-Adjacent Gate Execution</span>
            </div>
            <div>
              Your circuit executes 2-qubit operations across physical qubits without a direct resonator bus (e.g.,{' '}
              {nonAdjacentGates.map((v, i) => (
                <span key={i} className="dt-violation-badge">
                  {v.gate.gate.toUpperCase()}(q[{v.q1}], q[{v.q2}])
                </span>
              ))}
              ). On real superconducting hardware like <strong>FakeManila</strong>, the Qiskit transpiler must inject a sequence of{' '}
              <strong>SWAP gates</strong> to route quantum states, tripling gate count and accumulating noise before execution.
            </div>
          </div>
        ) : (
          <div
            className="dt-educational-card clean"
            data-testid="topology-clean-callout"
          >
            <div className="dt-educational-card-header">
              <CheckCircle2 size={15} />
              <span>Perfect Physical Hardware Alignment</span>
            </div>
            <div>
              All multi-qubit interactions in your current circuit map directly onto native physical resonator buses on FakeManila. No SWAP routing overhead is required.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
