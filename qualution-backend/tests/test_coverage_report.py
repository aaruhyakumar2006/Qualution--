import json
import copy
import numpy as np
from pathlib import Path

from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts
from app.services.diagnosis_engine import compute_tvd

LESSON_CIRCUITS = {
    "Hadamard Superposition (|0> -> |+>)": {
        "lesson_id": "superposition-checkpoint-1",
        "circuit": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])]),
        "concepts": ["hadamard_gate", "superposition", "measurement_collapse"]
    },
    "Two Hadamard Interference (H-H |0>)": {
        "lesson_id": "superposition-checkpoint-2",
        "circuit": CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]),
        "concepts": ["hadamard_gate", "quantum_interference"]
    },
    "Bell State Entanglement (H-CX)": {
        "lesson_id": "grover-oracle",
        "circuit": CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]),
        "concepts": ["cnot_gate", "entanglement"]
    },
    "2-Qubit Grover Superposition (H-H)": {
        "lesson_id": "grover-step-1",
        "circuit": CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]),
        "concepts": ["multi_qubit_systems", "hadamard_gate"]
    },
    "2-Qubit Grover Oracle (H-H-CZ)": {
        "lesson_id": "grover-step-3",
        "circuit": CircuitRequest(qubits=2, classical_bits=2, gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1])
        ]),
        "concepts": ["oracle", "phase_kickback", "phase"]
    },
    "Full 2-Qubit Grover Circuit": {
        "lesson_id": "grover-run",
        "circuit": CircuitRequest(qubits=2, classical_bits=2, gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1]),
            GateRequest(gate="x", targets=[0]),
            GateRequest(gate="x", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="x", targets=[0]),
            GateRequest(gate="x", targets=[1]),
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1])
        ]),
        "concepts": ["grovers_search", "oracle", "diffuser"]
    }
}

def test_coverage_report_totals_add_up():
    """
    Recomputes coverage report metrics for all lesson circuits and asserts that
    diagnosable + indistinguishable equals the total number of registered mutations for every row.
    """
    all_mutations = mutation_registry.list_all()
    total_mutations_count = len(all_mutations)

    for circ_name, info in LESSON_CIRCUITS.items():
        circuit = info["circuit"]
        correct_facts = extract_circuit_facts(circuit)
        correct_z = correct_facts["measurement_probabilities"]
        correct_sv = np.array([amp["amplitude_real"] + 1j * amp["amplitude_imag"] for amp in correct_facts["statevector"]])
        
        probe_h = copy.deepcopy(circuit)
        for q in range(circuit.qubits):
            probe_h.gates.append(GateRequest(gate="h", targets=[q]))
        correct_h = extract_circuit_facts(probe_h)["measurement_probabilities"]
        
        probe_y = copy.deepcopy(circuit)
        for q in range(circuit.qubits):
            probe_y.gates.append(GateRequest(gate="rx", targets=[q], angle=1.5707963267948966))
        correct_y = extract_circuit_facts(probe_y)["measurement_probabilities"]

        diagnosable = 0
        indistinguishable = 0

        for m in all_mutations:
            m_id = m.id
            if not mutation_registry.is_applicable(m_id, circuit):
                indistinguishable += 1
                continue

            mutated = mutation_registry.mutate(m_id, circuit)
            mutated_facts = extract_circuit_facts(mutated)
            mutated_z = mutated_facts["measurement_probabilities"]
            tvd_z = compute_tvd(correct_z, mutated_z)

            mutated_sv = np.array([amp["amplitude_real"] + 1j * amp["amplitude_imag"] for amp in mutated_facts["statevector"]])
            fidelity_diff = round(1.0 - abs(np.vdot(correct_sv, mutated_sv))**2, 6)

            mutated_h_circ = mutation_registry.mutate(m_id, probe_h)
            tvd_h = compute_tvd(correct_h, extract_circuit_facts(mutated_h_circ)["measurement_probabilities"])

            mutated_y_circ = mutation_registry.mutate(m_id, probe_y)
            tvd_y = compute_tvd(correct_y, extract_circuit_facts(mutated_y_circ)["measurement_probabilities"])

            if tvd_z > 0.05 or tvd_h > 0.05 or tvd_y > 0.05 or fidelity_diff > 0.05:
                diagnosable += 1
            else:
                indistinguishable += 1

        assert diagnosable + indistinguishable == total_mutations_count, f"Totals mismatch for {circ_name}"
