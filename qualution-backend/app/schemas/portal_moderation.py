from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ModerationRejectRequest(BaseModel):
    reason: str = Field(
        ...,
        min_length=3,
        max_length=500,
        description="Required reason why the submission was rejected."
    )

class ModerationRemoveRequest(BaseModel):
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional reason why the item was removed from public feed."
    )

class ModerationQueueItem(BaseModel):
    id: str
    title: str
    submission_type: str
    section: str
    canonical_url: str
    note: Optional[str] = None
    circuit_qasm: Optional[str] = None
    circuit_data: Optional[Dict[str, Any]] = None
    status: str
    author_id: Optional[str] = None
    author_display_name: str
    author_role: str
    audience: str
    submitted_at: Optional[str] = None
    created_at: str
    screening: Optional[Dict[str, Any]] = None
    report_count: int = 0
    reports: List[Dict[str, Any]] = []

