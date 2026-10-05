import json
from pathlib import Path
from typing import Dict, List, Set, Any
from pydantic import BaseModel

TAXONOMY_FILE_PATH = Path(__file__).parent.parent / "data" / "concept_taxonomy.json"

class ConceptDefinition(BaseModel):
    id: str
    name: str
    definition: str
    prerequisite_ids: List[str]
    lesson_step_ids: List[str]

class ConceptTaxonomy(BaseModel):
    version: str
    concepts: List[ConceptDefinition]

def load_concept_taxonomy(file_path: Path = TAXONOMY_FILE_PATH) -> ConceptTaxonomy:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return ConceptTaxonomy(**data)

def validate_concept_taxonomy_dag(taxonomy: ConceptTaxonomy) -> Dict[str, Any]:
    """
    Validates that:
    1. All prerequisite_ids exist in the concept list.
    2. The graph contains no cycles (is a valid DAG).
    Returns a dict with 'valid': bool, 'errors': List[str], 'cycles': List[List[str]].
    """
    errors: List[str] = []
    concept_map: Dict[str, ConceptDefinition] = {c.id: c for c in taxonomy.concepts}
    
    # 1. Check unknown prerequisite IDs
    for c in taxonomy.concepts:
        for prereq_id in c.prerequisite_ids:
            if prereq_id not in concept_map:
                errors.append(f"Concept '{c.id}' references unknown prerequisite ID '{prereq_id}'")

    # 2. Cycle detection using Depth First Search (DFS)
    visited: Set[str] = set()
    rec_stack: Set[str] = set()
    cycles: List[List[str]] = []

    def dfs(concept_id: str, path: List[str]):
        visited.add(concept_id)
        rec_stack.add(concept_id)
        path.append(concept_id)

        concept = concept_map.get(concept_id)
        if concept:
            for prereq_id in concept.prerequisite_ids:
                if prereq_id not in visited:
                    if prereq_id in concept_map:
                        dfs(prereq_id, path)
                elif prereq_id in rec_stack:
                    cycle_start = path.index(prereq_id)
                    cycle_path = path[cycle_start:] + [prereq_id]
                    cycles.append(cycle_path)
                    errors.append(f"Cycle detected in concept prerequisites: {' -> '.join(cycle_path)}")

        rec_stack.remove(concept_id)
        path.pop()

    for concept_id in concept_map:
        if concept_id not in visited:
            dfs(concept_id, [])

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "cycles": cycles
    }
