import time
import copy
from typing import Dict, List, Any, Optional, Literal
from pydantic import BaseModel, Field

from app.schemas.circuit import CircuitRequest, GateRequest
from app.schemas.misconception import MisconceptionCatalogEntry
from app.services.diagnosis_engine import diagnosis_engine, DiagnosisResult
from app.services.fact_extractor import extract_circuit_facts
from app.services.mutation_library import mutation_registry
from app.services.evidence_engine import compute_misconception_statuses
from app.services.prerequisite_tracing import trace_weakest_prerequisite
from app.services.turn_validator import validate_turn_text, ValidationResult

TurnKind = Literal[
    "question", "experiment_offer", "reflection_prompt",
    "verification", "encouragement", "handoff", "disambiguation"
]

SocraticState = Literal[
    "IDLE", "DETECT", "DIAGNOSE", "QUESTION",
    "EXPERIMENT", "REFLECT", "VERIFY", "RESOLVED", "HANDOFF", "DISAMBIGUATION"
]

class MarioTurn(BaseModel):
    kind: TurnKind
    text: str
    hint_level: int = 1
    experiment_id: Optional[str] = None
    facts_used: List[Any] = Field(default_factory=list)
    state: SocraticState = "QUESTION"
    misconception_id: Optional[str] = None
    path_used: str = "template"
    discriminating_probe: Optional[CircuitRequest] = None

class SessionState(BaseModel):
    session_id: str
    user_id: str
    current_state: SocraticState = "IDLE"
    current_misconception_id: Optional[str] = None
    hint_level: int = 1
    turns_count: int = 0
    failing_concept_count: Dict[str, int] = Field(default_factory=dict)
    prerequisite_probed: bool = False
    prior_supported_misconceptions: List[str] = Field(default_factory=list)
    pending_tied_misconceptions: List[str] = Field(default_factory=list)
    discriminating_probe: Optional[CircuitRequest] = None

