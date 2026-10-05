/**
 * benchmarkGhzComparison.ts
 *
 * Direct Head-to-Head Benchmark: TypeScript Baseline vs Rust/WASM Engine
 * Evaluates identical GHZ circuits across 10, 50, 100, 500, and 1000 qubits.
 * Measures both 100 shots (statistical sampling) and 1 shot (fast path).
 * Runs twice back-to-back in the foreground.
 */

import fs from 'node:fs';
import path from 'node:path';
import { simulateStabilizerCircuit } from './src/features/circuit/stabilizerEngine';
import { initSync, simulate_stabilizer_circuit } from './src/wasm/qualution-core/pkg/qualution_core.js';
import type { CanonicalCircuit, UnifiedExecutionResult } from './src/features/circuit/types';

// 1. Initialize WASM synchronously
const wasmPath = path.resolve('./src/wasm/qualution-core/pkg/qualution_core_bg.wasm');
const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
initSync({ module: wasmBytes });

function createGhzCircuit(numQubits: number, shots: number): CanonicalCircuit {
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
    shots,
  };
}

interface BenchmarkMeasurement {
  qubits: number;
  shots: number;
  tsWallMs: number;
  wasmWallMs: number;
  wasmEngineMs: number;
  speedupWall: number;
  speedupEngine: number;
  status: string;
}

function runMeasurement(qubits: number, shots: number): BenchmarkMeasurement {
  const circuit = createGhzCircuit(qubits, shots);

  // Warmup memory / gc if available
  if (global.gc) {
    global.gc();
  }

  // 1. Pure TypeScript
  const t0Ts = performance.now();
  const tsResult = simulateStabilizerCircuit(circuit, { shots });
  const t1Ts = performance.now();
  const tsWallMs = Math.round((t1Ts - t0Ts) * 100) / 100;

  // 2. Rust / WASM
  const t0Wasm = performance.now();
  const wasmResult = simulate_stabilizer_circuit(circuit, shots) as UnifiedExecutionResult;
  const t1Wasm = performance.now();
  const wasmWallMs = Math.round((t1Wasm - t0Wasm) * 100) / 100;
  const wasmEngineMs = wasmResult.runtime_ms;

  // Verify correctness
  const allZeros = '0'.repeat(qubits);
  const allOnes = '1'.repeat(qubits);
  const tsKeys = Object.keys(tsResult.counts || {});
  const wasmKeys = Object.keys(wasmResult.counts || {});

  const tsValid = tsKeys.length <= 2 && tsKeys.every((k) => k === allZeros || k === allOnes);
  const wasmValid = wasmKeys.length <= 2 && wasmKeys.every((k) => k === allZeros || k === allOnes);
  const status = tsValid && wasmValid ? 'VALID' : 'LEAKAGE_DETECTED';

  const speedupWall = Math.round((tsWallMs / Math.max(0.01, wasmWallMs)) * 100) / 100;
  const speedupEngine = Math.round((tsWallMs / Math.max(0.01, wasmEngineMs)) * 100) / 100;

  return {
    qubits,
    shots,
    tsWallMs,
    wasmWallMs,
    wasmEngineMs,
    speedupWall,
    speedupEngine,
    status,
  };
}

async function runSuite(runLabel: string) {
  console.log(`\n========================================================================`);
  console.log(`   BENCHMARK RUN: ${runLabel}`);
  console.log(`========================================================================`);

  const qubitSizes = [10, 50, 100, 500, 1000];

  console.log(`\n--- PART 1: 100 SHOTS (Statistical Sampling) ---`);
  console.log(`Qubits | TS Wall (ms) | WASM Wall (ms) | WASM Core (ms) | Wall Speedup | Engine Speedup | Status`);
  console.log(`-------|--------------|----------------|----------------|--------------|----------------|-------`);
  const results100: BenchmarkMeasurement[] = [];
  for (const n of qubitSizes) {
    const m = runMeasurement(n, 100);
    results100.push(m);
    console.log(
      `${String(m.qubits).padEnd(6)} | ` +
      `${String(m.tsWallMs.toFixed(2)).padStart(12)} | ` +
      `${String(m.wasmWallMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.wasmEngineMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.speedupWall.toFixed(2) + 'x').padStart(12)} | ` +
      `${String(m.speedupEngine.toFixed(2) + 'x').padStart(14)} | ` +
      `${m.status}`
    );
  }

  console.log(`\n--- PART 2: 1 SHOT (Fast Path Unitary + Single Measurement) ---`);
  console.log(`Qubits | TS Wall (ms) | WASM Wall (ms) | WASM Core (ms) | Wall Speedup | Engine Speedup | Status`);
  console.log(`-------|--------------|----------------|----------------|--------------|----------------|-------`);
  const results1: BenchmarkMeasurement[] = [];
  for (const n of qubitSizes) {
    const m = runMeasurement(n, 1);
    results1.push(m);
    console.log(
      `${String(m.qubits).padEnd(6)} | ` +
      `${String(m.tsWallMs.toFixed(2)).padStart(12)} | ` +
      `${String(m.wasmWallMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.wasmEngineMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.speedupWall.toFixed(2) + 'x').padStart(12)} | ` +
      `${String(m.speedupEngine.toFixed(2) + 'x').padStart(14)} | ` +
      `${m.status}`
    );
  }

  return { results100, results1 };
}

// Crossover analysis across smaller qubit intervals
async function runCrossoverAnalysis() {
  console.log(`\n========================================================================`);
  console.log(`   CROSSOVER POINT ANALYSIS (Small to Medium Qubit Register Scaling)     `);
  console.log(`========================================================================`);
  const testPoints = [5, 10, 20, 30, 40, 50, 75, 100];
  console.log(`Qubits | 1-Shot TS (ms) | 1-Shot WASM (ms) | 1-Shot Speedup | 100-Shot TS (ms) | 100-Shot WASM (ms) | 100-Shot Speedup`);
  console.log(`-------|----------------|------------------|----------------|------------------|--------------------|-----------------`);

  for (const q of testPoints) {
    const m1 = runMeasurement(q, 1);
    const m100 = runMeasurement(q, 100);
    console.log(
      `${String(q).padEnd(6)} | ` +
      `${String(m1.tsWallMs.toFixed(2)).padStart(14)} | ` +
      `${String(m1.wasmWallMs.toFixed(2)).padStart(16)} | ` +
      `${String(m1.speedupWall.toFixed(2) + 'x').padStart(14)} | ` +
      `${String(m100.tsWallMs.toFixed(2)).padStart(16)} | ` +
      `${String(m100.wasmWallMs.toFixed(2)).padStart(18)} | ` +
      `${String(m100.speedupWall.toFixed(2) + 'x').padStart(15)}`
    );
  }
}

async function main() {
  // Run 1
  await runSuite('RUN 1 OF 2 (FOREGROUND BLOCKING)');

  // Run 2
  await runSuite('RUN 2 OF 2 (FOREGROUND BLOCKING)');

  // Crossover analysis
  await runCrossoverAnalysis();
}

main().catch(console.error);
