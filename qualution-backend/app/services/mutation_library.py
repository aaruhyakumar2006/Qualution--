import copy
from typing import List, Callable, Dict, Any, Optional
from pydantic import BaseModel
from app.schemas.circuit import CircuitRequest, GateRequest

class MutationDefinition(BaseModel):
    id: str
    concept_family: str
    name: str
    description: str

MutationFunction = Callable[[CircuitRequest], CircuitRequest]

class MutationRegistry:
    def __init__(self):
        self._mutations: Dict[str, MutationDefinition] = {}
        self._funcs: Dict[str, MutationFunction] = {}

    def register(self, mutation_id: str, concept_family: str, name: str, description: str, func: MutationFunction):
        definition = MutationDefinition(
            id=mutation_id,
            concept_family=concept_family,
            name=name,
            description=description
        )
        self._mutations[mutation_id] = definition
        self._funcs[mutation_id] = func

    def get_definition(self, mutation_id: str) -> Optional[MutationDefinition]:
        return self._mutations.get(mutation_id)

    def is_applicable(self, mutation_id: str, circuit: CircuitRequest) -> bool:
        func = self._funcs.get(mutation_id)
        if not func:
            return False
        # Check if mutation produces a non-identical circuit
        mutated = func(circuit)
        return mutated.model_dump() != circuit.model_dump()

    def mutate(self, mutation_id: str, circuit: CircuitRequest) -> CircuitRequest:
        func = self._funcs.get(mutation_id)
        if not func:
            raise ValueError(f"Unknown mutation ID: '{mutation_id}'")
        return func(circuit)

    def list_all(self) -> List[MutationDefinition]:
        return list(self._mutations.values())

mutation_registry = MutationRegistry()

