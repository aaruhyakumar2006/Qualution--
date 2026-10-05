import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PulseCalibrationVisualizerModal from './PulseCalibrationVisualizerModal';
import * as portalApi from '../api/portalApi';
import { PULSE_VISUALIZER_STRINGS } from '../constants/portalConstants';

const mockPresets: portalApi.PulsePreset[] = [
  {
    id: 'ibm-heron-drag-x90',
    name: 'IBM Heron R4 DRAG π/2 X-Gate',
    target_qpu: 'IBM Heron (156Q)',
    pulse_type: 'drag',
    gate_name: 'SX (π/2)',
    duration_ns: 32.0,
    sample_rate_ghz: 4.5,
    amplitude: 0.78,
    sigma_ns: 6.5,
    beta_drag: 0.34,
    phase_rad: 0.0,
    detuning_mhz: 0.0,
    description: 'Calibrated DRAG pulse on transmon Q0.'
  },
  {
    id: 'rigetti-ankaa-gaussian-square',
    name: 'Rigetti Ankaa-3 Gaussian Square CZ Gate',
    target_qpu: 'Rigetti Ankaa-3 (84Q)',
    pulse_type: 'gaussian_square',
    gate_name: 'CZ Entangler',
    duration_ns: 64.0,
    sample_rate_ghz: 2.0,
    amplitude: 0.92,
    sigma_ns: 8.0,
    beta_drag: 0.15,
    phase_rad: 0.0,
    detuning_mhz: -45.0,
    description: 'Flux pulse with Gaussian edge smoothing.'
  }
];

const mockSimulateResponse: portalApi.PulseSimulateResponse = {
  pulse_type: 'drag',
  duration_ns: 32.0,
  gate_name: 'SX (π/2)',
  samples: [
    { t_ns: 0.0, i_real: 0.01, q_imag: -0.005, envelope: 0.01, phase: -0.46 },
    { t_ns: 16.0, i_real: 0.78, q_imag: 0.0, envelope: 0.78, phase: 0.0 },
    { t_ns: 32.0, i_real: 0.01, q_imag: 0.005, envelope: 0.01, phase: 0.46 }
  ],
  spectrum: [
    { frequency_mhz: -50, power_db: -32.5 },
    { frequency_mhz: 0, power_db: 12.4 },
    { frequency_mhz: 50, power_db: -35.1 }
  ],
  leakage_suppression_ratio: 99.4,
  estimated_gate_fidelity: 0.9994,
  effective_area_pi: 0.5,
  recommended_qubit_type: 'Superconducting Transmon (Anharmonicity α ≈ -240 MHz)',
  calibration_advice: 'DRAG coefficient β successfully depresses spectral density at |1> -> |2>.'
};

describe('PulseCalibrationVisualizerModal Component (Phase 13)', () => {
  const mockOnClose = vi.fn();
  const mockOnLaunchWorkbench = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(portalApi, 'fetchPulsePresets').mockResolvedValue(mockPresets);
    vi.spyOn(portalApi, 'simulatePulseWaveform').mockResolvedValue(mockSimulateResponse);
  });

  it('does not render when isOpen is false', () => {
    render(
      <PulseCalibrationVisualizerModal
        isOpen={false}
        onClose={mockOnClose}
        onLaunchWorkbench={mockOnLaunchWorkbench}
      />
    );
    expect(screen.queryByTestId('pulse-visualizer-modal')).toBeNull();
  });

  it('loads presets, runs simulation, and renders waveform SVG graph and KPIs', async () => {
    render(
      <PulseCalibrationVisualizerModal
        isOpen={true}
        onClose={mockOnClose}
        onLaunchWorkbench={mockOnLaunchWorkbench}
      />
    );

    expect(screen.getByTestId('pulse-visualizer-modal')).toBeInTheDocument();
    expect(screen.getByText(PULSE_VISUALIZER_STRINGS.MODAL_TITLE)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('leakage-suppression-kpi')).toHaveTextContent('99.4%');
      expect(screen.getByTestId('fidelity-kpi')).toHaveTextContent('99.94%');
      expect(screen.getByTestId('pulse-waveform-svg')).toBeInTheDocument();
      expect(screen.getByText(/DRAG coefficient β successfully/i)).toBeInTheDocument();
    });
  });

  it('switches between presets and updates waveform parameters', async () => {
    render(
      <PulseCalibrationVisualizerModal
        isOpen={true}
        onClose={mockOnClose}
        onLaunchWorkbench={mockOnLaunchWorkbench}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('preset-btn-rigetti-ankaa-gaussian-square')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('preset-btn-rigetti-ankaa-gaussian-square'));
    expect(screen.getByTestId('slider-duration')).toHaveValue('64');
  });

  it('switches to RF spectrum tab and renders frequency bars', async () => {
    render(
      <PulseCalibrationVisualizerModal
        isOpen={true}
        onClose={mockOnClose}
        onLaunchWorkbench={mockOnLaunchWorkbench}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-pulse-spectrum')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-pulse-spectrum'));
    expect(screen.getByTestId('spectrum-bars-container')).toBeInTheDocument();
  });

  it('triggers onLaunchWorkbench when launch button is clicked', async () => {
    render(
      <PulseCalibrationVisualizerModal
        isOpen={true}
        onClose={mockOnClose}
        onLaunchWorkbench={mockOnLaunchWorkbench}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('launch-workbench-pulse-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('launch-workbench-pulse-btn'));
    expect(mockOnLaunchWorkbench).toHaveBeenCalledWith('ibm-heron-drag-x90');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
