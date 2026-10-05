import pytest
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.socratic_loop import socratic_loop, SessionState
from app.services.turn_validator import validate_turn_text

def test_turn_validator_rules():
    """Verifies that validate_turn_text enforces all pedagogical & security constraints."""
    # 1. Valid turn text
    res = validate_turn_text(
        text="Mario: What happens to the probability when Hadamard is applied?",
        hint_level=1,
        misconception_name="Hadamard Inverts Classical",
        facts_used=[{"0": 0.5, "1": 0.5}]
    )
    assert res.is_valid is True

    # 2. Reject multiple question marks
    res_q = validate_turn_text(
        text="Mario: What is this? Why did it change?",
        hint_level=1
    )
    assert res_q.is_valid is False
    assert any("question marks" in issue for issue in res_q.issues)

    # 3. Reject word limit (> 40 words)
    long_text = "Mario: " + "word " * 45 + "?"
    res_w = validate_turn_text(text=long_text, hint_level=1)
    assert res_w.is_valid is False
    assert any("word limit" in issue for issue in res_w.issues)

    # 4. Reject misconception name leakage below Level 4
    res_leak = validate_turn_text(
        text="Mario: You have the Hadamard Inverts Classical misconception?",
        hint_level=2,
        misconception_name="Hadamard Inverts Classical"
    )
    assert res_leak.is_valid is False
    assert any("Leaked misconception" in issue for issue in res_leak.issues)

    # 5. Grounding check for numbers in text
    res_num = validate_turn_text(
        text="Mario: Did you expect 99.9% probability?",
        hint_level=1,
        facts_used=[{"0": 0.5, "1": 0.5}]
    )
    assert res_num.is_valid is False
    assert any("not found in facts_used" in issue for issue in res_num.issues)

def test_socratic_loop_correct_student():
    """Correct student yields RESOLVED state with encouragement turn."""
    session = SessionState(session_id="s-corr", user_id="u-corr")
    circuit = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])])
    
    sess, turn = socratic_loop.process_turn(
        session=session,
        circuit=circuit,
        student_prediction={"0": 0.5, "1": 0.5}
    )
    assert turn.state == "RESOLVED"
    assert turn.kind == "encouragement"

def test_socratic_loop_misconception_end_to_end_4_entries():
    """
    Simulates end-to-end student trajectory for 4 misconceptions across 3 concept families:
    1. hadamard-inverts-classical (superposition)
    2. cnot-control-target-swapped (cnot)
    3. wrong-grover-oracle-marked-state (oracle)
    4. grover-over-iteration (grover)
    """
    circuits_and_predictions = [
        ("hadamard-inverts-classical", CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])]), {"1": 1.0}),
        ("cnot-control-target-swapped", CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]), {"10": 1.0}),
        ("wrong-grover-oracle-marked-state", CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]), GateRequest(gate="cz", targets=[0, 1])]), {"10": 1.0}),
        ("grover-over-iteration", CircuitRequest(qubits=2, classical_bits=2, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]), GateRequest(gate="cz", targets=[0, 1]), GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]), GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]), GateRequest(gate="cz", targets=[0, 1]), GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]), GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]), {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25})
    ]

    for misc_id, circ, faulty_pred in circuits_and_predictions:
        session = SessionState(session_id=f"sess-{misc_id}", user_id=f"usr-{misc_id}")
        
        # Turn 1: Initial faulty prediction -> QUESTION or DISAMBIGUATION (Level 1)
        sess, turn1 = socratic_loop.process_turn(session, circ, faulty_pred)
        assert turn1.state in ["QUESTION", "DISAMBIGUATION"]
        assert turn1.hint_level >= 1

        # Turn 2: Second failure triggers Prerequisite Step-Back or escalation
        sess, turn2 = socratic_loop.process_turn(sess, circ, faulty_pred)
        assert turn2.state in ["QUESTION", "DISAMBIGUATION"]
        assert sess.prerequisite_probed is True or turn2.state == "DISAMBIGUATION"

        # Turn 3: Hint Level increases to Level 2 (or remains in DISAMBIGUATION)
        sess, turn3 = socratic_loop.process_turn(sess, circ, faulty_pred)
        assert turn3.hint_level == 2 or turn3.state == "DISAMBIGUATION"

        # Experiment generation
        exp_diff = socratic_loop.generate_experiment(misc_id, circ)
        assert exp_diff["universe_a"]["label"] == "Universe A (Original)"
        assert exp_diff["universe_b"]["label"] == "Universe B (Variant)"
        assert "diff_summary" in exp_diff

def test_socratic_loop_turn_cap_handoff():
    """Asserts that after 8 turns on same misconception, Mario hands off to next topic."""
    session = SessionState(session_id="s-cap", user_id="u-cap")
    circuit = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])])
    faulty_pred = {"1": 1.0}

    for _ in range(8):
        session, turn = socratic_loop.process_turn(session, circuit, faulty_pred)

    # 9th turn triggers turn cap HANDOFF
    session, turn_handoff = socratic_loop.process_turn(session, circuit, faulty_pred)
    assert turn_handoff.state == "HANDOFF"
    assert turn_handoff.kind == "handoff"
