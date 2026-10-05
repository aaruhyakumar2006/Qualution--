/**
 * statevectorWasm.test.ts
 *
 * Validation of the Rust/WASM Statevector Simulation Engine.
 * Tests:
 * 1. Bell state (|00> + |11>) cross-check and complex amplitude verification.
 * 2. Non-Clifford RX(pi/3) rotation -> P(0) = 0.75, P(1) = 0.25 exact.
 * 3. Non-Clifford T-gate circuit (H -> T -> H) -> P(0) ≈ 0.8536.
 * 4. Grover 2-qubit circuit -> exact P(11) = 1.00.
 * 5. Web Worker runner (runStatevectorInWorker).
 * 6. Memory ceiling safety guard: > 20 qubits rejected before WASM invocation.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSync, simulate_statevector_circuit } from '../../wasm/qualution-core/pkg/qualution_core.js';
import { runStatevectorInWorker } from './statevectorWorker';
import { simulateStatevectorCircuit } from './statevectorEngine';
import type { CanonicalCircuit, UnifiedExecutionResult } from './types';

describe('Rust/WASM Full-Statevector Quantum Engine', () => {
  beforeAll(() => {
    // Initialize WebAssembly module synchronously for Node/JSDOM tests
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initSync({ module: wasmBytes });
  });

  // ── HUMAN CHECKPOINT: Test 1 - Bell State ────────────────────────────────
  it('1. HUMAN CHECKPOINT: Bell State (|00> + |11>) produces 50/50 superposition with complex amplitudes', () => {
    const bellCircuit: CanonicalCircuit = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { id: 'g0', type: 'h', targets: [0], column: 0 },
        { id: 'g1', type: 'cx', targets: [0, 1], column: 1 },
      ],
      measurements: [
        { qubit: 0, classical_bit: 0 },
        { qubit: 1, classical_bit: 1 },
      ],
      shots: 1000,
    };

    const result = simulate_statevector_circuit(bellCircuit, 1000) as UnifiedExecutionResult;

    console.log('\n[HUMAN CHECKPOINT - TEST 1: BELL STATE (WASM STATEVECTOR)]');
    console.log('Backend:', result.backend);
    console.log('Execution Method:', result.execution_method);
    console.log('Counts:', result.counts);
    console.log('Probabilities:', result.probabilities);
    console.log('Statevector:', result.statevector);
    console.log('Runtime (ms):', result.runtime_ms);

    expect(result.backend).toBe('statevector_wasm_core');
    expect(result.execution_method).toBe('statevector');
    expect(result.qubit_count).toBe(2);

    expect(result.probabilities['00']).toBeCloseTo(0.5, 4);
    expect(result.probabilities['11']).toBeCloseTo(0.5, 4);
    expect(result.probabilities['01'] ?? 0).toBe(0);
    expect(result.probabilities['10'] ?? 0).toBe(0);

    // Verify amplitudes
    expect(result.statevector).toBeDefined();
    expect(result.statevector?.[0].real).toBeCloseTo(Math.SQRT1_2, 4);
    expect(result.statevector?.[3].real).toBeCloseTo(Math.SQRT1_2, 4);
    expect(result.statevector?.[1].real).toBe(0);
    expect(result.statevector?.[2].real).toBe(0);
  });

  // ── Test 2: Non-Clifford RX(pi/3) Rotation ───────────────────────────────
  it('2. Non-Clifford Circuit: RX(pi/3) rotation produces analytical P(0) = 0.75, P(1) = 0.25', () => {
    const rxCircuit: CanonicalCircuit = {
      qubits: 1,
      classical_bits: 1,
      gates: [
        {
          id: 'g-rx',
          type: 'rx',
          targets: [0],
          column: 0,
          angle: Math.PI / 3, // Non-Clifford angle
        },
      ],
      measurements: [{ qubit: 0, classical_bit: 0 }],
      shots: 10000,
    };

    const result = simulate_statevector_circuit(rxCircuit, 10000) as UnifiedExecutionResult;

    console.log('\n[HUMAN CHECKPOINT - TEST 2: NON-CLIFFORD RX(PI/3) WASM]');
    console.log('P(0):', result.probabilities['0']);
    console.log('P(1):', result.probabilities['1']);

    expect(result.probabilities['0']).toBeCloseTo(0.75, 4);
    expect(result.probabilities['1']).toBeCloseTo(0.25, 4);

    const ratio0 = (result.counts?.['0'] ?? 0) / 10000;
    const ratio1 = (result.counts?.['1'] ?? 0) / 10000;
    expect(ratio0).toBeGreaterThan(0.72);
    expect(ratio0).toBeLessThan(0.78);
    expect(ratio1).toBeGreaterThan(0.22);
    expect(ratio1).toBeLessThan(0.28);
  });

  // ── Test 3: Non-Clifford T Gate ──────────────────────────────────────────
  it('3. Non-Clifford Circuit with T gate: H -> T -> H produces P(0) ≈ 0.8536', () => {
    const hthCircuit: CanonicalCircuit = {
      qubits: 1,
      classical_bits: 1,
      gates: [
        { id: 'g0', type: 'h', targets: [0], column: 0 },
        { id: 'g1', type: 't', targets: [0], column: 1 },
        { id: 'g2', type: 'h', targets: [0], column: 2 },
      ],
      measurements: [{ qubit: 0, classical_bit: 0 }],
      shots: 10000,
    };

    const result = simulate_statevector_circuit(hthCircuit, 10000) as UnifiedExecutionResult;

    const expectedP0 = (2 + Math.SQRT2) / 4;
    const expectedP1 = (2 - Math.SQRT2) / 4;

    console.log('\n[HUMAN CHECKPOINT - TEST 3: T-GATE H-T-H WASM]');
    console.log('P(0) Expected:', expectedP0.toFixed(4), 'Computed:', result.probabilities['0']);
    console.log('P(1) Expected:', expectedP1.toFixed(4), 'Computed:', result.probabilities['1']);

    expect(result.probabilities['0']).toBeCloseTo(expectedP0, 4);
    expect(result.probabilities['1']).toBeCloseTo(expectedP1, 4);
  });

  // ── Test 4: Grover 2-Qubit Exact Reproduction ────────────────────────────
  it('4. Grover 2-qubit circuit reproduces exact P(11) = 1.00', () => {
    const groverCircuit: CanonicalCircuit = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { id: 'g-h0', type: 'h', targets: [0], column: 0 },
        { id: 'g-h1', type: 'h', targets: [1], column: 0 },
        { id: 'g-cz-oracle', type: 'cz', targets: [0, 1], column: 1 },
        { id: 'g-dh0', type: 'h', targets: [0], column: 2 },
        { id: 'g-dh1', type: 'h', targets: [1], column: 2 },
        { id: 'g-dx0', type: 'x', targets: [0], column: 3 },
        { id: 'g-dx1', type: 'x', targets: [1], column: 3 },
        { id: 'g-dcz', type: 'cz', targets: [0, 1], column: 4 },
        { id: 'g-dx0b', type: 'x', targets: [0], column: 5 },
        { id: 'g-dx1b', type: 'x', targets: [1], column: 5 },
        { id: 'g-dh0b', type: 'h', targets: [0], column: 6 },
        { id: 'g-dh1b', type: 'h', targets: [1], column: 6 },
      ],
      measurements: [
        { qubit: 0, classical_bit: 0 },
        { qubit: 1, classical_bit: 1 },
      ],
      shots: 1000,
    };

    const result = simulate_statevector_circuit(groverCircuit, 1000) as UnifiedExecutionResult;

    console.log('\n[HUMAN CHECKPOINT - TEST 4: GROVER 2-QUBIT WASM]');
    console.log('P(11):', result.probabilities['11']);
    console.log('Counts:', result.counts);

    expect(result.probabilities['11']).toBeGreaterThanOrEqual(0.99);
    expect(result.probabilities['11']).toBe(1.0);
    expect(result.counts?.['11']).toBe(1000);
    expect(result.probabilities['00'] ?? 0).toBe(0);
    expect(result.probabilities['01'] ?? 0).toBe(0);
    expect(result.probabilities['10'] ?? 0).toBe(0);
  });

  // ── Test 5: Web Worker Invoker ───────────────────────────────────────────
  it('5. runStatevectorInWorker completes non-blocking simulation', async () => {
    const bellCircuit: CanonicalCircuit = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { id: 'g0', type: 'h', targets: [0], column: 0 },
        { id: 'g1', type: 'cx', targets: [0, 1], column: 1 },
      ],
      measurements: [
        { qubit: 0, classical_bit: 0 },
        { qubit: 1, classical_bit: 1 },
      ],
      shots: 500,
    };

    const result = await runStatevectorInWorker(bellCircuit, { shots: 500 });

    console.log('\n[HUMAN CHECKPOINT - TEST 5: STATEVECTOR WORKER]');
    console.log('Backend:', result.backend);
    console.log('Counts:', result.counts);

    expect(result.qubit_count).toBe(2);
    expect(result.shots).toBe(500);
    expect((result.counts?.['00'] ?? 0) + (result.counts?.['11'] ?? 0)).toBe(500);
  });

  // ── Test 6: Memory Ceiling Safety Guard (<= 20 qubits) ───────────────────
  it('6. Memory Ceiling Guard strictly blocks > 20 qubits upfront before WASM execution', async () => {
    const oversizedCircuit: CanonicalCircuit = {
      qubits: 21,
      gates: [{ id: 'g0', type: 'h', targets: [0], column: 0 }],
      measurements: [{ qubit: 0, classical_bit: 0 }],
      shots: 10,
    };

    // Client wrapper upfront enforcement
    await expect(runStatevectorInWorker(oversizedCircuit)).rejects.toThrow(
      /Statevector simulation exceeds safe client memory limits for 21 qubits/
    );

    // Direct WASM engine ceiling enforcement
    expect(() => simulate_statevector_circuit(oversizedCircuit, 10)).toThrow(
      /Statevector simulation exceeds safe client memory limits for 21 qubits/
    );

    console.log('\n[HUMAN CHECKPOINT - TEST 6: MEMORY CEILING ENFORCEMENT]');
    console.log('21-qubit circuit successfully blocked by both JS client wrapper and Rust WASM ceiling.');
  });
});
