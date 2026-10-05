import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.services.portal_db_service import portal_db_service, compute_title_hash
from app.services.portal_enrichment_service import portal_enrichment_service
from app.services.portal_event_service import portal_event_broadcaster
from app.services.ingestion_handlers import fetch_source_items

logger = logging.getLogger("portal_ingestion_service")

class PortalIngestionService:
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self._is_running = False
        self._last_run_at: Optional[str] = None
        self._last_stats: Optional[Dict[str, Any]] = None
        self._interval_minutes: int = settings.INGESTION_INTERVAL_MINUTES

    def get_status(self) -> Dict[str, Any]:
        """Returns the live status, scheduling mode, and last execution metrics."""
        return {
            "scheduler_running": self.scheduler.running,
            "cycle_in_progress": self._is_running,
            "interval_minutes": self._interval_minutes,
            "last_run_at": self._last_run_at,
            "last_stats": self._last_stats
        }

    def start_scheduler(self, interval_mins: Optional[int] = None):
        """Starts the APScheduler background runner if not already running."""
        mins = max(1, interval_mins or settings.INGESTION_INTERVAL_MINUTES)
        self._interval_minutes = mins
        if not self.scheduler.running:
            self.scheduler.add_job(
                self.run_ingestion_cycle,
                "interval",
                minutes=mins,
                id="portal_ingestion_job",
                replace_existing=True
            )
            self.scheduler.start()
            logger.info(f"Portal ingestion scheduler started (interval: {mins}m)")
        else:
            self.update_scheduler_interval(mins)

    def update_scheduler_interval(self, minutes: int):
        """Updates the scheduler job interval dynamically."""
        interval_mins = max(1, minutes)
        self._interval_minutes = interval_mins
        if self.scheduler.get_job("portal_ingestion_job"):
            self.scheduler.reschedule_job(
                "portal_ingestion_job",
                trigger="interval",
                minutes=interval_mins
            )
            logger.info(f"Portal ingestion scheduler interval updated to {interval_mins}m")
        elif not self.scheduler.running:
            self.start_scheduler(interval_mins)

    def stop_scheduler(self):
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Portal ingestion scheduler stopped")

    async def run_ingestion_cycle(self) -> Dict[str, Any]:
        """
        Executes one full ingestion cycle across all enabled sources from portal_sources.
        Respects per-source rate limits and skips failing sources without stopping.
        """
        if self._is_running:
            logger.info("Ingestion cycle already in progress, skipping concurrent run.")
            return {"status": "busy", "message": "Ingestion cycle already running"}

        self._is_running = True
        self._last_run_at = datetime.now(timezone.utc).isoformat()
        stats = {
            "sources_processed": 0,
            "sources_failed": 0,
            "items_discovered": 0,
            "items_deduplicated": 0,
            "items_inserted": 0,
            "items_enriched": 0
        }

        try:
            # 1. Load active sources and allowed curriculum tags from database at runtime
            sources = await portal_db_service.get_portal_sources(enabled_only=True)
            tags_records = await portal_db_service.get_curriculum_tags()
            allowed_curriculum_tags = [t["tag"] for t in tags_records]

            logger.info(f"Starting ingestion cycle with {len(sources)} sources and {len(allowed_curriculum_tags)} curriculum tags.")

            for source in sources:
                src_name = source.get("name", "Unknown Source")
                stats["sources_processed"] += 1
                try:
                    # Fetch items through type-specific handler
                    items = await fetch_source_items(source)
                    stats["items_discovered"] += len(items)

                    for raw_item in items:
                        canonical_url = raw_item["canonical_url"]
                        t_hash = compute_title_hash(raw_item["title"])

                        # 2. Strict Deduplication
                        is_duplicate = await portal_db_service.check_item_exists(canonical_url, t_hash)
                        if is_duplicate:
                            stats["items_deduplicated"] += 1
                            continue

                        # 3. AI Enrichment (run ONCE for newly discovered item)
                        is_enriched, enrichment_output, prompt_ver = portal_enrichment_service.enrich_item(
                            title=raw_item["title"],
                            abstract=raw_item.get("abstract"),
                            source=raw_item.get("source", src_name),
                            allowed_curriculum_tags=allowed_curriculum_tags
                        )

                        # Assemble final normalized content_item
                        content_item = {
                            "source": raw_item.get("source", src_name),
                            "source_tier": raw_item.get("source_tier", source.get("source_tier", 1)),
                            "section": source.get("section", "news"),
                            "title": raw_item["title"],
                            "canonical_url": canonical_url,
                            "title_hash": t_hash,
                            "published_at": raw_item.get("published_at"),
                            "abstract": raw_item.get("abstract"),
                            "summary": enrichment_output.summary,
                            "level": enrichment_output.level,
                            "tags": enrichment_output.tags,
                            "curriculum_tags": enrichment_output.curriculum_tags,
                            "enriched": is_enriched,
                            "prompt_version": prompt_ver,
                        }

                        await portal_db_service.upsert_content_item(content_item)
                        stats["items_inserted"] += 1
                        if is_enriched:
                            stats["items_enriched"] += 1

                        # Broadcast live telemetry event to active SSE stream subscribers
                        try:
                            await portal_event_broadcaster.broadcast_signal(content_item)
                        except Exception as b_err:
                            logger.warning(f"Error broadcasting ingestion signal: {b_err}")

                    # Respect source rate limit
                    rate_limit = source.get("rate_limit_per_minute", settings.SOURCE_DEFAULT_RATE_LIMIT_PER_MINUTE)
                    delay = max(0.1, 60.0 / max(1, rate_limit))
                    await asyncio.sleep(min(1.0, delay))

                except Exception as e:
                    stats["sources_failed"] += 1
                    logger.error(f"Error processing source '{src_name}': {e}. Skipping source to protect run.")

            self._last_stats = stats
            logger.info(f"Ingestion cycle completed successfully: {stats}")
            return {"status": "success", "stats": stats}

        finally:
            self._is_running = False

portal_ingestion_service = PortalIngestionService()
