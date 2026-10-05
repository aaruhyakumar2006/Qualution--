import time
from typing import Dict, List, Any, Optional, Literal, Union
from pydantic import BaseModel, Field

from app.services.evidence_engine import EvidenceEvent, compute_misconception_statuses, MisconceptionStatusSummary

class RateLimitExceededException(ValueError):
    """Custom exception raised when learner events rate limit is breached, mapping to SQLSTATE 'QL001'."""
    def __init__(self, message: str = "Rate limit exceeded: Maximum 600 events per hour allowed.", sqlstate: str = "QL001"):
        super().__init__(message)
        self.sqlstate = sqlstate

LearnerEventKind = Literal[
    "prediction", "run", "edit", "hint_shown", "hint_level_up",
    "answer", "experiment_run", "reflection", "verification", "free_text"
]

class LearnerEventCreate(BaseModel):
    session_id: str
    lesson_id: str
    step_id: str
    kind: LearnerEventKind
    payload: Dict[str, Any] = Field(default_factory=dict)
    confidence: Optional[Union[float, int]] = Field(None, ge=0.0, le=3.0, description="Self-reported confidence: 0.0 to 1.0 or 1 to 3")

class LearnerEventRecord(LearnerEventCreate):
    id: str
    user_id: str
    created_at: float

class MisconceptionStateRecord(BaseModel):
    user_id: str
    misconception_id: str
    concept_ids: List[str] = Field(default_factory=list)
    status: str
    touchpoints: int
    last_evidence_at: float
    updated_at: float

class ConceptMasteryRecord(BaseModel):
    user_id: str
    concept_id: str
    score: float
    evidence_count: int
    updated_at: float

