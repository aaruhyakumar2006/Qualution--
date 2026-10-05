import os
import json
import logging
import re
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger("portal_db_service")

# Path to seed data as backup / initial baseline
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
SEED_FILE = BASE_DIR / "data" / "portal_seed.json"

def compute_title_hash(title: str) -> str:
    """Computes a normalized alphanumeric SHA-256 hash for title deduplication."""
    clean = re.sub(r"[^a-z0-9]", "", title.lower())
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()

class PortalDbService:
    """
    Unified Data Service for Community Telemetry Portal.
    Connects to pooled PostgreSQL via asyncpg (using settings.DATABASE_URL).
    Falls back gracefully to local in-memory / seed store when DATABASE_URL is unset or offline.
    """
    def __init__(self):
        self._pool = None
        self._memory_items: Dict[str, Dict[str, Any]] = {}
        self._memory_sources: List[Dict[str, Any]] = []
        self._memory_tags: Dict[str, Dict[str, Any]] = {}
        self._initialized = False
        self._db_available: Optional[bool] = None
        self._last_db_check: float = 0.0
        self._logged_memory_notice = False

    async def get_db_pool(self):
        """Creates or returns the asyncpg connection pool if DATABASE_URL is configured."""
        if not settings.DATABASE_URL:
            if not self._logged_memory_notice:
                logger.info("DATABASE_URL is unset; PortalDbService operating in local in-memory fallback mode.")
                self._logged_memory_notice = True
            return None

        import time
        if self._db_available is False and (time.time() - self._last_db_check < 60.0):
            return None

        if self._pool is None:
            try:
                import asyncpg
                self._pool = await asyncpg.create_pool(
                    dsn=settings.DATABASE_URL,
                    min_size=1,
                    max_size=10,
                    timeout=3.0,
                    command_timeout=5.0
                )
                self._mark_db_success()
                logger.info("PortalDbService PostgreSQL connection pool established.")
            except Exception as e:
                self._mark_db_failed()
                if not self._logged_memory_notice:
                    logger.warning(f"Could not initialize PostgreSQL pool ({e}); falling back to in-memory store.")
                    self._logged_memory_notice = True
                return None
        return self._pool

    async def close_pool(self):
        """Gracefully shuts down connection pool."""
        if self._pool:
            try:
                await self._pool.close()
            except Exception:
                pass
            self._pool = None

    def _mark_db_failed(self):
        import time
        self._db_available = False
        self._last_db_check = time.time()

    def _mark_db_success(self):
        self._db_available = True

    async def _init_memory_cache(self):
        if self._initialized:
            return
        if SEED_FILE.exists():
            try:
                with open(SEED_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for item in data.get("content_items", []):
                        cid = item.get("id") or str(uuid.uuid4())
                        item_copy = dict(item)
                        item_copy["id"] = cid
                        item_copy["title_hash"] = compute_title_hash(item["title"])
                        self._memory_items[item["canonical_url"]] = item_copy
                    self._memory_sources = data.get("portal_sources", [])
                    for t in data.get("curriculum_tags", []):
                        self._memory_tags[t["tag"]] = t
            except Exception as e:
                logger.warning(f"Could not load seed data into memory cache: {e}")
        self._initialized = True

    async def get_portal_sources(self, enabled_only: bool = True) -> List[Dict[str, Any]]:
        """Returns portal sources from PostgreSQL pool, falling back to memory store."""
        await self._init_memory_cache()
        pool = await self.get_db_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    query = "SELECT * FROM public.portal_sources"
                    if enabled_only:
                        query += " WHERE enabled = true"
                    rows = await conn.fetch(query)
                    if rows:
                        self._mark_db_success()
                        return [dict(r) for r in rows]
            except Exception as e:
                self._mark_db_failed()
                logger.debug(f"Direct DB sources query failed ({e}); using cache.")

        # In-memory fallback
        if enabled_only:
            return [s for s in self._memory_sources if s.get("enabled", True)]
        return list(self._memory_sources)

    async def add_portal_source(self, source: Dict[str, Any]) -> Dict[str, Any]:
        """Dynamically registers a new portal source."""
        await self._init_memory_cache()
        source_id = source.get("id") or str(uuid.uuid4())
        src_copy = dict(source)
        src_copy["id"] = source_id
        src_copy["enabled"] = src_copy.get("enabled", True)
        self._memory_sources.append(src_copy)

        pool = await self.get_db_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO public.portal_sources (id, name, type, url_or_query, section, source_tier, enabled, fetch_interval_minutes, rate_limit_per_minute)
                        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
                        ON CONFLICT DO NOTHING;
                    """, uuid.UUID(source_id), src_copy["name"], src_copy["type"], src_copy["url_or_query"], src_copy["section"], src_copy.get("source_tier", 1), src_copy["enabled"], src_copy.get("fetch_interval_minutes", 60), src_copy.get("rate_limit_per_minute", 30))
            except Exception as e:
                logger.debug(f"Direct DB source insert failed ({e}). Cached in memory.")
        return src_copy

    async def update_portal_source(self, source_name_or_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates an existing portal source row dynamically in cache and database."""
        await self._init_memory_cache()
        target = None
        for s in self._memory_sources:
            if s.get("id") == source_name_or_id or s.get("name") == source_name_or_id:
                s.update(updates)
                target = s
                break
        return target

    async def get_curriculum_tags(self) -> List[Dict[str, Any]]:
        """Returns all allowed curriculum tags with lesson mappings."""
        await self._init_memory_cache()
        pool = await self.get_db_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch("SELECT * FROM public.curriculum_tags")
                    if rows:
                        self._mark_db_success()
                        return [dict(r) for r in rows]
            except Exception as e:
                self._mark_db_failed()
                logger.debug(f"Direct DB curriculum tags query failed ({e}); using cache.")
        return list(self._memory_tags.values())

    async def check_item_exists(self, canonical_url: str, title_hash: str) -> bool:
        """Deduplication check against canonical_url or normalized title_hash."""
        await self._init_memory_cache()
        # Memory check
        if canonical_url in self._memory_items:
            return True
        for it in self._memory_items.values():
            if it.get("title_hash") == title_hash:
                return True

        # Database check
        pool = await self.get_db_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(
                        "SELECT 1 FROM public.content_items WHERE canonical_url = $1 OR title_hash = $2 LIMIT 1",
                        canonical_url, title_hash
                    )
                    if row:
                        self._mark_db_success()
                        return True
            except Exception as e:
                self._mark_db_failed()
                logger.debug(f"Direct DB dedup query failed ({e}).")

        return False

    async def upsert_content_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Upserts an item into content_items."""
        await self._init_memory_cache()
        canonical_url = item["canonical_url"]
        item_copy = dict(item)
        if "id" not in item_copy or not item_copy["id"]:
            item_copy["id"] = str(uuid.uuid4())
        if "title_hash" not in item_copy:
            item_copy["title_hash"] = compute_title_hash(item["title"])

        self._memory_items[canonical_url] = item_copy

        pool = await self.get_db_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO public.content_items (
                            id, source, source_tier, section, title, canonical_url, title_hash,
                            published_at, abstract, summary, level, tags, curriculum_tags,
                            enriched, prompt_version
                        ) VALUES (
                            $1::uuid, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10, $11, $12, $13, $14, $15
                        )
                        ON CONFLICT (canonical_url) DO UPDATE
                        SET title = EXCLUDED.title,
                            summary = EXCLUDED.summary,
                            abstract = EXCLUDED.abstract,
                            level = EXCLUDED.level,
                            tags = EXCLUDED.tags,
                            curriculum_tags = EXCLUDED.curriculum_tags,
                            enriched = EXCLUDED.enriched,
                            prompt_version = EXCLUDED.prompt_version;
                    """, uuid.UUID(item_copy["id"]), item_copy.get("source", "unknown"), item_copy.get("source_tier", 1), item_copy["section"], item_copy["title"], canonical_url, item_copy["title_hash"], item_copy.get("published_at"), item_copy.get("abstract"), item_copy.get("summary"), item_copy.get("level", "Beginner"), item_copy.get("tags", []), item_copy.get("curriculum_tags", []), item_copy.get("enriched", False), item_copy.get("prompt_version"))
            except Exception as e:
                logger.debug(f"Direct DB upsert failed ({e}). Stored in memory.")

        return item_copy

    async def get_portal_sections(self) -> List[Dict[str, Any]]:
        """Returns sections list with dynamic item counts."""
        await self._init_memory_cache()
        sections_spec = [
            {"id": "all", "num": "01", "title": "ALL", "subtitle": "Everything happening in the quantum ecosystem.", "accent": "#C1F8FF", "accentDark": "#00B8D9"},
            {"id": "courses", "num": "02", "title": "COURSES", "subtitle": "New QUALUTION courses, lessons and learning paths.", "accent": "#B0EF9E", "accentDark": "#39D353"},
            {"id": "news", "num": "03", "title": "NEWS", "subtitle": "Quantum computing news and industry updates.", "accent": "#FFC83B", "accentDark": "#E6A800"},
            {"id": "research", "num": "04", "title": "RESEARCH", "subtitle": "Interesting quantum papers and discoveries for the community.", "accent": "#FE90E9", "accentDark": "#D63FBC"},
            {"id": "events", "num": "05", "title": "EVENTS", "subtitle": "Conferences, workshops, hackathons and webinars.", "accent": "#D0BFFF", "accentDark": "#7C3AED"},
            {"id": "opportunities", "num": "06", "title": "OPPORTUNITIES", "subtitle": "Internships, scholarships, challenges, fellowships and competitions.", "accent": "#FFA94D", "accentDark": "#E06C00"},
            {"id": "qualution", "num": "07", "title": "QUALUTION", "subtitle": "New platform features, challenges, certifications and announcements.", "accent": "#C1F8FF", "accentDark": "#00B8D9"},
        ]

        items = list(self._memory_items.values())
        counts: Dict[str, int] = {}
        for it in items:
            sec = it.get("section", "").lower()
            counts[sec] = counts.get(sec, 0) + 1
        counts["all"] = len(items)

        for sec in sections_spec:
            sec["item_count"] = counts.get(sec["id"], 0)

        return sections_spec

    async def get_portal_items(
        self,
        section: Optional[str] = None,
        level: Optional[str] = None,
        q: Optional[str] = None,
        cursor: Optional[str] = None,
        limit: int = 10
    ) -> Tuple[List[Dict[str, Any]], Optional[str], bool]:
        """
        Cursor-paginated items query.
        Only returns approved public items for general feed consumers.
        """
        await self._init_memory_cache()
        items = list(self._memory_items.values())

        # Public filter: only approved public items
        items = [i for i in items if i.get("status", "approved") == "approved" and i.get("audience", "public") == "public"]

        # Sort descending by published_at or submitted_at
        items.sort(key=lambda x: str(x.get("published_at") or x.get("submitted_at") or ""), reverse=True)

        # Filters
        if section and section.lower() != "all":
            items = [i for i in items if i.get("section", "").lower() == section.lower()]

        if level:
            items = [i for i in items if i.get("level", "").lower() == level.lower()]

        if q and q.strip():
            query_lower = q.strip().lower()
            items = [
                i for i in items
                if query_lower in i.get("title", "").lower()
                or query_lower in i.get("summary", "").lower()
                or query_lower in i.get("abstract", "").lower()
                or query_lower in i.get("note", "").lower()
                or any(query_lower in t.lower() for t in i.get("tags", []))
            ]

        # Keyset cursor pagination
        if cursor:
            try:
                cursor_idx = -1
                for idx, it in enumerate(items):
                    if it.get("id") == cursor or it.get("published_at") == cursor:
                        cursor_idx = idx
                        break
                if cursor_idx >= 0:
                    items = items[cursor_idx + 1:]
            except Exception:
                pass

        has_more = len(items) > limit
        sliced = items[:limit]
        next_cursor = sliced[-1]["id"] if sliced and has_more else None

        return sliced, next_cursor, has_more

    async def get_portal_item_by_id(self, item_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single content item by its ID."""
        await self._init_memory_cache()
        for it in self._memory_items.values():
            if str(it.get("id")) == str(item_id):
                return it
        return None

    # ─── SUBMISSION & MODERATION METHODS ───────────────────────────────────────

    async def create_user_submission(self, submission: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new user post submission."""
        await self._init_memory_cache()
        item_id = submission.get("id") or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        item_record = {
            "id": item_id,
            "source": submission.get("source") or "Community",
            "source_tier": submission.get("source_tier", 3),
            "section": submission.get("section", "news"),
            "submission_type": submission.get("submission_type", "news"),
            "title": submission["title"],
            "canonical_url": submission.get("canonical_url") or f"https://qualution.org/community/{item_id}",
            "title_hash": compute_title_hash(submission["title"]),
            "published_at": now,
            "submitted_at": now,
            "abstract": submission.get("note") or submission.get("abstract") or "",
            "summary": submission.get("summary") or submission.get("note") or "",
            "note": submission.get("note") or "",
            "circuit_qasm": submission.get("circuit_qasm"),
            "circuit_data": submission.get("circuit_data"),
            "level": submission.get("level", "Beginner"),
            "tags": submission.get("tags", ["Community"]),
            "curriculum_tags": submission.get("curriculum_tags", []),
            "author_id": str(submission["author_id"]) if submission.get("author_id") else None,
            "author_display_name": submission.get("author_display_name", "Quantum Pioneer"),
            "author_role": submission.get("author_role", "student"),
            "status": submission.get("status", "pending"),
            "audience": submission.get("audience", "public"),
            "class_id": str(submission["class_id"]) if submission.get("class_id") else None,
            "screening": submission.get("screening"),
            "reviewed_by": submission.get("reviewed_by"),
            "reviewed_at": submission.get("reviewed_at"),
            "review_reason": submission.get("review_reason"),
            "enriched": False,
            "created_at": now,
        }

        self._memory_items[item_record["canonical_url"]] = item_record

        # Log submission event in moderation audit
        await self.log_moderation_event(
            item_id=item_id,
            actor_id=item_record["author_id"],
            action="submitted",
            reason=f"Submitted via portal (status: {item_record['status']})"
        )

        return item_record

    async def get_user_submissions(self, author_id: str) -> List[Dict[str, Any]]:
        """Retrieves all submissions authored by a specific user in any status."""
        await self._init_memory_cache()
        author_str = str(author_id)
        results = [
            i for i in self._memory_items.values()
            if str(i.get("author_id")) == author_str
        ]
        results.sort(key=lambda x: str(x.get("submitted_at") or x.get("created_at") or ""), reverse=True)
        return results

    async def delete_user_submission(self, item_id: str, author_id: str) -> bool:
        """Allows an author to delete their own submission, recording the audit log."""
        await self._init_memory_cache()
        author_str = str(author_id)
        target_url = None
        for url, it in self._memory_items.items():
            if str(it.get("id")) == str(item_id) and str(it.get("author_id")) == author_str:
                target_url = url
                break

        if not target_url:
            return False

        # Mark as removed or pop
        self._memory_items[target_url]["status"] = "removed"

        await self.log_moderation_event(
            item_id=item_id,
            actor_id=author_str,
            action="deleted_by_author",
            reason="Author deleted submission"
        )
        return True

    async def get_moderation_queue(self, status: str = "pending") -> List[Dict[str, Any]]:
        """Returns items in the moderation queue sorted by risk and submission timestamp."""
        await self._init_memory_cache()
        if status == "reported":
            # Collect item IDs with open reports
            reported_ids = {r["item_id"] for r in getattr(self, "_memory_reports", []) if r.get("status") == "open"}
            queue = [i for i in self._memory_items.values() if str(i.get("id")) in reported_ids]
        elif status == "all":
            queue = [i for i in self._memory_items.values() if i.get("status") in ("pending", "rejected")]
        else:
            queue = [
                i for i in self._memory_items.values()
                if i.get("status") == status
            ]

        # Attach report details
        all_reports = getattr(self, "_memory_reports", [])
        enriched_queue = []
        for it in queue:
            item_id_str = str(it.get("id"))
            item_reports = [r for r in all_reports if str(r.get("item_id")) == item_id_str]
            it_copy = dict(it)
            it_copy["report_count"] = len(item_reports)
            it_copy["reports"] = item_reports
            enriched_queue.append(it_copy)

        # Sort by spam likelihood descending, then submitted_at ascending
        def sort_key(item):
            screening = item.get("screening") or {}
            spam = screening.get("spam_likelihood", 0.0)
            submitted = item.get("submitted_at") or ""
            return (-spam, submitted)

        enriched_queue.sort(key=sort_key)
        return enriched_queue

    async def update_moderation_status(
        self,
        item_id: str,
        new_status: str,
        reviewer_id: str,
        review_reason: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Applies a moderation decision (approved, rejected, removed) and records the audit log."""
        await self._init_memory_cache()
        target = None
        for it in self._memory_items.values():
            if str(it.get("id")) == str(item_id):
                target = it
                break

        if not target:
            return None

        now = datetime.now(timezone.utc).isoformat()
        target["status"] = new_status
        target["reviewed_by"] = str(reviewer_id)
        target["reviewed_at"] = now
        target["review_reason"] = review_reason

        # Resolve open reports for this item if any
        for r in getattr(self, "_memory_reports", []):
            if str(r.get("item_id")) == str(item_id) and r.get("status") == "open":
                r["status"] = "resolved"
                r["resolved_by"] = str(reviewer_id)
                r["resolved_at"] = now

        action_map = {
            "approved": "approved",
            "rejected": "rejected",
            "removed": "removed"
        }
        await self.log_moderation_event(
            item_id=item_id,
            actor_id=str(reviewer_id),
            action=action_map.get(new_status, "approved"),
            reason=review_reason or f"Status changed to {new_status}"
        )

        return target

    async def create_post_report(self, item_id: str, reporter_id: str, reason: str) -> Dict[str, Any]:
        """Creates a post report for moderation review."""
        await self._init_memory_cache()
        if not hasattr(self, "_memory_reports"):
            self._memory_reports = []

        report_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        report_record = {
            "id": report_id,
            "item_id": str(item_id),
            "reporter_id": str(reporter_id),
            "reason": reason,
            "status": "open",
            "created_at": now
        }
        self._memory_reports.append(report_record)

        await self.log_moderation_event(
            item_id=str(item_id),
            actor_id=str(reporter_id),
            action="reported",
            reason=f"User report: {reason}"
        )

        return report_record

    async def log_moderation_event(
        self,
        item_id: str,
        actor_id: Optional[str],
        action: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Appends an immutable audit event to moderation_log."""
        if not hasattr(self, "_memory_moderation_log"):
            self._memory_moderation_log = []

        now = datetime.now(timezone.utc).isoformat()
        log_entry = {
            "id": str(uuid.uuid4()),
            "item_id": str(item_id),
            "actor_id": str(actor_id) if actor_id else None,
            "action": action,
            "reason": reason,
            "ts": now
        }
        self._memory_moderation_log.append(log_entry)
        logger.info(f"[ModerationLog] action={action} item={item_id} actor={actor_id} reason={reason}")
        return log_entry

portal_db_service = PortalDbService()
