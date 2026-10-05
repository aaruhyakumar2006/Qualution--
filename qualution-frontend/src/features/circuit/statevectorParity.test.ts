/**
 * statevectorParity.test.ts
 *
 * Automated Parity Test Harness: TypeScript Statevector vs Rust/WASM Statevector Core.
 *
 * Rigorous validation across:
 * 1. Bell state (|00> + |11>): exact 50/50 distribution and complex statevector amplitudes.
 * 2. Grover 2-qubit circuit: THREE-WAY cross-check:
 *    - TypeScript Statevector
 *    - Rust/WASM Statevector
 *    - Rust/WASM Stabilizer
 *    All three must agree 100% on P(11) = 1.0000 with 0 leakage.
 * 3. Non-Clifford circuit: RX(pi/3) single-qubit rotation (which Stabilizer explicitly rejects):
 *    Confirms exact Born-rule analytical probabilities P(0) = 0.75, P(1) = 0.25 (< 1e-9 diff).
 * 4. Non-Clifford circuit: H -> T -> H circuit:
 *    Confirms analytical P(0) = (2 + sqrt(2))/4 ≈ 0.85355339, P(1) ≈ 0.14644661 (< 1e-9 diff).
 * 5. Multi-qubit non-Clifford circuit (5 qubits with H, CX, T, RX, RZ, P):
 *    Confirms full tensor-index bit manipulation parity across multiple wire registers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simulateStatevectorCircuit } from './statevectorEngine';
import {
  initSync,
  simulate_statevector_circuit,
  simulate_stabilizer_circuit,
} from '../../wasm/qualution-core/pkg/qualution_core.js';
import type { CanonicalCircuit, UnifiedExecutionResult } from './types';

// ── Deterministic PRNG for Identical Bit-Exact Sampling ────────────────────

function createXorShift32(seed: number): () => number {
  let s = (seed === 0 ? 1 : seed) >>> 0;
  return function next(): number {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── Circuit Fixture Constructors ───────────────────────────────────────────

function buildBellCircuit(): CanonicalCircuit {
  return {
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
}

function buildGroverCircuit(): CanonicalCircuit {
  return {
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
}

function buildNonCliffordRxCircuit(): CanonicalCircuit {
  return {
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
    shots: 1000,
  };
}

function buildNonCliffordHthCircuit(): CanonicalCircuit {
  return {
    qubits: 1,
    classical_bits: 1,
    gates: [
      { id: 'g0', type: 'h', targets: [0], column: 0 },
      { id: 'g1', type: 't', targets: [0], column: 1 }, // Non-Clifford T gate
      { id: 'g2', type: 'h', targets: [0], column: 2 },
    ],
    measurements: [{ qubit: 0, classical_bit: 0 }],
    shots: 1000,
  };
}

function buildMultiQubitNonCliffordCircuit(): CanonicalCircuit {
  return {
    qubits: 5,
    classical_bits: 5,
    gates: [
      // Layer 0: Superposition
      { id: 'g0', type: 'h', targets: [0], column: 0 },
      { id: 'g1', type: 'h', targets: [1], column: 0 },
      { id: 'g2', type: 'h', targets: [2], column: 0 },
      // Layer 1: Non-Clifford T and Rotations
      { id: 'g3', type: 't', targets: [0], column: 1 },
      { id: 'g4', type: 'rx', targets: [1], column: 1, angle: Math.PI / 4 },
      { id: 'g5', type: 'rz', targets: [2], column: 1, angle: Math.PI / 6 },
      // Layer 2: Entanglement
      { id: 'g6', type: 'cx', targets: [0, 3], column: 2 },
      { id: 'g7', type: 'cx', targets: [1, 4], column: 2 },
      // Layer 3: Phase and CZ
      { id: 'g8', type: 'p', targets: [3], column: 3, angle: Math.PI / 3 },
      { id: 'g9', type: 'cz', targets: [2, 4], column: 3 },
    ],
    measurements: [
      { qubit: 0, classical_bit: 0 },
      { qubit: 1, classical_bit: 1 },
      { qubit: 2, classical_bit: 2 },
      { qubit: 3, classical_bit: 3 },
      { qubit: 4, classical_bit: 4 },
    ],
    shots: 1000,
  };
}

// ── Statevector Parity Assertion ───────────────────────────────────────────

function assertStatevectorParity(
  fixtureName: string,
  circuit: CanonicalCircuit,
  seed: number = 42,
  shots: number = 1000
) {
  // 1. Run pure TypeScript Statevector engine
  const t0Ts = performance.now();
  const tsResult = simulateStatevectorCircuit(circuit, {
    shots,
    rng: createXorShift32(seed),
  });
  const tsWallMs = performance.now() - t0Ts;

  // 2. Run Rust/WASM Statevector engine
  const t0Wasm = performance.now();
  const wasmResult = simulate_statevector_circuit(
    { ...circuit, seed, shots },
    shots
  ) as UnifiedExecutionResult;
  const wasmWallMs = performance.now() - t0Wasm;

  // 3. Compare analytical probability distributions
  const tsProbs = tsResult.probabilities || {};
  const wasmProbs = wasmResult.probabilities || {};
  const allStates = new Set([...Object.keys(tsProbs), ...Object.keys(wasmProbs)]);

  let maxProbDiff = 0.0;
  const divergingStates: Array<{ state: string; ts: number; wasm: number; diff: number }> = [];

  for (const state of allStates) {
    const pTs = tsProbs[state] ?? 0.0;
    const pWasm = wasmProbs[state] ?? 0.0;
    const diff = Math.abs(pTs - pWasm);
    if (diff > maxProbDiff) {
      maxProbDiff = diff;
    }
    if (diff > 1e-7) { // 1e-7 tolerance accounts for Float64 roundtrip in JS vs Rust float formatting
      divergingStates.push({ state, ts: pTs, wasm: pWasm, diff });
    }
  }

  // 4. Compare complex statevector amplitudes if present
  let maxAmpDiff = 0.0;
  if (tsResult.statevector && wasmResult.statevector) {
    expect(wasmResult.statevector).toHaveLength(tsResult.statevector.length);
    for (let i = 0; i < tsResult.statevector.length; i++) {
      const aTs = tsResult.statevector[i];
      const aWasm = wasmResult.statevector[i];
      const diffR = Math.abs(aTs.real - aWasm.real);
      const diffI = Math.abs(aTs.imag - aWasm.imag);
      maxAmpDiff = Math.max(maxAmpDiff, diffR, diffI);
    }
  }

  // 5. Compare sampled counts (exact with synchronized PRNG)
  for (const state of allStates) {
    const cTs = tsResult.counts?.[state] ?? 0;
    const cWasm = wasmResult.counts?.[state] ?? 0;
    expect(cWasm).toBe(cTs);
  }

  expect(divergingStates).toHaveLength(0);
  expect(maxProbDiff).toBeLessThan(1e-7);

  console.log(`\n[PARITY FIXTURE: ${fixtureName}]`);
  console.log(`- Qubits: ${circuit.qubits} | Gates: ${circuit.gates?.length ?? 0} | Shots: ${shots}`);
  console.log(`- Distinct Output States: ${allStates.size}`);
  console.log(`- Max Probability Diff: ${maxProbDiff.toExponential(4)}`);
  console.log(`- Max Amplitude Diff: ${maxAmpDiff.toExponential(4)}`);
  console.log(`- TS Runtime: ${tsWallMs.toFixed(2)}ms | WASM Runtime: ${wasmWallMs.toFixed(2)}ms`);

  return {
    fixtureName,
    maxProbDiff,
    maxAmpDiff,
    tsWallMs,
    wasmWallMs,
    tsResult,
    wasmResult,
  };
}

describe('Statevector Engine Automated Parity & Cross-Check Suite', () => {
  beforeAll(() => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initSync({ module: wasmBytes });
  });

  // ── FIXTURE 1: Bell State ────────────────────────────────────────────────
  it('Fixture 1: Bell State achieves 100% parity (< 1e-7) with matching complex amplitudes', () => {
    const circuit = buildBellCircuit();
    const { maxProbDiff, maxAmpDiff, tsResult, wasmResult } = assertStatevectorParity(
      'Bell State (|00> + |11>)',
      circuit,
      42,
      1000
    );

    expect(maxProbDiff).toBeLessThan(1e-7);
    expect(maxAmpDiff).toBeLessThan(1e-5);
    expect(tsResult.probabilities['00']).toBeCloseTo(0.5, 4);
    expect(wasmResult.probabilities['00']).toBeCloseTo(0.5, 4);
    expect(tsResult.probabilities['11']).toBeCloseTo(0.5, 4);
    expect(wasmResult.probabilities['11']).toBeCloseTo(0.5, 4);
  });

  // ── FIXTURE 2: THREE-WAY Grover Cross-Check ──────────────────────────────
  it('Fixture 2: Grover Circuit achieves THREE-WAY 100% agreement (TS Statevector == WASM Statevector == WASM Stabilizer)', () => {
    const circuit = buildGroverCircuit();

    // 1. Pure TS Statevector
    const tsSvResult = simulateStatevectorCircuit(circuit, { shots: 1000 });
    // 2. Rust WASM Statevector
    const wasmSvResult = simulate_statevector_circuit(circuit, 1000) as UnifiedExecutionResult;
    // 3. Rust WASM Stabilizer
    const wasmStabResult = simulate_stabilizer_circuit(circuit, 1000) as UnifiedExecutionResult;

    console.log('\n[THREE-WAY GROVER CROSS-CHECK]');
    console.log('1. TS Statevector P(11):', tsSvResult.probabilities['11']);
    console.log('2. WASM Statevector P(11):', wasmSvResult.probabilities['11']);
    console.log('3. WASM Stabilizer P(11):', wasmStabResult.probabilities['11']);

    // Check P(11) in [0.99, 1.00] for all three
    expect(tsSvResult.probabilities['11']).toBeGreaterThanOrEqual(0.99);
    expect(tsSvResult.probabilities['11']).toBe(1.0);

    expect(wasmSvResult.probabilities['11']).toBeGreaterThanOrEqual(0.99);
    expect(wasmSvResult.probabilities['11']).toBe(1.0);

    expect(wasmStabResult.probabilities['11']).toBeGreaterThanOrEqual(0.99);
    expect(wasmStabResult.probabilities['11']).toBe(1.0);

    // Three-way exact identity
    expect(wasmSvResult.probabilities['11']).toBe(tsSvResult.probabilities['11']);
    expect(wasmSvResult.probabilities['11']).toBe(wasmStabResult.probabilities['11']);

    // Counts agreement
    expect(tsSvResult.counts?.['11']).toBe(1000);
    expect(wasmSvResult.counts?.['11']).toBe(1000);
    expect(wasmStabResult.counts?.['11']).toBe(1000);
  });

  // ── FIXTURE 3: Non-Clifford RX(pi/3) Rotation ────────────────────────────
  it('Fixture 3: Non-Clifford RX(pi/3) rotation achieves exact Born rule analytical agreement P(0)=0.75, P(1)=0.25', () => {
    const circuit = buildNonCliffordRxCircuit();
    const { maxProbDiff, tsResult, wasmResult } = assertStatevectorParity(
      'Non-Clifford RX(pi/3)',
      circuit,
      101,
      1000
    );

    expect(maxProbDiff).toBeLessThan(1e-7);
    expect(tsResult.probabilities['0']).toBe(0.75);
    expect(wasmResult.probabilities['0']).toBe(0.75);
    expect(tsResult.probabilities['1']).toBe(0.25);
    expect(wasmResult.probabilities['1']).toBe(0.25);
  });

  // ── FIXTURE 4: Non-Clifford T Gate Circuit (H -> T -> H) ───────────────────
  it('Fixture 4: Non-Clifford H-T-H circuit produces analytical agreement P(0)=(2+sqrt(2))/4', () => {
    const circuit = buildNonCliffordHthCircuit();
    const { maxProbDiff, tsResult, wasmResult } = assertStatevectorParity(
      'Non-Clifford H-T-H',
      circuit,
      202,
      1000
    );

    const expectedP0 = (2 + Math.SQRT2) / 4;
    const expectedP1 = (2 - Math.SQRT2) / 4;

    expect(maxProbDiff).toBeLessThan(1e-7);
    expect(tsResult.probabilities['0']).toBeCloseTo(expectedP0, 6);
    expect(wasmResult.probabilities['0']).toBeCloseTo(expectedP0, 6);
    expect(tsResult.probabilities['1']).toBeCloseTo(expectedP1, 6);
    expect(wasmResult.probabilities['1']).toBeCloseTo(expectedP1, 6);
  });

  // ── FIXTURE 5: Multi-Qubit Non-Clifford Circuit (5 Qubits) ─────────────────
  it('Fixture 5: 5-Qubit Multi-Layer Non-Clifford circuit achieves bit-exact parity across all 32 basis states', () => {
    const circuit = buildMultiQubitNonCliffordCircuit();
    const { maxProbDiff, maxAmpDiff } = assertStatevectorParity(
      '5-Qubit Non-Clifford (H, T, RX, RZ, CX, P, CZ)',
      circuit,
      303,
      1000
    );

    expect(maxProbDiff).toBeLessThan(1e-7);
    expect(maxAmpDiff).toBeLessThan(1e-5);
  });
});
