import pytest
import asyncio
from unittest.mock import patch, AsyncMock
from app.services.portal_db_service import portal_db_service, compute_title_hash
from app.services.portal_ingestion_service import portal_ingestion_service

@pytest.mark.anyio
async def test_deduplication_by_canonical_url_and_title_hash():
    """Verify deduplication detects both identical canonical URL and normalized title hash."""
    url = "https://example.com/unique-paper-101"
    title = "Topological Quantum Memory in Majorana Chains"
    t_hash = compute_title_hash(title)

    # Initially does not exist
    exists_before = await portal_db_service.check_item_exists(url, t_hash)
    assert exists_before is False

    # Insert item
    await portal_db_service.upsert_content_item({
        "source": "test",
        "section": "research",
        "title": title,
        "canonical_url": url,
        "title_hash": t_hash,
        "published_at": "2026-10-01T00:00:00Z"
    })

    # Exact canonical URL duplicate
    assert await portal_db_service.check_item_exists(url, "some_other_hash") is True

    # Same title hash with different URL (e.g. mirror link or trailing slash)
    assert await portal_db_service.check_item_exists("https://mirror.com/paper-101", t_hash) is True

    # Case-insensitive & punctuation variation check
    varied_title = "  TOPOLOGICAL Quantum Memory in Majorana Chains!  "
    assert compute_title_hash(varied_title) == t_hash
    assert await portal_db_service.check_item_exists("https://another.com", compute_title_hash(varied_title)) is True

@pytest.mark.anyio
async def test_ingestion_resilience_failing_source_does_not_abort_run():
    """Verify that a network failure on one source is skipped and does not crash the ingestion cycle."""
    mock_sources = [
        {"name": "Failing Source", "type": "rss", "url_or_query": "https://broken-url-does-not-exist.test/rss", "section": "news", "enabled": True},
        {"name": "Working Source", "type": "arxiv", "url_or_query": "cat:quant-ph", "section": "research", "enabled": True}
    ]

    with patch.object(portal_db_service, "get_portal_sources", AsyncMock(return_value=mock_sources)), \
         patch("app.services.portal_ingestion_service.portal_enrichment_service.enrich_item") as mock_enrich, \
         patch("app.services.portal_ingestion_service.fetch_source_items") as mock_fetch:

        from app.schemas.portal_enrichment import EnrichmentOutput
        mock_enrich.return_value = (
            True,
            EnrichmentOutput(
                summary="Verified quantum supremacy on dense graph optimization using QAOA depth 8.",
                level="Advanced",
                tags=["QAOA", "Optimization"],
                curriculum_tags=["Optimization"]
            ),
            "enrich_item.v1"
        )

        async def fetch_side_effect(source):
            if source["name"] == "Failing Source":
                raise ConnectionError("Simulated DNS timeout")
            return [{
                "source": "Working Source",
                "source_tier": 1,
                "section": "research",
                "title": "Quantum Supremacy in Graph Optimization",
                "canonical_url": "https://arxiv.org/abs/2610.99999",
                "published_at": "2026-10-02T12:00:00Z",
                "abstract": "We demonstrate verifiable quantum advantage on 500-vertex random regular graphs using QAOA depth 8."
            }]

        mock_fetch.side_effect = fetch_side_effect

        result = await portal_ingestion_service.run_ingestion_cycle()
        assert result["status"] == "success"
        stats = result["stats"]
        assert stats["sources_processed"] == 2
        assert stats["sources_failed"] == 1
        assert stats["items_discovered"] == 1
        assert stats["items_inserted"] >= 1

@pytest.mark.anyio
async def test_source_driven_ingestion_enable_disable_unknown_types():
    """Verify that changing portal_sources drives ingestion:
       - Enabled source is fetched.
       - Disabled source is skipped.
       - Unknown source type is logged and skipped without stopping the run.
    """
    mock_sources = [
        {"id": "src-1", "name": "Active arXiv Source", "type": "arxiv", "url_or_query": "cat:quant-ph", "section": "research", "enabled": True},
        {"id": "src-2", "name": "Disabled News Source", "type": "rss", "url_or_query": "https://news.test/rss", "section": "news", "enabled": False},
        {"id": "src-3", "name": "Unknown Type Source", "type": "unsupported_type", "url_or_query": "xyz", "section": "events", "enabled": True},
    ]

    fetched_sources = []
    async def mock_fetch(source):
        from app.services.ingestion_handlers import fetch_source_items
        res = await fetch_source_items(source)
        fetched_sources.append(source["name"])
        return res

    with patch.object(portal_db_service, "get_portal_sources", AsyncMock(side_effect=lambda enabled_only=True: [s for s in mock_sources if not enabled_only or s["enabled"]])), \
         patch("app.services.portal_ingestion_service.portal_enrichment_service.enrich_item") as mock_enrich, \
         patch("app.services.portal_ingestion_service.fetch_source_items", side_effect=mock_fetch):

        from app.schemas.portal_enrichment import EnrichmentOutput
        mock_enrich.return_value = (
            True,
            EnrichmentOutput(
                summary="Quantum simulation test summary.",
                level="Beginner",
                tags=["Simulation"],
                curriculum_tags=["Simulation"]
            ),
            "enrich_item.v1"
        )

        result = await portal_ingestion_service.run_ingestion_cycle()
        assert result["status"] == "success"
        stats = result["stats"]
        # Only enabled sources (src-1 and src-3) are processed
        assert stats["sources_processed"] == 2
        assert "Disabled News Source" not in fetched_sources
        assert "Active arXiv Source" in fetched_sources
        # Unknown type (src-3) was dispatched, fetch_source_items logged warning & returned [], cycle completed smoothly
        assert "Unknown Type Source" in fetched_sources