class EvidenceStoreService:
    def __init__(self):
        # In-memory storage structures indexed by user_id
        self._events: Dict[str, List[LearnerEventRecord]] = {}
        self._misconception_states: Dict[str, Dict[str, MisconceptionStateRecord]] = {}
        self._concept_mastery: Dict[str, Dict[str, ConceptMasteryRecord]] = {}

    def insert_event(self, user_id: str, event_data: LearnerEventCreate) -> LearnerEventRecord:
        # Enforce rate limit (max 600 events per hour per user)
        now = time.time()
        one_hour_ago = now - 3600.0
        user_events = self._events.setdefault(user_id, [])
        
        recent_count = sum(1 for e in user_events if e.created_at >= one_hour_ago)
        if recent_count >= 600:
            raise RateLimitExceededException("Rate limit exceeded: Maximum 600 events per hour allowed.", sqlstate="QL001")

        # Enforce free-text length cap (max 500 chars)
        free_text = event_data.payload.get("free_text")
        if free_text and isinstance(free_text, str) and len(free_text) > 500:
            event_data.payload["free_text"] = free_text[:500]

        event_id = f"evt-{user_id[:8]}-{int(now * 1000)}-{len(user_events) + 1}"
        record = LearnerEventRecord(
            id=event_id,
            user_id=user_id,
            created_at=now,
            **event_data.model_dump()
        )

        user_events.append(record)

        # Incrementally update projections
        self._update_projections_for_event(user_id, record)

        return record

    def _update_projections_for_event(self, user_id: str, event: LearnerEventRecord):
        # Map event into evidence events format for evidence_engine
        user_events = self._events.get(user_id, [])
        evidence_events: List[EvidenceEvent] = []

        for e in user_events:
            misc_id = e.payload.get("misconception_id")
            if not misc_id:
                continue
            
            c_ids = e.payload.get("concept_ids") or []
            if isinstance(e.payload.get("concept_id"), str):
                c_ids.append(e.payload["concept_id"])

            conf_val = None
            if hasattr(e, "confidence_level") and e.confidence_level:
                conf_map = {"low": 0.3, "medium": 0.6, "high": 0.9}
                conf_val = conf_map.get(e.confidence_level, 0.6)
            elif e.confidence == 3 or e.confidence == 0.9:
                conf_val = 0.9
            elif e.confidence == 2 or e.confidence == 0.6:
                conf_val = 0.6
            elif e.confidence == 1 or e.confidence == 0.3:
                conf_val = 0.3

            if e.kind in ["prediction", "answer", "run"] and (e.payload.get("is_error") or e.payload.get("strength")):
                kind_str = "prediction_error"
            elif e.kind == "verification" and e.payload.get("is_correct"):
                kind_str = "correct_attempt"
            else:
                kind_str = "observation"

            evidence_events.append(EvidenceEvent(
                kind=kind_str,
                misconception_id=misc_id,
                concept_ids=c_ids,
                step_id=e.step_id,
                strength=float(e.payload.get("strength", 1.0)),
                timestamp=e.created_at,
                confidence=conf_val
            ))

        statuses = compute_misconception_statuses(evidence_events)

        user_states = self._misconception_states.setdefault(user_id, {})
        for misc_id, summary in statuses.items():
            user_states[misc_id] = MisconceptionStateRecord(
                user_id=user_id,
                misconception_id=misc_id,
                concept_ids=event.payload.get("concept_ids") or [event.payload["concept_id"]] if event.payload.get("concept_id") else [],
                status=summary.status if summary.status != "NONE" else "POSSIBLE",
                touchpoints=summary.touchpoints_count,
                last_evidence_at=summary.last_event_timestamp,
                updated_at=time.time()
            )

        # Update concept mastery: Strictly correctness-driven
        concept_id = event.payload.get("concept_id")
        if concept_id:
            user_mastery = self._concept_mastery.setdefault(user_id, {})
            current_m = user_mastery.get(concept_id)
            is_correct = bool(event.kind == "verification" and event.payload.get("is_correct", True)) or bool(event.payload.get("is_correct"))
            is_error = bool(event.payload.get("is_error")) or (event.kind == "prediction" and not event.payload.get("is_correct"))

            # Target score based on correctness
            target_score = 1.0 if is_correct else (0.2 if is_error else 0.5)

            if not current_m:
                user_mastery[concept_id] = ConceptMasteryRecord(
                    user_id=user_id,
                    concept_id=concept_id,
                    score=target_score,
                    evidence_count=1,
                    updated_at=time.time()
                )
            else:
                new_count = current_m.evidence_count + 1
                # Smooth Bayesian update towards target score
                new_score = round(current_m.score * 0.7 + target_score * 0.3, 2)
                user_mastery[concept_id] = ConceptMasteryRecord(
                    user_id=user_id,
                    concept_id=concept_id,
                    score=new_score,
                    evidence_count=new_count,
                    updated_at=time.time()
                )

    def get_user_state(self, user_id: str) -> Dict[str, Any]:
        user_states = self._misconception_states.get(user_id, {})
        user_mastery = self._concept_mastery.get(user_id, {})
        return {
            "user_id": user_id,
            "misconceptions": {k: v.model_dump() for k, v in user_states.items()},
            "mastery": {k: v.model_dump() for k, v in user_mastery.items()}
        }

    def rebuild_user_projections(self, user_id: str) -> Dict[str, Any]:
        """Replays all events for user and returns rebuilt projection state."""
        self._misconception_states[user_id] = {}
        self._concept_mastery[user_id] = {}
        events = list(self._events.get(user_id, []))
        for ev in events:
            self._update_projections_for_event(user_id, ev)
        return self.get_user_state(user_id)

    def purge_old_events(self, days: int = 180) -> int:
        cutoff = time.time() - (days * 86400.0)
        purged = 0
        for uid in list(self._events.keys()):
            new_list = [e for e in self._events[uid] if e.created_at >= cutoff]
            purged += len(self._events[uid]) - len(new_list)
            self._events[uid] = new_list
        return purged

    def export_user_data(self, user_id: str) -> Dict[str, Any]:
        """Exports user learner events and projections without deleting."""
        return {
            "user_id": user_id,
            "exported_at": time.time(),
            "events": [e.model_dump() for e in self._events.get(user_id, [])],
            "state": self.get_user_state(user_id)
        }

    def delete_user_data(self, user_id: str, confirmation: str) -> bool:
        """Deletes user data if confirmation string matches 'DELETE MY DATA'."""
        if confirmation != "DELETE MY DATA":
            raise ValueError("Confirmation mismatch. Expected literal string: 'DELETE MY DATA'")
        self._events.pop(user_id, None)
        self._misconception_states.pop(user_id, None)
        self._concept_mastery.pop(user_id, None)
        return True

    def export_and_delete_user_data(self, user_id: str) -> Dict[str, Any]:
        export_data = self.export_user_data(user_id)
        self.delete_user_data(user_id, confirmation="DELETE MY DATA")
        return export_data

evidence_store = EvidenceStoreService()
