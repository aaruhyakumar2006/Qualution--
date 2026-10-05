import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuantumBenchmarkModal from './QuantumBenchmarkModal';
import HardwareStatusBanner from './HardwareStatusBanner';
import { BENCHMARK_STRINGS } from '../constants/portalConstants';
import * as portalApi from '../api/portalApi';

describe('Quantum Algorithm Benchmark & Cross-QPU Performance Matrix (Phase 8)', () => {
  const mockPresets = [
    {
      id: 'grover_3q',
      name: "Grover's Search (3-Qubit Oracle)",
      algorithm: 'Grover',
      num_qubits: 3,
      circuit_depth: 12,
      gate_count: 18,
      description: 'Quadratic quantum search for target state |111>.',
      qasm: 'OPENQASM 2.0;\nqreg q[3];\nh q[0];\nh q[1];\nh q[2];\n',
    },
    {
      id: 'qft_4q',
      name: 'Quantum Fourier Transform (4-Qubit)',
      algorithm: 'QFT',
      num_qubits: 4,
      circuit_depth: 16,
      gate_count: 22,
      description: 'Fundamental quantum subroutine converting state vectors.',
      qasm: 'OPENQASM 2.0;\nqreg q[4];\nh q[0];\n',
    },
  ];

  const mockComparison = {
    timestamp: '2026-10-04T11:00:00Z',
    benchmark_name: "Grover's Search (3-Qubit Oracle)",
    num_qubits: 3,
    original_depth: 12,
    recommended_provider_id: 'ibm_heron_r2',
    results: [
      {
        provider_id: 'ibm_heron_r2',
        provider_name: 'IBM Quantum Heron r2',
        architecture: 'superconducting',
        status: 'ONLINE',
        original_depth: 12,
        transpiled_depth: 16,
        gate_count_1q: 11,
        gate_count_2q: 13,
        estimated_fidelity: 96.45,
        estimated_runtime_ms: 57.8,
        queue_wait_sec: 45,
        recommended_reason: 'High entangling gate speed with 133-qubit Heron architecture.',
      },
      {
        provider_id: 'nvidia_cuquantum_cluster',
        provider_name: 'NVIDIA cuQuantum DGX Cluster',
        architecture: 'gpu_accelerator',
        status: 'ONLINE',
        original_depth: 12,
        transpiled_depth: 12,
        gate_count_1q: 9,
        gate_count_2q: 9,
        estimated_fidelity: 99.98,
        estimated_runtime_ms: 5.4,
        queue_wait_sec: 0,
        recommended_reason: 'Ideal for rapid debugging and zero quantum noise.',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HardwareStatusBanner Benchmark Action', () => {
    it('triggers onOpenBenchmarkModal when Q-Eval Benchmarks button is clicked', async () => {
      vi.spyOn(portalApi, 'fetchHardwareStatus').mockResolvedValue({
        online_count: 4,
        total_count: 4,
        system_status: 'OPERATIONAL',
        best_2q_fidelity: 99.85,
        lowest_queue_provider: 'NVIDIA cuQuantum',
      });
      const onOpenBench = vi.fn();

      render(
        <HardwareStatusBanner
          onOpenTelemetryModal={vi.fn()}
          onOpenBenchmarkModal={onOpenBench}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Q-Eval Benchmarks')).toBeDefined();
      });

      const btn = screen.getByText('Q-Eval Benchmarks');
      fireEvent.click(btn);

      expect(onOpenBench).toHaveBeenCalledTimes(1);
    });
  });

  describe('QuantumBenchmarkModal', () => {
    it('renders null if isOpen is false', () => {
      const { container } = render(
        <QuantumBenchmarkModal isOpen={false} onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('loads presets and displays cross-QPU comparison matrix with fidelity bars', async () => {
      vi.spyOn(portalApi, 'fetchBenchmarkPresets').mockResolvedValue(mockPresets);
      vi.spyOn(portalApi, 'compareCircuitAcrossQPUs').mockResolvedValue(mockComparison);

      render(
        <QuantumBenchmarkModal
          isOpen={true}
          onClose={vi.fn()}
          onLaunchWorkbench={vi.fn()}
        />
      );

      expect(screen.getByText(BENCHMARK_STRINGS.MODAL_TITLE)).toBeDefined();

      await waitFor(() => {
        expect(screen.getAllByText(/Grover's Search/).length).toBeGreaterThan(0);
        expect(screen.getByText('IBM Quantum Heron r2')).toBeDefined();
        expect(screen.getByText('NVIDIA cuQuantum DGX Cluster')).toBeDefined();
      });

      // Verify fidelity metrics and badges
      expect(screen.getByText('96.45%')).toBeDefined();
      expect(screen.getByText('99.98%')).toBeDefined();
      expect(screen.getByText('Best Physical')).toBeDefined();
      expect(screen.getByText('Zero Noise Sim')).toBeDefined();
    });

    it('switches between presets and executes fresh transpilation comparison', async () => {
      vi.spyOn(portalApi, 'fetchBenchmarkPresets').mockResolvedValue(mockPresets);
      const compareSpy = vi.spyOn(portalApi, 'compareCircuitAcrossQPUs').mockResolvedValue(mockComparison);

      render(
        <QuantumBenchmarkModal
          isOpen={true}
          onClose={vi.fn()}
          onLaunchWorkbench={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Quantum Fourier Transform/)).toBeDefined();
      });

      const qftTab = screen.getByText(/Quantum Fourier Transform/);
      fireEvent.click(qftTab);

      await waitFor(() => {
        expect(compareSpy).toHaveBeenCalledWith('qft_4q', null);
      });
    });

    it('allows entering custom QASM and running benchmark', async () => {
      vi.spyOn(portalApi, 'fetchBenchmarkPresets').mockResolvedValue(mockPresets);
      const compareSpy = vi.spyOn(portalApi, 'compareCircuitAcrossQPUs').mockResolvedValue(mockComparison);

      render(
        <QuantumBenchmarkModal
          isOpen={true}
          onClose={vi.fn()}
          onLaunchWorkbench={vi.fn()}
        />
      );

      const customTab = screen.getByText(BENCHMARK_STRINGS.CUSTOM_QASM_TAB);
      fireEvent.click(customTab);

      expect(screen.getByText(/Paste or Edit OpenQASM 2.0 Circuit/)).toBeDefined();
    });

    it('calls onLaunchWorkbench when Test in Workbench button is clicked', async () => {
      vi.spyOn(portalApi, 'fetchBenchmarkPresets').mockResolvedValue(mockPresets);
      vi.spyOn(portalApi, 'compareCircuitAcrossQPUs').mockResolvedValue(mockComparison);
      const onLaunch = vi.fn();

      render(
        <QuantumBenchmarkModal
          isOpen={true}
          onClose={vi.fn()}
          onLaunchWorkbench={onLaunch}
        />
      );

      await waitFor(() => {
        expect(screen.getAllByText(BENCHMARK_STRINGS.LAUNCH_WORKBENCH_BTN).length).toBeGreaterThan(0);
      });

      const launchButtons = screen.getAllByText(BENCHMARK_STRINGS.LAUNCH_WORKBENCH_BTN);
      fireEvent.click(launchButtons[0]);

      expect(onLaunch).toHaveBeenCalledTimes(1);
    });
  });
});
