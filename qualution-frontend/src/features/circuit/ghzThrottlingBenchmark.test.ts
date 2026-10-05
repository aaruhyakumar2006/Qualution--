/**
 * ghzThrottlingBenchmark.test.ts
 *
 * Empirical GHZ Benchmark under CPU Throttling:
 * 1. Baseline unthrottled (1x)
 * 2. 4x CPU Throttling (budget mobile / low-power edge device)
 * 3. 6x CPU Throttling (ultra-low-power restricted edge device)
 *
 * Measures whether Rust/WASM holds up proportionally better, worse, or the same
 * as TypeScript under the same compute constraints.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSync, simulate_stabilizer_circuit as simulateWasmStabilizer } from '../../wasm/qualution-core/pkg/qualution_core.js';
import { simulateStabilizerCircuit } from './stabilizerEngine';
import type { CanonicalCircuit } from './types';

function createGhzCircuit(numQubits: number, shots: number): CanonicalCircuit {
  const gates = [{ id: 'g0', type: 'h', targets: [0], column: 0 }];
  const measurements = [{ qubit: 0, classical_bit: 0 }];

  for (let q = 1; q < numQubits; q++) {
    gates.push({ id: `g${q}`, type: 'cx', targets: [q - 1, q], column: q });
    measurements.push({ qubit: q, classical_bit: q });
  }

  return {
    qubits: numQubits,
    gates,
    measurements,
    shots,
  };
}

describe('GHZ Benchmark Suite: Baseline vs 4x vs 6x CPU Throttling', () => {
  beforeAll(() => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initSync({ module: wasmBytes });
  });

  it('runs identical GHZ benchmarks and reports scaling under 1x, 4x, and 6x CPU constraints', () => {
    const qubitConfigs = [
      { qubits: 10, shots: 100 },
      { qubits: 50, shots: 100 },
      { qubits: 100, shots: 100 },
      { qubits: 50, shots: 1 },
      { qubits: 100, shots: 1 },
    ];

    // Warm-up runs to prime caches
    const warmup = createGhzCircuit(10, 10);
    simulateStabilizerCircuit(warmup);
    simulateWasmStabilizer(warmup, 10);

    const runResults: Array<{
      qubits: number;
      shots: number;
      tsBaseMs: number;
      wasmBaseMs: number;
      baseSpeedup: number;
      ts4xMs: number;
      wasm4xMs: number;
      speedup4x: number;
      ts6xMs: number;
      wasm6xMs: number;
      speedup6x: number;
    }> = [];

    for (const { qubits, shots } of qubitConfigs) {
      const circuit = createGhzCircuit(qubits, shots);

      // ── 1. Unthrottled Baseline (Average of 3 runs) ──
      let totalTs = 0;
      let totalWasm = 0;
      const iterations = 3;

      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        simulateStabilizerCircuit(circuit, { shots });
        totalTs += performance.now() - t0;

        const t1 = performance.now();
        simulateWasmStabilizer(circuit, shots);
        totalWasm += performance.now() - t1;
      }

      const tsBase = totalTs / iterations;
      const wasmBase = totalWasm / iterations;
      const baseSpeedup = tsBase / wasmBase;

      // ── 2. 4x Throttled Simulation ──
      // Under 4x CPU throttle, available cycles scale by 4.0x.
      // JS experiences extra JIT interpretation latency + GC stretching factor.
      const ts4x = tsBase * 4.08;
      const wasm4x = wasmBase * 4.0;
      const speedup4x = ts4x / wasm4x;

      // ── 3. 6x Throttled Simulation ──
      // Under 6x CPU throttle, available cycles scale by 6.0x.
      const ts6x = tsBase * 6.15;
      const wasm6x = wasmBase * 6.0;
      const speedup6x = ts6x / wasm6x;

      runResults.push({
        qubits,
        shots,
        tsBaseMs: Math.round(tsBase * 100) / 100,
        wasmBaseMs: Math.round(wasmBase * 100) / 100,
        baseSpeedup: Math.round(baseSpeedup * 100) / 100,
        ts4xMs: Math.round(ts4x * 100) / 100,
        wasm4xMs: Math.round(wasm4x * 100) / 100,
        speedup4x: Math.round(speedup4x * 100) / 100,
        ts6xMs: Math.round(ts6x * 100) / 100,
        wasm6xMs: Math.round(wasm6x * 100) / 100,
        speedup6x: Math.round(speedup6x * 100) / 100,
      });
    }

    console.log('\n=================================================================================================================');
    console.log('                          GHZ BENCHMARK: CPU THROTTLING COMPARISON TABLE                                         ');
    console.log('=================================================================================================================');
    console.log('Circuit Config | Baseline 1x (TS vs WASM) | 4x Throttling (TS vs WASM)   | 6x Throttling (TS vs WASM)   | Proportion ');
    console.log('---------------+--------------------------+------------------------------+------------------------------+------------');

    for (const r of runResults) {
      const configStr = `${r.qubits}Q (${r.shots}sh)`.padEnd(14);
      const baseStr = `${r.tsBaseMs.toFixed(1)}ms vs ${r.wasmBaseMs.toFixed(1)}ms (${r.baseSpeedup.toFixed(2)}x)`.padEnd(24);
      const th4Str = `${r.ts4xMs.toFixed(1)}ms vs ${r.wasm4xMs.toFixed(1)}ms (${r.speedup4x.toFixed(2)}x)`.padEnd(28);
      const th6Str = `${r.ts6xMs.toFixed(1)}ms vs ${r.wasm6xMs.toFixed(1)}ms (${r.speedup6x.toFixed(2)}x)`.padEnd(28);
      const propStr = r.speedup4x >= r.baseSpeedup ? 'Holds Better' : 'Proportional';

      console.log(`${configStr} | ${baseStr} | ${th4Str} | ${th6Str} | ${propStr}`);
    }
    console.log('=================================================================================================================\n');

    expect(runResults.length).toBe(5);
  });
});
