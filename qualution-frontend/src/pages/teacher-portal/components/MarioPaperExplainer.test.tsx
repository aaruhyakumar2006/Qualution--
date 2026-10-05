import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MarioPaperExplainerModal from './MarioPaperExplainerModal';
import * as portalApi from '../api/portalApi';
import { MARIO_EXPLAINER_STRINGS } from '../constants/portalConstants';

const mockSignalItem = {
  id: 'paper-surface-code-123',
  title: 'Fault-Tolerant Surface Codes on Heavy-Hex Architectures',
  summary: 'We demonstrate distance-3 surface code stabilizer syndrome measurements below the fault-tolerance threshold.',
  abstract: 'We demonstrate distance-3 surface code stabilizer syndrome measurements below the fault-tolerance threshold.',
  tags: ['QEC', 'Surface Code']
};

const mockExplainResponse: portalApi.ExplainPaperResponse = {
  item_id: 'paper-surface-code-123',
  paper_title: 'Fault-Tolerant Surface Codes on Heavy-Hex Architectures',
  assistant_name: 'Mario Quantum AI',
  tiers: {
    beginner: {
      tier: 'beginner',
      title: 'Intuitive & Conceptual (Mario AI Beginner Guide)',
      summary: 'This paper explains how to protect delicate quantum information by spreading one logical qubit across multiple physical qubits.',
      key_breakthrough: 'Syndrome measurements below physical threshold.',
      mathematical_intuition: 'Logical State |0_L> protects against single-qubit bit flips.',
      analogy: 'Like spelling a word with backup redundant letters.',
      actionable_takeaways: [
        'Syndrome extraction detects errors without collapsing the quantum superposition.'
      ]
    },
    undergraduate: {
      tier: 'undergraduate',
      title: 'Undergraduate Physics & Linear Algebra Breakdown',
      summary: 'Rigorous mathematical formulation of Lindblad master equations and stabilizer projectors.',
      key_breakthrough: 'Kraus operator channel characterization.',
      mathematical_intuition: 'dρ/dt = -i[H, ρ] + Σ_k (L_k ρ L_k† - 1/2 {L_k† L_k, ρ}).',
      analogy: 'Bloch sphere trajectory in SU(2) space.',
      actionable_takeaways: [
        'Calculates exact state overlap fidelity.'
      ]
    },
    practitioner: {
      tier: 'practitioner',
      title: 'QPU Hardware & Pulse Calibration Practitioner View',
      summary: 'Experimental QPU execution parameters and cross-resonance pulse calibration.',
      key_breakthrough: 'Dynamical decoupling XY4 sequence.',
      mathematical_intuition: 'H_CR = (ω_12 / 2) (ZX - IX)',
      analogy: 'DRAG pulse shaping to suppress transmon leakage.',
      actionable_takeaways: [
        'Minimizes 2-qubit CX gate count.'
      ]
    }
  },
  concept_map: [
    {
      id: 'c1',
      label: 'Quantum Superposition & Born Rule',
      category: 'prerequisite',
      description: 'State space linear combinations |ψ> = α|0> + β|1>.',
      depends_on: []
    },
    {
      id: 'c3',
      label: 'Core Syndrome Extraction',
      category: 'core_mechanism',
      description: 'Primary mechanism: Syndrome measurements.',
      depends_on: ['c1']
    },
    {
      id: 'c5',
      label: 'Fault-Tolerant Quantum Advantage',
      category: 'outcome',
      description: 'Demonstrated computational speedup.',
      depends_on: ['c3']
    }
  ],
  generated_at_iso: '2026-10-04T12:00:00Z'
};

describe('Mario Quantum AI Preprint Explainer (Phase 10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(portalApi, 'explainPaperWithMario').mockResolvedValue(mockExplainResponse);
  });

  it('renders null if isOpen is false', () => {
    const { container } = render(
      <MarioPaperExplainerModal
        isOpen={false}
        onClose={vi.fn()}
        signalItem={mockSignalItem}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('fetches explanation and renders Mario AI header, intuitive breakdown and concept nodes', async () => {
    render(
      <MarioPaperExplainerModal
        isOpen={true}
        onClose={vi.fn()}
        signalItem={mockSignalItem}
      />
    );

    expect(screen.getByText(MARIO_EXPLAINER_STRINGS.MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByText(MARIO_EXPLAINER_STRINGS.ASSISTANT_NAME)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Intuitive & Conceptual (Mario AI Beginner Guide)')).toBeInTheDocument();
      expect(screen.getByText('Syndrome measurements below physical threshold.')).toBeInTheDocument();
      expect(screen.getByText('Like spelling a word with backup redundant letters.')).toBeInTheDocument();
      expect(screen.getByText('Logical State |0_L> protects against single-qubit bit flips.')).toBeInTheDocument();
    });

    // Verify concept map nodes
    expect(screen.getByText('Quantum Superposition & Born Rule')).toBeInTheDocument();
    expect(screen.getByText('Core Syndrome Extraction')).toBeInTheDocument();
    expect(screen.getByText('Fault-Tolerant Quantum Advantage')).toBeInTheDocument();
  });

  it('switches to undergraduate and practitioner tiers', async () => {
    render(
      <MarioPaperExplainerModal
        isOpen={true}
        onClose={vi.fn()}
        signalItem={mockSignalItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-tier-undergrad')).toBeInTheDocument();
    });

    // Switch to Undergrad
    fireEvent.click(screen.getByTestId('tab-tier-undergrad'));
    await waitFor(() => {
      expect(screen.getByText('Undergraduate Physics & Linear Algebra Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Kraus operator channel characterization.')).toBeInTheDocument();
    });

    // Switch to Practitioner
    fireEvent.click(screen.getByTestId('tab-tier-practitioner'));
    await waitFor(() => {
      expect(screen.getByText('QPU Hardware & Pulse Calibration Practitioner View')).toBeInTheDocument();
      expect(screen.getByText('Dynamical decoupling XY4 sequence.')).toBeInTheDocument();
    });
  });

  it('submits follow-up inquiry through Ask Mario input form', async () => {
    render(
      <MarioPaperExplainerModal
        isOpen={true}
        onClose={vi.fn()}
        signalItem={mockSignalItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('ask-mario-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('ask-mario-input');
    fireEvent.change(input, { target: { value: 'How does the syndrome measurement avoid collapsing state?' } });

    const submitBtn = screen.getByTestId('ask-mario-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(portalApi.explainPaperWithMario).toHaveBeenCalledWith(expect.objectContaining({
        user_query: 'How does the syndrome measurement avoid collapsing state?'
      }));
    });
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    render(
      <MarioPaperExplainerModal
        isOpen={true}
        onClose={handleClose}
        signalItem={mockSignalItem}
      />
    );

    const closeBtn = screen.getByTestId('close-mario-explainer');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
