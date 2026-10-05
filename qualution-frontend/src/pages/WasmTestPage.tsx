import React, { useEffect, useState } from 'react';
import init, { add, roundtrip_circuit_test } from '../wasm/qualution-core/pkg/qualution_core.js';
import wasmUrl from '../wasm/qualution-core/pkg/qualution_core_bg.wasm?url';
import { runStabilizerInWorker } from '../features/circuit/stabilizerWorker';

export const WasmTestPage: React.FC = () => {
  const [addResult, setAddResult] = useState<number | null>(null);
  const [circuitResult, setCircuitResult] = useState<any | null>(null);
  const [workerResult, setWorkerResult] = useState<any | null>(null);
  const [status, setStatus] = useState<string>('Initializing WebAssembly module...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAndTestWasm() {
      try {
        setStatus('Loading and initializing WASM binary...');
        await init(wasmUrl);
        if (!mounted) return;

        // 1. Primitive arithmetic round-trip
        const res = add(2, 3);
        if (!mounted) return;
        setAddResult(res);

        // 2. Complex Circuit object round-trip across JS <-> WASM boundary
        const realGroverCircuit = {
          qubits: 2,
          classical_bits: 2,
          gates: [
            { id: 'g0', type: 'h', targets: [0], column: 0 },
            { id: 'g1', type: 'h', targets: [1], column: 0 },
            { id: 'g2', type: 'cz', targets: [0, 1], column: 1 },
            { id: 'g3', type: 'h', targets: [0], column: 2 },
            { id: 'g4', type: 'h', targets: [1], column: 2 },
            { id: 'g5', type: 'x', targets: [0], column: 3 },
            { id: 'g6', type: 'x', targets: [1], column: 3 },
            { id: 'g7', type: 'cz', targets: [0, 1], column: 4 },
            { id: 'g8', type: 'x', targets: [0], column: 5 },
            { id: 'g9', type: 'x', targets: [1], column: 5 },
            { id: 'g10', type: 'h', targets: [0], column: 6 },
            { id: 'g11', type: 'h', targets: [1], column: 6 },
          ],
          measurements: [
            { qubit: 0, classical_bit: 0 },
            { qubit: 1, classical_bit: 1 },
          ],
          shots: 1024,
        };

        const resultObj = roundtrip_circuit_test(realGroverCircuit);
        if (!mounted) return;
        setCircuitResult(resultObj);

        // 3. Web Worker simulation of Bell State
        setStatus('Dispatching Bell state simulation to Rust/WASM Web Worker...');
        const bellCircuit = {
          qubits: 2,
          classical_bits: 2,
          gates: [
            { id: 'h0', type: 'h', targets: [0], column: 0 },
            { id: 'cx01', type: 'cx', targets: [0, 1], column: 1 },
          ],
          measurements: [
            { qubit: 0, classical_bit: 0 },
            { qubit: 1, classical_bit: 1 },
          ],
          shots: 1024,
        };

        const wResult = await runStabilizerInWorker(bellCircuit, { shots: 1024 });
        console.log('[WasmTestPage] Web Worker Bell State Simulation Result:', wResult);
        if (!mounted) return;
        setWorkerResult(wResult);

        setStatus('All WASM & Web Worker validations complete.');
      } catch (err: any) {
        if (!mounted) return;
        console.error('[WasmTestPage] Execution failed:', err);
        setError(err?.message || String(err));
        setStatus('Failed during WASM / Worker execution.');
      }
    }

    loadAndTestWasm();

    return () => {
      mounted = false;
    };
  }, []);

  const isCircuitValid =
    circuitResult &&
    circuitResult.status === 'success' &&
    circuitResult.qubit_count === 2 &&
    circuitResult.shots === 1024;

  const isWorkerBellValid =
    workerResult &&
    workerResult.status === 'success' &&
    workerResult.probabilities &&
    (workerResult.probabilities['00'] ?? 0) > 0.35 &&
    (workerResult.probabilities['11'] ?? 0) > 0.35 &&
    (workerResult.probabilities['01'] ?? 0) === 0 &&
    (workerResult.probabilities['10'] ?? 0) === 0;

  return (
    <div
      id="wasm-test-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#040914',
        color: '#ffffff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          padding: '2.5rem 3rem',
          maxWidth: '750px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', color: '#60a5fa' }}>
          Rust / WASM Web Worker Execution
        </h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Validating non-blocking off-thread quantum simulation in WebAssembly Web Worker
        </p>

        <div
          id="wasm-status"
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            color: error ? '#f87171' : '#38bdf8',
          }}
        >
          {error ? `Error: ${error}` : status}
        </div>

        {/* Section 1: Primitive Add Check */}
        <div
          id="wasm-result-container"
          style={{
            padding: '1rem',
            background: addResult === 5 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: addResult === 5 ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            marginBottom: '1rem',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Check 1: Primitive Function add(2, 3)
          </div>
          <div
            id="wasm-result"
            style={{
              fontSize: '1.8rem',
              fontWeight: 800,
              color: addResult === 5 ? '#4ade80' : '#ffffff',
              margin: '0.2rem 0',
            }}
          >
            {addResult !== null ? addResult : '...'}
          </div>
        </div>

        {/* Section 2: Circuit Object Round-Trip Check */}
        <div
          id="circuit-roundtrip-container"
          style={{
            padding: '1rem',
            background: isCircuitValid ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            border: isCircuitValid ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            marginBottom: '1rem',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Check 2: Boundary Round-Trip Contract
          </div>
          {circuitResult ? (
            <div style={{ fontSize: '0.82rem', color: '#e2e8f0', lineHeight: '1.5' }}>
              <div><strong>Status:</strong> <span id="roundtrip-status" style={{ color: '#4ade80' }}>{circuitResult.status}</span> | <strong>Backend:</strong> {circuitResult.backend}</div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>Awaiting...</div>
          )}
        </div>

        {/* Section 3: Web Worker Bell State Simulation */}
        <div
          id="worker-bell-container"
          style={{
            padding: '1.25rem',
            background: isWorkerBellValid ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
            border: isWorkerBellValid ? '2px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Check 3: Web Worker Bell State Simulation (|Phi+&gt;)
          </div>
          {workerResult ? (
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0', lineHeight: '1.6' }}>
              <div><strong>Worker Status:</strong> <span id="worker-status" style={{ color: '#4ade80' }}>{workerResult.status}</span></div>
              <div><strong>Backend:</strong> <span id="worker-backend">{workerResult.backend}</span></div>
              <div><strong>Execution Location:</strong> <span id="worker-location">{workerResult.execution_location}</span></div>
              <div><strong>Qubit Count:</strong> <span id="worker-qubits">{workerResult.qubit_count}</span></div>
              <div><strong>Shots:</strong> <span id="worker-shots">{workerResult.shots}</span></div>
              <div><strong>Counts:</strong> <span id="worker-counts">{JSON.stringify(workerResult.counts)}</span></div>
              <div><strong>Probabilities:</strong> <span id="worker-probabilities">{JSON.stringify(workerResult.probabilities)}</span></div>
              <div><strong>Runtime:</strong> <span id="worker-runtime">{workerResult.runtime_ms} ms</span></div>
              <div><strong>Routing Reason:</strong> <span id="worker-reason" style={{ color: '#93c5fd' }}>{workerResult.routing_reason}</span></div>
              <div
                id="worker-bell-verified"
                style={{
                  marginTop: '0.75rem',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: isWorkerBellValid ? '#4ade80' : '#f87171',
                }}
              >
                {isWorkerBellValid
                  ? `VERIFIED: Bell State simulated in Web Worker -> P(00)=${(workerResult.probabilities['00'] * 100).toFixed(1)}%, P(11)=${(workerResult.probabilities['11'] * 100).toFixed(1)}%, 0% leakage`
                  : 'VALIDATION FAILED: Invalid Bell state probabilities'}
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8' }}>Awaiting Web Worker response...</div>
          )}
        </div>
      </div>
    </div>
  );
};