@pytest.mark.anyio
async def test_scheduler_honours_interval_change():
    """Verify that updating fetch_interval_minutes updates the scheduler job interval."""
    # Start scheduler with 60 minutes
    portal_ingestion_service.start_scheduler(interval_mins=60)
    job = portal_ingestion_service.scheduler.get_job("portal_ingestion_job")
    assert job is not None
    assert job.trigger.interval.total_seconds() == 60 * 60

    # Dynamically change interval to 15 minutes
    portal_ingestion_service.update_scheduler_interval(minutes=15)
    updated_job = portal_ingestion_service.scheduler.get_job("portal_ingestion_job")
    assert updated_job.trigger.interval.total_seconds() == 15 * 60

    # Stop scheduler clean up
    portal_ingestion_service.stop_scheduler()


@pytest.mark.anyio
async def test_github_releases_handler_normalization():
    """Verify GitHub releases handler normalizes tags, names, urls, and cleaned markdown bodies."""
    from unittest.mock import MagicMock
    from app.services.ingestion_handlers import GithubHandler
    handler = GithubHandler()

    fake_releases = [
        {
            "tag_name": "v1.2.0",
            "name": "Quantum Transpiler v1.2",
            "html_url": "https://github.com/qualution/core/releases/tag/v1.2.0",
            "body": "<p>Added <strong>pulse-level control</strong></p>\n\nBug fixes in simulator.",
            "published_at": "2026-10-01T10:00:00Z"
        },
        {
            "tag_name": "v2.0.0-rc1",
            "name": "v2.0.0-rc1",  # Same as tag
            "html_url": "https://github.com/qualution/core/releases/tag/v2.0.0-rc1",
            "body": "",
            "published_at": "2026-10-02T12:00:00Z"
        }
    ]

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json = MagicMock(return_value=fake_releases)

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)

    with patch("httpx.AsyncClient", return_value=mock_client):
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = None

        source = {
            "name": "QUALUTION Core GitHub",
            "type": "github",
            "url_or_query": "https://github.com/qualution/core",
            "section": "qualution",
            "source_tier": 1
        }
        items = await handler.fetch(source)
        assert len(items) == 2

        item1 = items[0]
        assert item1["source"] == "QUALUTION Core GitHub"
        assert item1["title"] == "core v1.2.0: Quantum Transpiler v1.2"
        assert item1["canonical_url"] == "https://github.com/qualution/core/releases/tag/v1.2.0"
        assert "pulse-level control" in item1["abstract"]
        assert "<p>" not in item1["abstract"]
        assert item1["section"] == "qualution"

        item2 = items[1]
        assert item2["title"] == "core Release v2.0.0-rc1"
        assert "Official release of" in item2["abstract"]


@pytest.mark.anyio
async def test_github_releases_handler_rate_limit_and_empty():
    """Verify GitHub releases handler gracefully handles 403 rate limits and empty responses."""
    from unittest.mock import MagicMock
    from app.services.ingestion_handlers import GithubHandler
    handler = GithubHandler()

    # Rate limit 403 response
    mock_403 = MagicMock()
    mock_403.status_code = 403
    mock_403.text = "API rate limit exceeded"

    mock_client_403 = AsyncMock()
    mock_client_403.__aenter__.return_value = mock_client_403
    mock_client_403.__aexit__.return_value = None
    mock_client_403.get = AsyncMock(return_value=mock_403)

    with patch("httpx.AsyncClient", return_value=mock_client_403):
        source = {"name": "GH", "url_or_query": "owner/repo"}
        items = await handler.fetch(source)
        assert items == []

    # Empty array response
    mock_empty = MagicMock()
    mock_empty.status_code = 200
    mock_empty.json = MagicMock(return_value=[])

    mock_client_empty = AsyncMock()
    mock_client_empty.__aenter__.return_value = mock_client_empty
    mock_client_empty.__aexit__.return_value = None
    mock_client_empty.get = AsyncMock(return_value=mock_empty)

    with patch("httpx.AsyncClient", return_value=mock_client_empty):
        source = {"name": "GH", "url_or_query": "owner/repo"}
        items = await handler.fetch(source)
        assert items == []

    # Invalid repo query without owner/repo format
    invalid_source = {"name": "GH Invalid", "url_or_query": "invalid-repo-without-slash"}
    items = await handler.fetch(invalid_source)
    assert items == []


