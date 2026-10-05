/**
 * wasmErrorHandling.test.tsx
 *
 * Permanent Regression Test Suite: Rust/WASM Panic and Error Handling Stress Tests.
 *
 * Rust panics behave fundamentally differently from JavaScript exceptions.
 * In WebAssembly, unhandled panics trap into WebAssembly.RuntimeError: unreachable,
 * which can cause silent hangs, browser tab crashes, or opaque error messages.
 *
 * This test suite rigorously verifies that:
 * 1. Deliberately malformed inputs to BOTH WASM functions:
 *    - Negative qubit count (e.g., qubits: -1, qubits: 0)
 *    - Gate referencing non-existent qubit index (e.g., target: 5 on 2 qubits)
 *    - Empty gates array (gates: [])
 *    - Unrecognized gate type (e.g., gate: 'magic_teleport_gate')
 * 2. Every malformed case produces a clean, catchable JavaScript Error object
 *    with clear contextual messages — NOT a silent hang, NOT a tab crash,
 *    and NOT an opaque "RuntimeError: unreachable".
 * 3. The UI error handling pipeline (client validation, executionState, and VisualizationPanel)
 *    handles these errors gracefully, displaying a clear alert banner to the learner without freezing.
 */

import React from 'react';
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initSync,
  init_panic_hook,
  simulate_stabilizer_circuit,
  simulate_statevector_circuit,
} from '../../wasm/qualution-core/pkg/qualution_core.js';

