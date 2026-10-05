from pydantic import BaseModel, Field
from typing import List, Optional

class PulsePreset(BaseModel):
    id: str
    name: str
    target_qpu: str
    pulse_type: str  # "drag", "gaussian", "gaussian_square", "cross_resonance", "square"
    gate_name: str
    duration_ns: float
    sample_rate_ghz: float = 4.5
    amplitude: float = 0.85
    sigma_ns: float = 8.0
    beta_drag: float = 0.25
    phase_rad: float = 0.0
    detuning_mhz: float = 0.0
    description: str

class PulseSimulateRequest(BaseModel):
    pulse_type: str = "drag"
    duration_ns: float = 40.0
    sample_rate_ghz: float = 4.5
    amplitude: float = 0.85
    sigma_ns: float = 8.0
    beta_drag: float = 0.25
    phase_rad: float = 0.0
    detuning_mhz: float = 0.0
    samples_count: int = 120

class PulseSamplePoint(BaseModel):
    t_ns: float
    i_real: float
    q_imag: float
    envelope: float
    phase: float

class PulseFrequencyPoint(BaseModel):
    frequency_mhz: float
    power_db: float

class PulseSimulateResponse(BaseModel):
    pulse_type: str
    duration_ns: float
    gate_name: str = "X (π-pulse)"
    samples: List[PulseSamplePoint]
    spectrum: List[PulseFrequencyPoint]
    leakage_suppression_ratio: float
    estimated_gate_fidelity: float
    effective_area_pi: float
    recommended_qubit_type: str
    calibration_advice: str
