from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class QPUTopologyNode(BaseModel):
    qubit_id: int
    t1_us: float = Field(..., description="T1 relaxation time in microseconds")
    t2_us: float = Field(..., description="T2 dephasing time in microseconds")
    readout_error: float = Field(..., description="Readout error rate (0.0 to 1.0)")
    neighbors: List[int] = Field(default_factory=list, description="Connected neighbor qubit IDs in coupling map")

class QPUCalibrationMetrics(BaseModel):
    avg_1q_error: float = Field(..., description="Average single-qubit gate error rate")
    avg_2q_error: float = Field(..., description="Average two-qubit entangling gate error rate")
    avg_t1_us: float = Field(..., description="Average T1 coherence time in microseconds")
    avg_t2_us: float = Field(..., description="Average T2 coherence time in microseconds")
    readout_fidelity: float = Field(..., description="Average readout fidelity percentage (0.0 to 1.0)")
    calibration_timestamp: str = Field(..., description="ISO timestamp of most recent automated calibration")

class QPUHardwareProvider(BaseModel):
    id: str
    name: str
    provider: str = Field(..., description="ibm, nvidia, rigetti, ionq")
    architecture: str = Field(..., description="superconducting, gpu_accelerator, trapped_ion, neutral_atom")
    qubit_count: int
    status: str = Field(..., description="ONLINE, CALIBRATING, MAINTENANCE, OFFLINE")
    queue_depth: int = Field(default=0, description="Number of pending quantum jobs in queue")
    est_wait_time_sec: int = Field(default=0, description="Estimated wait time in seconds")
    topology_type: str = Field(..., description="Heavy-Hex, Linear, All-to-All, Square-Grid")
    calibration: QPUCalibrationMetrics
    topology_nodes: List[QPUTopologyNode] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

class HardwareTelemetryResponse(BaseModel):
    timestamp: str
    total_qpus: int
    online_qpus: int
    providers: List[QPUHardwareProvider]

class HardwareStatusSummary(BaseModel):
    online_count: int
    total_count: int
    system_status: str = Field(..., description="OPERATIONAL, DEGRADED, MAINTENANCE")
    best_2q_fidelity: float
    lowest_queue_provider: str
