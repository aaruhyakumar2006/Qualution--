from typing import Optional, Dict, Any, List, Union
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel, Field

from app.schemas.circuit import CircuitRequest
from app.services.fact_extractor import extract_circuit_facts
from app.services.diagnosis_engine import diagnosis_engine, DiagnosisResult
from app.services.evidence_engine import (
    EvidenceEvent,
    compute_misconception_statuses,
    MisconceptionStatusSummary
)
from app.services.prerequisite_tracing import trace_weakest_prerequisite

router = APIRouter(prefix="", tags=["misconception"])

class FactsRequest(BaseModel):
    circuit: CircuitRequest
    max_qubits: Optional[int] = Field(12, ge=1, le=20, description="Configurable qubit cap for fact extraction")

class DiagnoseRequest(BaseModel):
    circuit: CircuitRequest
    student_prediction: Union[Dict[str, float], List[str], str] = Field(..., description="Probability dict, list of outcomes, or categorical string")
    confidence: Optional[float] = Field(0.8, ge=0.0, le=1.0, description="Student self-reported confidence weight (0.0 to 1.0)")
    current_step_id: Optional[str] = Field(None, description="Optional current lesson step ID")

class StatusRequest(BaseModel):
    events: List[EvidenceEvent] = Field(..., description="Chronological sequence of evidence events")

@router.post("/misconception/facts")
async def get_circuit_facts(payload: FactsRequest):
    """
    Generic Quantum Fact Extractor:
    Computes measurement probabilities, statevector amplitudes/phases, per-qubit purity & entanglement entropy,
    pairwise entanglement indicators, and relative phase summary on any CircuitIR.
    Enforces configurable qubit cap.
    """
    try:
        result = extract_circuit_facts(
            circuit=payload.circuit,
            max_qubits=payload.max_qubits or 12
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fact extraction failed: {str(e)}")

@router.post("/misconception/diagnose")
async def diagnose_misconception(payload: DiagnoseRequest):
    """
    Simulation-Driven Misconception Diagnosis Engine:
    Runs correct circuit & candidate mutations, computes Total Variation Distance (TVD),
    and returns ranked candidate misconceptions with evidence scores.
    """
    try:
        result = diagnosis_engine.diagnose(
            circuit=payload.circuit,
            student_prediction=payload.student_prediction,
            confidence=payload.confidence,
            current_step_id=payload.current_step_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Diagnosis failed: {str(e)}")

@router.post("/misconception/status")
async def get_misconception_statuses(payload: StatusRequest):
    """
    Evidence and Status Engine:
    Computes SUPPORTED, POSSIBLE, CLEARED per misconception from an event sequence.
    Pure, deterministic, replayable logic.
    """
    try:
        statuses = compute_misconception_statuses(payload.events)
        return {
            "status": "success",
            "statuses": statuses
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Status calculation failed: {str(e)}")

@router.get("/misconception/prerequisite_trace/{concept_id}")
async def trace_prerequisites(concept_id: str):
    """
    Prerequisite Tracing:
    Given a failing concept ID, walks the taxonomy graph to return the weakest prerequisite concept.
    """
    try:
        res = trace_weakest_prerequisite(concept_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Prerequisite tracing failed: {str(e)}")

# ── M3 Evidence Store Endpoints ─────────────────────────────────────────────
from app.core.auth_dependency import get_current_user, CurrentUser
from app.services.evidence_store_service import evidence_store, LearnerEventCreate

@router.post("/misconception/events")
async def post_learner_event(
    payload: LearnerEventCreate,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Misconception Engine M3 Event Store:
    Validates, writes append-only event for authenticated user, and updates state projections.
    """
    try:
        record = evidence_store.insert_event(user_id=current_user.id, event_data=payload)
        user_state = evidence_store.get_user_state(user_id=current_user.id)
        return {
            "status": "success",
            "event_id": record.id,
            "user_state": user_state
        }
    except ValueError as ve:
        raise HTTPException(status_code=429, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process learner event: {str(e)}")

@router.get("/misconception/state")
async def get_learner_state(
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Fetches the current user's projected misconception states and concept mastery scores.
    """
    try:
        user_state = evidence_store.get_user_state(user_id=current_user.id)
        return {
            "status": "success",
            "user_state": user_state
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch learner state: {str(e)}")

# ── M4 Socratic Loop Endpoints ──────────────────────────────────────────────
from app.services.socratic_loop import socratic_loop, SessionState, MarioTurn

class TurnRequest(BaseModel):
    session_id: str
    lesson_id: str
    step_id: str
    circuit: CircuitRequest
    student_prediction: Union[Dict[str, float], List[str], str]
    confidence: Optional[float] = Field(0.8, ge=0.0, le=1.0)

class ExperimentRequest(BaseModel):
    misconception_id: str
    circuit: CircuitRequest

@router.post("/misconception/turn")
async def post_socratic_turn(
    payload: TurnRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Socratic Loop Turn Engine (Stage M4):
    Ingests student event + circuit, runs diagnosis, evaluates hint ladder & turn cap,
    persists learner event via M3 store, and returns Mario's next turn.
    """
    try:
        # Load or initialize session state
        session = SessionState(
            session_id=payload.session_id,
            user_id=current_user.id
        )

        updated_session, turn = socratic_loop.process_turn(
            session=session,
            circuit=payload.circuit,
            student_prediction=payload.student_prediction,
            user_confidence=payload.confidence or 0.8,
            current_step_id=payload.step_id
        )

        # Persist event via M3 evidence store
        event_kind = "verification" if turn.state == "RESOLVED" else "prediction"
        evidence_store.insert_event(
            user_id=current_user.id,
            event_data=LearnerEventCreate(
                session_id=payload.session_id,
                lesson_id=payload.lesson_id,
                step_id=payload.step_id,
                kind=event_kind,
                payload={
                    "misconception_id": turn.misconception_id,
                    "hint_level": turn.hint_level,
                    "turn_kind": turn.kind,
                    "is_correct": turn.state == "RESOLVED"
                },
                confidence=3 if (payload.confidence or 0.8) >= 0.8 else 2
            )
        )

        return {
            "status": "success",
            "turn": turn.model_dump(),
            "session_state": updated_session.model_dump()
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Socratic turn generation failed: {str(e)}")

@router.post("/misconception/experiment")
async def post_socratic_experiment(
    payload: ExperimentRequest,
    current_user: CurrentUser = Depends(get_current_user)
):
    """
    Socratic Experiment Generator (Stage M4):
    Generates Universe A (original) vs Universe B (variant) circuit comparison with diff metrics.
    """
    try:
        experiment_diff = socratic_loop.generate_experiment(
            misconception_id=payload.misconception_id,
            circuit=payload.circuit
        )
        return {
            "status": "success",
            "experiment": experiment_diff
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Experiment generation failed: {str(e)}")


