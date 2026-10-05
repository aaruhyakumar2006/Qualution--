import { describe, it, expect, beforeAll } from 'vitest';
import { initWasmCore, isWasmAvailable } from './wasmManager';
import {
  computeDistributionFidelityTs,
  computeDistributionFidelityWasm,
} from './digitalTwinEngine';

describe('Phase 3 Task 5: Fidelity Calculation Performance Benchmark', () => {
  beforeAll(async () => {
    const loaded = await initWasmCore();
    expect(loaded).toBe(true);
    expect(isWasmAvailable()).toBe(true);
  });

  function generateDistributions(qubits: number) {
    const outcomes = 1 << qubits;
    const ideal: Record<string, number> = {};
    const noisy: Record<string, number> = {};

    let sumIdeal = 0.0;
    let sumNoisy = 0.0;

    for (let i = 0; i < outcomes; i++) {
      const bitstring = i.toString(2).padStart(qubits, '0');
      // Exponential decay or random probabilities
      const p1 = Math.exp(-0.01 * i);
      const p2 = Math.exp(-0.012 * i) * (0.9 + 0.2 * ((i * 31) % 17) / 17);
      ideal[bitstring] = p1;
      noisy[bitstring] = p2;
      sumIdeal += p1;
      sumNoisy += p2;
    }

    // Normalize
    for (const k in ideal) ideal[k] /= sumIdeal;
    for (const k in noisy) noisy[k] /= sumNoisy;

    return { ideal, noisy, outcomes };
  }

  it('runs realistic benchmark across 2, 5, 7, and 10 qubits (up to 2^10 outcomes)', () => {
    const scales = [2, 5, 7, 10];
    const results: Array<{
      qubits: number;
      outcomes: number;
      iterations: number;
      tsTimeMs: number;
      wasmTimeMs: number;
      tsAvgUs: number;
      wasmAvgUs: number;
      fasterEngine: 'typescript' | 'rust';
      ratio: number;
    }> = [];

    for (const qubits of scales) {
      const { ideal, noisy, outcomes } = generateDistributions(qubits);
      const iterations = outcomes >= 1024 ? 200 : 500;

      // Warm-up
      for (let i = 0; i < 20; i++) {
        computeDistributionFidelityTs(ideal, noisy);
        computeDistributionFidelityWasm(ideal, noisy);
      }

      // Benchmark TypeScript
      const t0Ts = performance.now();
      let lastTsF = 0;
      for (let i = 0; i < iterations; i++) {
        lastTsF = computeDistributionFidelityTs(ideal, noisy);
      }
      const t1Ts = performance.now();
      const tsTimeMs = t1Ts - t0Ts;

      // Benchmark Rust/WASM
      const t0Wasm = performance.now();
      let lastWasmF = 0;
      for (let i = 0; i < iterations; i++) {
        lastWasmF = computeDistributionFidelityWasm(ideal, noisy);
      }
      const t1Wasm = performance.now();
      const wasmTimeMs = t1Wasm - t0Wasm;

      // Sanity parity check
      expect(Math.abs(lastTsF - lastWasmF)).toBeLessThan(1e-10);

      const tsAvgUs = (tsTimeMs / iterations) * 1000;
      const wasmAvgUs = (wasmTimeMs / iterations) * 1000;
      const fasterEngine = wasmTimeMs < tsTimeMs ? 'rust' : 'typescript';
      const ratio =
        fasterEngine === 'typescript'
          ? wasmTimeMs / tsTimeMs
          : tsTimeMs / wasmTimeMs;

      results.push({
        qubits,
        outcomes,
        iterations,
        tsTimeMs: Number(tsTimeMs.toFixed(3)),
        wasmTimeMs: Number(wasmTimeMs.toFixed(3)),
        tsAvgUs: Number(tsAvgUs.toFixed(2)),
        wasmAvgUs: Number(wasmAvgUs.toFixed(2)),
        fasterEngine,
        ratio: Number(ratio.toFixed(2)),
      });
    }

    console.log('\n================ FIDELITY BENCHMARK REPORT ================');
    console.table(results);
    console.log('============================================================\n');

    expect(results).toHaveLength(4);
  });
});
