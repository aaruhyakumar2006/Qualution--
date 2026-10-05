from typing import List, Dict, Optional
from pydantic import BaseModel, Field

class TagCount(BaseModel):
    tag: str
    count: int
    category: Optional[str] = "curriculum"

class SectionBreakdown(BaseModel):
    section_id: str
    section_name: str
    count: int
    percentage: float

class AnalyticsOverviewResponse(BaseModel):
    total_signals: int
    verified_signals: int
    active_discussions: int
    total_peer_reviews: int
    avg_fidelity_score: float
    weekly_velocity_signals: int
    top_curriculum_tags: List[TagCount]
    section_breakdown: List[SectionBreakdown]
    last_updated_iso: str

class ClusterNode(BaseModel):
    id: str
    label: str
    signal_count: int
    avg_relevance: float
    representative_keywords: List[str]
    sample_signal_ids: List[str]

class ClusterEdge(BaseModel):
    source: str
    target: str
    weight: float
    shared_keywords: List[str]

class TopicClustersResponse(BaseModel):
    clusters: List[ClusterNode]
    edges: List[ClusterEdge]
    total_clustered_signals: int
    coverage_percentage: float
    computed_at_iso: str