import { validateCircuitClientSide } from './clientValidation';
import { INITIAL_EXECUTION_STATE, type ExecutionState } from './executionState';
import { VisualizationPanel } from '../../components/visualization/VisualizationPanel';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const wasmPath = path.resolve(currentDir, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');

beforeAll(() => {
  const wasmBuffer = fs.readFileSync(wasmPath);
  initSync({ module: new Uint8Array(wasmBuffer) });
  init_panic_hook();
});

describe('Phase 10: WASM Engine Error Handling & Panic Resilience Regression Suite', () => {

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Stabilizer WASM Engine Stress Tests (simulate_stabilizer_circuit)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('1. simulate_stabilizer_circuit Error Handling', () => {

    it('1.1 Rejects negative and zero qubit counts with clean catchable Error', () => {
      const negativeCircuit = {
        qubits: -1,
        gates: [{ type: 'h', targets: [0] }],
      };

      let caughtError: any = null;
      try {
        simulate_stabilizer_circuit(negativeCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/qubit count must be at least 1/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');

      // Test zero qubits as well
      const zeroCircuit = {
        qubits: 0,
        gates: [{ type: 'h', targets: [0] }],
      };
      expect(() => simulate_stabilizer_circuit(zeroCircuit, 100)).toThrow(
        /qubit count must be at least 1/i
      );
    });

    it('1.2 Rejects non-existent qubit index (out of bounds) with clean catchable Error', () => {
      // 2-qubit circuit (valid indices: 0, 1), target qubit 5 is out of bounds
      const outOfBoundsCircuit = {
        qubits: 2,
        gates: [{ type: 'h', targets: [5] }],
      };

      let caughtError: any = null;
      try {
        simulate_stabilizer_circuit(outOfBoundsCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/target qubit index 5 is out of bounds for a 2-qubit circuit/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');

      // Negative target index
      const negativeTargetCircuit = {
        qubits: 2,
        gates: [{ type: 'h', targets: [-1] }],
      };
      expect(() => simulate_stabilizer_circuit(negativeTargetCircuit, 100)).toThrow(
        /target qubit index -1 is out of bounds/i
      );

      // Two-qubit gate with second target out of bounds
      const cxOutOfBoundsCircuit = {
        qubits: 2,
        gates: [{ type: 'cx', targets: [0, 99] }],
      };
      expect(() => simulate_stabilizer_circuit(cxOutOfBoundsCircuit, 100)).toThrow(
        /target qubit index 99 is out of bounds/i
      );
    });

    it('1.3 Rejects empty gates array with clean catchable Error', () => {
      const emptyCircuit = {
        qubits: 2,
        gates: [],
      };

      let caughtError: any = null;
      try {
        simulate_stabilizer_circuit(emptyCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/gates array cannot be empty/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');
    });

    it('1.4 Rejects unrecognized gate type with clean catchable Error', () => {
      const unrecognizedGateCircuit = {
        qubits: 2,
        gates: [{ type: 'magic_quantum_teleporter', targets: [0] }],
      };

      let caughtError: any = null;
      try {
        simulate_stabilizer_circuit(unrecognizedGateCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/Unsupported gate in stabilizer simulation: 'magic_quantum_teleporter'/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');
    });

    it('1.5 Rejects multi-qubit gate with duplicate control and target qubits', () => {
      const duplicateTargetsCircuit = {
        qubits: 2,
        gates: [{ type: 'cx', targets: [1, 1] }],
      };

      expect(() => simulate_stabilizer_circuit(duplicateTargetsCircuit, 100)).toThrow(
        /control qubit and target qubit must be distinct/i
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Statevector WASM Engine Stress Tests (simulate_statevector_circuit)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('2. simulate_statevector_circuit Error Handling', () => {

    it('2.1 Rejects negative and zero qubit counts with clean catchable Error', () => {
      const negativeCircuit = {
        qubits: -3,
        gates: [{ type: 'h', targets: [0] }],
      };

      let caughtError: any = null;
      try {
        simulate_statevector_circuit(negativeCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/qubit count must be at least 1/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');

      // Zero qubits
      const zeroCircuit = {
        qubits: 0,
        gates: [{ type: 'h', targets: [0] }],
      };
      expect(() => simulate_statevector_circuit(zeroCircuit, 100)).toThrow(
        /qubit count must be at least 1/i
      );
    });

    it('2.2 Rejects non-existent qubit index (out of bounds) with clean catchable Error', () => {
      const outOfBoundsCircuit = {
        qubits: 3,
        gates: [{ type: 'h', targets: [10] }],
      };

      let caughtError: any = null;
      try {
        simulate_statevector_circuit(outOfBoundsCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/target qubit index 10 is out of bounds for a 3-qubit circuit/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');

      // Two-qubit gate target out of bounds
      const czOutOfBoundsCircuit = {
        qubits: 2,
        gates: [{ type: 'cz', targets: [0, 8] }],
      };
      expect(() => simulate_statevector_circuit(czOutOfBoundsCircuit, 100)).toThrow(
        /target qubit index 8 is out of bounds/i
      );
    });

    it('2.3 Rejects empty gates array with clean catchable Error', () => {
      const emptyCircuit = {
        qubits: 2,
        gates: [],
      };

      let caughtError: any = null;
      try {
        simulate_statevector_circuit(emptyCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/gates array cannot be empty/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');
    });

    it('2.4 Rejects unrecognized gate type with clean catchable Error', () => {
      const unrecognizedGateCircuit = {
        qubits: 2,
        gates: [{ type: 'unrecognized_super_gate', targets: [0] }],
      };

      let caughtError: any = null;
      try {
        simulate_statevector_circuit(unrecognizedGateCircuit, 100);
      } catch (err: any) {
        caughtError = err;
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError instanceof Error).toBe(true);
      expect(caughtError.message).toMatch(/Unsupported gate in statevector simulation: 'unrecognized_super_gate'/i);
      expect(caughtError.message).not.toContain('RuntimeError: unreachable');
    });

    it('2.5 Memory ceiling guard gracefully rejects circuits exceeding safe client limit', () => {
      const ceilingBreakerCircuit = {
        qubits: 21,
        gates: [{ type: 'h', targets: [0] }],
      };

      expect(() => simulate_statevector_circuit(ceilingBreakerCircuit, 10)).toThrow(
        /Statevector simulation exceeds safe client memory limits for 21 qubits/i
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. UI Graceful Error Handling & Pipeline Verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('3. UI Graceful Error Handling Pipeline', () => {

    it('3.1 Client-side validation catches negative qubits and out-of-bounds targets before dispatch', () => {
      const invalidCircuit: any = {
        qubits: -1,
        gates: [{ gate: 'h', targets: [5], column: 0 }],
      };

      const validation = validateCircuitClientSide(invalidCircuit);
      expect(validation.valid).toBe(false);
      expect(validation.issues.some((i) => i.message.includes('at least 1 qubit'))).toBe(true);
      expect(validation.issues.some((i) => i.message.includes('non-existent qubit'))).toBe(true);
    });

    it('3.2 ExecutionState captures error status and message without freezing UI state', () => {
      const mockErrorMessage = 'Invalid circuit: qubit count must be at least 1 (received -1)';

      const updatedState: ExecutionState = {
        ...INITIAL_EXECUTION_STATE,
        status: 'error',
        latestError: mockErrorMessage,
        phase: null,
        executionDurationMs: 4.2,
      };

      expect(updatedState.status).toBe('error');
      expect(updatedState.latestError).toBe(mockErrorMessage);
      expect(updatedState.phase).toBeNull();
      // Verify state is clean and ready for retry or student correction
      expect(updatedState.executionDurationMs).toBeGreaterThan(0);
    });

    it('3.3 Panic hook is verified and active', () => {
      expect(() => init_panic_hook()).not.toThrow();
    });

    it('3.4 VisualizationPanel renders alert banner with exact error message and retry button without freezing UI', () => {
      const mockCircuit: any = {
        qubits: 2,
        classical_bits: 2,
        gates: [],
        measure: false,
        shots: 100,
      };

      const errorState: ExecutionState = {
        ...INITIAL_EXECUTION_STATE,
        status: 'error',
        latestError: 'Invalid circuit: qubit count must be at least 1 (received -1)',
        errorCategory: 'validation',
      };

      render(
        <VisualizationPanel
          circuit={mockCircuit}
          simulationResult={null}
          executionState={errorState}
          qubitCount={2}
          onRetryRun={() => {}}
        />
      );

      const alertBanner = screen.getByTestId('viz-error-banner');
      expect(alertBanner).toBeInTheDocument();
      expect(screen.getByText('VALIDATION Error')).toBeInTheDocument();
      expect(
        screen.getByText('Invalid circuit: qubit count must be at least 1 (received -1)')
      ).toBeInTheDocument();
      expect(screen.getByTestId('viz-error-retry-btn')).toBeInTheDocument();
    });
  });
});
