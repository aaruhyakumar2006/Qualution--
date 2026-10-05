import copy
from app.services.diagnosis_engine import diagnosis_engine
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts
from app.schemas.circuit import CircuitRequest, GateRequest

entries = diagnosis_engine.catalog.entries
print(f"Total entries: {len(entries)}")

# Test pool of discriminating probe circuits:
probe_pool = [
    # 1-qubit H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])]),
    # 1-qubit H -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 1-qubit X -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="x", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 1-qubit H -> Z -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="z", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 1-qubit H -> S -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="s", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 2-qubit Bell pair: H(0) -> CX(0,1)
    CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]),
    # 2-qubit Bell pair with local Z: H(0) -> CX(0,1) -> Z(0) -> H(0), H(1)
    CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]), GateRequest(gate="z", targets=[0]), GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]),
    # 2-qubit CZ Grover step: H(0), H(1) -> CZ(0,1) -> H(0), H(1)
    CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]), GateRequest(gate="cz", targets=[0, 1]), GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]),
    # 2-qubit Full Grover 1-iter:
    CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="cz", targets=[0, 1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
        GateRequest(gate="cz", targets=[0, 1]),
        GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
    ]),
    # Mid-circuit measurement: H(0) -> Measure(0) -> H(0)
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="measure", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # VQE Ry-CX-Ry ansatz
    CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="ry", targets=[0], angle=1.5708),
        GateRequest(gate="ry", targets=[1], angle=1.5708),
        GateRequest(gate="cx", targets=[0, 1]),
    ])
]

print(f"Generated probe pool size: {len(probe_pool)}")
