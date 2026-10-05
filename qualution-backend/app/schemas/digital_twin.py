from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class QubitProperty(BaseModel):
    qubit: int
    t1: Optional[float] = Field(None, description="T1 relaxation time in seconds")
    t2: Optional[float] = Field(None, description="T2 dephasing time in seconds")
    t1_us: Optional[float] = Field(None, description="T1 relaxation time in microseconds")
    t2_us: Optional[float] = Field(None, description="T2 dephasing time in microseconds")
    frequency_ghz: Optional[float] = Field(None, description="Qubit resonant frequency in GHz")

class TwoQubitGateError(BaseModel):
    gate: str = Field(..., description="Two-qubit gate name (e.g. cx, ecr)")
    qubits: List[int] = Field(..., description="Pair of coupled qubits [control, target]")
    error: float = Field(..., description="Gate error rate")
    duration_ns: Optional[float] = Field(None, description="Gate duration in nanoseconds")

class DigitalTwinSimulationResponse(BaseModel):
    backend_name: str = Field(..., description="Target fake backend name (e.g. fake_manila)")
    backend_display_name: str = Field(..., description="Class name of the fake backend (e.g. FakeManilaV2)")
    qubit_count: int = Field(..., description="Number of qubits on the backend")
    circuit_qubits: int = Field(..., description="Number of qubits in the simulated circuit")
    shots: int = Field(..., description="Measurement shot count")
    ideal_probabilities: Dict[str, float] = Field(..., description="Ideal noiseless probabilities")
    noisy_probabilities: Dict[str, float] = Field(..., description="Hardware-calibrated noisy probabilities")
    ideal_counts: Dict[str, int] = Field(..., description="Raw ideal measurement counts")
    noisy_counts: Dict[str, int] = Field(..., description="Raw noisy measurement counts")
    coupling_map: List[List[int]] = Field(..., description="Physical qubit coupling map edges")
    qubit_properties: List[QubitProperty] = Field(..., description="Calibrated T1/T2 properties per qubit")
    gate_errors: List[TwoQubitGateError] = Field(..., description="Calibrated two-qubit gate error rates")
    runtime_ms: float = Field(..., description="Wall-clock simulation execution time in ms")
    execution_location: str = Field(default="local_python", description="Execution location")
    warnings: Optional[List[str]] = Field(default=None, description="Any execution notices or warnings")
