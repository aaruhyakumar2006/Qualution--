from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class BenchmarkPreset(BaseModel):
    id: str
    name: str
    algorithm: str
    num_qubits: int
    circuit_depth: int
    gate_count: int
    description: str
    qasm: str

class QPUTranspileResult(BaseModel):
    provider_id: str
    provider_name: str
    architecture: str
    status: str
    original_depth: int
    transpiled_depth: int
    gate_count_1q: int
    gate_count_2q: int
    estimated_fidelity: float = Field(..., description="Estimated end-to-end circuit execution fidelity percentage (0.0 to 100.0)")
    estimated_runtime_ms: float
    queue_wait_sec: int
    recommended_reason: Optional[str] = None

class BenchmarkComparisonRequest(BaseModel):
    preset_id: Optional[str] = None
    custom_qasm: Optional[str] = None

class BenchmarkComparisonResponse(BaseModel):
    timestamp: str
    benchmark_name: str
    num_qubits: int
    original_depth: int
    recommended_provider_id: str
    results: List[QPUTranspileResult]