# ── 1. swap_cnot_control_target ──────────────────────────────────────────────
def mutate_swap_cnot(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "cx" and len(g.targets) == 2:
            g.targets = [g.targets[1], g.targets[0]]
    return new_circuit

mutation_registry.register(
    mutation_id="swap_cnot_control_target",
    concept_family="cnot_gate",
    name="Swap CNOT Control and Target",
    description="Swaps control and target qubit indices for all CNOT (CX) gates in circuit.",
    func=mutate_swap_cnot
)

# ── 2. replace_h_with_x ──────────────────────────────────────────────────────
def mutate_replace_h_with_x(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "h":
            g.gate = "x"
    return new_circuit

mutation_registry.register(
    mutation_id="replace_h_with_x",
    concept_family="hadamard_gate",
    name="Replace Hadamard with Pauli-X",
    description="Replaces all Hadamard (H) gates with Pauli-X bit-flip gates.",
    func=mutate_replace_h_with_x
)

# ── 3. replace_x_with_h ──────────────────────────────────────────────────────
def mutate_replace_x_with_h(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "x":
            g.gate = "h"
    return new_circuit

mutation_registry.register(
    mutation_id="replace_x_with_h",
    concept_family="single_qubit_gates",
    name="Replace Pauli-X with Hadamard",
    description="Replaces all Pauli-X gates with Hadamard (H) gates.",
    func=mutate_replace_x_with_h
)

# ── 4. drop_gate ─────────────────────────────────────────────────────────────
def mutate_drop_gate(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    if new_circuit.gates:
        # Drop the last quantum gate before measurements
        non_meas = [i for i, g in enumerate(new_circuit.gates) if g.gate != "measure"]
        if non_meas:
            drop_idx = non_meas[-1]
            new_circuit.gates.pop(drop_idx)
    return new_circuit

mutation_registry.register(
    mutation_id="drop_gate",
    concept_family="quantum_gates",
    name="Drop Key Quantum Gate",
    description="Omits the last quantum gate in the circuit.",
    func=mutate_drop_gate
)

# ── 4b. drop_mid_circuit_measurement ─────────────────────────────────────────
def mutate_drop_mid_circuit_measurement(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates student misconception that measurement has no effect (no state vector collapse).
    Removes all mid-circuit measurement gates while keeping final measurements.
    """
    new_circuit = copy.deepcopy(circuit)
    if len(new_circuit.gates) > 1:
        n_gates = len(new_circuit.gates)
        gates_without_mid_meas = []
        for i, g in enumerate(new_circuit.gates):
            if g.gate == "measure" and i < n_gates - 1:
                continue
            gates_without_mid_meas.append(g)
        new_circuit.gates = gates_without_mid_meas
    return new_circuit

mutation_registry.register(
    mutation_id="drop_mid_circuit_measurement",
    concept_family="measurement_collapse",
    name="Omit Mid-Circuit Measurement Collapse",
    description="Omits mid-circuit measurement operations, assuming quantum statevector remains un-collapsed.",
    func=mutate_drop_mid_circuit_measurement
)

# ── 5. ignore_z_phase ────────────────────────────────────────────────────────
def mutate_ignore_z_phase(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    new_circuit.gates = [g for g in new_circuit.gates if g.gate not in ["z", "s", "t", "sdg", "tdg", "p", "cp", "rz"]]
    return new_circuit

mutation_registry.register(
    mutation_id="ignore_z_phase",
    concept_family="phase",
    name="Ignore Z and Phase Shift Gates",
    description="Removes all Z, S, T, Rz, and P phase shift gates from the circuit.",
    func=mutate_ignore_z_phase
)

# ── 6. treat_relative_as_global_phase ────────────────────────────────────────
def mutate_treat_relative_as_global_phase(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    # Replaces relative phase shifts (Z/S/T) with Identity gates
    for g in new_circuit.gates:
        if g.gate in ["z", "s", "t", "sdg", "tdg"]:
            g.gate = "id"
    return new_circuit

mutation_registry.register(
    mutation_id="treat_relative_as_global_phase",
    concept_family="relative_vs_global_phase",
    name="Treat Relative Phase as Global Phase",
    description="Replaces relative phase gates with Identity gates assuming phase is global and unobservable.",
    func=mutate_treat_relative_as_global_phase
)

# ── 7. wrong_grover_oracle_marked_state ──────────────────────────────────────
def mutate_wrong_grover_oracle(circuit: CircuitRequest) -> CircuitRequest:
    """
    Alters the Grover oracle CZ gate to mark wrong state |10> instead of |11>
    by wrapping qubit 0 in an X-gate sandwich (X_0 -> CZ -> X_0).
    """
    new_circuit = copy.deepcopy(circuit)
    cz_gates = [g for g in new_circuit.gates if g.gate == "cz"]
    if cz_gates:
        target_cz = cz_gates[0]
        idx = new_circuit.gates.index(target_cz)
        # Insert X before and after CZ on qubit 0 to flip target state from |11> to |10>
        new_circuit.gates.insert(idx, GateRequest(gate="x", targets=[0]))
        new_circuit.gates.insert(idx + 2, GateRequest(gate="x", targets=[0]))
    return new_circuit

mutation_registry.register(
    mutation_id="wrong_grover_oracle_marked_state",
    concept_family="oracle",
    name="Wrong Grover Oracle Marked State",
    description="Alters oracle phase-flip logic so that an unintended computational basis state is marked.",
    func=mutate_wrong_grover_oracle
)

# ── 8. wrong_grover_iteration_count ──────────────────────────────────────────
def mutate_wrong_grover_iteration_count(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    gates_no_meas = [g for g in new_circuit.gates if g.gate != "measure"]
    meas_gates = [g for g in new_circuit.gates if g.gate == "measure"]
    
    # Find first oracle gate (cz) to separate initial state preparation from iteration loop
    cz_indices = [i for i, g in enumerate(gates_no_meas) if g.gate == "cz"]
    if cz_indices:
        first_cz = cz_indices[0]
        init_gates = gates_no_meas[:first_cz]
        iter_gates = gates_no_meas[first_cz:]
        new_circuit.gates = init_gates + iter_gates + copy.deepcopy(iter_gates) + meas_gates
    else:
        return circuit
    return new_circuit

mutation_registry.register(
    mutation_id="wrong_grover_iteration_count",
    concept_family="grovers_search",
    name="Over-Iterate Grover Search Loop",
    description="Doubles the number of Grover iteration steps (Oracle + Diffuser), causing over-rotation away from target state.",
    func=mutate_wrong_grover_iteration_count
)

# ── 9. bad_vqe_parameter_init ────────────────────────────────────────────────
def mutate_bad_vqe_parameter_init(circuit: CircuitRequest) -> CircuitRequest:
    new_circuit = copy.deepcopy(circuit)
    # Resets all rotation angles to 0.0
    for g in new_circuit.gates:
        if g.angle is not None:
            g.angle = 0.0
    return new_circuit

mutation_registry.register(
    mutation_id="bad_vqe_parameter_init",
    concept_family="vqe_parameterization",
    name="Bad VQE Zero-Parameter Initialization",
    description="Sets all rotation gate angles theta to 0.0, trapping optimization at zero-gradient initialization point.",
    func=mutate_bad_vqe_parameter_init
)

# ── 10. cnot_copies_state_product ────────────────────────────────────────────
def mutate_cnot_copies_state_product(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates the classical copying misconception for CNOT(control, target).
    Instead of entangling control and target into Bell state (|00>+|11>)/sqrt(2),
    it simulates producing an unentangled product state (|0>+|1>)/sqrt(2) x (|0>+|1>)/sqrt(2)
    by replacing CNOT with a Hadamard gate on the target qubit.
    """
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "cx" and len(g.targets) == 2:
            # Replace CX with H on target qubit
            g.gate = "h"
            g.targets = [g.targets[1]]
    return new_circuit

mutation_registry.register(
    mutation_id="cnot_copies_state_product",
    concept_family="cnot_gate",
    name="CNOT Copies State to Target (Product State)",
    description="Simulates CNOT creating an independent product state copy on target qubit rather than an entangled Bell state.",
    func=mutate_cnot_copies_state_product
)

# ── 11. h_is_classical_mixture ─────────────────────────────────────────────
def mutate_h_is_classical_mixture(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates student misconception that Hadamard produces a classical random mixture.
    Applying H twice to |0> leaves a 50/50 mixture rather than interfering back to |0>.
    Replaces H -> H sequence with a single H gate.
    """
    new_circuit = copy.deepcopy(circuit)
    seen_h = set()
    filtered_gates = []
    for g in new_circuit.gates:
        if g.gate == "h" and len(g.targets) > 0:
            q = g.targets[0]
            if q in seen_h:
                continue
            seen_h.add(q)
        filtered_gates.append(g)
    new_circuit.gates = filtered_gates
    return new_circuit

mutation_registry.register(
    mutation_id="h_is_classical_mixture",
    concept_family="superposition",
    name="Hadamard as Classical Mixture (No Interference)",
    description="Simulates Hadamard as producing a persistent 50/50 classical mixture without destructive/constructive phase interference.",
    func=mutate_h_is_classical_mixture
)

# ── 12. replace_cz_with_cx ─────────────────────────────────────────────────
def mutate_replace_cz_with_cx(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates using a bit-flip (CNOT) instead of a phase-flip (CZ) for a Grover oracle.
    Replaces all CZ gates with CX (CNOT) gates.
    """
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "cz" and len(g.targets) == 2:
            g.gate = "cx"
    return new_circuit

mutation_registry.register(
    mutation_id="replace_cz_with_cx",
    concept_family="oracle",
    name="Replace CZ Phase Oracle with CX Bit-Flip",
    description="Replaces controlled-Z phase flip oracle gates with controlled-X bit flip gates without phase kickback.",
    func=mutate_replace_cz_with_cx
)

# ── 13. replace_cz_with_single_z ───────────────────────────────────────────
def mutate_replace_cz_with_single_z(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates belief that applying single-qubit Z to qubit 0 is sufficient to mark
    multi-qubit state |11> instead of multi-qubit controlled-phase (CZ).
    """
    new_circuit = copy.deepcopy(circuit)
    for g in new_circuit.gates:
        if g.gate == "cz" and len(g.targets) >= 1:
            g.gate = "z"
            g.targets = [g.targets[0]]
    return new_circuit

mutation_registry.register(
    mutation_id="replace_cz_with_single_z",
    concept_family="oracle",
    name="Replace Controlled-Z Oracle with Single-Qubit Z",
    description="Replaces CZ multi-qubit phase oracle with a single-qubit Z gate on qubit 0.",
    func=mutate_replace_cz_with_single_z
)

# ── 14. cnot_oracle_omit_target_h ──────────────────────────────────────────
def mutate_cnot_oracle_omit_target_h(circuit: CircuitRequest) -> CircuitRequest:
    """
    Simulates omitting the Hadamard gate on the target ancilla qubit before CNOT in oracle.
    """
    new_circuit = copy.deepcopy(circuit)
    cx_gates = [g for g in new_circuit.gates if g.gate == "cx" and len(g.targets) == 2]
    if cx_gates:
        cx_target = cx_gates[0].targets[1]
        cx_idx = new_circuit.gates.index(cx_gates[0])
        h_to_remove = None
        for i in range(cx_idx - 1, -1, -1):
            g = new_circuit.gates[i]
            if g.gate == "h" and cx_target in g.targets:
                h_to_remove = i
                break
        if h_to_remove is not None:
            new_circuit.gates.pop(h_to_remove)
    return new_circuit

mutation_registry.register(
    mutation_id="cnot_oracle_omit_target_h",
    concept_family="oracle",
    name="Omit Ancilla Target Hadamard Before CNOT in Oracle",
    description="Omits the preparatory Hadamard on the target ancilla qubit before CNOT in phase kickback oracle.",
    func=mutate_cnot_oracle_omit_target_h
)
