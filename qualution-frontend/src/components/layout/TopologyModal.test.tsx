import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TopologyModal } from './TopologyModal';
import { Header } from './Header';
import type { CircuitRequest } from '../../features/circuit/types';

describe('Hardware Topology & Digital Twin Window and View Dropdown', () => {
  const mockCircuit: CircuitRequest = {
    qubits: 5,
    classical_bits: 5,
    gates: [
      { id: 'g0', gate: 'h', targets: [0], column: 0 },
      { id: 'g1', gate: 'cx', targets: [0, 1], column: 1 },
      { id: 'g2', gate: 'cx', targets: [0, 2], column: 2 },
    ],
    measure: true,
    shots: 1000,
  };

  it('renders Hardware Topology & Digital Twin menu item in View dropdown and triggers callback', () => {
    const handleOpenTopology = vi.fn();
    const handleOpenMetrics = vi.fn();

    render(
      <Header
        circuitName="Bell Test"
        onChangeCircuitName={vi.fn()}
        onOpenFiles={vi.fn()}
        onOpenRunConfig={vi.fn()}
        selectedBackend="aer_simulator"
        onSelectBackend={vi.fn()}
        shots={1024}
        onChangeShots={vi.fn()}
        onRun={vi.fn()}
        executionStatus="idle"
        executionPhase="ready"
        onOpenMetrics={handleOpenMetrics}
        onOpenTopology={handleOpenTopology}
      />
    );

    // Open View dropdown menu
    const viewMenuBtn = screen.getByTestId('menu-view-btn');
    fireEvent.click(viewMenuBtn);

    // Both Circuit Metrics and Hardware Topology items should exist in the View dropdown
    const metricsItem = screen.getByTestId('view-menu-metrics');
    expect(metricsItem).toBeInTheDocument();

    const topologyItem = screen.getByTestId('view-menu-topology');
    expect(topologyItem).toBeInTheDocument();
    expect(topologyItem.textContent).toContain('Hardware Topology & Digital Twin');

    // Clicking it triggers onOpenTopology
    fireEvent.click(topologyItem);
    expect(handleOpenTopology).toHaveBeenCalledTimes(1);
  });

  it('renders Digital Twin Studio modal directly displaying DigitalTwinComparisonView without the QPU Coupling Topology tab', async () => {
    const handleClose = vi.fn();

    render(
      <TopologyModal
        isOpen={true}
        onClose={handleClose}
        circuit={mockCircuit}
      />
    );

    // Modal window should be displayed
    const modal = screen.getByTestId('hardware-topology-feature-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.textContent).toContain('Quantum Hardware Digital Twin Studio');

    // The old QPU Coupling Topology tab should NOT be present
    expect(screen.queryByTestId('tab-topology-routing')).toBeNull();

    // Directly renders digital twin comparison view
    await waitFor(() => {
      expect(screen.getByTestId('digital-twin-comparison-view')).toBeInTheDocument();
    });

    // Close button triggers onClose
    const closeBtn = screen.getByTestId('dt-modal-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders TopologyModal safely when circuit prop is omitted without throwing undefined error', () => {
    render(
      <TopologyModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    const modal = screen.getByTestId('hardware-topology-feature-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('digital-twin-comparison-view')).toBeInTheDocument();
  });
});
