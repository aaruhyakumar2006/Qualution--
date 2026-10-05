from pathlib import Path
from typing import List, Optional, Union
from pydantic import model_validator, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Locate .env file in backend root or workspace root
backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
root_env = Path(__file__).resolve().parent.parent.parent.parent / ".env"
env_file_path = backend_env if backend_env.exists() else (root_env if root_env.exists() else None)

class Settings(BaseSettings):
    """
    Central typed application settings backed by pydantic-settings.
    All secrets must fail fast with a clear error if missing.
    Every non-secret parameter has a documented, production-ready default.
    """
    model_config = SettingsConfigDict(
        env_file=str(env_file_path) if env_file_path else None,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "Qualution Backend"
    API_V1_STR: str = "/api/v1"

    # Mandatory Secrets (Fail-Fast validated)
    DATABASE_URL: Optional[str] = None
    NVIDIA_API_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    INGESTION_SECRET: Optional[str] = None

    # Optional Secrets & Auth
    GROQ_API_KEY: Optional[str] = None
    SUPABASE_URL: str = "https://hihwyzxnuyjzgkwlmzlt.supabase.co"
    SUPABASE_DB_PASSWORD: Optional[str] = None
    QBRAID_API_KEY: Optional[str] = None
    QBRAID_DEFAULT_DEVICE: Optional[str] = None

    # Community Telemetry Portal Ingestion & Caching Configuration
    INGESTION_INTERVAL_MINUTES: int = 60
    SOURCE_DEFAULT_RATE_LIMIT_PER_MINUTE: int = 30
    PORTAL_PAGE_SIZE_DEFAULT: int = 10
    PORTAL_PAGE_SIZE_MAX: int = 50
    PORTAL_CACHE_TTL_SECONDS: int = 300
    ENRICHMENT_BATCH_SIZE: int = 5
    ENRICHMENT_RETRY_COUNT: int = 1
    ENRICHMENT_TIMEOUT_SECONDS: float = 30.0
    DEXIE_CACHE_SIZE: int = 50

    # Portal Submission & Moderation Limits
    SUBMISSION_MAX_TITLE_LENGTH: int = 150
    SUBMISSION_MAX_NOTE_LENGTH: int = 1500
    SUBMISSION_RATE_LIMIT_PER_MINUTE: int = 5
    SUBMISSION_RATE_LIMIT_PER_DAY: int = 50
    REPORT_RATE_LIMIT_PER_MINUTE: int = 5
    AUTO_APPROVE_ROLES: List[str] = ["teacher", "admin"]
    AUTO_REJECT_SPAM_THRESHOLD: float = 0.85
    PORTAL_ANONYMIZE_COMMUNITY_AUTHORS: bool = False

    # NVIDIA NIM Provider Configuration
    NVIDIA_MODEL: str = "nvidia/nemotron-3-super-120b-a12b"
    NVIDIA_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CONNECT_TIMEOUT: float = 10.0
    NVIDIA_READ_TIMEOUT: float = 35.0
    NVIDIA_REQUEST_TIMEOUT: float = 45.0
    NVIDIA_MAX_RETRIES: int = 1
    NVIDIA_RETRY_BACKOFF: float = 1.5

    # Groq Provider Configuration
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_CONNECT_TIMEOUT: float = 5.0
    GROQ_READ_TIMEOUT: float = 15.0

    # Quantum Circuit Simulation Limits & Constraints
    MAX_STATEVECTOR_QUBITS: int = 16
    MAX_SHOTS: int = 100000
    MAX_TIMELINE_QUBITS: int = 12
    MAX_TIMELINE_STEPS: int = 50
    MAX_OPTIMIZATION_QUBITS: int = 10
    MAX_OPTIMIZATION_ITERATIONS: int = 10
    AI_ENVIRONMENT_CACHE_TTL_MS: int = 30000
    AI_LOW_BANDWIDTH_LATENCY_MS: float = 1500.0
    AI_PROBE_TIMEOUT_MS: float = 3000.0

    # Cross-Origin Resource Sharing
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        """
        Enforce fail-fast behavior: if any mandatory secret is missing or empty,
        raise a clear diagnostic error immediately.
        """
        missing = []
        for secret_name in ["DATABASE_URL", "NVIDIA_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "INGESTION_SECRET"]:
            val = getattr(self, secret_name, None)
            if not val or not str(val).strip():
                missing.append(secret_name)
        if missing:
            raise ValueError(
                f"Missing required secret(s): {', '.join(missing)}. "
                f"Please set them in your environment or .env file."
            )
        return self

settings = Settings()
