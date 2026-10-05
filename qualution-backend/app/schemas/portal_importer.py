from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ImportedSignalItem(BaseModel):
    title: str
    author_display_name: Optional[str] = "Community Contributor"
    canonical_url: Optional[str] = None
    abstract: Optional[str] = ""
    summary: Optional[str] = ""
    section: Optional[str] = "papers"
    level: Optional[str] = "Intermediate"
    tags: List[str] = Field(default_factory=list)
    curriculum_tags: List[str] = Field(default_factory=list)
    circuit_qasm: Optional[str] = None

class BatchImportRequest(BaseModel):
    raw_bibtex: Optional[str] = None
    items: Optional[List[ImportedSignalItem]] = None
    format: str = "bibtex"  # 'bibtex' | 'json' | 'manual'
    default_section: Optional[str] = "papers"

class BatchImportResultItem(BaseModel):
    title: str
    status: str  # 'imported' | 'skipped_duplicate' | 'invalid'
    item_id: Optional[str] = None
    reason: Optional[str] = None

class BatchImportResponse(BaseModel):
    total_received: int
    imported_count: int
    skipped_count: int
    results: List[BatchImportResultItem]
    timestamp_iso: str