@pytest.mark.anyio
async def test_arxiv_handler_error_isolation():
    """Verify arXiv handler gracefully handles non-200 responses and malformed XML."""
    from unittest.mock import MagicMock
    from app.services.ingestion_handlers import ArxivHandler
    handler = ArxivHandler()

    # 1. Non-200 HTTP response
    mock_500 = MagicMock()
    mock_500.status_code = 500
    mock_client_500 = AsyncMock()
    mock_client_500.__aenter__.return_value = mock_client_500
    mock_client_500.__aexit__.return_value = None
    mock_client_500.get = AsyncMock(return_value=mock_500)

    with patch("httpx.AsyncClient", return_value=mock_client_500):
        items = await handler.fetch({"name": "arXiv", "url_or_query": "cat:quant-ph"})
        assert items == []

    # 2. Malformed XML response
    mock_bad_xml = MagicMock()
    mock_bad_xml.status_code = 200
    mock_bad_xml.text = "<unclosed-tag><broken-xml>"
    mock_client_bad_xml = AsyncMock()
    mock_client_bad_xml.__aenter__.return_value = mock_client_bad_xml
    mock_client_bad_xml.__aexit__.return_value = None
    mock_client_bad_xml.get = AsyncMock(return_value=mock_bad_xml)

    with patch("httpx.AsyncClient", return_value=mock_client_bad_xml):
        items = await handler.fetch({"name": "arXiv", "url_or_query": "cat:quant-ph"})
        assert items == []


@pytest.mark.anyio
async def test_rss_handler_error_isolation():
    """Verify RSS handler handles non-200 status, invalid XML, and missing feed URL."""
    from unittest.mock import MagicMock
    from app.services.ingestion_handlers import RssHandler
    handler = RssHandler()

    # 1. Missing or invalid feed URL
    items_invalid_url = await handler.fetch({"name": "RSS", "url_or_query": "not-a-valid-http-url"})
    assert items_invalid_url == []

    # 2. HTTP error 404
    mock_404 = MagicMock()
    mock_404.status_code = 404
    mock_client_404 = AsyncMock()
    mock_client_404.__aenter__.return_value = mock_client_404
    mock_client_404.__aexit__.return_value = None
    mock_client_404.get = AsyncMock(return_value=mock_404)

    with patch("httpx.AsyncClient", return_value=mock_client_404):
        items = await handler.fetch({"name": "RSS", "url_or_query": "https://example.com/feed.xml"})
        assert items == []

    # 3. Malformed XML
    mock_bad_xml = MagicMock()
    mock_bad_xml.status_code = 200
    mock_bad_xml.text = "<html><body>Not valid RSS XML</body></html>"
    mock_client_bad_xml = AsyncMock()
    mock_client_bad_xml.__aenter__.return_value = mock_client_bad_xml
    mock_client_bad_xml.__aexit__.return_value = None
    mock_client_bad_xml.get = AsyncMock(return_value=mock_bad_xml)

    with patch("httpx.AsyncClient", return_value=mock_client_bad_xml):
        items = await handler.fetch({"name": "RSS", "url_or_query": "https://example.com/feed.xml"})
        assert items == []


@pytest.mark.anyio
async def test_ingestion_api_endpoints_permissions_and_trigger():
    """Verify ingestion management endpoints enforce educator auth and execute cycles."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request to /ingest/status is rejected
        res_unauth = await client.get("/api/v1/portal/ingest/status")
        assert res_unauth.status_code == 401

        # 2. Student role request is forbidden
        res_student = await client.get(
            "/api/v1/portal/ingest/status",
            headers={"Authorization": "Bearer usr-student-alex"}
        )
        assert res_student.status_code == 403

        # 3. Teacher can get status
        res_teacher_status = await client.get(
            "/api/v1/portal/ingest/status",
            headers={"Authorization": "Bearer usr-teacher-elena"}
        )
        assert res_teacher_status.status_code == 200
        status_data = res_teacher_status.json()
        assert "interval_minutes" in status_data
        assert "scheduler_running" in status_data

        # 4. Teacher can update interval
        res_interval = await client.put(
            "/api/v1/portal/ingest/interval?minutes=45",
            headers={"Authorization": "Bearer usr-teacher-elena"}
        )
        assert res_interval.status_code == 200
        assert res_interval.json()["status"] == "success"

        # 5. Teacher can trigger manual ingestion
        with patch.object(portal_ingestion_service, "run_ingestion_cycle", AsyncMock(return_value={"status": "success", "stats": {"items_discovered": 5}})):
            res_trigger = await client.post(
                "/api/v1/portal/ingest/trigger",
                headers={"Authorization": "Bearer usr-teacher-elena"}
            )
            assert res_trigger.status_code == 200
            assert res_trigger.json()["status"] == "success"

