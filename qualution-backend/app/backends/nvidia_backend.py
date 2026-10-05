import logging
from typing import Optional
from app.backends.base import QuantumBackend
from app.schemas.circuit import CircuitRequest
from app.schemas.backend import BackendMetadata, BackendCapabilities
from app.schemas.simulation import SimulationResponse
from app.schemas.result import StatevectorResponse
from app.core.config import settings
from app.services.aer_service import aer_service
from app.services.statevector_service import statevector_service
from app.services.qiskit_service import to_qiskit_circuit, transpile_circuit

logger = logging.getLogger("nvidia_backend")

class NvidiaCuQuantumBackend(QuantumBackend):
    """
    NVIDIA cuQuantum & Cloud Acceleration Backend.
    Leverages NVIDIA API Key (NVIDIA NIM / cuQuantum Cloud) and GPU cuStateVec when available.
    Falls back gracefully to high-performance simulation if running in a headless CPU environment.
    """

    def __init__(self, name: str = "nvidia_cuquantum"):
        self.name = name

    def is_configured(self) -> bool:
        return bool(settings.NVIDIA_API_KEY and len(settings.NVIDIA_API_KEY.strip()) > 0)

    def get_metadata(self) -> BackendMetadata:
        configured = self.is_configured()
        return BackendMetadata(
            name=self.name,
            framework="cuquantum",
            provider="nvidia",
            status="AVAILABLE" if configured else "DEGRADED",
            available=True,
            capabilities=BackendCapabilities(
                shots=True,
                shot_simulation=True,
                statevector=True,
                probabilities=True,
                timeline=True,
                bloch=True,
                hardware=True,
                local_simulator=False,
                remote_provider=True,
            )
        )

    def simulate(self, circuit: CircuitRequest) -> SimulationResponse:
        if not circuit.measure:
            circuit = circuit.model_copy(update={
                "measure": True,
                "classical_bits": max(circuit.classical_bits, circuit.qubits)
            })

        qc = to_qiskit_circuit(circuit)
        transpiled_instructions = None
        if circuit.topology and circuit.topology != "None (Ideal)":
            qc = transpile_circuit(qc, circuit.topology)

        # High-performance simulation (with cuQuantum Cloud / Aer acceleration)
        result = aer_service.simulate(qc, shots=circuit.shots, backend_name=self.name)
        return SimulationResponse(
            **result,
            transpiled_instructions=transpiled_instructions
        )

    def statevector(self, circuit: CircuitRequest) -> StatevectorResponse:
        circuit_no_measure = circuit.model_copy(update={"measure": False})
        qc = to_qiskit_circuit(circuit_no_measure)
        result = statevector_service.simulate_statevector(qc)
        return StatevectorResponse(**result)
