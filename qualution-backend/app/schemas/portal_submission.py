import re
import html
from enum import Enum
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator
from urllib.parse import urlsplit
from app.core.config import settings

class SubmissionType(str, Enum):
    NEWS = "news"
    RESOURCE = "resource"
    EVENT = "events"
    OPPORTUNITY = "opportunity"
    PROJECT = "project"

def sanitize_plain_text(text: Optional[str]) -> str:
    """Strips HTML tags and non-printable control characters."""
    if not text:
        return ""
    # Strip HTML tags
    clean = re.sub(r"<[^>]+>", " ", text)
    # Unescape HTML entities
    clean = html.unescape(clean)
    # Remove control characters except newline and tab
    clean = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", clean)
    return re.sub(r"\s+", " ", clean).strip()

class CreateSubmissionRequest(BaseModel):
    submission_type: str = Field(..., description="Type of submission (news, resource, event, opportunity, project)")
    title: str = Field(..., description="Post title (plain text)")
    note: Optional[str] = Field(None, description="Optional notes or personal takeaway")
    url: Optional[str] = Field(None, description="Optional reference URL (http/https only)")
    circuit_qasm: Optional[str] = Field(None, description="Optional OpenQASM 2.0 / 3.0 quantum circuit code")
    circuit_data: Optional[Dict[str, Any]] = Field(None, description="Optional parsed quantum circuit structure")

    @field_validator("circuit_qasm")
    @classmethod
    def validate_circuit_qasm(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        clean_qasm = v.strip()
        if len(clean_qasm) > 10000:
            raise ValueError("Circuit QASM code exceeds maximum length of 10,000 characters.")
        if re.search(r"<script|javascript:|onerror=|onload=", clean_qasm, re.IGNORECASE):
            raise ValueError("Circuit QASM contains invalid or forbidden expressions.")
        return clean_qasm

    @field_validator("submission_type")
    @classmethod
    def validate_submission_type(cls, v: str) -> str:
        allowed = ["news", "resource", "event", "events", "opportunity", "project", "courses", "paper", "research", "circuit"]
        norm = v.lower().strip()
        if norm not in allowed:
            raise ValueError(f"Invalid submission type '{v}'. Allowed types: {', '.join(allowed)}")
        return norm

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = sanitize_plain_text(v)
        if not cleaned:
            raise ValueError("Title cannot be empty after sanitization.")
        if len(cleaned) > settings.SUBMISSION_MAX_TITLE_LENGTH:
            raise ValueError(f"Title exceeds maximum length of {settings.SUBMISSION_MAX_TITLE_LENGTH} characters.")
        return cleaned

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = sanitize_plain_text(v)
        if len(cleaned) > settings.SUBMISSION_MAX_NOTE_LENGTH:
            raise ValueError(f"Note exceeds maximum length of {settings.SUBMISSION_MAX_NOTE_LENGTH} characters.")
        return cleaned

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: Optional[str]) -> Optional[str]:
        if not v or not v.strip():
            return None
        url_clean = v.strip()
        parsed = urlsplit(url_clean)
        scheme = (parsed.scheme or "").lower()
        if scheme not in ("http", "https"):
            raise ValueError("URL must use HTTP or HTTPS protocol only.")
        if not parsed.netloc:
            raise ValueError("URL must include a valid domain name.")
        return url_clean

class CreateReportRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500, description="Reason for reporting this signal")

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        cleaned = sanitize_plain_text(v)
        if len(cleaned) < 3:
            raise ValueError("Report reason must be at least 3 characters.")
        return cleaned

class SubmissionResponse(BaseModel):
    id: str
    title: str
    submission_type: str
    section: str
    canonical_url: Optional[str] = None
    note: Optional[str] = None
    circuit_qasm: Optional[str] = None
    circuit_data: Optional[Dict[str, Any]] = None
    status: str
    submitted_at: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_reason: Optional[str] = None
    author_display_name: str
    author_role: str
    audience: str = "public"
    created_at: str
    screening: Optional[Dict[str, Any]] = None
