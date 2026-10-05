import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HardwareStatusBanner from './HardwareStatusBanner';
import HardwareTelemetryModal from './HardwareTelemetryModal';
import { HARDWARE_STRINGS } from '../constants/portalConstants';
import * as portalApi from '../api/portalApi';

describe('Hardware Telemetry Components (Phase 6)', () => {
  const mockStatus = {
    total_count: 4,
    online_count: 4,
    system_status: 'OPERATIONAL',
    best_2q_fidelity: 99.85,
    lowest_queue_provider: 'NVIDIA cuQuantum DGX-H100',
  };

  const mockTelemetry = {
    timestamp: '2026-10-04T10:00:00Z',
    total_qpus: 4,
    online_qpus: 4,
    providers: [
      {
        id: 'ibm_heron',
        name: 'IBM Quantum Heron (Eagle-R3)',
        provider: 'ibm',
        architecture: 'superconducting',
        qubit_count: 133,
        status: 'ONLINE',
        queue_depth: 14,
        est_wait_time_sec: 45,
        topology_type: 'Heavy-Hex',
        calibration: {
          avg_1q_error: 0.00018,
          avg_2q_error: 0.0032,
          avg_t1_us: 142.5,
          avg_t2_us: 118.2,
          readout_fidelity: 0.988,
          calibration_timestamp: '2026-10-04T09:45:00Z',
        },
        topology_nodes: [
          { qubit_id: 0, t1_us: 145.2, t2_us: 120.1, readout_error: 0.011, neighbors: [1, 2] },
          { qubit_id: 1, t1_us: 139.8, t2_us: 115.4, readout_error: 0.013, neighbors: [0, 3] },
          { qubit_id: 2, t1_us: 144.0, t2_us: 119.0, readout_error: 0.012, neighbors: [0] },
          { qubit_id: 3, t1_us: 141.5, t2_us: 117.8, readout_error: 0.012, neighbors: [1] },
        ],
        tags: ['Production', '133Q'],
      },
      {
        id: 'nvidia_cuquantum',
        name: 'NVIDIA cuQuantum DGX-H100',
        provider: 'nvidia',
        architecture: 'gpu_accelerator',
        qubit_count: 40,
        status: 'ONLINE',
        queue_depth: 2,
        est_wait_time_sec: 1,
        topology_type: 'All-to-All',
        calibration: {
          avg_1q_error: 0.000001,
          avg_2q_error: 0.000001,
          avg_t1_us: 99999.0,
          avg_t2_us: 99999.0,
          readout_fidelity: 0.99999,
          calibration_timestamp: '2026-10-04T10:00:00Z',
        },
        topology_nodes: [
          { qubit_id: 0, t1_us: 99999.0, t2_us: 99999.0, readout_error: 0.000001, neighbors: [1, 2, 3] },
        ],
        tags: ['GPU Simulator', 'State Vector'],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('HardwareStatusBanner', () => {
    it('renders banner with online QPU counts and metrics from API', async () => {
      vi.spyOn(portalApi, 'fetchHardwareStatus').mockResolvedValue(mockStatus);

      render(<HardwareStatusBanner onOpenTelemetryModal={vi.fn()} />);

      expect(screen.getByText(HARDWARE_STRINGS.BANNER_TITLE)).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText('4/4 QPUs Online')).toBeDefined();
        expect(screen.getByText('99.85%')).toBeDefined();
        expect(screen.getByText('NVIDIA cuQuantum DGX-H100')).toBeDefined();
      });
    });

    it('triggers onOpenTelemetryModal when Details button is clicked', async () => {
      vi.spyOn(portalApi, 'fetchHardwareStatus').mockResolvedValue(mockStatus);
      const onOpen = vi.fn();

      render(<HardwareStatusBanner onOpenTelemetryModal={onOpen} />);

      const btn = screen.getByText(HARDWARE_STRINGS.VIEW_DETAILS_BTN);
      fireEvent.click(btn);

      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('HardwareTelemetryModal', () => {
    it('renders null if isOpen is false', () => {
      const { container } = render(
        <HardwareTelemetryModal isOpen={false} onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('fetches telemetry and displays provider tabs, calibration metrics, and topology nodes', async () => {
      vi.spyOn(portalApi, 'fetchHardwareTelemetry').mockResolvedValue(mockTelemetry);

      render(<HardwareTelemetryModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText(HARDWARE_STRINGS.MODAL_TITLE)).toBeDefined();

      await waitFor(() => {
        expect(screen.getByText('IBM Quantum Heron (Eagle-R3)')).toBeDefined();
        expect(screen.getByText('NVIDIA cuQuantum DGX-H100')).toBeDefined();
      });

      // Check calibration metrics
      expect(screen.getByText('99.68%')).toBeDefined(); // 1 - 0.0032 = 99.68%
      expect(screen.getByText(/T1: 142.5 µs/)).toBeDefined();
      expect(screen.getByText(/T2: 118.2 µs/)).toBeDefined();

      // Check topology node clicks
      const q0Node = screen.getByText('Q[0]');
      fireEvent.click(q0Node);

      // Check Qubit inspector panel
      expect(screen.getByText(/Inspecting:/)).toBeDefined();
      expect(screen.getByText(/145.2 µs/)).toBeDefined();
      expect(screen.getByText(/Q\[1\], Q\[2\]/)).toBeDefined();
    });

    it('switches active provider tab when clicked', async () => {
      vi.spyOn(portalApi, 'fetchHardwareTelemetry').mockResolvedValue(mockTelemetry);

      render(<HardwareTelemetryModal isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('NVIDIA cuQuantum DGX-H100')).toBeDefined();
      });

      const nvidiaTab = screen.getByText('NVIDIA cuQuantum DGX-H100');
      fireEvent.click(nvidiaTab);

      // Verify switch
      await waitFor(() => {
        expect(screen.getByText(/T1:\s*>10 ms/)).toBeDefined();
        expect(screen.getByText(/gpu_accelerator/)).toBeDefined();
      });
    });

    it('calls onClose when close button is clicked', async () => {
      vi.spyOn(portalApi, 'fetchHardwareTelemetry').mockResolvedValue(mockTelemetry);
      const onClose = vi.fn();

      render(<HardwareTelemetryModal isOpen={true} onClose={onClose} />);

      const closeBtn = screen.getByLabelText('Close');
      fireEvent.click(closeBtn);

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