class SocraticLoopEngine:
    def initialize_session_with_memory(
        self,
        session_id: str,
        user_id: str,
        lesson_id: str,
        lesson_concept_ids: Optional[List[str]] = None
    ) -> SessionState:
        """
        Cross-Lesson Memory Initialization Rule:
        On lesson start, loads the learner's persisted misconception states and concept mastery.
        If any misconception has status 'SUPPORTED' (>= 2 touchpoints) and shares concepts with
        the current lesson, it is registered in `prior_supported_misconceptions` and pre-seeds
        the initial probe bias for the Socratic turn engine.
        """
        from app.services.evidence_store_service import evidence_store
        user_state = evidence_store.get_user_state(user_id)
        supported_prior = []

        lesson_concepts = set(lesson_concept_ids or [])
        for misc_id, m_record in user_state.get("misconceptions", {}).items():
            if m_record.get("status") == "SUPPORTED":
                misc_concepts = set(m_record.get("concept_ids", []))
                if not lesson_concepts or (misc_concepts & lesson_concepts):
                    supported_prior.append(misc_id)

        session = SessionState(
            session_id=session_id,
            user_id=user_id,
            prior_supported_misconceptions=supported_prior
        )
        if supported_prior:
            session.current_misconception_id = supported_prior[0]
        return session
    def process_turn(
        self,
        session: SessionState,
        circuit: CircuitRequest,
        student_prediction: Any,
        user_confidence: float = 0.8,
        current_step_id: Optional[str] = None
    ) -> tuple[SessionState, MarioTurn]:
        """
        Pure, deterministic Socratic Loop state transition engine.
        Processes event + circuit facts + diagnosis to determine next Mario turn.
        """
        # 1. Extract physics facts
        facts = extract_circuit_facts(circuit)
        if facts.get("status") == "too_large":
            raise ValueError(facts.get("message", "Circuit too large"))

        # 2. Run diagnosis
        diagnosis = diagnosis_engine.diagnose(
            circuit=circuit,
            student_prediction=student_prediction,
            confidence=user_confidence,
            current_step_id=current_step_id
        )

        session.turns_count += 1
        facts_used = [
            {"source": "student_prediction", "probabilities": diagnosis.student_normalized_probabilities},
            {"source": "circuit_simulator", "probabilities": facts["measurement_probabilities"]}
        ]

        # Check turn cap (max 8 turns per misconception)
        if session.turns_count > 8:
            session.current_state = "HANDOFF"
            turn = MarioTurn(
                kind="handoff",
                text="Mario: We have worked hard on this concept! Let's save our progress and try the next challenge.",
                hint_level=4,
                facts_used=facts_used,
                state="HANDOFF",
                misconception_id=session.current_misconception_id
            )
            return session, turn

        # If student prediction matches correct answer
        if diagnosis.status == "matches_correct_answer":
            session.current_state = "RESOLVED"
            turn = MarioTurn(
                kind="encouragement",
                text="Mario: Spot on! Your quantum state prediction matches the simulator perfectly.",
                hint_level=1,
                facts_used=facts_used,
                state="RESOLVED"
            )
            return session, turn

        # If top candidates are tied, generate a neutral observation + disambiguation probe turn
        if diagnosis.status == "tie_detected":
            session.current_state = "DISAMBIGUATION"
            session.pending_tied_misconceptions = [m.id for m in diagnosis.tied_misconceptions]
            session.discriminating_probe = diagnosis.discriminating_probe
            session.hint_level = 1
            obs_text = "What do you observe about the state probabilities if we test this alternative circuit probe?"
            turn_text = f"Mario: {obs_text}"
            turn = MarioTurn(
                kind="disambiguation",
                text=turn_text,
                hint_level=1,
                facts_used=facts_used,
                state="DISAMBIGUATION",
                misconception_id=diagnosis.tied_misconceptions[0].id if diagnosis.tied_misconceptions else None,
                discriminating_probe=diagnosis.discriminating_probe
            )
            return session, turn

        # Misconception detected
        # Maintain session continuity if current or prior misconception is tied at top score
        detected_entry = diagnosis.detected_misconception
        if diagnosis.ranked_candidates and (session.current_misconception_id or session.prior_supported_misconceptions):
            candidate_map = {c["misconception_id"]: c for c in diagnosis.ranked_candidates}
            top_score = diagnosis.ranked_candidates[0]["evidence_score"]
            preferred_id = session.current_misconception_id or (session.prior_supported_misconceptions[0] if session.prior_supported_misconceptions else None)
            if preferred_id and preferred_id in candidate_map and abs(candidate_map[preferred_id]["evidence_score"] - top_score) < 1e-4:
                matched = next((e for e in diagnosis_engine.catalog.entries if e.id == preferred_id), None)
                if matched:
                    detected_entry = matched

        misc_id = detected_entry.id if detected_entry else "general_misconception"

        # Handle prerequisite step-back if same concept fails >= 2 times
        primary_concept = detected_entry.concept_ids[0] if detected_entry and detected_entry.concept_ids else "superposition"
        session.failing_concept_count[primary_concept] = session.failing_concept_count.get(primary_concept, 0) + 1

        if session.failing_concept_count[primary_concept] >= 2 and not session.prerequisite_probed:
            prereq_trace = trace_weakest_prerequisite(primary_concept)
            prereq_id = prereq_trace.get("weakest_prerequisite_id")
            if prereq_id and prereq_id != primary_concept:
                session.prerequisite_probed = True
                session.current_state = "QUESTION"
                turn = MarioTurn(
                    kind="question",
                    text=f"Mario: Before we continue, let's check your understanding of {prereq_id.replace('_', ' ')}.",
                    hint_level=1,
                    facts_used=facts_used,
                    state="QUESTION",
                    misconception_id=misc_id
                )
                return session, turn

        # Update session misconception tracking
        if session.current_misconception_id != misc_id:
            session.current_misconception_id = misc_id
            session.hint_level = 1
        else:
            session.hint_level = min(4, session.hint_level + 1)

        session.current_state = "QUESTION"
        hint_ladder = detected_entry.hint_ladder if detected_entry else []
        hint_idx = min(len(hint_ladder) - 1, session.hint_level - 1) if hint_ladder else 0
        hint_text = hint_ladder[hint_idx] if hint_ladder else "Notice how the quantum transformation affects state probabilities."

        # Format turn text and clean any duplicate Mario: prefix
        clean_hint = hint_text.strip()
        if clean_hint.lower().startswith("mario:"):
            clean_hint = clean_hint[6:].strip()
        turn_text = f"Mario: {clean_hint}"

        validation = validate_turn_text(
            text=turn_text,
            hint_level=session.hint_level,
            misconception_name=detected_entry.name if detected_entry else None,
            facts_used=facts_used
        )

        if not validation.is_valid:
            # Fallback to safe template text if validation fails
            turn_text = f"Mario: What do you observe about the measurement probabilities?"

        turn = MarioTurn(
            kind="question",
            text=turn_text,
            hint_level=session.hint_level,
            experiment_id=f"exp-{misc_id}",
            facts_used=facts_used,
            state="QUESTION",
            misconception_id=misc_id
        )

        return session, turn

    def generate_experiment(self, misconception_id: str, circuit: CircuitRequest) -> Dict[str, Any]:
        """
        Generates Universe A (original) vs Universe B (variant) experiment diff payload.
        Reuses mutation library.
        """
        entry = diagnosis_engine.catalog.entries
        target_entry = next((e for e in entry if e.id == misconception_id), None)
        mutation_ref = target_entry.mutation_ref if target_entry else "replace_h_with_x"

        # Universe A (original)
        facts_a = extract_circuit_facts(circuit)

        # Universe B (variant / mutated)
        variant_circuit = mutation_registry.mutate(mutation_ref, circuit)
        facts_b = extract_circuit_facts(variant_circuit)

        # Compute diff summary
        probs_a = facts_a["measurement_probabilities"]
        probs_b = facts_b["measurement_probabilities"]

        from app.services.diagnosis_engine import compute_tvd
        tvd_diff = compute_tvd(probs_a, probs_b)

        purity_a = facts_a["per_qubit_reduced_state"][0]["purity"] if facts_a.get("per_qubit_reduced_state") else 1.0
        purity_b = facts_b["per_qubit_reduced_state"][0]["purity"] if facts_b.get("per_qubit_reduced_state") else 1.0

        return {
            "misconception_id": misconception_id,
            "universe_a": {
                "label": "Universe A (Original)",
                "circuit": circuit.model_dump(),
                "probabilities": probs_a,
                "purity": purity_a
            },
            "universe_b": {
                "label": "Universe B (Variant)",
                "circuit": variant_circuit.model_dump(),
                "probabilities": probs_b,
                "purity": purity_b
            },
            "diff_summary": {
                "tvd_distance": tvd_diff,
                "purity_delta": round(purity_b - purity_a, 4),
                "is_distinguishable": tvd_diff > 0.05
            }
        }

    def handle_student_free_text(
        self,
        session: SessionState,
        student_text: str,
        circuit: CircuitRequest
    ) -> tuple[SessionState, MarioTurn]:
        """
        Handles student free-text question strictly inside the Socratic frame.
        RESOLVED is NEVER triggered by student keywords; it requires simulator verification.
        Refers to real observed circuit values without leaking answers below level 4.
        """
        session.turns_count += 1
        facts = extract_circuit_facts(circuit)
        facts_used = [{"source": "circuit_simulator", "probabilities": facts.get("measurement_probabilities", {})}]

        from app.services.llm_service import llm_service
        concept = llm_service.classify_free_text_concept(student_text, ["hadamard_gate", "cnot_gate", "oracle", "phase", "entanglement"])
        
        response_text = f"Mario: Great question about {concept.replace('_', ' ')}. Look at the measurement probabilities on your circuit: what happens to the output distribution when you change that gate?"
        
        turn = MarioTurn(
            kind="question",
            text=response_text,
            hint_level=session.hint_level,
            facts_used=facts_used,
            state="QUESTION",
            misconception_id=session.current_misconception_id
        )
        return session, turn

socratic_loop = SocraticLoopEngine()
