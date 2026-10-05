import json
import pytest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent
SEED_FILE = BASE_DIR / "data" / "portal_seed.json"

def test_portal_seed_structure_and_invariants():
    """
    Asserts all FIX 2 invariants across seeded portal items:
    1. Every section (COURSES, NEWS, RESEARCH, EVENTS, OPPORTUNITIES, QUALUTION) has >= 2 items.
    2. Research items have real arXiv titles/abstracts and plausible canonical URLs.
    3. Courses items reference real quantum topics (Grover's, Shor's, VQE, QAOA, QEC) and link to qualution.org/courses.
    4. News items cite real quantum organizations (IBM Quantum, Google Quantum AI, Quantinuum, IonQ, QuEra, Rigetti, Microsoft).
    5. Opportunities list real fellowships, internships, hackathons (QHack, MIT iQuHACK, IBM Quantum Challenge, CERN openlab, Unitary Fund grants).
    6. Every item's source name matches a defined name in portal_sources.
    """
    assert SEED_FILE.exists(), f"Seed file not found at {SEED_FILE}"
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    portal_sources = data.get("portal_sources", [])
    content_items = data.get("content_items", [])
    curriculum_tags = data.get("curriculum_tags", [])

    assert len(portal_sources) > 0
    assert len(content_items) >= 20
    assert len(curriculum_tags) > 0

    valid_source_names = {s["name"] for s in portal_sources}

    # 1. Section counts (each must have >= 2 items)
    required_sections = ["courses", "news", "research", "events", "opportunities", "qualution"]
    section_counts = {sec: 0 for sec in required_sections}

    for item in content_items:
        sec = item.get("section", "").lower()
        if sec in section_counts:
            section_counts[sec] += 1

        # 6. Source name matches portal_sources
        src = item.get("source")
        assert src in valid_source_names, f"Item '{item.get('title')}' has source '{src}' not found in portal_sources"

        # Check required fields
        assert item.get("title"), "Item missing title"
        assert item.get("canonical_url", "").startswith("http"), "Item missing valid canonical URL"
        assert item.get("abstract"), "Item missing abstract"
        assert item.get("summary"), "Item missing summary"
        assert item.get("level") in ["Beginner", "Intermediate", "Advanced"], f"Invalid level: {item.get('level')}"

    for sec, count in section_counts.items():
        assert count >= 2, f"Section '{sec}' has only {count} items; required >= 2"

    # 2. Research items invariants
    research_items = [i for i in content_items if i["section"].lower() == "research"]
    for r in research_items:
        assert "arxiv.org" in r["canonical_url"] or "doi.org" in r["canonical_url"] or "nature.com" in r["canonical_url"]
        assert len(r["abstract"]) > 50

    # 3. Courses items invariants
    courses_items = [i for i in content_items if i["section"].lower() == "courses"]
    courses_text = " ".join(f"{c['title']} {c['abstract']} {c['summary']}" for c in courses_items).lower()
    for topic in ["qec", "surface code", "vqe", "qaoa", "grover", "shor", "bloch"]:
        assert any(term in courses_text for term in [topic, topic.replace(" ", "")]), f"Courses lack coverage for {topic}"
    for c in courses_items:
        assert "qualution.org/courses" in c["canonical_url"]

    # 4. News items invariants (organizations)
    news_items = [i for i in content_items if i["section"].lower() == "news"]
    news_text = " ".join(f"{n['title']} {n['abstract']} {n['summary']}" for n in news_items)
    recognized_orgs = ["IBM", "Google", "Quantinuum", "Microsoft", "QuEra", "Rigetti", "IonQ"]
    found_orgs = [org for org in recognized_orgs if org in news_text]
    assert len(found_orgs) >= 4, f"News items do not cite enough real quantum orgs: {found_orgs}"

    # 5. Opportunities items invariants
    opp_items = [i for i in content_items if i["section"].lower() == "opportunities"]
    opp_text = " ".join(f"{o['title']} {o['abstract']} {o['summary']}" for o in opp_items)
    recognized_opps = ["Unitary Fund", "CERN", "IBM Quantum Challenge", "QHack", "Fellowship", "Internship"]
    found_opps = [opp for opp in recognized_opps if opp in opp_text]
    assert len(found_opps) >= 3, f"Opportunities lack recognizable quantum programs: {found_opps}"
