import copy
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from pydantic import BaseModel, Field

from app.schemas.circuit import CircuitRequest, GateRequest
from app.schemas.misconception import MisconceptionCatalog, MisconceptionCatalogEntry
from app.services.fact_extractor import extract_circuit_facts
from app.services.mutation_library import mutation_registry
from app.services.concept_taxonomy import load_concept_taxonomy

CATALOG_FILE_PATH = Path(__file__).parent.parent / "data" / "misconception_catalog.json"

class DiagnosisResult(BaseModel):
    status: str  # "misconception_detected" | "tie_detected" | "matches_correct_answer" | "no_match"
    detected_misconception: Optional[MisconceptionCatalogEntry] = None
    tied_misconceptions: List[MisconceptionCatalogEntry] = Field(default_factory=list)
    discriminating_probe: Optional[CircuitRequest] = None
    discriminating_threshold: Optional[float] = None
    distance_to_correct: float
    distance_to_misconception: Optional[float] = None
    evidence_score: float
    ranked_candidates: List[Dict[str, Any]]
    correct_probabilities: Dict[str, float]
    student_normalized_probabilities: Dict[str, float]

def select_discriminating_probe(
    tied_candidates: List[MisconceptionCatalogEntry],
    qubit_cap: int = 3,
    min_threshold: float = 0.25
) -> Optional[CircuitRequest]:
    """
    Searches candidate probe circuits and a generated pool of small circuits
    (within qubit_cap) for a circuit where all tied candidates produce mutually
    distinguishable simulated predictions (TVD >= min_threshold).
    Uses phase-aware basis rotations when necessary.
    """
    if len(tied_candidates) < 2:
        return tied_candidates[0].probe_circuits[0] if tied_candidates and tied_candidates[0].probe_circuits else None

    # Candidate pool
    circuits_to_test: List[CircuitRequest] = []
    for cand in tied_candidates:
        circuits_to_test.extend(cand.probe_circuits)

    pool = [
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
        CircuitRequest(qubits=2, classical_bits=2, gates=[
            GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="z", targets=[0]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
        ]),
        # 7. CZ Grover step: H(0), H(1) -> CZ(0,1) -> H(0), H(1)
        CircuitRequest(qubits=2, classical_bits=2, gates=[
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
        ]),
        # 8. CNOT with target H: X(1) -> H(1) -> H(0) -> CX(0,1) -> H(0), H(1)
        CircuitRequest(qubits=2, classical_bits=2, gates=[
            GateRequest(gate="x", targets=[1]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
        ]),
        # 9. Mid-circuit measurement: H(0) -> Measure(0) -> H(0)
        CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="measure", targets=[0]), GateRequest(gate="h", targets=[0])]),
    ]
    circuits_to_test.extend(pool)

    best_probe = None
    max_min_separation = -1.0

    for c in circuits_to_test:
        if c.qubits > qubit_cap:
            continue
        predictions = []
        valid_probe = True
        for cand in tied_candidates:
            try:
                mut_c = mutation_registry.mutate(cand.mutation_ref, c)
                facts = extract_circuit_facts(mut_c)
                if facts["status"] != "success":
                    valid_probe = False
                    break
                probs = facts["measurement_probabilities"]
                predictions.append(probs)
            except Exception:
                valid_probe = False
                break

        if not valid_probe or len(predictions) != len(tied_candidates):
            continue

        min_sep = 1.0
        for i in range(len(predictions)):
            for j in range(i + 1, len(predictions)):
                sep = compute_tvd(predictions[i], predictions[j])
                min_sep = min(min_sep, sep)

        if min_sep > max_min_separation:
            max_min_separation = min_sep
            best_probe = c

    if max_min_separation >= min_threshold:
        return best_probe
    return best_probe or tied_candidates[0].probe_circuits[0]

