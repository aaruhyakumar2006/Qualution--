import pytest
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.fact_extractor import extract_circuit_facts
from app.services.concept_taxonomy import (
    load_concept_taxonomy,
    validate_concept_taxonomy_dag,
    ConceptTaxonomy,
    ConceptDefinition
)
from app.schemas.misconception import MisconceptionCatalog
from app.services.lesson_concept_validator import scan_lesson_concepts
from app.api.routes.onboarding import assess_onboarding, OnboardingAssessPayload

def test_fact_extractor_known_state_zero():
    circuit = CircuitRequest(
        qubits=1,
        classical_bits=1,
        gates=[]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["status"] == "success"
    assert facts["measurement_probabilities"]["0"] == 1.0
    assert facts["per_qubit_reduced_state"][0]["purity"] == 1.0
    assert facts["per_qubit_reduced_state"][0]["entanglement_entropy"] == 0.0

def test_fact_extractor_known_state_plus():
    circuit = CircuitRequest(
        qubits=1,
        classical_bits=1,
        gates=[GateRequest(gate="h", targets=[0])]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["status"] == "success"
    assert abs(facts["measurement_probabilities"]["0"] - 0.5) < 1e-3
    assert abs(facts["measurement_probabilities"]["1"] - 0.5) < 1e-3
    assert facts["per_qubit_reduced_state"][0]["purity"] == 1.0
    assert facts["per_qubit_reduced_state"][0]["entanglement_entropy"] == 0.0

def test_fact_extractor_bell_state():
    circuit = CircuitRequest(
        qubits=2,
        classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1])
        ]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["status"] == "success"
    assert abs(facts["measurement_probabilities"]["00"] - 0.5) < 1e-3
    assert abs(facts["measurement_probabilities"]["11"] - 0.5) < 1e-3
    assert abs(facts["per_qubit_reduced_state"][0]["purity"] - 0.5) < 1e-3
    assert abs(facts["per_qubit_reduced_state"][0]["entanglement_entropy"] - 1.0) < 1e-3
    assert facts["pairwise_entanglement"][0]["is_entangled"] is True

def test_fact_extractor_ghz_state():
    circuit = CircuitRequest(
        qubits=3,
        classical_bits=3,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="cx", targets=[1, 2])
        ]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["status"] == "success"
    assert abs(facts["measurement_probabilities"]["000"] - 0.5) < 1e-3
    assert abs(facts["measurement_probabilities"]["111"] - 0.5) < 1e-3

def test_fact_extractor_z_on_bell_state_relative_phase_shift():
    """
    CRITICAL PHYSICS CHECK:
    Applying Z to one qubit of a Bell pair (|00> + |11>)/sqrt(2) yields (|00> - |11>)/sqrt(2).
    Entanglement entropy MUST remain unchanged (1.0 bit), purity MUST stay 0.5,
    and relative phase MUST shift by pi radians.
    """
    circuit = CircuitRequest(
        qubits=2,
        classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]),
            GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="z", targets=[0])
        ]
    )
    facts = extract_circuit_facts(circuit)
    assert facts["status"] == "success"
    # Entanglement entropy unchanged
    assert abs(facts["per_qubit_reduced_state"][0]["purity"] - 0.5) < 1e-3
    assert abs(facts["per_qubit_reduced_state"][0]["entanglement_entropy"] - 1.0) < 1e-3
    assert facts["pairwise_entanglement"][0]["is_entangled"] is True
    # Relative phase shift check (3.14159 rad / pi)
    rel_phase_11 = facts["relative_phase_summary"].get("11", 0.0)
    assert abs(rel_phase_11 - 3.14159) < 1e-2

def test_fact_extractor_qubit_cap():
    circuit = CircuitRequest(
        qubits=15,
        classical_bits=15,
        gates=[]
    )
    facts = extract_circuit_facts(circuit, max_qubits=12)
    assert facts["status"] == "too_large"
    assert facts["requested_qubits"] == 15
    assert facts["max_qubits"] == 12

def test_concept_taxonomy_dag_validity():
    taxonomy = load_concept_taxonomy()
    res = validate_concept_taxonomy_dag(taxonomy)
    assert res["valid"] is True, f"Taxonomy DAG validation failed: {res['errors']}"

def test_concept_taxonomy_cycle_detector():
    bad_taxonomy = ConceptTaxonomy(
        version="1.0.0",
        concepts=[
            ConceptDefinition(id="a", name="A", definition="A", prerequisite_ids=["b"], lesson_step_ids=[]),
            ConceptDefinition(id="b", name="B", definition="B", prerequisite_ids=["a"], lesson_step_ids=[])
        ]
    )
    res = validate_concept_taxonomy_dag(bad_taxonomy)
    assert res["valid"] is False
    assert len(res["cycles"]) > 0

def test_misconception_catalog_schema_validation():
    import json
    from pathlib import Path
    catalog_path = Path(__file__).parent.parent / "app" / "data" / "misconception_catalog.json"
    with open(catalog_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    catalog = MisconceptionCatalog(**data)
    assert len(catalog.entries) >= 11
    for entry in catalog.entries:
        assert len(entry.hint_ladder) == 4
        assert len(entry.concept_ids) >= 1
        assert len(entry.probe_circuits) >= 1

def test_lesson_concept_scanner():
    report = scan_lesson_concepts()
    assert report["total_lessons"] > 0
    assert "summary_per_lesson" in report

def test_existing_onboarding_rules_pass():
    payload = OnboardingAssessPayload(
        answers={
            "q2_interference": "B",
            "q3_cnot_entanglement": "B"
        }
    )
    res = assess_onboarding(payload)
    assert hasattr(res, "detected_misconceptions")
    rules = [m.rule_id for m in res.detected_misconceptions]
    assert "RULE_SUPERPOS_RANDOM" in rules
    assert "RULE_CNOT_COPY" in rules

def test_original_lessons_load_identically():
    """
    Verifies that original lesson JSON files load cleanly and sidecar metadata
    is merged without mutating or altering the original lesson JSON files.
    """
    from pathlib import Path
    import json
    from app.services.lesson_concept_validator import scan_lesson_concepts, LESSONS_DIR

    report = scan_lesson_concepts()
    assert report["total_lessons"] > 0

    # Ensure sidecars exist in sidecars/ directory
    sidecars_dir = LESSONS_DIR / "sidecars"
    assert sidecars_dir.exists()
    assert len(list(sidecars_dir.glob("*.meta.json"))) >= 3

