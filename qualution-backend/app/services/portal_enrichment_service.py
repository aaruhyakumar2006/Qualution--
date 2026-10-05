import json
import logging
import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from app.core.config import settings
from app.schemas.portal_enrichment import EnrichmentOutput
from app.services.providers.nvidia_provider import nvidia_provider

logger = logging.getLogger("portal_enrichment_service")

# Locate versioned prompt file
PROMPT_FILE = Path(__file__).resolve().parent.parent.parent / "prompts" / "enrich_item.v1.txt"
PROMPT_VERSION = "enrich_item.v1"

def load_prompt_template() -> str:
    """Loads the versioned prompt template from disk at startup."""
    if not PROMPT_FILE.exists():
        logger.warning(f"Prompt template file not found at {PROMPT_FILE}, using built-in fallback.")
        return (
            "Analyze this quantum computing dispatch and output valid JSON with keys: "
            "summary, level, tags, curriculum_tags.\n"
            "ALLOWED CURRICULUM TAGS: {allowed_curriculum_tags}\n"
            "Title: {title}\nSource: {source}\nAbstract: {abstract}"
        )
    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()

PROMPT_TEMPLATE = load_prompt_template()

class PortalEnrichmentService:
    def __init__(self):
        self.prompt_version = PROMPT_VERSION

    @property
    def prompt_template(self) -> str:
        return load_prompt_template()

    def _extract_json_block(self, text: str) -> Optional[Dict[str, Any]]:
        """Extracts JSON dictionary from raw LLM output even if surrounded by markdown fences."""
        if not text:
            return None
        text = text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            text = "\n".join(lines).strip()

        # Try direct parse
        try:
            return json.loads(text)
        except Exception:
            pass

        # Try regex search for first { ... }
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
        return None

    def deterministic_fallback(
        self,
        title: str,
        abstract: Optional[str],
        allowed_curriculum_tags: List[str]
    ) -> EnrichmentOutput:
        """
        Deterministic, hallucination-free fallback when LLM is unavailable or invalid.
        Derives summary strictly from the first 2-3 sentences of the source abstract.
        """
        raw_text = (abstract or title).strip()
        # Split on sentence boundaries
        sentences = re.split(r"(?<=[.!?])\s+", raw_text)
        if len(sentences) >= 2:
            summary = " ".join(sentences[:2])
        elif len(sentences) == 1 and len(sentences[0]) > 20:
            summary = sentences[0]
        else:
            summary = f"Curated quantum telemetry dispatch: {title}."

        # Ensure minimum length
        if len(summary) < 20:
            summary = f"Official research signal regarding {title}. Link provided for full primary source."

        # Match curriculum tags deterministically based on keyword presence
        matched_curriculum = []
        lower_combined = f"{raw_text} {title}".lower()
        tag_synonyms = {
            "error correction": ["error correction", "qec", "surface code", "stabilizer", "fault tolerance"],
            "superposition": ["superposition", "hadamard"],
            "entanglement": ["entanglement", "bell state", "chsh", "epr"],
            "grover": ["grover", "amplitude amplification", "search algorithm"],
            "phase estimation": ["phase estimation", "qpe", "phase kickback"],
            "optimization": ["qaoa", "vqe", "combinatorial optimization", "maxcut"],
            "cryptography": ["cryptography", "bb84", "qkd", "post-quantum"],
            "visualization": ["bloch sphere", "visualization", "state vector"],
            "hardware": ["qubit", "cryogenic", "decoherence", "processor", "transmon", "condor", "willow"]
        }
        for tag in allowed_curriculum_tags:
            tag_lower = tag.lower()
            syns = tag_synonyms.get(tag_lower, [tag_lower])
            if any(syn in lower_combined for syn in syns):
                matched_curriculum.append(tag)

        # Infer basic level
        level = "Beginner"
        lower_text = raw_text.lower()
        if any(w in lower_text for w in ["hamiltonian", "fault-tolerant", "topological", "eigensolver", "non-abelian"]):
            level = "Advanced"
        elif any(w in lower_text for w in ["grover", "bell state", "entanglement", "phase estimation", "vqe"]):
            level = "Intermediate"

        tags = ["Quantum"]
        if matched_curriculum:
            tags.extend(matched_curriculum[:2])
        else:
            tags.append("Research")

        return EnrichmentOutput(
            summary=summary[:1400],
            level=level, # type: ignore
            tags=list(set(tags))[:5],
            curriculum_tags=matched_curriculum[:3]
        )

    def enrich_item(
        self,
        title: str,
        abstract: Optional[str],
        source: str,
        allowed_curriculum_tags: List[str]
    ) -> Tuple[bool, EnrichmentOutput, str]:
        """
        Enriches a single item using NVIDIA NIM with schema validation and one retry.
        Returns:
            Tuple[bool, EnrichmentOutput, str]: (is_enriched, validated_output, prompt_version)
        """
        abs_text = (abstract or "").strip()
        if not abs_text:
            # Cannot enrich with LLM if no abstract provided; use deterministic fallback
            fallback = self.deterministic_fallback(title, abstract, allowed_curriculum_tags)
            return False, fallback, self.prompt_version

        tags_str = ", ".join(allowed_curriculum_tags) if allowed_curriculum_tags else "None"
        formatted_prompt = self.prompt_template.format(
            title=title,
            source=source,
            abstract=abs_text,
            allowed_curriculum_tags=tags_str
        )

        system_instruction = "You are the QUALUTION Quantum Editorial AI Assistant. Output ONLY valid raw JSON conforming strictly to the requested schema."

        # Attempt 1 + 1 retry on invalid output
        for attempt in range(2):
            try:
                # Call NVIDIA NIM
                raw_response, _, status_code = nvidia_provider._call_chat_completions(
                    system_prompt=system_instruction,
                    user_prompt=formatted_prompt,
                    max_tokens=600,
                    temperature=0.2
                )

                if raw_response and status_code == "success":
                    data = self._extract_json_block(raw_response)
                    if data and isinstance(data, dict):
                        # Filter curriculum tags to ONLY allowed tags
                        raw_c_tags = data.get("curriculum_tags", [])
                        valid_c_tags = [t for t in raw_c_tags if t in allowed_curriculum_tags]
                        data["curriculum_tags"] = valid_c_tags

                        # Validate with Pydantic
                        validated = EnrichmentOutput(**data)
                        return True, validated, self.prompt_version
                    else:
                        logger.warning(f"Enrichment attempt {attempt + 1}: Could not parse JSON from output: {raw_response[:100]}")
                else:
                    logger.info(f"Enrichment attempt {attempt + 1}: NVIDIA NIM returned {status_code}")
            except Exception as e:
                logger.warning(f"Enrichment attempt {attempt + 1} exception: {e}")

        # If LLM failed or retry failed, return deterministic fallback with enriched=False
        logger.info(f"Enrichment fallback used for '{title}'. Setting enriched=False.")
        fallback_output = self.deterministic_fallback(title, abstract, allowed_curriculum_tags)
        return False, fallback_output, self.prompt_version

portal_enrichment_service = PortalEnrichmentService()