def normalize_student_prediction(
    prediction: Union[Dict[str, float], List[str], str],
    num_qubits: int
) -> Dict[str, float]:
    """
    Normalizes prediction input into a probability distribution dict over bitstrings.
    Accepts:
    - Probability distribution dict: {"00": 0.5, "11": 0.5}
    - List of most likely outcomes: ["11"] or ["00", "11"]
    - Categorical choice string: "c" or "11"
    """
    num_states = 1 << num_qubits
    dist: Dict[str, float] = {}

    if isinstance(prediction, dict):
        total = sum(float(v) for v in prediction.values())
        if total > 0:
            for k, v in prediction.items():
                bitstring = k.zfill(num_qubits)
                dist[bitstring] = float(v) / total
        return dist

    if isinstance(prediction, list):
        if not prediction:
            return {}
        weight = 1.0 / len(prediction)
        for item in prediction:
            bitstring = str(item).zfill(num_qubits)
            dist[bitstring] = dist.get(bitstring, 0.0) + weight
        return dist

    if isinstance(prediction, str):
        # Map common option choices or bitstrings
        clean_pred = str(prediction).strip()
        if len(clean_pred) == num_qubits and all(c in '01' for c in clean_pred):
            dist[clean_pred] = 1.0
        elif clean_pred in ["a", "option_a"]:
            dist[format(0, f'0{num_qubits}b')] = 1.0
        elif clean_pred in ["b", "option_b"]:
            dist[format(1, f'0{num_qubits}b')] = 1.0
        elif clean_pred in ["c", "option_c"]:
            # Equal superposition uniform distribution
            weight = 1.0 / num_states
            for i in range(num_states):
                dist[format(i, f'0{num_qubits}b')] = weight
        else:
            dist[clean_pred] = 1.0
        return dist

    return {}

def compute_tvd(dist_a: Dict[str, float], dist_b: Dict[str, float]) -> float:
    """
    Total Variation Distance (TVD) between two probability distributions:
    TVD(p, q) = 0.5 * sum_x |p(x) - q(x)|
    Ranging from 0.0 (identical) to 1.0 (disjoint).
    """
    all_keys = set(dist_a.keys()).union(set(dist_b.keys()))
    tvd_sum = 0.0
    for k in all_keys:
        pa = dist_a.get(k, 0.0)
        pb = dist_b.get(k, 0.0)
        tvd_sum += abs(pa - pb)
    return round(0.5 * tvd_sum, 6)

