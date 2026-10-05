import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DigitalTwinComparisonView } from './DigitalTwinComparisonView';
import type { CircuitRequest } from '../../features/circuit/types';
import type { DigitalTwinBackendResponse } from '../../features/circuit/digitalTwinTypes';

describe('Digital Twin Comparison Display (Phase 4 Tasks 1-4)', () => {
  const mockCircuit: CircuitRequest = {
    qubits: 2,
    classical_bits: 2,
    gates: [
      { gate: 'h', targets: [0], column: 0 },
      { gate: 'cx', targets: [0, 1], column: 1 },
    ],
    measure: true,
    shots: 1000,
  };

  const mockPayload: DigitalTwinBackendResponse = {
    backend_name: 'fake_manila',
    backend_display_name: 'FakeManilaV2 (Falcon r5.4)',
    qubit_count: 5,
    circuit_qubits: 2,
    shots: 1000,
    ideal_probabilities: { '00': 0.51, '11': 0.49 },
    noisy_probabilities: { '00': 0.45, '01': 0.03, '10': 0.02, '11': 0.50 },
    ideal_counts: { '00': 510, '11': 490 },
    noisy_counts: { '00': 450, '01': 30, '10': 20, '11': 500 },
    coupling_map: [[0, 1], [1, 0]],
    qubit_properties: [
      { qubit: 0, t1_us: 131.5, t2_us: 102.2, frequency_ghz: 4.962 },
      { qubit: 1, t1_us: 124.5, t2_us: 79.0, frequency_ghz: 4.838 },
    ],
    gate_errors: [
      { gate: 'cx', qubits: [0, 1], error: 0.0088277, duration_ns: 277.33 },
    ],
    runtime_ms: 32.1,
    execution_location: 'local_python',
  };

  it('Task 1: Renders two histograms side by side for Ideal and Noisy distributions', () => {
    render(<DigitalTwinComparisonView circuit={mockCircuit} initialData={mockPayload} />);

    // Both histogram cards must exist
    expect(screen.getByTestId('dt-hist-ideal')).toBeInTheDocument();
    expect(screen.getByTestId('dt-hist-noisy')).toBeInTheDocument();

    // Verify titles
    expect(screen.getByText('Ideal (Noiseless)')).toBeInTheDocument();
    expect(screen.getByText('On Real Hardware (Noisy)')).toBeInTheDocument();

    // Verify basis states in both distributions
    expect(screen.getAllByText('00').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('11').length).toBeGreaterThanOrEqual(2);
  });

  it('Task 2: Displays real fidelity score, fidelity-loss percentage, and honest computed_by tag', () => {
    render(<DigitalTwinComparisonView circuit={mockCircuit} initialData={mockPayload} />);

    // Check fidelity score display
    const fidelityBox = screen.getByTestId('dt-stat-fidelity');
    expect(fidelityBox).toBeInTheDocument();
    expect(fidelityBox.textContent).toMatch(/Classical State Fidelity/i);

    // Check loss display
    const lossBox = screen.getByTestId('dt-stat-loss');
    expect(lossBox).toBeInTheDocument();
    expect(lossBox.textContent).toMatch(/Fidelity Loss to Hardware Noise/i);

    // Check honest dev-facing engine provenance tag
    const badge = screen.getByTestId('fidelity-computed-by-badge');
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toMatch(/Fidelity computed via (Rust\/WASM|TypeScript fallback)/);
  });

  it('Task 3: Surfaces real IBM calibration numbers (T1/T2, gate errors) with named snapshot', () => {
    render(<DigitalTwinComparisonView circuit={mockCircuit} initialData={mockPayload} />);

    // Snapshot container with device name
    const panel = screen.getByTestId('dt-calibration-panel');
    expect(panel).toBeInTheDocument();
    expect(panel.textContent).toContain('FakeManilaV2 (Falcon r5.4)');

    // Qubit table with real T1/T2 values
    const qubitTable = screen.getByTestId('dt-qubit-props-table');
    expect(qubitTable.textContent).toContain('131.5 µs');
    expect(qubitTable.textContent).toContain('102.2 µs');

    // Gate error table with real error rate
    const gateTable = screen.getByTestId('dt-gate-errors-table');
    expect(gateTable.textContent).toContain('CX(Q0, Q1)');
    expect(gateTable.textContent).toContain('0.88%');
  });

  it('Task 4: AI Tutor generates one sentence citing real hardware metadata', () => {
    render(<DigitalTwinComparisonView circuit={mockCircuit} initialData={mockPayload} />);

    const sentence = screen.getByTestId('dt-tutor-sentence');
    expect(sentence).toBeInTheDocument();
    expect(sentence.textContent).toMatch(/On FakeManilaV2 \(Falcon r5\.4\), this circuit's fidelity drops to/);
    expect(sentence.textContent).toMatch(/largely from the two-qubit gate at qubits 0 and 1/);
    expect(sentence.textContent).toMatch(/measured error rate of 0\.88%/);
  });

  it('Closes when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DigitalTwinComparisonView
        circuit={mockCircuit}
        initialData={mockPayload}
        onClose={handleClose}
      />
    );

    const closeBtn = screen.getByTestId('dt-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
