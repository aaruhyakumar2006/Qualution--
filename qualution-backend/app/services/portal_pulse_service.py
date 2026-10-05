import math
from typing import List
from app.schemas.portal_pulse import (
    PulsePreset,
    PulseSimulateRequest,
    PulseSimulateResponse,
    PulseSamplePoint,
    PulseFrequencyPoint
)

class PortalPulseService:
    def __init__(self):
        self._presets = [
            PulsePreset(
                id="ibm-heron-drag-x90",
                name="IBM Heron R4 DRAG π/2 X-Gate",
                target_qpu="IBM Heron (156Q)",
                pulse_type="drag",
                gate_name="SX (π/2)",
                duration_ns=32.0,
                sample_rate_ghz=4.5,
                amplitude=0.78,
                sigma_ns=6.5,
                beta_drag=0.34,
                phase_rad=0.0,
                detuning_mhz=0.0,
                description="Calibrated DRAG pulse on transmon Q0 to cancel |1> -> |2> leakage under 240 MHz anharmonicity."
            ),
            PulsePreset(
                id="ibm-heron-cr-echo",
                name="IBM Cross-Resonance Direct CX Echo",
                target_qpu="IBM Heron (156Q)",
                pulse_type="cross_resonance",
                gate_name="CR ZX(π/4)",
                duration_ns=160.0,
                sample_rate_ghz=4.5,
                amplitude=0.65,
                sigma_ns=18.0,
                beta_drag=0.0,
                phase_rad=math.pi / 2,
                detuning_mhz=125.0,
                description="Microwave drive applied to control qubit at target qubit resonance for entangling 2-qubit interactions."
            ),
            PulsePreset(
                id="rigetti-ankaa-gaussian-square",
                name="Rigetti Ankaa-3 Gaussian Square CZ Gate",
                target_qpu="Rigetti Ankaa-3 (84Q)",
                pulse_type="gaussian_square",
                gate_name="CZ Entangler",
                duration_ns=64.0,
                sample_rate_ghz=2.0,
                amplitude=0.92,
                sigma_ns=8.0,
                beta_drag=0.15,
                phase_rad=0.0,
                detuning_mhz=-45.0,
                description="Flux pulse with Gaussian edge smoothing to prevent non-adiabatic transitions into non-computational states."
            ),
            PulsePreset(
                id="ionq-forte-raman-pi",
                name="IonQ Forte Barium-133 Raman π-Pulse",
                target_qpu="IonQ Forte (36Q)",
                pulse_type="gaussian",
                gate_name="Rabi Flip π",
                duration_ns=80.0,
                sample_rate_ghz=5.0,
                amplitude=0.88,
                sigma_ns=16.0,
                beta_drag=0.0,
                phase_rad=0.0,
                detuning_mhz=0.0,
                description="Counter-propagating Raman laser pulse for motional sideband cooling and optical qubit transitions."
            )
        ]

    def get_presets(self) -> List[PulsePreset]:
        return self._presets

    def simulate_pulse(self, req: PulseSimulateRequest) -> PulseSimulateResponse:
        n_samples = max(20, min(req.samples_count, 300))
        dt = req.duration_ns / (n_samples - 1)
        t_center = req.duration_ns / 2.0
        sigma = max(0.5, req.sigma_ns)
        amp = req.amplitude
        beta = req.beta_drag
        detuning_rad_per_ns = 2 * math.pi * (req.detuning_mhz / 1000.0)

        samples: List[PulseSamplePoint] = []

        for i in range(n_samples):
            t = i * dt
            rel_t = t - t_center

            # Base envelope
            if req.pulse_type == "drag" or req.pulse_type == "gaussian":
                env = amp * math.exp(-0.5 * (rel_t / sigma) ** 2)
                # DRAG derivative term
                d_env_dt = - (rel_t / (sigma ** 2)) * env
                i_val = env * math.cos(req.phase_rad + detuning_rad_per_ns * t)
                q_val = (-beta * d_env_dt) if req.pulse_type == "drag" else 0.0
            elif req.pulse_type == "gaussian_square":
                flat_width = req.duration_ns * 0.5
                if abs(rel_t) <= flat_width / 2.0:
                    env = amp
                else:
                    edge_t = abs(rel_t) - (flat_width / 2.0)
                    env = amp * math.exp(-0.5 * (edge_t / sigma) ** 2)
                i_val = env * math.cos(req.phase_rad + detuning_rad_per_ns * t)
                q_val = 0.0
            elif req.pulse_type == "cross_resonance":
                # CR rotary echo tone
                cr_env = amp * math.exp(-0.5 * (rel_t / sigma) ** 2)
                i_val = cr_env * math.cos(detuning_rad_per_ns * t)
                q_val = cr_env * 0.35 * math.sin(detuning_rad_per_ns * t + req.phase_rad)
                env = math.sqrt(i_val ** 2 + q_val ** 2)
            else:  # square / default
                env = amp if (t >= 0.1 * req.duration_ns and t <= 0.9 * req.duration_ns) else 0.0
                i_val = env * math.cos(req.phase_rad + detuning_rad_per_ns * t)
                q_val = 0.0

            phase_val = math.atan2(q_val, i_val) if (abs(i_val) > 1e-6 or abs(q_val) > 1e-6) else 0.0

            samples.append(
                PulseSamplePoint(
                    t_ns=round(t, 3),
                    i_real=round(i_val, 4),
                    q_imag=round(q_val, 4),
                    envelope=round(env, 4),
                    phase=round(phase_val, 4)
                )
            )

        # Compute power spectrum via discrete Fourier approximation
        spectrum: List[PulseFrequencyPoint] = []
        freq_range = [-200, -150, -100, -50, -20, 0, 20, 50, 100, 150, 200]
        for f in freq_range:
            omega = 2 * math.pi * (f / 1000.0)  # GHz
            real_sum = sum(s.i_real * math.cos(omega * s.t_ns) * dt for s in samples)
            imag_sum = sum(s.i_real * math.sin(omega * s.t_ns) * dt for s in samples)
            power = real_sum ** 2 + imag_sum ** 2
            power_db = round(10 * math.log10(max(power, 1e-6)), 2)
            spectrum.append(PulseFrequencyPoint(frequency_mhz=float(f), power_db=power_db))

        # Heuristic calculations
        leakage_suppression = 99.4 if req.pulse_type == "drag" and abs(beta) > 0.1 else 88.2
        if req.pulse_type == "cross_resonance":
            estimated_fidelity = 0.9965
            recommended_qubit = "Fixed-Frequency Transmon with Cross-Resonance Bus"
            advice = "Rotary echo tone cancels unwanted IX and ZZ residual Hamiltonian terms."
        elif req.pulse_type == "drag":
            estimated_fidelity = 0.9994
            recommended_qubit = "Superconducting Transmon (Anharmonicity α ≈ -220 to -340 MHz)"
            advice = "DRAG coefficient β successfully depresses spectral density at the |1> -> |2> transition frequency."
        elif req.pulse_type == "gaussian_square":
            estimated_fidelity = 0.9980
            recommended_qubit = "Tunable Coupler Fluxonium / Transmon"
            advice = "Smooth Gaussian edges suppress Fourier sidebands during fast state transitions."
        else:
            estimated_fidelity = 0.9950
            recommended_qubit = "Trapped Ion (171Yb+ / 133Ba+ Optical Raman)"
            advice = "Standard Gaussian envelope delivers symmetric spectral roll-off."

        effective_area = sum(s.envelope for s in samples) * dt / 10.0

        return PulseSimulateResponse(
            pulse_type=req.pulse_type,
            duration_ns=req.duration_ns,
            samples=samples,
            spectrum=spectrum,
            leakage_suppression_ratio=leakage_suppression,
            estimated_gate_fidelity=estimated_fidelity,
            effective_area_pi=round(effective_area, 3),
            recommended_qubit_type=recommended_qubit,
            calibration_advice=advice
        )

portal_pulse_service = PortalPulseService()