class DiagnosisEngine:
    def __init__(self, catalog_path: Path = CATALOG_FILE_PATH):
        with open(catalog_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.catalog = MisconceptionCatalog(**data)
        self.taxonomy = load_concept_taxonomy()

    def diagnose(
        self,
        circuit: CircuitRequest,
        student_prediction: Union[Dict[str, float], List[str], str],
        confidence: Optional[float] = 0.8,
        current_step_id: Optional[str] = None
    ) -> DiagnosisResult:
        # 1. Extract correct physics facts
        correct_facts = extract_circuit_facts(circuit)
        if correct_facts["status"] == "too_large":
            raise ValueError(correct_facts["message"])

        correct_probs = correct_facts["measurement_probabilities"]

        # 2. Normalize student prediction into distribution
        student_probs = normalize_student_prediction(student_prediction, circuit.qubits)

        # Distance to correct physics
        dist_to_correct = compute_tvd(student_probs, correct_probs)

        # If student's prediction matches correct output within tolerance (TVD <= 0.05), no misconception
        if dist_to_correct <= 0.05:
            return DiagnosisResult(
                status="matches_correct_answer",
                detected_misconception=None,
                distance_to_correct=dist_to_correct,
                distance_to_misconception=None,
                evidence_score=0.0,
                ranked_candidates=[],
                correct_probabilities=correct_probs,
                student_normalized_probabilities=student_probs
            )

        # 3. Select candidate misconceptions
        # Filter by concept_ids matching current step if step is provided
        step_concept_ids: List[str] = []
        if current_step_id:
            for c in self.taxonomy.concepts:
                if current_step_id in c.lesson_step_ids:
                    step_concept_ids.append(c.id)

        candidate_entries: List[MisconceptionCatalogEntry] = []
        if step_concept_ids:
            candidate_entries = [
                e for e in self.catalog.entries
                if any(cid in step_concept_ids for cid in e.concept_ids)
            ]

        # Fallback to all entries if no concept match found
        if not candidate_entries:
            candidate_entries = self.catalog.entries

        # 4. Evaluate each candidate mutation
        ranked_candidates: List[Dict[str, Any]] = []

        for entry in candidate_entries:
            mutation_ref = entry.mutation_ref
            if not mutation_registry.get_definition(mutation_ref):
                continue

            # Only evaluate candidate mutations that are physically applicable to the given circuit
            if not mutation_registry.is_applicable(mutation_ref, circuit):
                continue

            try:
                mutated_circuit = mutation_registry.mutate(mutation_ref, circuit)
                mutated_facts = extract_circuit_facts(mutated_circuit)
                if mutated_facts["status"] != "success":
                    continue
                mutated_probs = mutated_facts["measurement_probabilities"]
                # Distance in measurement basis
                dist_to_mutated = compute_tvd(student_probs, mutated_probs)

                # Confidence-weighted evidence score:
                conf_weight = 1.5 if (confidence or 0.8) >= 0.8 else 1.0
                evidence_score = round(max(0.0, (1.0 - dist_to_mutated) * conf_weight), 4)

                ranked_candidates.append({
                    "misconception_id": entry.id,
                    "name": entry.name,
                    "concept_ids": entry.concept_ids,
                    "mutation_ref": mutation_ref,
                    "distance_to_student": dist_to_mutated,
                    "evidence_score": evidence_score,
                    "entry": entry
                })
            except Exception:
                continue

        # Sort candidate misconceptions by smallest distance to student prediction (highest evidence score)
        ranked_candidates.sort(key=lambda x: x["distance_to_student"])

        if not ranked_candidates or ranked_candidates[0]["distance_to_student"] > 0.4:
            return DiagnosisResult(
                status="no_match",
                detected_misconception=None,
                distance_to_correct=dist_to_correct,
                distance_to_misconception=None,
                evidence_score=0.0,
                ranked_candidates=[
                    {k: v for k, v in r.items() if k != "entry"}
                    for r in ranked_candidates
                ],
                correct_probabilities=correct_probs,
                student_normalized_probabilities=student_probs
            )

        # Check for top-rank ties (difference in distance <= 0.05)
        top_candidates = [
            c for c in ranked_candidates
            if c["distance_to_student"] <= 0.40 and abs(c["distance_to_student"] - ranked_candidates[0]["distance_to_student"]) <= 0.05
        ]

        if len(top_candidates) > 1:
            tied_entries = [c["entry"] for c in top_candidates]
            discriminating_probe = select_discriminating_probe(tied_entries)
            split_evidence = round(top_candidates[0]["evidence_score"] / len(top_candidates), 4)

            return DiagnosisResult(
                status="tie_detected",
                detected_misconception=None,
                tied_misconceptions=tied_entries,
                discriminating_probe=discriminating_probe,
                discriminating_threshold=0.25,
                distance_to_correct=dist_to_correct,
                distance_to_misconception=top_candidates[0]["distance_to_student"],
                evidence_score=split_evidence,
                ranked_candidates=[
                    {k: v for k, v in r.items() if k != "entry"}
                    for r in ranked_candidates
                ],
                correct_probabilities=correct_probs,
                student_normalized_probabilities=student_probs
            )

        best_match = ranked_candidates[0]
        detected_entry: MisconceptionCatalogEntry = best_match["entry"]

        return DiagnosisResult(
            status="misconception_detected",
            detected_misconception=detected_entry,
            tied_misconceptions=[],
            discriminating_probe=None,
            discriminating_threshold=None,
            distance_to_correct=dist_to_correct,
            distance_to_misconception=best_match["distance_to_student"],
            evidence_score=best_match["evidence_score"],
            ranked_candidates=[
                {k: v for k, v in r.items() if k != "entry"}
                for r in ranked_candidates
            ],
            correct_probabilities=correct_probs,
            student_normalized_probabilities=student_probs
        )

diagnosis_engine = DiagnosisEngine()
