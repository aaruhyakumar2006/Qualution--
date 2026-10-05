from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field

HIGH_CONFIDENCE_WEIGHT = 1.5
MEDIUM_CONFIDENCE_WEIGHT = 1.0
LOW_CONFIDENCE_WEIGHT = 0.5

StatusType = Literal["SUPPORTED", "POSSIBLE", "CLEARED", "NONE"]

class EvidenceEvent(BaseModel):
    kind: Literal["observation", "prediction_error", "correct_attempt"]
    misconception_id: str
    concept_ids: List[str] = Field(default_factory=list)
    step_id: Optional[str] = None
    strength: float = 1.0
    timestamp: float
    confidence: Optional[float] = 0.8

class MisconceptionStatusSummary(BaseModel):
    misconception_id: str
    status: StatusType
    evidence_score: float
    touchpoints_count: int
    last_event_timestamp: float
    cleared_at: Optional[float] = None

def get_confidence_weight(confidence: Optional[float]) -> float:
    if confidence is None:
        return MEDIUM_CONFIDENCE_WEIGHT
    if confidence >= 0.8:
        return HIGH_CONFIDENCE_WEIGHT
    if confidence >= 0.5:
        return MEDIUM_CONFIDENCE_WEIGHT
    return LOW_CONFIDENCE_WEIGHT

def compute_misconception_statuses(events: List[EvidenceEvent]) -> Dict[str, MisconceptionStatusSummary]:
    """
    Pure, deterministic, replayable status calculation from evidence event sequence.
    Rule logic:
    - SUPPORTED: weighted evidence sum >= 2.0 across >= 2 independent touchpoints.
    - POSSIBLE: weighted evidence sum >= 0.5 across >= 1 touchpoint.
    - CLEARED: a 'correct_attempt' event occurs at or after latest evidence.
    """
    # Sort events deterministically by timestamp, then kind, then step_id
    sorted_events = sorted(
        events,
        key=lambda e: (e.timestamp, e.kind, e.step_id or "", e.misconception_id)
    )

    grouped_events: Dict[str, List[EvidenceEvent]] = {}
    for ev in sorted_events:
        grouped_events.setdefault(ev.misconception_id, []).append(ev)

    results: Dict[str, MisconceptionStatusSummary] = {}

    for misconception_id, ev_list in grouped_events.items():
        evidence_score = 0.0
        touchpoint_steps: set = set()
        cleared_timestamp: Optional[float] = None
        last_evidence_timestamp: float = 0.0

        for ev in ev_list:
            if ev.kind in ["observation", "prediction_error"]:
                weight = get_confidence_weight(ev.confidence)
                event_score = ev.strength * weight
                evidence_score += event_score
                step_key = ev.step_id or f"ts_{ev.timestamp}"
                touchpoint_steps.add(step_key)
                if ev.timestamp > last_evidence_timestamp:
                    last_evidence_timestamp = ev.timestamp

            elif ev.kind == "correct_attempt":
                # A verified correct attempt clears misconception if it occurs at or after latest evidence
                if ev.timestamp >= last_evidence_timestamp:
                    cleared_timestamp = ev.timestamp

        # Determine status
        touchpoints_count = len(touchpoint_steps)

        if cleared_timestamp is not None:
            status = "CLEARED"
        elif evidence_score >= 2.0 and touchpoints_count >= 2:
            status = "SUPPORTED"
        elif evidence_score >= 0.5 and touchpoints_count >= 1:
            status = "POSSIBLE"
        else:
            status = "NONE"

        results[misconception_id] = MisconceptionStatusSummary(
            misconception_id=misconception_id,
            status=status,
            evidence_score=round(evidence_score, 4),
            touchpoints_count=touchpoints_count,
            last_event_timestamp=last_evidence_timestamp,
            cleared_at=cleared_timestamp
        )

    return results
