from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ConceptMapNode(BaseModel):
    id: str
    label: str
    category: str  # 'prerequisite' | 'core_mechanism' | 'outcome' | 'hardware_constraint'
    description: str
    depends_on: List[str] = Field(default_factory=list)

class ExplanationTier(BaseModel):
    tier: str  # 'beginner' | 'undergraduate' | 'practitioner'
    title: str
    summary: str
    key_breakthrough: str
    mathematical_intuition: str
    analogy: Optional[str] = None
    actionable_takeaways: List[str]

class ExplainRequest(BaseModel):
    item_id: Optional[str] = None
    title: Optional[str] = None
    abstract: Optional[str] = None
    selected_tier: Optional[str] = "beginner"
    user_query: Optional[str] = None

class ExplainResponse(BaseModel):
    item_id: Optional[str] = None
    paper_title: str
    assistant_name: str = "Mario Quantum AI"
    tiers: Dict[str, ExplanationTier]
    concept_map: List[ConceptMapNode]
    generated_at_iso: str
