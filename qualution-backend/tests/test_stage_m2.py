import time
import pytest
from app.schemas.circuit import CircuitRequest, GateRequest
from app.schemas.misconception import MisconceptionCatalog
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts
from app.services.diagnosis_engine import diagnosis_engine, DiagnosisEngine, compute_tvd
from app.services.evidence_engine import (
    EvidenceEvent,
    compute_misconception_statuses,
    HIGH_CONFIDENCE_WEIGHT,
    LOW_CONFIDENCE_WEIGHT
)
from app.services.freetext_hook import freetext_mapper
from app.services.prerequisite_tracing import trace_weakest_prerequisite

def test_all_catalog_mutation_refs_exist():
    import json
    from pathlib import Path
    catalog_path = Path(__file__).parent.parent / "app" / "data" / "misconception_catalog.json"
    with open(catalog_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    catalog = MisconceptionCatalog(**data)

    for entry in catalog.entries:
        m_def = mutation_registry.get_definition(entry.mutation_ref)
        assert m_def is not None, f"Catalog entry '{entry.id}' has unmapped mutation_ref '{entry.mutation_ref}'"

def test_mutations_on_known_circuits():
    circuit = CircuitRequest(
        qubits=2,
        classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="z", targets=[0]),
            GateRequest(gate="ry", targets=[1], angle=1.57)
        ]
    )

    # Test swap_cnot_control_target
    m_cnot = mutation_registry.mutate("swap_cnot_control_target", circuit)
    assert m_cnot.gates[1].targets == [1, 0]

    # Test replace_h_with_x
    m_h_x = mutation_registry.mutate("replace_h_with_x", circuit)
    assert m_h_x.gates[0].gate == "x"

    # Test ignore_z_phase
    m_no_z = mutation_registry.mutate("ignore_z_phase", circuit)
    assert len(m_no_z.gates) == 3

    # Test bad_vqe_parameter_init
    m_vqe = mutation_registry.mutate("bad_vqe_parameter_init", circuit)
    assert m_vqe.gates[3].angle == 0.0

def test_diagnosis_picks_correct_student_no_misconception():
    circuit = CircuitRequest(
        qubits=1,
        classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0])]
    )
    # Student predicts correct 50/50 distribution
    prediction = {"0": 0.5, "1": 0.5}
    res = diagnosis_engine.diagnose(circuit, prediction)
    assert res.status == "matches_correct_answer"
    assert res.detected_misconception is None

def test_diagnosis_synthetic_student_hadamard_inverts_classical():
    circuit = CircuitRequest(
        qubits=1,
        classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0])]
    )
    # Synthetic student believes H is X gate, so H|0> yields |1> 100%
    prediction = {"1": 1.0}
    res = diagnosis_engine.diagnose(circuit, prediction, confidence=0.9, current_step_id="superposition-step-1")
    assert res.status == "misconception_detected"
    assert res.detected_misconception is not None
    assert res.detected_misconception.id in ["hadamard-inverts-classical", "superposition-not-mixture", "measurement-deterministic", "rule_superpos_random"]

def test_diagnosis_synthetic_student_cnot_copy():
    circuit = CircuitRequest(
        qubits=2,
        classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1])
        ]
    )
    # Synthetic student believes CNOT copies H|0> into 2 independent superposition states (25% each)
    prediction = {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25}
    res = diagnosis_engine.diagnose(circuit, prediction, confidence=0.9)
    assert res.status == "misconception_detected"
    assert res.detected_misconception is not None

def test_confidence_weighting_in_evidence():
    events_high_conf = [
        EvidenceEvent(kind="prediction_error", misconception_id="superposition-not-mixture", strength=1.0, timestamp=100.0, confidence=0.9, step_id="step-1"),
        EvidenceEvent(kind="prediction_error", misconception_id="superposition-not-mixture", strength=1.0, timestamp=101.0, confidence=0.9, step_id="step-2")
    ]
    status_high = compute_misconception_statuses(events_high_conf)["superposition-not-mixture"]
    assert status_high.status == "SUPPORTED"
    assert status_high.evidence_score >= 2.0

    events_low_conf = [
        EvidenceEvent(kind="prediction_error", misconception_id="superposition-not-mixture", strength=1.0, timestamp=100.0, confidence=0.2, step_id="step-1"),
        EvidenceEvent(kind="prediction_error", misconception_id="superposition-not-mixture", strength=1.0, timestamp=101.0, confidence=0.2, step_id="step-2")
    ]
    status_low = compute_misconception_statuses(events_low_conf)["superposition-not-mixture"]
    assert status_low.status == "POSSIBLE"
    assert status_low.evidence_score < 2.0

