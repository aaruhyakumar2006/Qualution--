import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.portal_db_service import PortalDbService
from app.core.config import settings

@pytest.mark.anyio
async def test_db_service_in_memory_fallback_when_database_url_unset():
    """Verify that when DATABASE_URL is unset, PortalDbService gracefully operates in memory."""
    service = PortalDbService()
    
    with patch("app.services.portal_db_service.settings.DATABASE_URL", None):
        pool = await service.get_db_pool()
        assert pool is None

        # Verify sources loaded from seed into memory
        sources = await service.get_portal_sources(enabled_only=True)
        assert len(sources) > 0

        # Verify curriculum tags loaded into memory
        tags = await service.get_curriculum_tags()
        assert len(tags) > 0

        # Test in-memory upsert and deduplication check
        test_url = "https://example.com/mem-test-1"
        assert await service.check_item_exists(test_url, "dummy_hash") is False

        await service.upsert_content_item({
            "source": "mem_test",
            "section": "news",
            "title": "Quantum Memory Item",
            "canonical_url": test_url,
            "title_hash": "hash_123"
        })

        assert await service.check_item_exists(test_url, "hash_123") is True
        fetched = await service.get_portal_item_by_id(list(service._memory_items.values())[0]["id"])
        assert fetched is not None


@pytest.mark.anyio
async def test_db_service_pooled_connection_when_database_url_set():
    """Verify that when DATABASE_URL is set, PortalDbService uses asyncpg connection pool."""
    service = PortalDbService()
    fake_db_url = "postgresql://postgres:postgres@localhost:5432/qualution"

    mock_pool = MagicMock()
    mock_conn = AsyncMock()
    mock_conn.fetch.return_value = [{"id": "1", "name": "DB Source", "enabled": True}]

    mock_acquire_ctx = AsyncMock()
    mock_acquire_ctx.__aenter__.return_value = mock_conn
    mock_acquire_ctx.__aexit__.return_value = None
    mock_pool.acquire.return_value = mock_acquire_ctx

    with patch("app.services.portal_db_service.settings.DATABASE_URL", fake_db_url), \
         patch("asyncpg.create_pool", AsyncMock(return_value=mock_pool)) as mock_create_pool:

        pool = await service.get_db_pool()
        assert pool == mock_pool
        mock_create_pool.assert_called_once()

        sources = await service.get_portal_sources(enabled_only=True)
        assert len(sources) == 1
        assert sources[0]["name"] == "DB Source"
        mock_pool.acquire.assert_called()

        await service.close_pool()
