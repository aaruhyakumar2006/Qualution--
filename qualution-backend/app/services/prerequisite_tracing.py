from typing import Dict, List, Optional, Set, Any
from pydantic import BaseModel
from app.services.concept_taxonomy import load_concept_taxonomy, ConceptTaxonomy
from app.services.evidence_engine import MisconceptionStatusSummary

class PrerequisiteTraceResult(BaseModel):
    failing_concept_id: str
    weakest_prerequisite_id: str
    prerequisite_chain: List[str]
    root_cause_concept: Dict[str, Any]

def trace_weakest_prerequisite(
    failing_concept_id: str,
    statuses: Optional[Dict[str, MisconceptionStatusSummary]] = None
) -> Dict[str, Any]:
    """
    Given a failing concept ID, traverses the concept prerequisite DAG upwards
    to find the root-cause or weakest prerequisite concept.
    """
    taxonomy = load_concept_taxonomy()
    concept_map = {c.id: c for c in taxonomy.concepts}

    if failing_concept_id not in concept_map:
        return {
            "failing_concept_id": failing_concept_id,
            "weakest_prerequisite_id": failing_concept_id,
            "prerequisite_chain": [failing_concept_id],
            "reason": f"Concept '{failing_concept_id}' not found in taxonomy"
        }

    # Traverse prerequisites recursively using DFS
    prereq_chain: List[str] = []
    visited: Set[str] = set()

    def dfs(cid: str):
        if cid in visited:
            return
        visited.add(cid)
        prereq_chain.append(cid)
        concept = concept_map.get(cid)
        if concept:
            for pid in concept.prerequisite_ids:
                dfs(pid)

    dfs(failing_concept_id)

    # Find the earliest concept in chain (deepest prerequisite)
    weakest_id = prereq_chain[-1]
    weakest_concept = concept_map.get(weakest_id)

    return {
        "failing_concept_id": failing_concept_id,
        "weakest_prerequisite_id": weakest_id,
        "prerequisite_chain": prereq_chain,
        "root_cause_concept": weakest_concept.model_dump() if weakest_concept else {}
    }
