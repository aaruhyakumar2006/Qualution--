from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from app.api.routes import health, circuits, simulation, backends, benchmark, codegen, codeparse, ai, auth, onboarding, portal
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: optionally start background ingestion scheduler
    try:
        from app.services.portal_ingestion_service import portal_ingestion_service
        portal_ingestion_service.start_scheduler()
    except Exception:
        pass
    yield
    # Shutdown
    try:
        from app.services.portal_ingestion_service import portal_ingestion_service
        portal_ingestion_service.stop_scheduler()
    except Exception:
        pass

app = FastAPI(
    title="Qualution Backend",
    description="API for Qualution: AI-powered interactive quantum learning platform",
    version="1.0.0",
    lifespan=lifespan,
)

# GZip compression middleware for small payload REST transfer
app.add_middleware(GZipMiddleware, minimum_size=300)

# Configure CORS safely for frontend development and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(circuits.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="")

app.include_router(backends.router, prefix="/api/v1")
app.include_router(benchmark.router, prefix="/api/v1")
app.include_router(codegen.router, prefix="/api/v1")
app.include_router(codeparse.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(portal.router, prefix="/api/v1")

from app.api.routes import misconception
app.include_router(misconception.router, prefix="")
app.include_router(misconception.router, prefix="/api/v1")

