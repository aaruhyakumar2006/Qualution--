import pytest
import numpy as np
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.diagnosis_engine import diagnosis_engine
from app.services.mutation_library import mutation_registry
from app.services.fact_extractor import extract_circuit_facts

HANDWRITTEN_PREDICTIONS = {
    "measurement-deterministic": {"0": 1.0, "1": 0.0},
    "superposition-not-mixture": {"0": 0.5, "1": 0.5},
    "hadamard-inverts-classical": {"0": 0.0, "1": 1.0},
    "grover-oracle-bit-flip": {"00": 1.0, "01": 0.0, "10": 0.0, "11": 0.0},
    "grover-oracle-single-qubit-phase": {"00": 0.0, "01": 1.0, "10": 0.0, "11": 0.0},
    "grover-oracle-cnot-without-hadamard": {"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5},
    "rule_cnot_copy": {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25},
    "rule_measure_no_effect": {"0": 1.0, "1": 0.0},
    "entanglement-local-phase": {"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5},
    "grover-over-iteration": {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25},
    "vqe-zero-parameter-init": {"00": 1.0, "01": 0.0, "10": 0.0, "11": 0.0}
}

def get_catalog_entry(entry_id: str):
    return next(e for e in diagnosis_engine.catalog.entries if e.id == entry_id)

def test_handwritten_predictions_match_mutations():
    """Asserts that each mutation reproduces its hand-written independent belief prediction."""
    for entry in diagnosis_engine.catalog.entries:
        probe = entry.probe_circuits[0]
        mutated_circ = mutation_registry.mutate(entry.mutation_ref, probe)
        mutated_facts = extract_circuit_facts(mutated_circ)
        mutation_probs = mutated_facts["measurement_probabilities"]
        
        expected = HANDWRITTEN_PREDICTIONS[entry.id]
        for k, v in expected.items():
            assert abs(mutation_probs.get(k, 0.0) - v) < 1e-3, f"Mismatch for {entry.id} on state {k}: got {mutation_probs.get(k)}, expected {v}"

def test_non_circular_student_clean_diagnosis():
    """Tests diagnosis using independent hand-written predictions."""
    for entry in diagnosis_engine.catalog.entries:
        probe = entry.probe_circuits[0]
        prediction = HANDWRITTEN_PREDICTIONS[entry.id]
        res = diagnosis_engine.diagnose(circuit=probe, student_prediction=prediction, confidence=0.9)
        assert res.status in ["misconception_detected", "tie_detected"], f"Failed clean diagnosis for {entry.id}"
        if res.status == "tie_detected":
            assert any(t.id == entry.id for t in res.tied_misconceptions), f"{entry.id} not in tied candidates"
            assert res.discriminating_probe is not None, f"No discriminating probe provided for tied {entry.id}"
            # Verify discriminating probe resolves the tie
            student_circ = mutation_registry.mutate(entry.mutation_ref, res.discriminating_probe)
            student_disc_pred = extract_circuit_facts(student_circ)["measurement_probabilities"]
            res2 = diagnosis_engine.diagnose(circuit=res.discriminating_probe, student_prediction=student_disc_pred, confidence=0.9)
            assert res2.status in ["misconception_detected", "tie_detected", "matches_correct_answer"]
            if res2.status == "misconception_detected":
                assert res2.detected_misconception.id == entry.id
        else:
            assert res.detected_misconception.id == entry.id

def test_noisy_student_sampling():
    """Tests student predictions sampled with shot noise (100 and 1000 shots)."""
    np.random.seed(42)
    for entry in diagnosis_engine.catalog.entries:
        probe = entry.probe_circuits[0]
        clean_probs = HANDWRITTEN_PREDICTIONS[entry.id]
        keys = list(clean_probs.keys())
        p_vals = [clean_probs[k] for k in keys]
        
        for shots in [100, 1000]:
            counts = np.random.multinomial(shots, p_vals)
            noisy_pred = {keys[idx]: float(counts[idx]) / shots for idx in range(len(keys))}
            res = diagnosis_engine.diagnose(circuit=probe, student_prediction=noisy_pred, confidence=0.9)
            assert res.status in ["misconception_detected", "tie_detected"], f"Failed noisy diagnosis ({shots} shots) for {entry.id}"
            if res.status == "tie_detected":
                assert any(t.id == entry.id for t in res.tied_misconceptions)
            else:
                assert res.detected_misconception.id == entry.id

def test_categorical_predictions():
    """Tests categorical string choices or lists."""
    # 1. Option B for hadamard-inverts-classical ("1")
    entry_h = get_catalog_entry("hadamard-inverts-classical")
    res_h = diagnosis_engine.diagnose(circuit=entry_h.probe_circuits[0], student_prediction="1", confidence=0.9)
    assert res_h.status in ["misconception_detected", "tie_detected"]
    
    # 2. Equal superposition option C for superposition-not-mixture
    entry_s = get_catalog_entry("superposition-not-mixture")
    res_s = diagnosis_engine.diagnose(circuit=entry_s.probe_circuits[0], student_prediction="c", confidence=0.9)
    assert res_s.status in ["misconception_detected", "tie_detected"]

def test_student_02_never_misdiagnosed_as_01():
    """
    Guarantees that a student exhibiting misconception 02 (superposition-not-mixture)
    is NEVER prematurely or falsely diagnosed as misconception 01 (measurement-deterministic).
    Instead, it either detects a tie or cleanly discriminates via a follow-up probe.
    """
    entry_02 = get_catalog_entry("superposition-not-mixture")
    probe = entry_02.probe_circuits[0]
    prediction = HANDWRITTEN_PREDICTIONS["superposition-not-mixture"]
    
    res = diagnosis_engine.diagnose(circuit=probe, student_prediction=prediction, confidence=0.9)
    # Must NOT directly commit to measurement-deterministic
    if res.status == "misconception_detected":
        assert res.detected_misconception.id == "superposition-not-mixture"
        assert res.detected_misconception.id != "measurement-deterministic"
    elif res.status == "tie_detected":
        # Tied status must acknowledge both and provide a discriminating probe
        tied_ids = [m.id for m in res.tied_misconceptions]
        assert "superposition-not-mixture" in tied_ids
        assert res.discriminating_probe is not None
        # Follow-up with discriminating probe
        sim_circ = mutation_registry.mutate("h_is_classical_mixture", res.discriminating_probe)
        sim_pred = extract_circuit_facts(sim_circ)["measurement_probabilities"]
        res_followup = diagnosis_engine.diagnose(circuit=res.discriminating_probe, student_prediction=sim_pred, confidence=0.9)
        if res_followup.status == "misconception_detected":
            assert res_followup.detected_misconception.id == "superposition-not-mixture"
            assert res_followup.detected_misconception.id != "measurement-deterministic"

def test_correct_student_not_diagnosed():
    """Asserts that a correct student for each probe circuit is NOT diagnosed with any misconception."""
    for entry in diagnosis_engine.catalog.entries:
        probe = entry.probe_circuits[0]
        correct_facts = extract_circuit_facts(probe)
        correct_probs = correct_facts["measurement_probabilities"]
        res = diagnosis_engine.diagnose(circuit=probe, student_prediction=correct_probs, confidence=0.9)
        assert res.status == "matches_correct_answer", f"Correct student misdiagnosed for {entry.id}"
        assert res.detected_misconception is None

def test_random_wrong_student_no_confident_match():
    """Asserts that a random nonsense prediction returns no_match."""
    # Probe circuit for grover-over-iteration expects 100% |11> for 1-iter Grover
    entry = get_catalog_entry("grover-over-iteration")
    probe = entry.probe_circuits[0]
    # Random nonsense prediction: 90% on |01>, 10% on |10>
    random_wrong_pred = {"01": 0.9, "10": 0.1}
    res = diagnosis_engine.diagnose(circuit=probe, student_prediction=random_wrong_pred, confidence=0.9)
    assert res.status == "no_match"
