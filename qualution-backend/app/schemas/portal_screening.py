from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

ALLOWED_SCREENING_FLAGS = {
    "spam",
    "off_topic",
    "promotional",
    "abusive",
    "personal_data",
    "misleading_claim",
    "duplicate_like",
    "unscreened"
}

class ScreeningOutput(BaseModel):
    relevance_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Quantum relevance score between 0.0 and 1.0")
    spam_likelihood: float = Field(default=0.0, ge=0.0, le=1.0, description="Estimated spam probability between 0.0 and 1.0")
    flags: List[str] = Field(default_factory=list, description="List of detected moderation flags")
    reason: str = Field(default="Pending review", description="One-sentence explanation of the screening decision")

    @field_validator("relevance_score", "spam_likelihood")
    @classmethod
    def clamp_scores(cls, v: float) -> float:
        return max(0.0, min(1.0, round(float(v), 3)))

    @field_validator("flags")
    @classmethod
    def filter_flags(cls, v: List[str]) -> List[str]:
        valid = [flag.lower().strip() for flag in v if flag.lower().strip() in ALLOWED_SCREENING_FLAGS]
        return list(dict.fromkeys(valid))
