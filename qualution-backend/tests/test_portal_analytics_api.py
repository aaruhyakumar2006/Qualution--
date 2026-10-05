import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_get_portal_analytics_overview():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/portal/analytics/overview")
        assert response.status_code == 200
        data = response.json()
        assert "total_signals" in data
        assert data["total_signals"] > 0
        assert "verified_signals" in data
        assert "top_curriculum_tags" in data
        assert len(data["top_curriculum_tags"]) > 0
        assert "section_breakdown" in data
        assert len(data["section_breakdown"]) > 0
        assert "avg_fidelity_score" in data
        assert data["avg_fidelity_score"] > 0.9

@pytest.mark.anyio
async def test_get_portal_topic_clusters():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/portal/analytics/clusters")
        assert response.status_code == 200
        data = response.json()
        assert "clusters" in data
        assert len(data["clusters"]) >= 4
        assert "edges" in data
        assert "coverage_percentage" in data
        assert data["coverage_percentage"] > 0

        # Check cluster fields
        cluster0 = data["clusters"][0]
        assert "id" in cluster0
        assert "label" in cluster0
        assert "signal_count" in cluster0
        assert cluster0["signal_count"] > 0
        assert "representative_keywords" in cluster0
