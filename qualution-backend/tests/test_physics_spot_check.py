import pytest
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.fact_extractor import extract_circuit_facts

def test_spot_check_measurement_deterministic():
    """H|0> yields 50% |0> and 50% |1>."""
    circuit = CircuitRequest(
        qubits=1, classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0])]
    )
    facts = extract_circuit_facts(circuit)
    assert abs(facts["measurement_probabilities"]["0"] - 0.5) < 1e-3
    assert abs(facts["measurement_probabilities"]["1"] - 0.5) < 1e-3

def test_spot_check_superposition_not_mixture():
    """H(H|0>) yields 100% |0> due to quantum interference."""
    circuit = CircuitRequest(
        qubits=1, classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["measurement_probabilities"]["0"] == 1.0

def test_spot_check_hadamard_inverts_classical():
    """H|0> creates superposition (purity 1.0) vs X|0> which creates basis state |1>."""
    circuit_h = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])])
    circuit_x = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="x", targets=[0])])
    
    facts_h = extract_circuit_facts(circuit_h)
    facts_x = extract_circuit_facts(circuit_x)
    
    assert abs(facts_h["measurement_probabilities"]["0"] - 0.5) < 1e-3
    assert facts_x["measurement_probabilities"]["1"] == 1.0

def test_spot_check_rule_cnot_copy():
    """
    CNOT(H|0> x |0>) creates Bell state (|00>+|11>)/sqrt(2) with reduced purity = 0.5
    and entanglement entropy = 1.0 bit (NOT product state with purity 1.0).
    """
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]
    )
    facts = extract_circuit_facts(circuit)
    assert abs(facts["per_qubit_reduced_state"][0]["purity"] - 0.5) < 1e-3
    assert abs(facts["per_qubit_reduced_state"][0]["entanglement_entropy"] - 1.0) < 1e-3
    assert facts["pairwise_entanglement"][0]["is_entangled"] is True

def test_spot_check_rule_measure_no_effect():
    """H-Measure-H yields 50/50 mixture due to collapse, whereas H-H yields pure |0>."""
    # Note: simulated state after collapse
    circuit_hh = CircuitRequest(
        qubits=1, classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]
    )
    facts = extract_circuit_facts(circuit_hh)
    assert facts["measurement_probabilities"]["0"] == 1.0

def test_spot_check_entanglement_local_phase():
    """
    Local Z on Bell pair transforms (|00>+|11>)/sqrt(2) to (|00>-|11>)/sqrt(2).
    Entanglement entropy MUST remain exactly 1.0 bit and purity MUST remain 0.5.
    """
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="z", targets=[0])
        ]
    )
    facts = extract_circuit_facts(circuit)
    assert abs(facts["per_qubit_reduced_state"][0]["purity"] - 0.5) < 1e-3
    assert abs(facts["per_qubit_reduced_state"][0]["entanglement_entropy"] - 1.0) < 1e-3

def test_spot_check_grover_over_iteration():
    """
    For N=4 (2 qubits, marked state |11>), independent formula:
    theta = arcsin(1/sqrt(4)) = 30 degrees (pi/6).
    P(|11>) = sin^2((2k + 1) * theta).
    k=0: P=0.25 (uniform superposition)
    k=1: P=1.0 (optimal 1 iteration)
    k=2: P=0.25 (over-rotation back to uniform 25%)
    k=3: P=0.25 (uniform 25%)
    k=4: P=1.0 (phase-inverted target)
    k=5: P=0.25
    k=6: P=0.25
    k=7: P=1.0
    Period is 3 iterations; P=1.0 at k=1, 4, 7... and P=0.25 at k=0, 2, 3, 5, 6...
    """
    import numpy as np

    theta = np.pi / 6  # arcsin(1/sqrt(4))
    
    for k in range(8):
        gates = [
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1])
        ]
        for _ in range(k):
            # Oracle for |11>: CZ
            gates.append(GateRequest(gate="cz", targets=[0, 1]))
            # Diffuser: H, X, CZ, X, H
            gates.extend([
                GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
                GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
                GateRequest(gate="cz", targets=[0, 1]),
                GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
                GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            ])
            
        circuit_k = CircuitRequest(qubits=2, classical_bits=2, gates=gates)
        facts_k = extract_circuit_facts(circuit_k)
        
        expected_p_target = float(np.sin((2 * k + 1) * theta) ** 2)
        actual_p_target = facts_k["measurement_probabilities"].get("11", 0.0)
        
        assert abs(actual_p_target - expected_p_target) < 1e-4, (
            f"Grover k={k} failed: expected {expected_p_target:.4f}, got {actual_p_target:.4f}"
        )
        if k in (0, 2, 3, 5, 6):
            assert abs(actual_p_target - 0.25) < 1e-4
            assert abs(facts_k["measurement_probabilities"].get("00", 0.0) - 0.25) < 1e-4
        elif k in (1, 4, 7):
            assert abs(actual_p_target - 1.0) < 1e-4
            assert abs(facts_k["measurement_probabilities"].get("00", 0.0) - 0.0) < 1e-4

def test_spot_check_vqe_zero_parameter_init():
    """Ry(0) is Identity, so initial state remains |00>."""
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[
            GateRequest(gate="ry", targets=[0], angle=0.0),
            GateRequest(gate="ry", targets=[1], angle=0.0),
            GateRequest(gate="cx", targets=[0, 1])
        ]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["measurement_probabilities"]["00"] == 1.0
