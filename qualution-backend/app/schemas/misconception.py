from typing import List, Literal, Dict, Any, Optional
from pydantic import BaseModel, Field, model_validator
from app.schemas.circuit import CircuitRequest

SeverityLevel = Literal["low", "medium", "high", "critical"]

class RemediationExperiment(BaseModel):
    title: str
    description: str
    comparison_circuit: Optional[CircuitRequest] = None

class MisconceptionCatalogEntry(BaseModel):
    id: str
    concept_ids: List[str] = Field(..., min_length=1)
    name: str
    faulty_rule: str
    mutation_ref: str
    probe_circuits: List[CircuitRequest] = Field(..., min_length=1)
    student_prompt_template: str
    hint_ladder: List[str] = Field(..., min_length=4, max_length=4)
    remediation_experiment: Dict[str, Any]
    severity: SeverityLevel

    @model_validator(mode="after")
    def validate_hint_ladder(self) -> "MisconceptionCatalogEntry":
        if len(self.hint_ladder) != 4:
            raise ValueError(f"hint_ladder must contain exactly 4 levels, got {len(self.hint_ladder)}")
        return self

class MisconceptionCatalog(BaseModel):
    version: str
    entries: List[MisconceptionCatalogEntry]
