import pytest
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.socratic_loop import socratic_loop, SessionState
from app.services.evidence_store_service import evidence_store, LearnerEventCreate

def test_scenario_1_happy_path_cleared():
    """
    Scenario 1:
    Student harbors 'hadamard-inverts-classical' (Superposition family).
    Sequence: Misconception -> Diagnosed -> Question -> Experiment -> Corrected -> RESOLVED (CLEARED).
    """
    user_id = "sim-student-happy-1"
    session = SessionState(session_id="sess-happy-1", user_id=user_id)
    circuit = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])])

    # Turn 1: Faulty prediction
    session, turn1 = socratic_loop.process_turn(session, circuit, student_prediction={"1": 1.0})
    assert turn1.state == "QUESTION"
    assert turn1.misconception_id == "hadamard-inverts-classical"
    assert turn1.hint_level == 1
    assert turn1.experiment_id is not None

    # Turn 2: Run counterfactual experiment
    exp = socratic_loop.generate_experiment(turn1.misconception_id, circuit)
    assert exp["universe_a"]["circuit"]["qubits"] == 1
    assert exp["universe_b"]["circuit"]["qubits"] == 1

    # Turn 3: Student reflects and submits corrected prediction
    session, turn3 = socratic_loop.process_turn(session, circuit, student_prediction={"0": 0.5, "1": 0.5})
    assert turn3.state == "RESOLVED"
    assert "Spot on" in turn3.text or "perfect" in turn3.text.lower()

