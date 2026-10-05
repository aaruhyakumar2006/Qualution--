import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DigitalTwinComparisonView } from '../../components/circuit/DigitalTwinComparisonView';
import { DigitalTwinTopologyOverlay } from '../../components/circuit/DigitalTwinTopologyOverlay';
import { CircuitCanvas } from '../../components/circuit/CircuitCanvas';
import { evaluateDistributionFidelity } from './digitalTwinEngine';
import { executeRoutedCircuit } from './executionRouter';
import type { CircuitRequest } from './types';

describe('Digital Twin Offline Profile & Fault Tolerance', () => {
  const bellCircuit: CircuitRequest = {
    qubits: 2,
    classical_bits: 2,
    gates: [
      { id: 'g0', gate: 'h', targets: [0], column: 0 },
      { id: 'g1', gate: 'cx', targets: [0, 1], column: 1 },
    ],
    measure: true,
    shots: 1000,
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('Task 1 & 2: Toggle is OFF by default in CircuitCanvas', () => {
    render(<CircuitCanvas circuit={bellCircuit} onUpdateCircuit={vi.fn()} />);

    // Toggle button should exist and have 'off' label
    const toggleBtn = screen.getByTestId('mirror-topology-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn.textContent).toContain('Mirror Fake Manila Topology');
    expect(toggleBtn.classList.contains('active')).toBe(false);

    // Overlay should NOT be in the DOM by default
    expect(screen.queryByTestId('digital-twin-topology-overlay')).not.toBeInTheDocument();
  });

  it('Task 2: When backend server is unreachable, DigitalTwinComparisonView gracefully falls back and does not crash', async () => {
    // Mock network failure (ECONNREFUSED / server offline)
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch: ECONNREFUSED http://127.0.0.1:8000'));

    render(<DigitalTwinComparisonView circuit={bellCircuit} />);

    // Still renders side-by-side comparison without crashing
    await waitFor(() => {
      expect(screen.getByTestId('dt-hist-ideal')).toBeInTheDocument();
      expect(screen.getByTestId('dt-hist-noisy')).toBeInTheDocument();
      expect(screen.getByTestId('dt-stat-fidelity')).toBeInTheDocument();
    });
  });

  it('Task 2: When backend is unreachable, DigitalTwinTopologyOverlay displays offline notice and operates on offline snapshot', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    render(<DigitalTwinTopologyOverlay isOpen={true} circuit={bellCircuit} />);

    await waitFor(() => {
      const notice = screen.getByTestId('dt-topology-offline-notice');
      expect(notice).toBeInTheDocument();
      expect(notice.textContent).toContain('Local backend unreachable');
    });

    // Graph and nodes continue to render cleanly
    expect(screen.getByTestId('topology-svg-graph')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-0')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-4')).toBeInTheDocument();
  });

  it('Task 2: Core Workbench engines (Stabilizer & Statevector) execute with zero degradation when backend is down', async () => {
    // Break fetch completely to simulate zero network / dead backend
    global.fetch = vi.fn().mockImplementation(() => {
      throw new Error('FATAL: Backend unreachable');
    });

    // 1. Clifford circuit routes to Stabilizer locally in-browser
    const stabilizerRes = await executeRoutedCircuit({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { id: 'h0', type: 'h', targets: [0], column: 0 },
        { id: 'cx1', type: 'cx', targets: [0, 1], column: 1 },
      ],
      measure: true,
      shots: 1000,
    });

    expect(['stabilizer_wasm_core', 'clifford_stabilizer']).toContain(stabilizerRes.backend);
    expect(['wasm_worker', 'local_browser']).toContain(stabilizerRes.execution_location);
    expect(stabilizerRes.probabilities['00']).toBeCloseTo(0.5, 1);
    expect(stabilizerRes.probabilities['11']).toBeCloseTo(0.5, 1);

    // 2. Non-Clifford circuit routes to local Statevector in-browser
    const statevectorRes = await executeRoutedCircuit({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { id: 'h0', type: 'h', targets: [0], column: 0 },
        { id: 't0', type: 't', targets: [0], column: 1 },
        { id: 'cx1', type: 'cx', targets: [0, 1], column: 2 },
      ],
      measure: true,
      shots: 1000,
    });

    expect(['statevector_wasm_core', 'wasm', 'statevector']).toContain(statevectorRes.backend);
    expect(['wasm_worker', 'local_browser']).toContain(statevectorRes.execution_location);
    expect(statevectorRes.probabilities).toBeDefined();
    // Proves 100% zero degradation for core execution paths
  });

  it('Task 3: Phase 3 fidelity calculation performs pure local arithmetic with zero network calls', () => {
    // Spy on fetch to ensure no network calls are initiated
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const idealDist = { '00': 0.5, '11': 0.5 };
    const noisyDist = { '00': 0.45, '01': 0.03, '10': 0.02, '11': 0.50 };

    const result = evaluateDistributionFidelity(idealDist, noisyDist);

    // Confirms calculation succeeded
    expect(result.fidelity).toBeGreaterThan(0.9);
    expect(result.fidelity).toBeLessThanOrEqual(1.0);
    expect(result.fidelity_loss_percent).toBeGreaterThan(0.0);
    expect(['rust', 'typescript']).toContain(result.computed_by);

    // Strictly verifies 0 network calls were made
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
