import copy
from app.services.diagnosis_engine import diagnosis_engine, compute_tvd
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts
from app.schemas.circuit import CircuitRequest, GateRequest

entries = diagnosis_engine.catalog.entries
n = len(entries)

# Build a comprehensive pool of small test circuits (qubits <= 2)
pool = []

# Add each entry's own probe circuits
for e in entries:
    pool.extend(e.probe_circuits)

# Add standard canonical discrimination circuits
pool.extend([
    # 1. Single H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])]),
    # 2. H -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 3. X -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="x", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 4. H -> Z -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="z", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 5. Bell state: H(0) -> CX(0,1)
    CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]),
    # 6. Bell state with Z: H(0) -> CX(0,1) -> Z(0) -> H(0), H(1)
    CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]), GateRequest(gate="z", targets=[0]), GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]),
    # 7. Grover 1-iteration
    CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="cz", targets=[0, 1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
        GateRequest(gate="cz", targets=[0, 1]),
        GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
    ]),
    # 8. Mid-circuit measurement: H -> Measure -> H
    CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="measure", targets=[0]), GateRequest(gate="h", targets=[0])]),
    # 9. VQE parameterized rotation: Ry(1.57) -> Ry(1.57) -> CX
    CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="ry", targets=[0], angle=1.5708),
        GateRequest(gate="ry", targets=[1], angle=1.5708),
        GateRequest(gate="cx", targets=[0, 1]),
    ])
])

def get_sim_distribution(mutation_ref: str, circuit: CircuitRequest):
    try:
        mut_c = mutation_registry.mutate(mutation_ref, circuit)
        facts = extract_circuit_facts(mut_c)
        if facts["status"] == "success":
            return facts["measurement_probabilities"]
    except Exception:
        pass
    return None

print(f"Loaded {len(pool)} probe circuits in pool.")