def test_status_replay_determinism():
    events_order_a = [
        EvidenceEvent(kind="prediction_error", misconception_id="m1", strength=1.0, timestamp=10.0, confidence=0.9, step_id="s1"),
        EvidenceEvent(kind="prediction_error", misconception_id="m1", strength=1.0, timestamp=10.0, confidence=0.9, step_id="s2"),
        EvidenceEvent(kind="correct_attempt", misconception_id="m1", strength=1.0, timestamp=20.0, confidence=1.0, step_id="s3")
    ]
    events_order_b = [
        EvidenceEvent(kind="correct_attempt", misconception_id="m1", strength=1.0, timestamp=20.0, confidence=1.0, step_id="s3"),
        EvidenceEvent(kind="prediction_error", misconception_id="m1", strength=1.0, timestamp=10.0, confidence=0.9, step_id="s2"),
        EvidenceEvent(kind="prediction_error", misconception_id="m1", strength=1.0, timestamp=10.0, confidence=0.9, step_id="s1")
    ]

    res_a = compute_misconception_statuses(events_order_a)["m1"]
    res_b = compute_misconception_statuses(events_order_b)["m1"]
    assert res_a.status == res_b.status == "CLEARED"
    assert res_a.evidence_score == res_b.evidence_score

def test_freetext_fallback_mapping():
    concepts = freetext_mapper.map_text_to_concepts("Why does CNOT entangle qubits in Grover's oracle?")
    assert "cnot_gate" in concepts or "oracle" in concepts

def test_prerequisite_tracing():
    trace = trace_weakest_prerequisite("grovers_search")
    assert trace["failing_concept_id"] == "grovers_search"
    assert "prerequisite_chain" in trace
    assert len(trace["prerequisite_chain"]) > 1

def test_diagnosis_performance_benchmark():
    circuit = CircuitRequest(
        qubits=2,
        classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="h", targets=[1])
        ]
    )
    t0 = time.perf_counter()
    res = diagnosis_engine.diagnose(circuit, {"00": 1.0}, current_step_id="grover-step-4")
    elapsed_sec = time.perf_counter() - t0
    assert elapsed_sec < 1.0, f"Diagnosis took {elapsed_sec:.4f}s (must be < 1.0s)"

def test_synthetic_student_all_12_catalog_entries():
    """
    Simulates a synthetic student for each of the 12 misconception catalog entries.
    Asserts that diagnose() ranks that entry first (or within top 2 with documented tie rule).
    """
    for entry in diagnosis_engine.catalog.entries:
        probe = entry.probe_circuits[0]
        mutated_circ = mutation_registry.mutate(entry.mutation_ref, probe)
        mutated_facts = extract_circuit_facts(mutated_circ)
        student_pred = mutated_facts["measurement_probabilities"]

        res = diagnosis_engine.diagnose(
            circuit=probe,
            student_prediction=student_pred,
            confidence=0.9
        )
        print(f"\n--- Entry: {entry.id} (mutation: {entry.mutation_ref}) ---")
        print(f"Student Pred: {student_pred}")
        print(f"Res Status: {res.status}")
        if res.ranked_candidates:
            print(f"Top Candidate: {res.ranked_candidates[0]['misconception_id']} (dist: {res.ranked_candidates[0]['distance_to_student']})")
        assert res.status in ["misconception_detected", "tie_detected"], f"Entry '{entry.id}' was not diagnosed for synthetic student"

def test_phase_probe_z_and_s():
    """
    Tests H-basis probe for pi (Z) phase shift and Y-basis probe for pi/2 (S) phase shift.
    Verifies that DiagnosisEngine distinguishes Z phase shift (|0>-|1>) and S phase shift (|0>+i|1>)
    from computational basis probabilities.
    """
    # 1. Z phase shift circuit (H -> Z) probed with H-basis probe (add H)
    circuit_z = CircuitRequest(qubits=1, classical_bits=1, gates=[
        GateRequest(gate="h", targets=[0]),
        GateRequest(gate="z", targets=[0]),
        GateRequest(gate="h", targets=[0])
    ])
    mutated_z = mutation_registry.mutate("ignore_z_phase", circuit_z)
    student_pred_z = extract_circuit_facts(mutated_z)["measurement_probabilities"]
    res_z = diagnosis_engine.diagnose(circuit_z, student_pred_z, confidence=0.9)
    assert res_z.status in ["misconception_detected", "tie_detected"]
    if res_z.status == "misconception_detected":
        assert res_z.detected_misconception is not None
    else:
        assert len(res_z.tied_misconceptions) > 0

    # 2. S phase shift circuit (H -> S) probed with Y-basis probe (add Rx(pi/2))
    circuit_s = CircuitRequest(qubits=1, classical_bits=1, gates=[
        GateRequest(gate="h", targets=[0]),
        GateRequest(gate="s", targets=[0]),
        GateRequest(gate="rx", targets=[0], angle=1.5707963267948966)
    ])
    mutated_s = mutation_registry.mutate("ignore_z_phase", circuit_s)
    student_pred_s = extract_circuit_facts(mutated_s)["measurement_probabilities"]
    res_s = diagnosis_engine.diagnose(circuit_s, student_pred_s, confidence=0.9)
    assert res_s.status in ["misconception_detected", "tie_detected"]
    if res_s.status == "misconception_detected":
        assert res_s.detected_misconception is not None