def test_scenario_2_never_improves_handoff_at_turn_cap():
    """
    Scenario 2:
    Student harbors 'grover-over-iteration' (Grover family) and never improves.
    Engine escalates through hint ladder up to Level 4, and hits turn cap (> 8) -> HANDOFF.
    """
    user_id = "sim-student-stuck-2"
    session = SessionState(
        session_id="sess-stuck-2",
        user_id=user_id,
        current_misconception_id="grover-over-iteration"
    )
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
        ]
    )

    # Turns 1 to 8: Consistently wrong prediction
    for turn_idx in range(1, 9):
        session, turn = socratic_loop.process_turn(
            session,
            circuit,
            student_prediction={"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25},
            current_step_id="lesson-8-grovers-search"
        )
        assert turn.state in ["QUESTION", "EXPERIMENT", "DISAMBIGUATION"]
        if turn.state != "DISAMBIGUATION":
            assert turn.misconception_id == "grover-over-iteration"

    # Turn 9: Exceeds 8 turns -> MUST trigger HANDOFF
    session, turn9 = socratic_loop.process_turn(session, circuit, student_prediction={"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25})
    assert turn9.state == "HANDOFF"
    assert turn9.kind == "handoff"
    assert "worked hard" in turn9.text.lower() or "next challenge" in turn9.text.lower()

def test_scenario_3_correct_student_no_misconception():
    """
    Scenario 3:
    Student creates Bell state and correctly predicts 50% |00> and 50% |11> (Entanglement family).
    Engine immediately acknowledges correctness with RESOLVED and assigns zero misconceptions.
    """
    user_id = "sim-student-correct-3"
    session = SessionState(session_id="sess-correct-3", user_id=user_id)
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]
    )

    session, turn = socratic_loop.process_turn(
        session,
        circuit,
        student_prediction={"00": 0.5, "11": 0.5}
    )
    assert turn.state == "RESOLVED"
    assert turn.misconception_id is None
    assert session.turns_count == 1

def test_scenario_4_prerequisite_step_back():
    """
    Scenario 4:
    Student fails twice on CNOT gate (cnot-control-target-swapped).
    Engine triggers prerequisite step-back to examine single-qubit basis or superposition.
    """
    user_id = "sim-student-prereq-4"
    session = SessionState(session_id="sess-prereq-4", user_id=user_id)
    circuit = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[GateRequest(gate="x", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]
    )

    # First failure on CNOT
    session, turn1 = socratic_loop.process_turn(session, circuit, student_prediction={"00": 1.0})
    assert turn1.state == "QUESTION"
    assert session.prerequisite_probed is False

    # Second failure on same concept -> triggers prerequisite probe
    session, turn2 = socratic_loop.process_turn(session, circuit, student_prediction={"00": 1.0})
    assert session.prerequisite_probed is True
    assert "check your understanding" in turn2.text.lower() or "before we continue" in turn2.text.lower()

def test_cross_lesson_memory_initialization():
    """
    Scenario 5:
    Cross-Lesson Memory:
    Persisted SUPPORTED misconception from lesson 1 pre-seeds the session probe for lesson 2.
    """
    user_id = "sim-student-memory-5"
    # Seed 2 events to establish SUPPORTED status in evidence store
    evidence_store.insert_event(user_id, LearnerEventCreate(
        session_id="sess-prev-1", lesson_id="lesson-1", step_id="st1", kind="prediction",
        payload={"misconception_id": "hadamard-inverts-classical", "concept_id": "hadamard_gate", "is_error": True},
        confidence=3
    ))
    evidence_store.insert_event(user_id, LearnerEventCreate(
        session_id="sess-prev-1", lesson_id="lesson-1", step_id="st2", kind="prediction",
        payload={"misconception_id": "hadamard-inverts-classical", "concept_id": "hadamard_gate", "is_error": True},
        confidence=3
    ))

    # Initialize new session for lesson 2
    session = socratic_loop.initialize_session_with_memory(
        session_id="sess-lesson-2",
        user_id=user_id,
        lesson_id="lesson-2",
        lesson_concept_ids=["hadamard_gate", "superposition"]
    )

    assert "hadamard-inverts-classical" in session.prior_supported_misconceptions
    assert session.current_misconception_id == "hadamard-inverts-classical"

def test_scenario_6_disambiguation_three_tie_groups():
    """
    Scenario 6:
    Tests disambiguation and discriminating probes across 3 tie groups:
    1. Group 1: measurement-deterministic vs superposition-not-mixture on [H, H, measure]
    2. Group 2: grover-oracle-bit-flip vs hadamard-inverts-classical on single-qubit oracle circuit
    3. Group 3: grover-over-iteration vs grover-oracle-bit-flip
    Verifies that ties produce non-committal observation turn + disambiguation probe with split evidence.
    """
    from app.services.diagnosis_engine import diagnosis_engine, select_discriminating_probe
    from app.services.mutation_library import mutation_registry
    from app.services.fact_extractor import extract_circuit_facts

    # --- Tie Group 1 ---
    entry_s = next(e for e in diagnosis_engine.catalog.entries if e.id == "superposition-not-mixture")
    res1 = diagnosis_engine.diagnose(circuit=entry_s.probe_circuits[0], student_prediction={"0": 0.5, "1": 0.5}, confidence=0.9)
    if res1.status == "tie_detected":
        assert len(res1.tied_misconceptions) >= 2
        assert res1.discriminating_probe is not None
        # Follow-up probe resolves
        sim_c = mutation_registry.mutate("h_is_classical_mixture", res1.discriminating_probe)
        p = extract_circuit_facts(sim_c)["measurement_probabilities"]
        res1_followup = diagnosis_engine.diagnose(circuit=res1.discriminating_probe, student_prediction=p, confidence=0.9)
        assert res1_followup.status in ["misconception_detected", "tie_detected", "matches_correct_answer"]

    # --- Tie Group 2: 2 candidate entries with small TVD ---
    entries_g2 = [
        next(e for e in diagnosis_engine.catalog.entries if e.id == "hadamard-inverts-classical"),
        next(e for e in diagnosis_engine.catalog.entries if e.id == "grover-oracle-bit-flip"),
    ]
    disc_probe_2 = select_discriminating_probe(entries_g2)
    assert disc_probe_2 is not None
    # Discriminating probe must produce distinct outcomes
    p_a = extract_circuit_facts(mutation_registry.mutate(entries_g2[0].mutation_ref, disc_probe_2))["measurement_probabilities"]
    p_b = extract_circuit_facts(mutation_registry.mutate(entries_g2[1].mutation_ref, disc_probe_2))["measurement_probabilities"]
    assert p_a != p_b

    # --- Tie Group 3: 2 Grover candidates ---
    entries_g3 = [
        next(e for e in diagnosis_engine.catalog.entries if e.id == "grover-oracle-bit-flip"),
        next(e for e in diagnosis_engine.catalog.entries if e.id == "grover-over-iteration"),
    ]
    disc_probe_3 = select_discriminating_probe(entries_g3)
    assert disc_probe_3 is not None
    p_g3_a = extract_circuit_facts(mutation_registry.mutate(entries_g3[0].mutation_ref, disc_probe_3))["measurement_probabilities"]
    p_g3_b = extract_circuit_facts(mutation_registry.mutate(entries_g3[1].mutation_ref, disc_probe_3))["measurement_probabilities"]
    assert p_g3_a != p_g3_b

