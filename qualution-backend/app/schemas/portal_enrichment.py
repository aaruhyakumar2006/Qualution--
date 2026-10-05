from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator

class EnrichmentOutput(BaseModel):
    """
    Pydantic-validated output schema for NVIDIA NIM portal item enrichment.
    Enforces student-friendly 2-3 sentence summary, standard levels, and tags.
    """
    summary: str = Field(
        ...,
        description="2-3 sentence student-friendly summary written strictly from the abstract.",
        min_length=15,
        max_length=1500
    )
    level: Literal["Beginner", "Intermediate", "Advanced"] = Field(
        default="Beginner",
        description="Target educational difficulty level."
    )
    tags: List[str] = Field(
        default_factory=list,
        description="List of 1 to 5 topical quantum computing tags."
    )
    curriculum_tags: List[str] = Field(
        default_factory=list,
        description="List of curriculum tags matched against allowed tags from the database."
    )

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, v: List[str]) -> List[str]:
        cleaned = [t.strip() for t in v if t and t.strip()]
        return cleaned[:5] if cleaned else ["Quantum"]

class EnrichedPortalItem(BaseModel):
    id: Optional[str] = None
    source: str
    source_tier: int = 1
    section: str
    title: str
    canonical_url: str
    title_hash: str
    published_at: str
    abstract: Optional[str] = None
    summary: Optional[str] = None
    level: str = "Beginner"
    tags: List[str] = Field(default_factory=list)
    curriculum_tags: List[str] = Field(default_factory=list)
    enriched: bool = False
    prompt_version: Optional[str] = None
