import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DigitalTwinTopologyOverlay } from './DigitalTwinTopologyOverlay';
import { CircuitCanvas } from './CircuitCanvas';
import type { CircuitRequest } from '../../features/circuit/types';

describe('Phase 4: Digital Twin Topology Overlay Component', () => {
  it('renders all 5 physical qubit nodes and physical coupling edges', () => {
    const circuit: CircuitRequest = {
      qubits: 5,
      classical_bits: 5,
      gates: [],
      measure: false,
      shots: 1000,
    };

    render(<DigitalTwinTopologyOverlay isOpen={true} circuit={circuit} />);

    // Confirm 5 physical qubits are rendered
    expect(screen.getByTestId('qubit-node-0')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-3')).toBeInTheDocument();
    expect(screen.getByTestId('qubit-node-4')).toBeInTheDocument();

    // Confirm device badge
    expect(screen.getByTestId('topology-device-badge')).toHaveTextContent('FakeManilaV2');

    // Confirm physical bus edges exist
    expect(screen.getByTestId('physical-edge-0-1')).toBeInTheDocument();
    expect(screen.getByTestId('physical-edge-1-2')).toBeInTheDocument();
    expect(screen.getByTestId('physical-edge-2-3')).toBeInTheDocument();
    expect(screen.getByTestId('physical-edge-3-4')).toBeInTheDocument();
  });

  it('renders direct link badge when circuit gates are physically adjacent', () => {
    // Adjacent Bell circuit: CX(0, 1) is directly supported by physical coupling
    const circuit: CircuitRequest = {
      qubits: 5,
      classical_bits: 5,
      gates: [
        { id: 'g0', gate: 'h', targets: [0], column: 0 },
        { id: 'g1', gate: 'cx', targets: [0, 1], column: 1 },
      ],
      measure: false,
      shots: 1000,
    };

    render(<DigitalTwinTopologyOverlay isOpen={true} circuit={circuit} />);

    expect(screen.getByText(/DIRECT LINK ✓/i)).toBeInTheDocument();
    expect(screen.getByTestId('topology-clean-callout')).toBeInTheDocument();
    expect(screen.queryByTestId('topology-violation-callout')).not.toBeInTheDocument();
  });

  it('visually flags non-adjacent 2-qubit gates (e.g. CX(0, 2)) as requiring SWAP routing', () => {
    // Non-adjacent circuit: CX between Q0 and Q2 (physical bus only connects 0-1 and 1-2)
    const nonAdjacentCircuit: CircuitRequest = {
      qubits: 5,
      classical_bits: 5,
      gates: [
        { id: 'g0', gate: 'h', targets: [0], column: 0 },
        { id: 'g1', gate: 'cx', targets: [0, 2], column: 1 }, // NON-ADJACENT!
      ],
      measure: false,
      shots: 1000,
    };

    render(<DigitalTwinTopologyOverlay isOpen={true} circuit={nonAdjacentCircuit} />);

    // 1. Arch for non-adjacent interaction
    expect(screen.getByTestId('non-adjacent-arch-0-2')).toBeInTheDocument();

    // 2. Warning marker text
    expect(screen.getByText(/SWAP Chain Required/i)).toBeInTheDocument();

    // 3. Educational callout card explaining routing penalty
    const callout = screen.getByTestId('topology-violation-callout');
    expect(callout).toBeInTheDocument();
    expect(callout).toHaveTextContent(/Hardware Routing Penalty/i);
    expect(callout).toHaveTextContent(/CX\(q\[0\], q\[2\]\)/i);
  });

  it('provides toggle in CircuitCanvas toolbar that is off by default and clearly toggles active state', () => {
    const circuit: CircuitRequest = {
      qubits: 5,
      classical_bits: 5,
      gates: [{ id: 'g1', gate: 'cx', targets: [0, 2], column: 0 }],
      measure: false,
      shots: 1000,
    };

    render(
      <CircuitCanvas
        circuit={circuit}
        onUpdateCircuit={vi.fn()}
        onSelectGate={vi.fn()}
      />
    );

    const toggleBtn = screen.getByTestId('mirror-topology-toggle-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Mirror Fake Manila Topology');

    // Overlay is OFF by default
    expect(screen.queryByTestId('digital-twin-topology-overlay')).not.toBeInTheDocument();

    // Click to toggle ON
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Mirroring Fake Manila');
    expect(screen.getByTestId('digital-twin-topology-overlay')).toBeInTheDocument();

    // Click to toggle OFF
    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveTextContent('Mirror Fake Manila Topology');
    expect(screen.queryByTestId('digital-twin-topology-overlay')).not.toBeInTheDocument();
  });
});
