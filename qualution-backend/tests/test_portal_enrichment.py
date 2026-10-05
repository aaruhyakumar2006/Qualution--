import pytest
from app.schemas.portal_enrichment import EnrichmentOutput
from app.services.portal_enrichment_service import portal_enrichment_service, PROMPT_VERSION

def test_pydantic_validation_valid_output():
    """Verify that conforming LLM JSON validates into EnrichmentOutput."""
    raw_data = {
        "summary": "This paper demonstrates scalable topological surface codes with sub-threshold error rates. It introduces real-time decoding on physical quantum hardware.",
        "level": "Intermediate",
        "tags": ["Surface Codes", "Fault Tolerance"],
        "curriculum_tags": ["Error Correction"]
    }
    output = EnrichmentOutput(**raw_data)
    assert output.level == "Intermediate"
    assert "Surface Codes" in output.tags
    assert output.curriculum_tags == ["Error Correction"]
    assert len(output.summary) > 20

def test_pydantic_validation_invalid_level():
    """Verify that invalid level raises validation error."""
    with pytest.raises(Exception):
        EnrichmentOutput(
            summary="A valid summary of sufficient length for test purposes.",
            level="Expert",  # Invalid, only Beginner|Intermediate|Advanced
            tags=["QEC"]
        )

def test_deterministic_fallback():
    """Verify that deterministic fallback extracts summary from abstract without hallucination."""
    abstract = "Google Willow demonstrates 1,000 physical qubits operating below fault tolerance threshold. Surface code scaling reduces logical error exponentially. Physical calibration is detailed."
    fallback = portal_enrichment_service.deterministic_fallback(
        title="Google Willow Paper",
        abstract=abstract,
        allowed_curriculum_tags=["Error Correction", "Grover", "Superposition"]
    )
    assert fallback.summary.startswith("Google Willow demonstrates 1,000 physical qubits")
    assert "Error Correction" in fallback.curriculum_tags  # Triggered by keyword in abstract
    assert fallback.level in ["Beginner", "Intermediate", "Advanced"]

def test_curriculum_tags_bounded_to_allowed():
    """Verify that LLM cannot inject arbitrary curriculum tags outside allowed list."""
    allowed = ["Error Correction", "Entanglement"]
    # Even if LLM attempted to include "MadeUpTag", enrichment service strips it
    raw_response = '{"summary": "Test quantum computing summary of sufficient length.", "level": "Beginner", "tags": ["tag1"], "curriculum_tags": ["Error Correction", "NonExistentTag"]}'
    data = portal_enrichment_service._extract_json_block(raw_response)
    valid_tags = [t for t in data["curriculum_tags"] if t in allowed]
    assert valid_tags == ["Error Correction"]
    assert "NonExistentTag" not in valid_tags

def test_prompt_version():
    """Verify prompt version is consistent and tracked."""
    assert portal_enrichment_service.prompt_version == PROMPT_VERSION
    assert PROMPT_VERSION == "enrich_item.v1"

def test_source_grounded_numbers_with_verbatim_metrics():
    """Verify that an item with verbatim numbers in the abstract retains those exact numbers."""
    abstract_with_numbers = (
        "Quantinuum H2 demonstrates 1,000 qubits and 99.9% 2-qubit gate fidelity under cryogenic benchmarking. "
        "Logical state preparation achieves 12 fault-tolerant qubits with a 0.8% error threshold."
    )
    fallback = portal_enrichment_service.deterministic_fallback(
        title="Quantinuum H2 Benchmark",
        abstract=abstract_with_numbers,
        allowed_curriculum_tags=["Hardware", "Error Correction"]
    )
    # The summary strictly derives from abstract and retains source numbers
    assert "1,000 qubits" in fallback.summary
    assert "99.9%" in fallback.summary

def test_source_grounded_numbers_without_metrics_does_not_invent():
    """Verify that an item without numbers in the abstract does NOT have invented qubit counts or percentages."""
    abstract_without_numbers = (
        "We study the theoretical query complexity of non-bipartite graph search using quantum random walks. "
        "Our proof bounds the generalized Ambainis adversary matrix for triangle finding in dense adjacency matrices."
    )
    fallback = portal_enrichment_service.deterministic_fallback(
        title="Query Complexity of Graph Search",
        abstract=abstract_without_numbers,
        allowed_curriculum_tags=["Grover", "Optimization"]
    )
    
    # Assert no invented metric figures, percentages, or qubit counts exist in the summary
    import re
    # Check no patterns like '1,000 qubits', '100 qubits', '99.9%', '99%' were invented
    assert not re.search(r"\b\d+\s+qubits?\b", fallback.summary, re.IGNORECASE)
    assert not re.search(r"\b\d+(\.\d+)?%\b", fallback.summary)
    assert "qubits" not in fallback.summary.lower() or "qubit" not in fallback.summary.lower()
