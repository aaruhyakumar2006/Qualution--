/**
 * wasmFallback.test.ts
 *
 * Automated verification of the Execution Router's WASM execution and automatic TypeScript fallback.
 *
 * Verifies:
 * 1. Normal Path: When WASM is available, Execution Router calls Rust/WASM engines.
 * 2. Forced Failure Path: When WASM fails to load or instantiate (mocked failure),
 *    Execution Router automatically falls back to the TypeScript engines.
 * 3. Dev-Console Warning: Logs a clear, non-user-facing dev-console-only warning.
 * 4. Parity: The learner experience is IDENTICAL on both paths (Grover fixture P(11) = 1.00).
 * 5. Preservation: TypeScript engines remain fully operational and tested as permanent fallbacks.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initWasmCore,
  initWasmSync,
  isWasmAvailable,
  setForceWasmFailure,
  resetWasmFailureOverride,
  setQuantumEnginePreference,
  getQuantumEnginePreference,
  getWasmStatus,
} from './wasmManager';
import { executeRoutedCircuit } from './executionRouter';
import type { CanonicalCircuit, UnifiedExecutionResult } from './types';

describe('Execution Router: WASM Execution & Automatic TypeScript Fallback', () => {
  // ── Canonical Grover 2-Qubit Fixture (Optimal Target: |11>) ─────────────────
  const groverCircuit: CanonicalCircuit = {
    qubits: 2,
    gates: [
      { id: 'g0', type: 'h', targets: [0], column: 0 },
      { id: 'g1', type: 'h', targets: [1], column: 0 },
      { id: 'g2', type: 'cz', targets: [0, 1], column: 1 }, // Oracle marking |11>
      { id: 'g3', type: 'h', targets: [0], column: 2 },      // Diffusion
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

  // ── Non-Clifford 2-Qubit Fixture with T-Gate ────────────────────────────────
  const nonCliffordCircuit: CanonicalCircuit = {
    qubits: 2,
    gates: [
      { id: 'g0', type: 'h', targets: [0], column: 0 },
      { id: 'g1', type: 't', targets: [0], column: 1 },       // Non-Clifford T-gate
      { id: 'g2', type: 'cx', targets: [0, 1], column: 2 },
    ],
    measurements: [
      { qubit: 0, classical_bit: 0 },
      { qubit: 1, classical_bit: 1 },
    ],
    shots: 1000,
  };

  beforeAll(async () => {
    // Initialize WebAssembly module for testing
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initWasmSync(wasmBytes);
    setQuantumEnginePreference('wasm');
  });

  afterAll(() => {
    setQuantumEnginePreference(null);
  });

  afterEach(() => {
    resetWasmFailureOverride();
    vi.restoreAllMocks();
  });

  // ── TEST 1: HUMAN CHECKPOINT - Normal WASM Execution Path ───────────────────
  it('1. HUMAN CHECKPOINT: Normal WASM path executes through Rust/WASM engine and produces correct Grover result', async () => {
    expect(isWasmAvailable()).toBe(true);

    const result = await executeRoutedCircuit(groverCircuit, { shots: 1024 });

    console.log('\n[HUMAN CHECKPOINT - PATH A: NORMAL WASM EXECUTION]');
    console.log('Status:', result.status);
    console.log('Backend:', result.backend);
    console.log('Execution Location:', result.execution_location);
    console.log('Execution Method:', result.execution_method);
    console.log('Counts:', result.counts);
    console.log('Probabilities:', result.probabilities);
    console.log('Runtime (ms):', result.runtime_ms);

    // Core assertions
    expect(result.status).toBe('success');
    expect(result.backend).toBe('stabilizer_wasm_core');
    expect(result.execution_method).toBe('stabilizer');
    expect(result.execution_location).toBe('wasm_worker');

    // Grover search target: |11> must have 100% probability
    expect(result.probabilities['11']).toBeCloseTo(1.0, 5);
    expect(result.counts['11']).toBe(1024);
    expect(result.probabilities['00'] ?? 0).toBe(0);
    expect(result.probabilities['01'] ?? 0).toBe(0);
    expect(result.probabilities['10'] ?? 0).toBe(0);
  });

  // ── TEST 2: HUMAN CHECKPOINT - Forced WASM Failure Fallback Path ────────────
  it('2. HUMAN CHECKPOINT: Forced WASM-load-failure path falls back to TypeScript engine and produces IDENTICAL Grover result', async () => {
    // Spy on dev console warning
    const warnSpy = vi.spyOn(console, 'warn');

    // FORCE WASM FAILURE (mock an older browser or device where WASM failed to instantiate)
    setForceWasmFailure(true);
    expect(isWasmAvailable()).toBe(false);
    expect(getWasmStatus()).toBe('forced_fallback');

    // Execute through the exact same Execution Router call
    const result = await executeRoutedCircuit(groverCircuit, { shots: 1024 });

    console.log('\n[HUMAN CHECKPOINT - PATH B: FORCED-FAILURE TYPESCRIPT FALLBACK]');
    console.log('Status:', result.status);
    console.log('Backend:', result.backend);
    console.log('Execution Location:', result.execution_location);
    console.log('Execution Method:', result.execution_method);
    console.log('Counts:', result.counts);
    console.log('Probabilities:', result.probabilities);
    console.log('Runtime (ms):', result.runtime_ms);

    // 1. Verify clear non-user-facing dev-console-only warning was logged
    expect(warnSpy).toHaveBeenCalled();
    const fallbackWarningFound = warnSpy.mock.calls.some((args) =>
      args.some((arg) => typeof arg === 'string' && (arg.includes('fallback') || arg.includes('TypeScript') || arg.includes('unavailable')))
    );
    expect(fallbackWarningFound).toBe(true);

    // 2. Verify TypeScript engine was invoked as permanent fallback
    expect(result.status).toBe('success');
    expect(result.backend).toBe('stabilizer_engine');
    expect(result.execution_method).toBe('stabilizer');
    expect(result.execution_location).toBe('local_browser');

    // 3. Learner experience is IDENTICAL: Grover target |11> must have 100% probability
    expect(result.probabilities['11']).toBeCloseTo(1.0, 5);
    expect(result.counts['11']).toBe(1024);
    expect(result.probabilities['00'] ?? 0).toBe(0);
    expect(result.probabilities['01'] ?? 0).toBe(0);
    expect(result.probabilities['10'] ?? 0).toBe(0);
  });

  // ── TEST 3: Statevector Fallback on Forced WASM Failure ──────────────────────
  it('3. Statevector path: Non-Clifford circuit falls back to TypeScript statevector engine when WASM fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn');

    // Force failure
    setForceWasmFailure(true);
    expect(isWasmAvailable()).toBe(false);

    const result = await executeRoutedCircuit(nonCliffordCircuit, { shots: 1000 });

    expect(warnSpy).toHaveBeenCalled();
    expect(result.status).toBe('success');
    expect(result.backend).toBe('statevector_engine');
    expect(result.execution_method).toBe('statevector');
    expect(result.execution_location).toBe('local_browser');

    // Output is non-empty and sums to 1.00
    const totalCount = Object.values(result.counts).reduce((a, b) => a + b, 0);
    expect(totalCount).toBe(1000);
    const totalProb = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
    expect(totalProb).toBeCloseTo(1.0, 3);
  });

  // ── TEST 4: Direct Comparison: Normal WASM vs Fallback Parity ───────────────
  it('4. Direct side-by-side comparison: WASM path vs Fallback path produce IDENTICAL output structures', async () => {
    // Path A: WASM
    resetWasmFailureOverride();
    const wasmResult = await executeRoutedCircuit(groverCircuit, { shots: 1024 });

    // Path B: Fallback
    setForceWasmFailure(true);
    const fallbackResult = await executeRoutedCircuit(groverCircuit, { shots: 1024 });

    console.log('\n[SIDE-BY-SIDE PARITY COMPARISON: GROVER FIXTURE]');
    console.log('Metric               | WASM Engine             | TypeScript Fallback Engine');
    console.log('---------------------+-------------------------+---------------------------');
    console.log(`Backend              | ${wasmResult.backend.padEnd(23)} | ${fallbackResult.backend}`);
    console.log(`P(11) Probability    | ${wasmResult.probabilities['11'].toFixed(6).padEnd(23)} | ${fallbackResult.probabilities['11'].toFixed(6)}`);
    console.log(`Target Shot Count    | ${wasmResult.counts['11'].toString().padEnd(23)} | ${fallbackResult.counts['11']}`);
    console.log(`Status               | ${wasmResult.status?.padEnd(23)} | ${fallbackResult.status}`);
    console.log(`Execution Method     | ${wasmResult.execution_method.padEnd(23)} | ${fallbackResult.execution_method}`);

    // Exact parity comparisons
    expect(wasmResult.probabilities['11']).toBe(fallbackResult.probabilities['11']);
    expect(wasmResult.counts['11']).toBe(fallbackResult.counts['11']);
    expect(wasmResult.shots).toBe(fallbackResult.shots);
    expect(wasmResult.status).toBe(fallbackResult.status);
    expect(wasmResult.execution_method).toBe(fallbackResult.execution_method);
  });

  // ── TEST 5: Default Preference Verification ────────────────────────────────
  it('5. Default engine preference resolves to "wasm" without manual overrides', () => {
    // Clear runtime override
    setQuantumEnginePreference(null);
    expect(getQuantumEnginePreference()).toBe('wasm');
    // Restore for subsequent test hygiene
    setQuantumEnginePreference('wasm');
  });
});

