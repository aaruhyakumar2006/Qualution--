import pytest
from pydantic import ValidationError
from app.core.config import Settings

def test_settings_fails_fast_on_missing_secrets():
    """Verify that omitting any required secret raises a clear diagnostic error."""
    # Omit DATABASE_URL
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            _env_file=None,
            DATABASE_URL=None,
            NVIDIA_API_KEY="test_key",
            SUPABASE_SERVICE_ROLE_KEY="test_key",
            INGESTION_SECRET="test_secret"
        )
    assert "DATABASE_URL" in str(exc_info.value)

    # Omit NVIDIA_API_KEY
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            _env_file=None,
            DATABASE_URL="postgresql://test:test@localhost:5432/test",
            NVIDIA_API_KEY=None,
            SUPABASE_SERVICE_ROLE_KEY="test_key",
            INGESTION_SECRET="test_secret"
        )
    assert "NVIDIA_API_KEY" in str(exc_info.value)

    # Omit SUPABASE_SERVICE_ROLE_KEY
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            _env_file=None,
            DATABASE_URL="postgresql://test:test@localhost:5432/test",
            NVIDIA_API_KEY="test_key",
            SUPABASE_SERVICE_ROLE_KEY=None,
            INGESTION_SECRET="test_secret"
        )
    assert "SUPABASE_SERVICE_ROLE_KEY" in str(exc_info.value)

    # Omit INGESTION_SECRET
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        Settings(
            _env_file=None,
            DATABASE_URL="postgresql://test:test@localhost:5432/test",
            NVIDIA_API_KEY="test_key",
            SUPABASE_SERVICE_ROLE_KEY="test_key",
            INGESTION_SECRET=None
        )
    assert "INGESTION_SECRET" in str(exc_info.value)

def test_settings_succeeds_with_all_secrets():
    """Verify that providing all required secrets initializes successfully with default settings."""
    s = Settings(
        _env_file=None,
        DATABASE_URL="postgresql://test:test@localhost:5432/test",
        NVIDIA_API_KEY="test_key",
        SUPABASE_SERVICE_ROLE_KEY="test_key",
        INGESTION_SECRET="test_secret"
    )
    assert s.INGESTION_INTERVAL_MINUTES == 60
    assert s.PORTAL_PAGE_SIZE_DEFAULT == 10
    assert s.PORTAL_PAGE_SIZE_MAX == 50
    assert s.SOURCE_DEFAULT_RATE_LIMIT_PER_MINUTE == 30
    assert s.PORTAL_CACHE_TTL_SECONDS == 300
    assert s.ENRICHMENT_BATCH_SIZE == 5
    assert len(s.CORS_ORIGINS) > 0
