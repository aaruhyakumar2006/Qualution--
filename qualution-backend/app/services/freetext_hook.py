from typing import List, Dict, Any
from app.services.concept_taxonomy import load_concept_taxonomy

class FreeTextConceptMapper:
    """
    Interface for mapping free-text student chat messages or questions
    to quantum concept IDs.
    
    Current implementation: Keyword-based deterministic matcher.
    TODO: Integrate Gemini/LLM semantic embedding classifier when LLM calls are enabled.
    """
    def __init__(self):
        self.taxonomy = load_concept_taxonomy()

    def map_text_to_concepts(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []

        lower_text = text.lower()
        matched_concept_ids: List[str] = []

        # Keyword mapping rules
        keyword_map = {
            "superposition": ["superposition", "hadamard_gate"],
            "hadamard": ["hadamard_gate"],
            "measure": ["measurement_collapse"],
            "collapse": ["measurement_collapse"],
            "phase": ["phase", "relative_vs_global_phase"],
            "bell": ["entanglement"],
            "entangle": ["entanglement"],
            "cnot": ["cnot_gate"],
            "oracle": ["oracle", "phase_kickback"],
            "diffuser": ["diffuser", "quantum_interference"],
            "grover": ["grovers_search"],
            "vqe": ["vqe_ansatz", "vqe_parameterization"],
            "rotation": ["rotation_gates"]
        }

        for keyword, concept_ids in keyword_map.items():
            if keyword in lower_text:
                for cid in concept_ids:
                    if cid not in matched_concept_ids:
                        matched_concept_ids.append(cid)

        # Fallback to general qubit basis if no keyword matched
        if not matched_concept_ids:
            matched_concept_ids.append("qubit_basis")

        return matched_concept_ids

freetext_mapper = FreeTextConceptMapper()
