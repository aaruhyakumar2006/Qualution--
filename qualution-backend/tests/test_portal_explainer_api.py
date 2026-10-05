import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_explain_quantum_paper_custom_payload():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "title": "Fault-Tolerant Surface Codes on Heavy-Hex Architectures",
            "abstract": "We demonstrate distance-3 surface code stabilizer syndrome measurements below the fault-tolerance threshold.",
            "selected_tier": "beginner"
        }
        response = await client.post("/api/v1/portal/explain", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["assistant_name"] == "Mario Quantum AI"
        assert "tiers" in data
        assert "beginner" in data["tiers"]
        assert "undergraduate" in data["tiers"]
        assert "practitioner" in data["tiers"]

        # Check beginner tier structure
        beginner = data["tiers"]["beginner"]
        assert "Intuitive" in beginner["title"] or "Mario AI" in beginner["title"]
        assert len(beginner["actionable_takeaways"]) > 0
        assert beginner["mathematical_intuition"]

        # Check concept map
        assert "concept_map" in data
        assert len(data["concept_map"]) >= 4
        assert any(n["category"] == "prerequisite" for n in data["concept_map"])
        assert any(n["category"] == "outcome" for n in data["concept_map"])

@pytest.mark.anyio
async def test_explain_quantum_paper_default_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/portal/explain", json={})
        assert response.status_code == 200
        data = response.json()
        assert data["assistant_name"] == "Mario Quantum AI"
        assert "tiers" in data
        assert len(data["concept_map"]) > 0
