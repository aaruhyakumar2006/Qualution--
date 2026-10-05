import copy
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.fact_extractor import extract_circuit_facts
from app.services.diagnosis_engine import compute_tvd

# Let's inspect pairwise discrimination between key pairs
# Define Discriminating Probes
probes = {
    "single_h": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])]),
    "double_h": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]),
    "x_then_h": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="x", targets=[0]), GateRequest(gate="h", targets=[0])]),
    "h_z_h": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="z", targets=[0]), GateRequest(gate="h", targets=[0])]),
    "bell": CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]),
    "bell_z": CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]),
        GateRequest(gate="z", targets=[0]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
    ]),
    "grover_step": CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="cz", targets=[0, 1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
    ]),
    "cnot_target_h": CircuitRequest(qubits=2, classical_bits=2, gates=[
        GateRequest(gate="x", targets=[1]), GateRequest(gate="h", targets=[1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]),
        GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
    ])
}

from app.services.mutation_library import mutation_registry
from app.services.diagnosis_engine import diagnosis_engine

entries = diagnosis_engine.catalog.entries
print(f"Catalog entries ({len(entries)}):")
for e in entries:
    print(f" - {e.id}: mut={e.mutation_ref}")

print("\n--- Discrimination Matrix: For each pair of entries, find max TVD across probe pool ---")
pairs_discriminated = {}
for i, e1 in enumerate(entries):
    for j, e2 in enumerate(entries):
        if i >= j:
            continue
        pair_key = f"{e1.id} vs {e2.id}"
        best_tvd = 0.0
        best_probe = None
        for pname, p in probes.items():
            try:
                # Only if at least one mutation is applicable
                app1 = mutation_registry.is_applicable(e1.mutation_ref, p)
                app2 = mutation_registry.is_applicable(e2.mutation_ref, p)
                if not app1 and not app2:
                    continue
                c1 = mutation_registry.mutate(e1.mutation_ref, p)
                c2 = mutation_registry.mutate(e2.mutation_ref, p)
                f1 = extract_circuit_facts(c1)
                f2 = extract_circuit_facts(c2)
                if f1["status"] == "success" and f2["status"] == "success":
                    tvd = compute_tvd(f1["measurement_probabilities"], f2["measurement_probabilities"])
                    if tvd > best_tvd:
                        best_tvd = tvd
                        best_probe = pname
            except Exception:
                pass
        pairs_discriminated[pair_key] = (best_tvd, best_probe)

print(f"Total pairs: {len(pairs_discriminated)}")
indistinguishable = []
for k, (tvd, p) in pairs_discriminated.items():
    if tvd < 0.20:
        indistinguishable.append(k)
        print(f"  [TIED/INDISTINGUISHABLE] {k} -> max TVD = {tvd}")
    else:
        print(f"  [DISCRIMINATED] {k} -> TVD = {tvd:.2f} using probe '{p}'")

print(f"\nIndistinguishable pairs count: {len(indistinguishable)}")

