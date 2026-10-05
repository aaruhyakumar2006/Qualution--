/**
 * stabilizerWasmParity.test.ts
 *
 * Automated Parity Test Harness: TypeScript Stabilizer Engine vs Rust/WASM Core.
 *
 * Verifies 100% exact parity between:
 * 1. Pure TypeScript Aaronson-Gottesman implementation (simulateStabilizerCircuit)
 * 2. Rust/WebAssembly Aaronson-Gottesman implementation (simulate_stabilizer_circuit)
 *
 * Standing test requirement:
 * Runs identical circuits through BOTH engines, asserting exact probability distributions
 * match within floating-point tolerance (< 1e-9), counts match identically, and the Grover
 * 12-gate circuit specifically reports P(11) in [0.99, 1.00] on both engines.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simulateStabilizerCircuit } from './stabilizerEngine';
import { initSync, simulate_stabilizer_circuit } from '../../wasm/qualution-core/pkg/qualution_core.js';
import type { CanonicalCircuit, UnifiedExecutionResult } from './types';

// ── Deterministic PRNG for 100% Bit-Identical Measurements ─────────────────

function createXorShift32(seed: number): () => number {
  let s = (seed === 0 ? 1 : seed) >>> 0;
  return function next(): number {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >>> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

// ── Circuit Generators & Fixtures ──────────────────────────────────────────

function buildBellStateCircuit(): CanonicalCircuit {
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

function buildGhzCircuit(numQubits: number): CanonicalCircuit {
  const gates = [{ id: 'g0', type: 'h', targets: [0], column: 0 }];
  const measurements = [{ qubit: 0, classical_bit: 0 }];

  for (let q = 1; q < numQubits; q++) {
    gates.push({ id: `g${q}`, type: 'cx', targets: [q - 1, q], column: q });
    measurements.push({ qubit: q, classical_bit: q });
  }

  return {
    qubits: numQubits,
    classical_bits: numQubits,
    gates,
    measurements,
    shots: 1000,
  };
}

function buildGroverCircuit(): CanonicalCircuit {
  return {
    qubits: 2,
    classical_bits: 2,
    gates: [
      // Column 0: Superposition
      { id: 'g-h0', type: 'h', targets: [0], column: 0 },
      { id: 'g-h1', type: 'h', targets: [1], column: 0 },
      // Column 1: Oracle (|11> phase inversion)
      { id: 'g-cz-oracle', type: 'cz', targets: [0, 1], column: 1 },
      // Column 2: Diffusion H
      { id: 'g-dh0', type: 'h', targets: [0], column: 2 },
      { id: 'g-dh1', type: 'h', targets: [1], column: 2 },
      // Column 3: Diffusion X
      { id: 'g-dx0', type: 'x', targets: [0], column: 3 },
      { id: 'g-dx1', type: 'x', targets: [1], column: 3 },
      // Column 4: Diffusion CZ
      { id: 'g-dcz', type: 'cz', targets: [0, 1], column: 4 },
      // Column 5: Diffusion X
      { id: 'g-dx0b', type: 'x', targets: [0], column: 5 },
      { id: 'g-dx1b', type: 'x', targets: [1], column: 5 },
      // Column 6: Diffusion H
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

function generateRandomCliffordCircuit(numQubits: number, depth: number, genSeed: number): CanonicalCircuit {
  const rng = createXorShift32(genSeed);
  const gates: Array<{ id: string; type: string; targets: number[]; column: number }> = [];
  const singleQubitGates = ['h', 's', 'sdg', 'x', 'y', 'z'];
  const twoQubitGates = ['cx', 'cz', 'swap'];

  let col = 0;
  for (let d = 0; d < depth; d++) {
    // Single qubit layer
    for (let q = 0; q < numQubits; q++) {
      if (rng() > 0.25) {
        const gateIdx = Math.floor(rng() * singleQubitGates.length);
        gates.push({
          id: `g_${col}_${q}`,
          type: singleQubitGates[gateIdx],
          targets: [q],
          column: col,
        });
      }
    }
    col++;

    // Two qubit layer
    const available = Array.from({ length: numQubits }, (_, i) => i);
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    for (let i = 0; i + 1 < available.length; i += 2) {
      if (rng() > 0.35) {
        const q1 = available[i];
        const q2 = available[i + 1];
        const gateIdx = Math.floor(rng() * twoQubitGates.length);
        gates.push({
          id: `g_${col}_${q1}_${q2}`,
          type: twoQubitGates[gateIdx],
          targets: [q1, q2],
          column: col,
        });
      }
    }
    col++;
  }

  const measurements = Array.from({ length: numQubits }, (_, q) => ({
    qubit: q,
    classical_bit: q,
  }));

  return {
    qubits: numQubits,
    classical_bits: numQubits,
    gates,
    measurements,
    shots: 1000,
  };
}

// ── Parity Assertion Function ──────────────────────────────────────────────

interface ParityReport {
  fixtureName: string;
  qubitCount: number;
  gateCount: number;
  shots: number;
  distinctStatesCount: number;
  maxProbabilityDiff: number;
  tsRuntimeMs: number;
  wasmRuntimeMs: number;
  groverP11?: { ts: number; wasm: number };
  passed: boolean;
}

function assertParity(
  fixtureName: string,
  circuit: CanonicalCircuit,
  seed: number,
  shots: number = 1000
): ParityReport {
  // 1. Run pure TypeScript engine with deterministic PRNG
  const t0Ts = performance.now();
  const tsResult = simulateStabilizerCircuit(circuit, {
    shots,
    rng: createXorShift32(seed),
  });
  const tsWallMs = performance.now() - t0Ts;

  // 2. Run Rust/WASM engine with identical seed
  const t0Wasm = performance.now();
  const wasmCircuit = { ...circuit, seed, shots };
  const wasmResult = simulate_stabilizer_circuit(wasmCircuit, shots) as UnifiedExecutionResult;
  const wasmWallMs = performance.now() - t0Wasm;

  // 3. Compare probability distributions & counts
  const tsProbs = tsResult.probabilities || {};
  const wasmProbs = wasmResult.probabilities || {};
  const allStates = new Set([...Object.keys(tsProbs), ...Object.keys(wasmProbs)]);

  let maxDiff = 0.0;
  const differingStates: Array<{ state: string; tsProb: number; wasmProb: number; diff: number }> = [];

  for (const state of allStates) {
    const pTs = tsProbs[state] ?? 0.0;
    const pWasm = wasmProbs[state] ?? 0.0;
    const diff = Math.abs(pTs - pWasm);
    if (diff > maxDiff) {
      maxDiff = diff;
    }
    if (diff > 1e-9) {
      differingStates.push({ state, tsProb: pTs, wasmProb: pWasm, diff });
    }
  }

  // 4. If any states differ by >= 1e-9, report blocking bug details and fail assertion
  if (differingStates.length > 0) {
    console.error(`\n[BLOCKING BUG DETECTED] Fixture '${fixtureName}' diverged!`);
    console.error(`Diverging states (tolerance 1e-9):`, differingStates.slice(0, 10));
    console.error(`TS Counts:`, tsResult.counts);
    console.error(`WASM Counts:`, wasmResult.counts);
  }

  expect(differingStates).toHaveLength(0);
  expect(maxDiff).toBeLessThan(1e-9);

  // Assert counts are bit-exact identical
  for (const state of allStates) {
    const cTs = tsResult.counts?.[state] ?? 0;
    const cWasm = wasmResult.counts?.[state] ?? 0;
    expect(cWasm).toBe(cTs);
  }

  const report: ParityReport = {
    fixtureName,
    qubitCount: circuit.qubits,
    gateCount: circuit.gates?.length ?? 0,
    shots,
    distinctStatesCount: allStates.size,
    maxProbabilityDiff: maxDiff,
    tsRuntimeMs: Math.round(tsWallMs * 100) / 100,
    wasmRuntimeMs: Math.round(wasmWallMs * 100) / 100,
    passed: true,
  };

  return report;
}

// ── Parity Test Suite ──────────────────────────────────────────────────────

describe('TypeScript vs Rust/WASM Stabilizer Engine Automated Parity Harness', () => {
  beforeAll(() => {
    // Initialize WebAssembly module synchronously in Node/JSDOM test runner
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initSync({ module: wasmBytes });
  });

  // ── FIXTURE 1: Bell State (2 Qubits) ─────────────────────────────────────
  it('Fixture 1: Bell State (2 qubits) achieves bit-exact parity (< 1e-9)', () => {
    const circuit = buildBellStateCircuit();
    const report = assertParity('Bell State (2q)', circuit, 42, 1000);

    console.log(`\n[PARITY FIXTURE 1: Bell State (2q)]`);
    console.log(`- States: ${report.distinctStatesCount} (|00>, |11>)`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.distinctStatesCount).toBe(2);
    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 2: GHZ-3 State (3 Qubits) ────────────────────────────────────
  it('Fixture 2: GHZ-3 (3 qubits) achieves bit-exact parity (< 1e-9)', () => {
    const circuit = buildGhzCircuit(3);
    const report = assertParity('GHZ-3 (3q)', circuit, 101, 1000);

    console.log(`\n[PARITY FIXTURE 2: GHZ-3 (3q)]`);
    console.log(`- States: ${report.distinctStatesCount} (|000>, |111>)`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.distinctStatesCount).toBe(2);
    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 3: GHZ-10 State (10 Qubits) ──────────────────────────────────
  it('Fixture 3: GHZ-10 (10 qubits) achieves bit-exact parity (< 1e-9)', () => {
    const circuit = buildGhzCircuit(10);
    const report = assertParity('GHZ-10 (10q)', circuit, 202, 1000);

    console.log(`\n[PARITY FIXTURE 3: GHZ-10 (10q)]`);
    console.log(`- States: ${report.distinctStatesCount}`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.distinctStatesCount).toBe(2);
    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 4: GHZ-50 State (50 Qubits) ──────────────────────────────────
  it('Fixture 4: GHZ-50 (50 qubits) achieves bit-exact parity (< 1e-9)', () => {
    const circuit = buildGhzCircuit(50);
    const report = assertParity('GHZ-50 (50q)', circuit, 303, 1000);

    console.log(`\n[PARITY FIXTURE 4: GHZ-50 (50q)]`);
    console.log(`- States: ${report.distinctStatesCount} (|0...0>, |1...1>)`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.distinctStatesCount).toBe(2);
    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 5: Grover 12-Gate Circuit (2 Qubits) ─────────────────────────
  it('Fixture 5: Grover 12-gate circuit achieves bit-exact parity with P(11) in [0.99, 1.00]', () => {
    const circuit = buildGroverCircuit();
    const report = assertParity('Grover 12-Gate Circuit (2q)', circuit, 404, 1000);

    // Re-verify specific requirement: confirm both report P(11) in [0.99, 1.00]
    const tsResult = simulateStabilizerCircuit(circuit, { shots: 1000, rng: createXorShift32(404) });
    const wasmResult = simulate_stabilizer_circuit({ ...circuit, seed: 404, shots: 1000 }, 1000) as UnifiedExecutionResult;

    const tsP11 = tsResult.probabilities['11'] ?? 0;
    const wasmP11 = wasmResult.probabilities['11'] ?? 0;

    console.log(`\n[PARITY FIXTURE 5: Grover 12-Gate Circuit (2q)]`);
    console.log(`- TS P(11): ${tsP11.toFixed(4)} | WASM P(11): ${wasmP11.toFixed(4)}`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(tsP11).toBeGreaterThanOrEqual(0.99);
    expect(tsP11).toBeLessThanOrEqual(1.00);
    expect(wasmP11).toBeGreaterThanOrEqual(0.99);
    expect(wasmP11).toBeLessThanOrEqual(1.00);
    expect(Math.abs(tsP11 - wasmP11)).toBeLessThan(1e-9);
    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 6: Random Clifford (5 Qubits) ─────────────────────────────────
  it('Fixture 6: Random Clifford 5-qubit circuit achieves bit-exact parity (< 1e-9)', () => {
    const circuit = generateRandomCliffordCircuit(5, 8, 505);
    const report = assertParity('Random Clifford (5q, 8 layers)', circuit, 5051, 1000);

    console.log(`\n[PARITY FIXTURE 6: Random Clifford (5q)]`);
    console.log(`- Gates: ${report.gateCount}`);
    console.log(`- Distinct Output States: ${report.distinctStatesCount}`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 7: Random Clifford (15 Qubits) ────────────────────────────────
  it('Fixture 7: Random Clifford 15-qubit circuit achieves bit-exact parity (< 1e-9)', () => {
    const circuit = generateRandomCliffordCircuit(15, 8, 606);
    const report = assertParity('Random Clifford (15q, 8 layers)', circuit, 6061, 1000);

    console.log(`\n[PARITY FIXTURE 7: Random Clifford (15q)]`);
    console.log(`- Gates: ${report.gateCount}`);
    console.log(`- Distinct Output States: ${report.distinctStatesCount}`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });

  // ── FIXTURE 8: Random Clifford (30 Qubits) ────────────────────────────────
  it('Fixture 8: Random Clifford 30-qubit circuit achieves bit-exact parity (< 1e-9)', () => {
    const circuit = generateRandomCliffordCircuit(30, 8, 707);
    const report = assertParity('Random Clifford (30q, 8 layers)', circuit, 7071, 1000);

    console.log(`\n[PARITY FIXTURE 8: Random Clifford (30q)]`);
    console.log(`- Gates: ${report.gateCount}`);
    console.log(`- Distinct Output States: ${report.distinctStatesCount}`);
    console.log(`- Max |P_ts - P_wasm|: ${report.maxProbabilityDiff.toExponential(4)}`);
    console.log(`- TS Runtime: ${report.tsRuntimeMs}ms | WASM Runtime: ${report.wasmRuntimeMs}ms`);

    expect(report.maxProbabilityDiff).toBeLessThan(1e-9);
  });
});
