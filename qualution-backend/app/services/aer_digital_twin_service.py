import inspect
import time
from typing import Dict, Any, List, Optional
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit_ibm_runtime import fake_provider

from app.schemas.canonical import CanonicalCircuitInput
from app.schemas.digital_twin import (
    DigitalTwinSimulationResponse,
    QubitProperty,
    TwoQubitGateError,
)

DEFAULT_FAKE_BACKEND: str = "fake_manila"

class AerDigitalTwinService:
    """
    Qiskit Aer Digital Twin service.
    Simulates circuits concurrently on both an ideal noiseless simulator
    and a hardware-calibrated noisy AerSimulator configured from an IBM fake backend snapshot.
    """

    def __init__(self):
        self._backend_cache: Dict[str, Any] = {}
        self._ideal_simulator = AerSimulator()

    def resolve_backend(self, backend_name: Optional[str] = None):
        name = (backend_name or DEFAULT_FAKE_BACKEND).strip()
        if name in self._backend_cache:
            return self._backend_cache[name]

        # 1. Direct class name match
        if hasattr(fake_provider, name):
            obj = getattr(fake_provider, name)
            if inspect.isclass(obj):
                backend = obj()
                self._backend_cache[name] = backend
                return backend

        # 2. V2 suffix match (e.g. FakeManila -> FakeManilaV2)
        if hasattr(fake_provider, f"{name}V2"):
            obj = getattr(fake_provider, f"{name}V2")
            if inspect.isclass(obj):
                backend = obj()
                self._backend_cache[name] = backend
                return backend

        # 3. Case-insensitive and snake_case normalization
        norm = name.lower().replace("_", "")
        for attr in dir(fake_provider):
            if attr.startswith("Fake"):
                attr_norm = attr.lower()
                if norm == attr_norm or f"{norm}v2" == attr_norm or f"fake{norm}" == attr_norm or f"fake{norm}v2" == attr_norm:
                    obj = getattr(fake_provider, attr)
                    if inspect.isclass(obj):
                        try:
                            backend = obj()
                            self._backend_cache[name] = backend
                            return backend
                        except Exception:
                            continue

        raise ValueError(
            f"Unsupported or unknown fake backend '{name}'. "
            "Supported backends include 'fake_manila' (FakeManilaV2), 'fake_jakarta' (FakeJakartaV2), 'fake_nairobi', etc."
        )

    def to_qiskit_circuit(self, circuit: CanonicalCircuitInput) -> QuantumCircuit:
        n_qubits = circuit.qubits
        n_clbits = circuit.classical_bits

        if not n_clbits:
            if circuit.measurements and len(circuit.measurements) > 0:
                n_clbits = max(m.classical_bit for m in circuit.measurements) + 1
            else:
                n_clbits = n_qubits

        qc = QuantumCircuit(n_qubits, n_clbits)

        for g in circuit.gates:
            raw_name = (g.type or g.gate or "").strip().lower()
            targets = g.targets
            angle = g.angle

            if not targets:
                continue

            if raw_name in ("h", "hadamard"):
                qc.h(targets[0])
            elif raw_name in ("x", "not"):
                qc.x(targets[0])
            elif raw_name in ("y",):
                qc.y(targets[0])
            elif raw_name in ("z",):
                qc.z(targets[0])
            elif raw_name in ("s",):
                qc.s(targets[0])
            elif raw_name in ("sdg", "s_dagger", "sdag"):
                qc.sdg(targets[0])
            elif raw_name in ("t",):
                qc.t(targets[0])
            elif raw_name in ("tdg", "t_dagger", "tdag"):
                qc.tdg(targets[0])
            elif raw_name in ("sx",):
                qc.sx(targets[0])
            elif raw_name in ("rx",):
                qc.rx(angle if angle is not None else 0.0, targets[0])
            elif raw_name in ("ry",):
                qc.ry(angle if angle is not None else 0.0, targets[0])
            elif raw_name in ("rz", "p", "phase"):
                qc.rz(angle if angle is not None else 0.0, targets[0])
            elif raw_name in ("cx", "cnot"):
                if len(targets) >= 2:
                    qc.cx(targets[0], targets[1])
            elif raw_name in ("cz",):
                if len(targets) >= 2:
                    qc.cz(targets[0], targets[1])
            elif raw_name in ("swap",):
                if len(targets) >= 2:
                    qc.swap(targets[0], targets[1])
            elif raw_name in ("ccx", "toffoli"):
                if len(targets) >= 3:
                    qc.ccx(targets[0], targets[1], targets[2])
            elif raw_name in ("id", "i"):
                qc.id(targets[0])
            elif raw_name in ("measure",):
                pass

        # Apply measurements
        has_measurements = False
        if circuit.measurements and len(circuit.measurements) > 0:
            for m in circuit.measurements:
                if m.qubit < n_qubits and m.classical_bit < n_clbits:
                    qc.measure(m.qubit, m.classical_bit)
                    has_measurements = True
        elif circuit.measure is not False:
            num_to_measure = min(n_qubits, n_clbits)
            for i in range(num_to_measure):
                qc.measure(i, i)
            has_measurements = num_to_measure > 0

        if not has_measurements or qc.num_clbits == 0:
            qc.measure_all()

        return qc

    def extract_qubit_properties(self, backend: Any) -> List[QubitProperty]:
        qubit_props: List[QubitProperty] = []
        for i in range(backend.num_qubits):
            qp = backend.qubit_properties(i)
            t1 = float(qp.t1) if qp and qp.t1 is not None else None
            t2 = float(qp.t2) if qp and qp.t2 is not None else None
            freq = float(qp.frequency) if qp and qp.frequency is not None else None
            qubit_props.append(
                QubitProperty(
                    qubit=i,
                    t1=t1,
                    t2=t2,
                    t1_us=round(t1 * 1e6, 2) if t1 is not None else None,
                    t2_us=round(t2 * 1e6, 2) if t2 is not None else None,
                    frequency_ghz=round(freq / 1e9, 4) if freq is not None else None,
                )
            )
        return qubit_props

    def extract_gate_errors(self, backend: Any) -> List[TwoQubitGateError]:
        two_q_errors: List[TwoQubitGateError] = []
        for op_name in backend.operation_names:
            op_props = backend.target[op_name]
            for q_tuple, q_prop in op_props.items():
                if q_tuple is not None and len(q_tuple) == 2 and q_prop:
                    two_q_errors.append(
                        TwoQubitGateError(
                            gate=op_name,
                            qubits=list(q_tuple),
                            error=float(q_prop.error) if q_prop.error is not None else 0.0,
                            duration_ns=round(q_prop.duration * 1e9, 2) if q_prop.duration is not None else None,
                        )
                    )
        return two_q_errors

    def simulate(
        self, circuit: CanonicalCircuitInput, backend_name: Optional[str] = None
    ) -> DigitalTwinSimulationResponse:
        backend = self.resolve_backend(backend_name or circuit.backend_name)
        if circuit.qubits > backend.num_qubits:
            raise ValueError(
                f"Circuit qubit count ({circuit.qubits}) exceeds fake backend '{backend.name}' "
                f"capacity ({backend.num_qubits} qubits)."
            )

        shots = circuit.shots or 1024
        qc = self.to_qiskit_circuit(circuit)

        t_start = time.perf_counter()

        # Run 1: Plain AerSimulator (ideal, noiseless)
        ideal_t_qc = transpile(qc, self._ideal_simulator)
        ideal_job = self._ideal_simulator.run(ideal_t_qc, shots=shots)
        ideal_counts = ideal_job.result().get_counts()
        ideal_probabilities = {
            k: round(v / shots, 6) for k, v in sorted(ideal_counts.items())
        }

        # Run 2: Hardware-calibrated noisy AerSimulator
        noisy_simulator = AerSimulator.from_backend(backend)
        noisy_t_qc = transpile(qc, backend, optimization_level=1)
        noisy_job = noisy_simulator.run(noisy_t_qc, shots=shots)
        noisy_counts = noisy_job.result().get_counts()
        noisy_probabilities = {
            k: round(v / shots, 6) for k, v in sorted(noisy_counts.items())
        }

        runtime_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

        # Coupling map
        coupling_edges: List[List[int]] = []
        if backend.coupling_map:
            coupling_edges = [list(e) for e in backend.coupling_map.get_edges()]

        # Per-qubit properties and gate errors
        qubit_properties = self.extract_qubit_properties(backend)
        gate_errors = self.extract_gate_errors(backend)

        return DigitalTwinSimulationResponse(
            backend_name=backend.name,
            backend_display_name=backend.__class__.__name__,
            qubit_count=backend.num_qubits,
            circuit_qubits=circuit.qubits,
            shots=shots,
            ideal_probabilities=ideal_probabilities,
            noisy_probabilities=noisy_probabilities,
            ideal_counts=ideal_counts,
            noisy_counts=noisy_counts,
            coupling_map=coupling_edges,
            qubit_properties=qubit_properties,
            gate_errors=gate_errors,
            runtime_ms=runtime_ms,
            execution_location="local_python",
            warnings=None,
        )

aer_digital_twin_service = AerDigitalTwinService()
