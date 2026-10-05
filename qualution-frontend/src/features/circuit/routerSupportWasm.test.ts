/**
 * routerSupportWasm.test.ts
 *
 * Parity and validation test suite for supporting router & resource guard functions:
 * 1. is_clifford_compatible (WASM) vs isCliffordCompatible (TS)
 * 2. estimate_statevector_memory (WASM) vs estimateStatevectorMemory (TS)
 * 3. get_safe_statevector_qubit_threshold (WASM) vs getSafeStatevectorQubitThreshold (TS)
 *
 * Exact match required across all circuits, memory calculations, and threshold evaluations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WASM exports
import {
  initSync,
  is_clifford_compatible,
  estimate_statevector_memory,
  get_safe_statevector_qubit_threshold,
  get_default_safe_statevector_qubit_ceiling,
} from '../../wasm/qualution-core/pkg/qualution_core.js';

// TypeScript equivalents
import {
  isCliffordCompatible,
  CLIFFORD_GATES,
} from './executionRouter';
import {
  estimateStatevectorMemory,
  getSafeStatevectorQubitThreshold,
  DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING,
} from './circuitAnalyzer';
import type { CanonicalCircuit, CircuitRequest } from './types';

describe('Supporting Router & Resource Guard Functions Parity (TS vs WASM)', () => {
  beforeAll(() => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const wasmPath = path.resolve(__dirname, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');
    const wasmBytes = new Uint8Array(fs.readFileSync(wasmPath));
    initSync({ module: wasmBytes });
  });

  // ── 1. Clifford Group Compatibility Tests ─────────────────────────────────

  describe('is_clifford_compatible parity', () => {
    it('evaluates an empty circuit as Clifford-compatible (returns true in both)', () => {
      const emptyCircuitRequest: CircuitRequest = {
        qubits: 2,
        classical_bits: 2,
        gates: [],
        measure: false,
        shots: 1024,
      };

      const emptyCanonicalCircuit: CanonicalCircuit = {
        qubits: 3,
        gates: [],
        measurements: [],
      };

      // Empty gate array
      expect(isCliffordCompatible(emptyCircuitRequest)).toBe(true);
      expect(is_clifford_compatible(emptyCircuitRequest)).toBe(true);

      expect(isCliffordCompatible(emptyCanonicalCircuit)).toBe(true);
      expect(is_clifford_compatible(emptyCanonicalCircuit)).toBe(true);

      // Bare { gates: [] }
      expect(isCliffordCompatible({ gates: [] })).toBe(true);
      expect(is_clifford_compatible({ gates: [] })).toBe(true);

      // null and undefined
      expect(isCliffordCompatible(null)).toBe(true);
      expect(is_clifford_compatible(null)).toBe(true);

      expect(isCliffordCompatible(undefined)).toBe(true);
      expect(is_clifford_compatible(undefined)).toBe(true);
    });

    it('evaluates a pure-Clifford circuit as Clifford-compatible (returns true in both)', () => {
      // 1. Pure-Clifford Grover fixture
      const groverPureCliffordCircuit: CircuitRequest = {
        qubits: 2,
        classical_bits: 2,
        gates: [
          { gate: 'h', targets: [0], column: 0 },
          { gate: 'h', targets: [1], column: 0 },
          { gate: 'cz', targets: [0, 1], column: 1 },
          { gate: 'h', targets: [0], column: 2 },
          { gate: 'h', targets: [1], column: 2 },
          { gate: 'x', targets: [0], column: 3 },
          { gate: 'x', targets: [1], column: 3 },
          { gate: 'cz', targets: [0, 1], column: 4 },
          { gate: 'x', targets: [0], column: 5 },
          { gate: 'x', targets: [1], column: 5 },
          { gate: 'h', targets: [0], column: 6 },
          { gate: 'h', targets: [1], column: 6 },
          { gate: 'measure', targets: [0], column: 7 },
          { gate: 'measure', targets: [1], column: 7 },
        ],
        measure: true,
        shots: 1024,
      };

      expect(isCliffordCompatible(groverPureCliffordCircuit)).toBe(true);
      expect(is_clifford_compatible(groverPureCliffordCircuit)).toBe(true);

      // 2. Bell state fixture
      const bellCircuit: CanonicalCircuit = {
        qubits: 2,
        gates: [
          { id: 'g0', type: 'h', targets: [0], column: 0 },
          { id: 'g1', type: 'cx', targets: [0, 1], column: 1 },
        ],
        measurements: [{ qubit: 0, classical_bit: 0 }, { qubit: 1, classical_bit: 1 }],
      };

      expect(isCliffordCompatible(bellCircuit)).toBe(true);
      expect(is_clifford_compatible(bellCircuit)).toBe(true);

      // 3. All Clifford primitives
      const allPrimitivesCircuit: CanonicalCircuit = {
        qubits: 4,
        gates: [
          { id: 'g0', type: 'h', targets: [0], column: 0 },
          { id: 'g1', type: 'x', targets: [1], column: 0 },
          { id: 'g2', type: 'y', targets: [2], column: 0 },
          { id: 'g3', type: 'z', targets: [3], column: 0 },
          { id: 'g4', type: 's', targets: [0], column: 1 },
          { id: 'g5', type: 'sdg', targets: [1], column: 1 },
          { id: 'g6', type: 's_dagger', targets: [2], column: 1 },
          { id: 'g7', type: 'cx', targets: [0, 1], column: 2 },
          { id: 'g8', type: 'cnot', targets: [2, 3], column: 2 },
          { id: 'g9', type: 'cz', targets: [1, 2], column: 3 },
          { id: 'g10', type: 'swap', targets: [0, 3], column: 4 },
          { id: 'g11', type: 'id', targets: [0], column: 5 },
          { id: 'g12', type: 'barrier', targets: [0], column: 6 },
          { id: 'g13', type: 'reset', targets: [1], column: 7 },
        ],
      };

      expect(isCliffordCompatible(allPrimitivesCircuit)).toBe(true);
      expect(is_clifford_compatible(allPrimitivesCircuit)).toBe(true);
    });

    it('evaluates a circuit with one T gate as non-Clifford (returns false in both)', () => {
      const circuitWithTGate: CircuitRequest = {
        qubits: 2,
        classical_bits: 2,
        gates: [
          { gate: 'h', targets: [0], column: 0 },
          { gate: 'cx', targets: [0, 1], column: 1 },
          { gate: 't', targets: [0], column: 2 }, // Non-Clifford T gate!
        ],
        measure: false,
        shots: 1024,
      };

      expect(isCliffordCompatible(circuitWithTGate)).toBe(false);
      expect(is_clifford_compatible(circuitWithTGate)).toBe(false);

      // CanonicalCircuit format with T gate
      const canonicalWithT: CanonicalCircuit = {
        qubits: 1,
        gates: [
          { id: 'g0', type: 'h', targets: [0], column: 0 },
          { id: 'g1', type: 't', targets: [0], column: 1 },
          { id: 'g2', type: 'h', targets: [0], column: 2 },
        ],
      };

      expect(isCliffordCompatible(canonicalWithT)).toBe(false);
      expect(is_clifford_compatible(canonicalWithT)).toBe(false);
    });

    it('evaluates non-Clifford rotation and multi-qubit gates as non-Clifford (returns false in both)', () => {
      const rxCircuit = { gates: [{ type: 'rx', targets: [0], angle: Math.PI / 4 }] };
      const ryCircuit = { gates: [{ type: 'ry', targets: [0], angle: 0.5 }] };
      const rzCircuit = { gates: [{ type: 'rz', targets: [0], angle: 1.23 }] };
      const tdgCircuit = { gates: [{ type: 'tdg', targets: [0] }] };
      const toffoliCircuit = { gates: [{ type: 'ccx', targets: [0, 1, 2] }] };

      expect(isCliffordCompatible(rxCircuit)).toBe(false);
      expect(is_clifford_compatible(rxCircuit)).toBe(false);

      expect(isCliffordCompatible(ryCircuit)).toBe(false);
      expect(is_clifford_compatible(ryCircuit)).toBe(false);

      expect(isCliffordCompatible(rzCircuit)).toBe(false);
      expect(is_clifford_compatible(rzCircuit)).toBe(false);

      expect(isCliffordCompatible(tdgCircuit)).toBe(false);
      expect(is_clifford_compatible(tdgCircuit)).toBe(false);

      expect(isCliffordCompatible(toffoliCircuit)).toBe(false);
      expect(is_clifford_compatible(toffoliCircuit)).toBe(false);
    });
  });

  // ── 2. Memory Estimation Formula Parity ────────────────────────────────────

  describe('estimate_statevector_memory formula parity (2^n * 16 bytes)', () => {
    it('produces IDENTICAL numbers to the TypeScript version for required qubit counts (5, 10, 20, 22, 25)', () => {
      const testQubitCounts = [5, 10, 20, 22, 25];

      // Exact mathematical expectation: 2^n * 16
      const expectedValues: Record<number, number> = {
        5: 512, // 32 * 16
        10: 16384, // 1,024 * 16
        20: 16777216, // 1,048,576 * 16 (~16.78 MB)
        22: 67108864, // 4,194,304 * 16 (~67.11 MB)
        25: 536870912, // 33,554,432 * 16 (~536.87 MB)
      };

      console.log('\n[MEMORY ESTIMATE PARITY TABLE]');
      console.log('Qubits | TypeScript (bytes) | WASM (bytes) | Exact Formula (2^n * 16) | Match?');
      console.log('-------+--------------------+--------------+--------------------------+-------');

      for (const n of testQubitCounts) {
        const tsVal = estimateStatevectorMemory(n);
        const wasmVal = estimate_statevector_memory(n);
        const expected = expectedValues[n];

        console.log(
          `${n.toString().padStart(6)} | ` +
          `${tsVal.toLocaleString().padStart(18)} | ` +
          `${wasmVal.toLocaleString().padStart(12)} | ` +
          `${expected.toLocaleString().padStart(24)} | ` +
          `${tsVal === wasmVal && wasmVal === expected ? 'YES (EXACT)' : 'MISMATCH'}`
        );

        // Strict bit-level float64 equality
        expect(wasmVal).toBe(tsVal);
        expect(wasmVal).toBe(expected);
      }
    });

    it('handles boundary and edge cases identically (0, negative, small, and extreme counts)', () => {
      const boundaryCases = [-10, -1, 0, 1, 2, 3, 4, 30, 50, 1021, 1025];

      for (const n of boundaryCases) {
        const tsVal = estimateStatevectorMemory(n);
        const wasmVal = estimate_statevector_memory(n);

        expect(wasmVal).toBe(tsVal);
      }

      // Edge case verification
      expect(estimate_statevector_memory(0)).toBe(0);
      expect(estimate_statevector_memory(-5)).toBe(0);
      expect(estimate_statevector_memory(1)).toBe(32);
      expect(estimate_statevector_memory(2)).toBe(64);
      expect(estimate_statevector_memory(30)).toBe(17179869184); // ~17.18 GB
      expect(estimate_statevector_memory(1025)).toBe(Number.MAX_VALUE);
    });
  });

  // ── 3. 20-Qubit Threshold Logic Parity ─────────────────────────────────────

  describe('get_safe_statevector_qubit_threshold parity', () => {
    it('matches the 20-qubit default threshold when device memory is unspecified', () => {
      const defaultTs = getSafeStatevectorQubitThreshold(undefined);
      const defaultWasm = get_safe_statevector_qubit_threshold(undefined);
      const ceilingWasm = get_default_safe_statevector_qubit_ceiling();

      console.log('\n[DEFAULT SAFE THRESHOLD VERIFICATION]');
      console.log('DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING (TS):', DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING);
      console.log('getSafeStatevectorQubitThreshold(undefined) (TS):', defaultTs);
      console.log('get_safe_statevector_qubit_threshold(undefined) (WASM):', defaultWasm);
      console.log('get_default_safe_statevector_qubit_ceiling() (WASM):', ceilingWasm);

      expect(defaultWasm).toBe(20);
      expect(defaultTs).toBe(20);
      expect(defaultWasm).toBe(defaultTs);
      expect(ceilingWasm).toBe(20);
      expect(DEFAULT_SAFE_STATEVECTOR_QUBIT_CEILING).toBe(20);
    });

    it('matches threshold logic identically across all hardware memory tiers', () => {
      const memoryTiers: Array<{ gb: number | undefined; label: string; expected: number }> = [
        { gb: undefined, label: 'Unspecified / Budget default', expected: 20 },
        { gb: 1, label: '1 GB RAM (Budget)', expected: 20 },
        { gb: 2, label: '2 GB RAM (Budget)', expected: 20 },
        { gb: 3.9, label: '3.9 GB RAM (< 4GB boundary)', expected: 20 },
        { gb: 4, label: '4 GB RAM (Mid-range tier)', expected: 22 },
        { gb: 6, label: '6 GB RAM (Mid-range tier)', expected: 22 },
        { gb: 7.9, label: '7.9 GB RAM (< 8GB boundary)', expected: 22 },
        { gb: 8, label: '8 GB RAM (High-memory tier)', expected: 24 },
        { gb: 16, label: '16 GB RAM (Workstation)', expected: 24 },
        { gb: 32, label: '32 GB RAM (Workstation)', expected: 24 },
      ];

      console.log('\n[HARDWARE MEMORY TIER PARITY TABLE]');
      console.log('Device RAM | TS Threshold | WASM Threshold | Expected | Match?');
      console.log('-----------+--------------+----------------+----------+-------');

      for (const tier of memoryTiers) {
        const tsThreshold = getSafeStatevectorQubitThreshold(tier.gb);
        const wasmThreshold = get_safe_statevector_qubit_threshold(tier.gb);

        console.log(
          `${(tier.gb !== undefined ? `${tier.gb} GB` : 'undefined').padEnd(10)} | ` +
          `${tsThreshold.toString().padStart(12)} | ` +
          `${wasmThreshold.toString().padStart(14)} | ` +
          `${tier.expected.toString().padStart(8)} | ` +
          `${tsThreshold === wasmThreshold && wasmThreshold === tier.expected ? 'YES (EXACT)' : 'MISMATCH'}`
        );

        expect(wasmThreshold).toBe(tsThreshold);
        expect(wasmThreshold).toBe(tier.expected);
      }
    });
  });
});
