import React, { useState, useEffect, useMemo } from 'react';
import { Play, Copy, Check, Code, Cpu, BarChart2, Eye, AlertTriangle } from 'lucide-react';
import { CIRCUIT_EMBED_STRINGS } from '../constants/portalConstants';
import { parseOpenQASMClient } from '../../../features/circuit/clientCodeParser';
import { simulateStatevectorCircuit } from '../../../features/circuit/statevectorEngine';

export default function InteractiveCircuitEmbed({
  qasm,
  circuitData,
  onLaunchWorkbench,
  lessonId,
  compact = false,
}) {
  const [activeTab, setActiveTab] = useState('visual'); // 'visual' | 'code'
  const [copied, setCopied] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [parseError, setParseError] = useState(null);

  // Parse QASM or assemble CircuitRequest
  const parsedCircuit = useMemo(() => {
    setParseError(null);
    if (circuitData && circuitData.qubits && circuitData.gates) {
      return circuitData;
    }
    if (!qasm || !qasm.trim()) {
      return null;
    }
    try {
      const response = parseOpenQASMClient(qasm);
      if (response && response.circuit) {
        return response.circuit;
      }
      return null;
    } catch (err) {
      setParseError(err.message || CIRCUIT_EMBED_STRINGS.PARSE_ERROR);
      return null;
    }
  }, [qasm, circuitData]);

  // Execute client-side simulation when circuit changes
  useEffect(() => {
    if (!parsedCircuit || !parsedCircuit.qubits || parsedCircuit.qubits > 10) {
      setSimulationResult(null);
      return;
    }
    setSimulating(true);
    try {
      const result = simulateStatevectorCircuit(parsedCircuit, { shots: 1024 });
      setSimulationResult(result);
    } catch (err) {
      console.warn('Circuit simulation error:', err);
    } finally {
      setSimulating(false);
    }
  }, [parsedCircuit]);

  if (!qasm && !circuitData) return null;

  const handleCopyCode = async () => {
    const textToCopy = qasm || JSON.stringify(circuitData, null, 2);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleLaunch = () => {
    if (typeof onLaunchWorkbench === 'function') {
      onLaunchWorkbench(parsedCircuit, lessonId);
    }
  };

  const qubitsCount = parsedCircuit?.qubits || 0;
  const gatesList = parsedCircuit?.gates || [];
  const depth = parsedCircuit?.depth || gatesList.length;

  // Render probability distribution
  const probabilities = simulationResult?.probabilities || {};
  const sortedBasisStates = Object.entries(probabilities)
    .filter(([_, prob]) => prob > 0.001)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div
      className="tmt-circuit-embed"
      style={{
        background: '#0B0D10',
        border: '2px solid #1F1F1F',
        borderRadius: '4px',
        margin: '0.75rem 0',
        padding: '0.85rem',
        boxShadow: '3px 3px 0px #C1F8FF',
        color: '#FFF',
        fontFamily: 'var(--font-mono, monospace)',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          borderBottom: '1px solid #1F1F1F',
          paddingBottom: '0.5rem',
          marginBottom: '0.6rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 900,
              padding: '2px 6px',
              borderRadius: '3px',
              background: '#C1F8FF',
              color: '#1F1F1F',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <Cpu size={11} />
            {CIRCUIT_EMBED_STRINGS.BADGE}
          </span>
          <span style={{ fontSize: '0.68rem', color: '#888' }}>
            {CIRCUIT_EMBED_STRINGS.QUBITS_LABEL} <strong style={{ color: '#FFF' }}>{qubitsCount}</strong> ·{' '}
            {CIRCUIT_EMBED_STRINGS.GATES_LABEL} <strong style={{ color: '#FFF' }}>{gatesList.length}</strong>
          </span>
        </div>

        {/* Tab switcher & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div style={{ display: 'inline-flex', background: '#16191E', borderRadius: '3px', padding: '1px', border: '1px solid #282C34' }}>
            <button
              onClick={() => setActiveTab('visual')}
              style={{
                background: activeTab === 'visual' ? '#FFC83B' : 'transparent',
                color: activeTab === 'visual' ? '#1F1F1F' : '#888',
                border: 'none',
                padding: '2px 7px',
                fontSize: '0.65rem',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Eye size={10} />
              {CIRCUIT_EMBED_STRINGS.VIEW_CIRCUIT}
            </button>
            <button
              onClick={() => setActiveTab('code')}
              style={{
                background: activeTab === 'code' ? '#FFC83B' : 'transparent',
                color: activeTab === 'code' ? '#1F1F1F' : '#888',
                border: 'none',
                padding: '2px 7px',
                fontSize: '0.65rem',
                fontWeight: 800,
                cursor: 'pointer',
                borderRadius: '2px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Code size={10} />
              {CIRCUIT_EMBED_STRINGS.VIEW_CODE}
            </button>
          </div>

          <button
            onClick={handleCopyCode}
            title={CIRCUIT_EMBED_STRINGS.COPY_CODE}
            style={{
              background: '#16191E',
              color: copied ? '#4ADE80' : '#AAA',
              border: '1px solid #282C34',
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '0.65rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            <span>{copied ? CIRCUIT_EMBED_STRINGS.COPIED : CIRCUIT_EMBED_STRINGS.COPY_CODE}</span>
          </button>
        </div>
      </div>

      {parseError && (
        <div style={{ color: '#FF8888', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem', margin: '0.4rem 0' }}>
          <AlertTriangle size={12} />
          <span>{parseError}</span>
        </div>
      )}

      {/* Main Content Area: Visual or Code */}
      {activeTab === 'visual' ? (
        <div>
          {/* Visual Wires & Gate Sequence */}
          <div
            style={{
              background: '#050709',
              border: '1px solid #1A1F26',
              borderRadius: '3px',
              padding: '0.6rem 0.8rem',
              overflowX: 'auto',
              marginBottom: '0.6rem',
            }}
          >
            {qubitsCount === 0 ? (
              <span style={{ fontSize: '0.7rem', color: '#666' }}>{CIRCUIT_EMBED_STRINGS.EMPTY_CIRCUIT}</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: '220px' }}>
                {Array.from({ length: qubitsCount }).map((_, qIdx) => {
                  const qubitGates = gatesList.filter((g) => {
                    const targets = Array.isArray(g.targets) ? g.targets : (Array.isArray(g.target) ? g.target : (g.target !== undefined ? [g.target] : []));
                    const controls = Array.isArray(g.controls) ? g.controls : (g.control !== undefined ? [g.control] : []);
                    return targets.includes(qIdx) || controls.includes(qIdx);
                  });

                  return (
                    <div
                      key={qIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.7rem',
                      }}
                    >
                      <span
                        style={{
                          width: '32px',
                          color: '#C1F8FF',
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        q[{qIdx}]
                      </span>
                      <span style={{ color: '#444' }}>─</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'nowrap' }}>
                        {qubitGates.length === 0 ? (
                          <span style={{ color: '#333' }}>────────────</span>
                        ) : (
                          qubitGates.map((g, gIdx) => {
                            const name = (g.gate || g.name || 'G').toUpperCase();
                            const targets = Array.isArray(g.targets) ? g.targets : (Array.isArray(g.target) ? g.target : (g.target !== undefined ? [g.target] : []));
                            const controls = Array.isArray(g.controls) ? g.controls : (g.control !== undefined ? [g.control] : []);
                            
                            // Check if this qubit is acting as a control
                            let isControl = controls.includes(qIdx);
                            if (!isControl && (name === 'CX' || name === 'CNOT' || name === 'CZ') && targets.length >= 2 && targets[0] === qIdx) {
                              isControl = true;
                            } else if (!isControl && name === 'CCX' && targets.length >= 3 && (targets[0] === qIdx || targets[1] === qIdx)) {
                              isControl = true;
                            }

                            const isMeasure = name.startsWith('M');

                            if (isControl) {
                              return (
                                <div key={gIdx} style={{ display: 'flex', alignItems: 'center' }}>
                                  <span
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      background: '#00B8D9',
                                      display: 'inline-block',
                                    }}
                                    title={`Control on q[${qIdx}]`}
                                  />
                                  <span style={{ color: '#444', margin: '0 2px' }}>─</span>
                                </div>
                              );
                            }

                            return (
                              <div key={gIdx} style={{ display: 'flex', alignItems: 'center' }}>
                                <span
                                  style={{
                                    background: isMeasure ? '#FE90E9' : '#FFC83B',
                                    color: '#1F1F1F',
                                    fontWeight: 900,
                                    fontSize: '0.65rem',
                                    padding: '1px 5px',
                                    borderRadius: '2px',
                                    border: '1px solid #1F1F1F',
                                    boxShadow: '1px 1px 0px #000',
                                    display: 'inline-block',
                                    minWidth: '18px',
                                    textAlign: 'center',
                                  }}
                                  title={`${name} on q[${qIdx}]`}
                                >
                                  {name}
                                </span>
                                <span style={{ color: '#444', margin: '0 2px' }}>─</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Probabilities Distribution Bar Chart */}
          {sortedBasisStates.length > 0 && (
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <BarChart2 size={11} color="#00B8D9" />
                <span>{CIRCUIT_EMBED_STRINGS.SIMULATION_HEADER}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.4rem' }}>
                {sortedBasisStates.map(([state, prob]) => {
                  const pct = (prob * 100).toFixed(1);
                  return (
                    <div
                      key={state}
                      style={{
                        background: '#12161D',
                        border: '1px solid #282C34',
                        borderRadius: '3px',
                        padding: '0.25rem 0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', marginBottom: '2px' }}>
                        <span style={{ color: '#C1F8FF', fontWeight: 800 }}>|{state}⟩</span>
                        <span style={{ color: '#FFC83B', fontWeight: 800 }}>{pct}%</span>
                      </div>
                      <div style={{ height: '4px', background: '#222', borderRadius: '2px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: '#00B8D9',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Raw OpenQASM Code View */
        <pre
          style={{
            background: '#050709',
            border: '1px solid #1A1F26',
            borderRadius: '3px',
            padding: '0.6rem',
            margin: '0 0 0.6rem 0',
            fontSize: '0.7rem',
            color: '#B0EF9E',
            overflowX: 'auto',
            maxHeight: '140px',
            lineHeight: 1.4,
          }}
        >
          {qasm || JSON.stringify(circuitData, null, 2)}
        </pre>
      )}

      {/* Launch in Workbench Action Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
        <button
          onClick={handleLaunch}
          className="btn-neo btn-neo-sm"
          style={{
            background: '#B0EF9E',
            color: '#1F1F1F',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono, monospace)',
            fontWeight: 900,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            cursor: 'pointer',
            border: '1.5px solid #1F1F1F',
            boxShadow: '2px 2px 0px #1F1F1F',
          }}
        >
          <Play size={11} />
          <span>{CIRCUIT_EMBED_STRINGS.SIMULATE_BTN}</span>
        </button>
      </div>
    </div>
  );
}
