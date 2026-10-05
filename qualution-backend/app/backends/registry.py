from typing import Dict, List, Optional
from app.backends.base import QuantumBackend
from app.backends.qiskit_backend import QiskitAerBackend
from app.backends.pennylane_backend import PennyLaneBackend
from app.backends.cirq_backend import CirqBackend
from app.backends.qbraid_backend import QBraidBackend
from app.backends.clifford_backend import CliffordStabilizerBackend
from app.backends.mps_backend import QiskitMPSBackend
from app.backends.nvidia_backend import NvidiaCuQuantumBackend
from app.schemas.backend import BackendMetadata

class BackendRegistry:
    def __init__(self):
        self._backends: Dict[str, QuantumBackend] = {}
        self._default_backend: str = "qiskit_aer"

        # Register default supported backends
        self.register(QiskitAerBackend())
        self.register(PennyLaneBackend())
        self.register(CirqBackend())
        self.register(QBraidBackend())

        self._specialized: Dict[str, QuantumBackend] = {
            "clifford_stabilizer": CliffordStabilizerBackend("clifford_stabilizer"),
            "qiskit_aer_stabilizer": CliffordStabilizerBackend("qiskit_aer_stabilizer"),
            "qiskit_aer_mps": QiskitMPSBackend("qiskit_aer_mps"),
            "nvidia_cuquantum": NvidiaCuQuantumBackend("nvidia_cuquantum"),
            "cuquantum": NvidiaCuQuantumBackend("cuquantum"),
        }

    def register(self, backend: QuantumBackend):
        meta = backend.get_metadata()
        self._backends[meta.name.lower()] = backend

    def get(self, name: Optional[str] = None) -> QuantumBackend:
        backend_name = (name or self._default_backend).lower()
        if hasattr(self, "_specialized") and backend_name in self._specialized:
            return self._specialized[backend_name]
        if backend_name not in self._backends:
            available = list(self._backends.keys())
            raise ValueError(f"Unknown backend '{backend_name}'. Available backends: {available}")
        return self._backends[backend_name]

    def list_backends(self) -> List[BackendMetadata]:
        return [b.get_metadata() for b in self._backends.values()]

    def has(self, name: str) -> bool:
        """Check if a backend exists in the registry"""
        backend_name = name.lower()
        return backend_name in self._backends or (hasattr(self, "_specialized") and backend_name in self._specialized)

backend_registry = BackendRegistry()
