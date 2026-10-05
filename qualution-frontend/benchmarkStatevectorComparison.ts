/**
 * benchmarkStatevectorComparison.ts
 *
 * Direct Head-to-Head Benchmark: TypeScript Statevector vs Rust/WASM Statevector Core
 * Evaluates representative non-Clifford circuits across 10, 15, 18, and 20 qubits (the full safe range).
 * Runs twice back-to-back in the foreground.
 */

import fs from 'node:fs';
import path from 'node:path';
import { simulateStatevectorCircuit } from './src/features/circuit/statevectorEngine';
import { initSync, simulate_statevector_circuit } from './src/wasm/qualution-core/pkg/qualution_core.js';
import type { CanonicalCircuit, UnifiedExecutionResult } from './src/features/circuit/types';

// 1. Initialize WASM synchronously
const wasmPath = path.resolve('./src/wasm/qualution-core/pkg/qualution_core_bg.wasm');
const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
initSync({ module: wasmBytes });

function createBenchmarkCircuit(numQubits: number, shots: number): CanonicalCircuit {
  const gates: Array<{ id: string; type: string; targets: number[]; column: number; angle?: number }> = [];

  // Column 0: Superposition layer
  for (let q = 0; q < numQubits; q++) {
    gates.push({ id: `h_${q}`, type: 'h', targets: [q], column: 0 });
  }

  // Column 1: Non-Clifford rotation layer
  for (let q = 0; q < numQubits; q++) {
    if (q % 2 === 0) {
      gates.push({ id: `rx_${q}`, type: 'rx', targets: [q], column: 1, angle: Math.PI / 4 });
    } else {
      gates.push({ id: `t_${q}`, type: 't', targets: [q], column: 1 });
    }
  }

  // Column 2: Entangling CNOT chain
  for (let q = 0; q + 1 < numQubits; q++) {
    gates.push({ id: `cx_${q}`, type: 'cx', targets: [q, q + 1], column: 2 });
  }

  // Column 3: Phase / RZ layer
  for (let q = 0; q < numQubits; q++) {
    gates.push({ id: `rz_${q}`, type: 'rz', targets: [q], column: 3, angle: Math.PI / 6 });
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
    shots,
  };
}

interface BenchmarkMeasurement {
  qubits: number;
  amplitudes: number;
  memoryMb: number;
  tsWallMs: number;
  wasmWallMs: number;
  wasmCoreMs: number;
  speedupWall: number;
  speedupCore: number;
}

function runMeasurement(qubits: number, shots: number = 1000): BenchmarkMeasurement {
  const circuit = createBenchmarkCircuit(qubits, shots);
  const amplitudes = 1 << qubits;
  const memoryMb = Math.round(((amplitudes * 16) / (1024 * 1024)) * 100) / 100;

  if (global.gc) {
    global.gc();
  }

  // 1. Pure TypeScript Statevector
  const t0Ts = performance.now();
  const tsResult = simulateStatevectorCircuit(circuit, { shots });
  const t1Ts = performance.now();
  const tsWallMs = Math.round((t1Ts - t0Ts) * 100) / 100;

  // 2. Rust/WASM Statevector
  const t0Wasm = performance.now();
  const wasmResult = simulate_statevector_circuit(circuit, shots) as UnifiedExecutionResult;
  const t1Wasm = performance.now();
  const wasmWallMs = Math.round((t1Wasm - t0Wasm) * 100) / 100;
  const wasmCoreMs = wasmResult.runtime_ms;

  const speedupWall = Math.round((tsWallMs / Math.max(0.01, wasmWallMs)) * 100) / 100;
  const speedupCore = Math.round((tsWallMs / Math.max(0.01, wasmCoreMs)) * 100) / 100;

  return {
    qubits,
    amplitudes,
    memoryMb,
    tsWallMs,
    wasmWallMs,
    wasmCoreMs,
    speedupWall,
    speedupCore,
  };
}

async function runSuite(runLabel: string) {
  console.log(`\n========================================================================`);
  console.log(`   STATEVECTOR BENCHMARK RUN: ${runLabel}`);
  console.log(`========================================================================`);
  console.log(`Qubits | Amplitudes | RAM (MB) | TS Wall (ms) | WASM Wall (ms) | WASM Core (ms) | Wall Speedup | Core Speedup`);
  console.log(`-------|------------|----------|--------------|----------------|----------------|--------------|-------------`);

  const qubitSizes = [10, 15, 18, 20];
  const results: BenchmarkMeasurement[] = [];

  for (const n of qubitSizes) {
    const m = runMeasurement(n, 1000);
    results.push(m);
    console.log(
      `${String(m.qubits).padEnd(6)} | ` +
      `${String(m.amplitudes.toLocaleString()).padStart(10)} | ` +
      `${String(m.memoryMb.toFixed(2)).padStart(8)} | ` +
      `${String(m.tsWallMs.toFixed(2)).padStart(12)} | ` +
      `${String(m.wasmWallMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.wasmCoreMs.toFixed(2)).padStart(14)} | ` +
      `${String(m.speedupWall.toFixed(2) + 'x').padStart(12)} | ` +
      `${String(m.speedupCore.toFixed(2) + 'x').padStart(11)}`
    );
  }

  return results;
}

async function main() {
  // Run 1
  await runSuite('RUN 1 OF 2 (FOREGROUND BLOCKING)');

  // Run 2
  await runSuite('RUN 2 OF 2 (FOREGROUND BLOCKING)');
}

main().catch(console.error);
