import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings

@pytest.mark.anyio
async def test_portal_sections_endpoint():
    """Verify GET /api/v1/portal/sections returns the 7 books with metadata."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/portal/sections")
        assert resp.status_code == 200
        sections = resp.json()
        assert len(sections) == 7
        ids = [s["id"] for s in sections]
        assert "all" in ids
        assert "courses" in ids
        assert "news" in ids
        assert "research" in ids
        assert "events" in ids
        assert "opportunities" in ids
        assert "qualution" in ids

        for s in sections:
            assert "title" in s
            assert "accent" in s
            assert "item_count" in s

@pytest.mark.anyio
async def test_portal_tags_endpoint():
    """Verify GET /api/v1/portal/tags returns curriculum tag to lesson mappings."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/portal/tags")
        assert resp.status_code == 200
        tags = resp.json()
        assert len(tags) > 0
        for t in tags:
            assert "tag" in t
            assert "lesson_id" in t
            assert "label" in t
        tag_names = [t["tag"] for t in tags]
        assert "Grover" in tag_names
        assert "Error Correction" in tag_names

@pytest.mark.anyio
async def test_portal_items_pagination_and_filters():
    """Verify GET /api/v1/portal/items pagination, section filter, and level filter."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Default fetch
        resp = await client.get("/api/v1/portal/items?limit=5")
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
        assert "has_more" in data
        assert len(data["items"]) <= 5

        # Filter by section 'courses'
        resp_courses = await client.get("/api/v1/portal/items?section=courses")
        assert resp_courses.status_code == 200
        courses_data = resp_courses.json()
        for item in courses_data["items"]:
            assert item["section"] == "courses"

        # Filter by level 'Beginner'
        resp_beg = await client.get("/api/v1/portal/items?level=Beginner")
        assert resp_beg.status_code == 200
        beg_data = resp_beg.json()
        for item in beg_data["items"]:
            assert item["level"] == "Beginner"

        # Search filter 'Google'
        resp_q = await client.get("/api/v1/portal/items?q=Google")
        assert resp_q.status_code == 200
        q_data = resp_q.json()
        assert len(q_data["items"]) > 0
        assert any("google" in it["title"].lower() or "google" in it.get("summary", "").lower() for it in q_data["items"])

@pytest.mark.anyio
async def test_portal_item_by_id_and_not_found():
    """Verify GET /api/v1/portal/items/{id} returns single item or 404."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Fetch list to get valid ID
        resp_list = await client.get("/api/v1/portal/items?limit=1")
        items = resp_list.json()["items"]
        if items:
            valid_id = items[0]["id"]
            resp_item = await client.get(f"/api/v1/portal/items/{valid_id}")
            assert resp_item.status_code == 200
            assert resp_item.json()["id"] == valid_id

        # 404 for bogus ID
        resp_404 = await client.get("/api/v1/portal/items/non-existent-id-999")
        assert resp_404.status_code == 404

@pytest.mark.anyio
async def test_portal_ingest_manual_trigger_security():
    """Verify POST /api/v1/portal/ingest rejects unauthorized requests and allows authorized."""
    from unittest.mock import patch, AsyncMock
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Missing header -> 401
        resp_no_secret = await client.post("/api/v1/portal/ingest")
        assert resp_no_secret.status_code == 401

        # Wrong secret -> 401
        resp_wrong = await client.post(
            "/api/v1/portal/ingest",
            headers={"X-Ingestion-Secret": "invalid_wrong_token"}
        )
        assert resp_wrong.status_code == 401

        # Valid secret
        with patch("app.api.routes.portal.portal_ingestion_service.run_ingestion_cycle", AsyncMock(return_value={"status": "success", "stats": {"sources_processed": 5}})):
            resp_valid = await client.post(
                "/api/v1/portal/ingest",
                headers={"X-Ingestion-Secret": settings.INGESTION_SECRET}
            )
            assert resp_valid.status_code == 200
            assert resp_valid.json()["status"] == "success"
            assert "stats" in resp_valid.json()
