import { describe, it, expect, beforeAll } from 'vitest';
import {
  initWasmCore,
  isWasmAvailable,
  setForceWasmFailure,
  resetWasmFailureOverride,
} from './wasmManager';
import {
  computeDistributionFidelityTs,
  computeDistributionFidelityWasm,
  evaluateDistributionFidelity,
} from './digitalTwinEngine';

describe('Phase 3 Task 3: Dual-Engine Parity Harness (Rust WASM vs TypeScript)', () => {
  beforeAll(async () => {
    const loaded = await initWasmCore();
    expect(loaded).toBe(true);
    expect(isWasmAvailable()).toBe(true);
  });

  // 12 Varied Parity Test Cases
  const parityTestCases: Array<{
    name: string;
    ideal: Record<string, number>;
    noisy: Record<string, number>;
    expected?: number;
  }> = [
    {
      name: 'Case 1: Phase 1 real backend output on Grover 12-gate circuit (FakeManilaV2)',
      ideal: { '11': 1.0 },
      noisy: { '00': 0.007, '01': 0.026, '10': 0.034, '11': 0.933 },
      expected: 0.933,
    },
    {
      name: 'Case 2: Pure deterministic 1-state exact identity',
      ideal: { '0': 1.0 },
      noisy: { '0': 1.0 },
      expected: 1.0,
    },
    {
      name: 'Case 3: Pure orthogonal / disjoint-support distributions',
      ideal: { '00': 1.0 },
      noisy: { '11': 1.0 },
      expected: 0.0,
    },
    {
      name: 'Case 4: Bell state uniform superposition (|00> + |11>)/sqrt(2) vs decoherence leakage',
      ideal: { '00': 0.5, '11': 0.5 },
      noisy: { '00': 0.46, '11': 0.47, '01': 0.04, '10': 0.03 },
    },
    {
      name: 'Case 5: GHZ 3-qubit state (|000> + |111>)/sqrt(2) vs bit-flip noise',
      ideal: { '000': 0.5, '111': 0.5 },
      noisy: { '000': 0.42, '111': 0.43, '001': 0.05, '110': 0.06, '010': 0.04 },
    },
    {
      name: 'Case 6: Hand-computed Case A (2-state partial overlap)',
      ideal: { '0': 0.5, '1': 0.5 },
      noisy: { '0': 0.8, '1': 0.2 },
      expected: 0.9,
    },
    {
      name: 'Case 7: Hand-computed Case B (3-state partial overlap)',
      ideal: { '00': 0.36, '01': 0.64 },
      noisy: { '00': 0.49, '01': 0.25, '10': 0.26 },
      expected: 0.6724,
    },
    {
      name: 'Case 8: 4-qubit W-state with realistic multi-qubit error distribution',
      ideal: { '0001': 0.25, '0010': 0.25, '0100': 0.25, '1000': 0.25 },
      noisy: {
        '0001': 0.21,
        '0010': 0.22,
        '0100': 0.20,
        '1000': 0.23,
        '0000': 0.08,
        '1111': 0.06,
      },
    },
    {
      name: 'Case 9: 5-qubit random distribution across 16 states (FakeManila scale)',
      ideal: {
        '00000': 0.125,
        '00011': 0.125,
        '01100': 0.125,
        '01111': 0.125,
        '10000': 0.125,
        '10011': 0.125,
        '11100': 0.125,
        '11111': 0.125,
      },
      noisy: {
        '00000': 0.10,
        '00011': 0.11,
        '01100': 0.12,
        '01111': 0.09,
        '10000': 0.10,
        '10011': 0.11,
        '11100': 0.13,
        '11111': 0.10,
        '00001': 0.04,
        '11110': 0.05,
        '01010': 0.05,
      },
    },
    {
      name: 'Case 10: Completely disjoint multi-qubit states',
      ideal: { '00000': 0.5, '11111': 0.5 },
      noisy: { '01010': 0.4, '10101': 0.6 },
      expected: 0.0,
    },
    {
      name: 'Case 11: Extreme asymmetry: ideal has 1 target state, noisy has 16 states with small leakage',
      ideal: { '0000': 1.0 },
      noisy: Object.fromEntries([
        ['0000', 0.85],
        ...Array.from({ length: 15 }, (_, i) => [
          (i + 1).toString(2).padStart(4, '0'),
          0.01,
        ]),
      ]),
    },
    {
      name: 'Case 12: Empty distributions edge case',
      ideal: {},
      noisy: {},
      expected: 0.0,
    },
  ];

  it.each(parityTestCases)(
    'confirms bit-exact or floating-point parity on $name',
    ({ ideal, noisy, expected }) => {
      const tsFidelity = computeDistributionFidelityTs(ideal, noisy);
      const wasmFidelity = computeDistributionFidelityWasm(ideal, noisy);

      // Verify floating point agreement within 1e-12
      expect(Math.abs(tsFidelity - wasmFidelity)).toBeLessThan(1e-12);

      if (expected !== undefined) {
        expect(tsFidelity).toBeCloseTo(expected, 8);
        expect(wasmFidelity).toBeCloseTo(expected, 8);
      }
    }
  );

  it('verifies fallback mechanism: routes to Rust when WASM available, falls back to TypeScript with console warning when disabled', () => {
    // 1. When WASM is available:
    resetWasmFailureOverride();
    const rustRes = evaluateDistributionFidelity({ '11': 1.0 }, { '11': 0.933 });
    expect(rustRes.computed_by).toBe('rust');
    expect(rustRes.fidelity).toBeCloseTo(0.933, 6);
    expect(rustRes.fidelity_loss_percent).toBeCloseTo(6.7, 1);

    // 2. When WASM failure is forced:
    setForceWasmFailure(true);
    const tsRes = evaluateDistributionFidelity({ '11': 1.0 }, { '11': 0.933 });
    expect(tsRes.computed_by).toBe('typescript');
    expect(tsRes.fidelity).toBeCloseTo(0.933, 6);
    expect(tsRes.fidelity_loss_percent).toBeCloseTo(6.7, 1);

    // Parity check across the fallback transition
    expect(Math.abs(rustRes.fidelity - tsRes.fidelity)).toBeLessThan(1e-12);
    expect(rustRes.fidelity_loss_percent).toBe(tsRes.fidelity_loss_percent);

    // Reset override
    resetWasmFailureOverride();
  });
});
