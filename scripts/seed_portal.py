#!/usr/bin/env python3
"""
scripts/seed_portal.py
Seeds the Community Telemetry Portal database from data/portal_seed.json.
Idempotently populates:
  1. curriculum_tags (educational concepts -> lesson_id mappings)
  2. portal_sources (arXiv, RSS, GitHub feeds)
  3. content_items (curated news, research, courses, opportunities, and announcements)

Usage:
  python scripts/seed_portal.py
"""

import os
import sys
import json
import re
import hashlib
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Add backend directory to sys.path so we can import Settings
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "qualution-backend"))

try:
    from app.core.config import settings
except ImportError:
    # Minimal fallback if running isolated
    from pydantic_settings import BaseSettings
    class FallbackSettings(BaseSettings):
        DATABASE_URL: str = os.getenv("DATABASE_URL", "")
        SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://hihwyzxnuyjzgkwlmzlt.supabase.co")
        SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    settings = FallbackSettings()

import httpx

def compute_title_hash(title: str) -> str:
    """Computes a normalized alphanumeric SHA-256 hash for strict deduplication."""
    clean_title = re.sub(r"[^a-z0-9]", "", title.lower())
    return hashlib.sha256(clean_title.encode("utf-8")).hexdigest()

def load_seed_data() -> Dict[str, Any]:
    seed_file = BASE_DIR / "data" / "portal_seed.json"
    if not seed_file.exists():
        raise FileNotFoundError(f"Seed file not found at {seed_file}")
    with open(seed_file, "r", encoding="utf-8") as f:
        return json.load(f)

async def seed_via_rest(data: Dict[str, Any]):
    """Seed data via Supabase PostgREST API using the service-role key."""
    base_url = settings.SUPABASE_URL.rstrip("/")
    key = settings.SUPABASE_SERVICE_ROLE_KEY
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Seed curriculum_tags
        c_tags = data.get("curriculum_tags", [])
        print(f"Upserting {len(c_tags)} curriculum tags...")
        for tag in c_tags:
            res = await client.post(
                f"{base_url}/rest/v1/curriculum_tags",
                headers=headers,
                json=tag
            )
            if res.status_code not in (200, 201, 204):
                print(f"  Warning on curriculum_tag {tag['tag']}: {res.status_code} {res.text}")

        # 2. Seed portal_sources
        sources = data.get("portal_sources", [])
        print(f"Upserting {len(sources)} portal sources...")
        for src in sources:
            # Check existing by name to prevent duplicates
            chk = await client.get(
                f"{base_url}/rest/v1/portal_sources?name=eq.{src['name']}&select=id",
                headers=headers
            )
            if chk.status_code == 200 and len(chk.json()) > 0:
                # Update
                src_id = chk.json()[0]["id"]
                await client.patch(
                    f"{base_url}/rest/v1/portal_sources?id=eq.{src_id}",
                    headers=headers,
                    json=src
                )
            else:
                await client.post(
                    f"{base_url}/rest/v1/portal_sources",
                    headers=headers,
                    json=src
                )

        # 3. Seed content_items
        items = data.get("content_items", [])
        print(f"Upserting {len(items)} curated content items...")
        for item in items:
            item_payload = dict(item)
            item_payload["title_hash"] = compute_title_hash(item["title"])
            res = await client.post(
                f"{base_url}/rest/v1/content_items",
                headers=headers,
                json=item_payload
            )
            if res.status_code not in (200, 201, 204):
                print(f"  Warning on item '{item['title']}': {res.status_code} {res.text}")

        print("Seed completed successfully via Supabase REST API!")

async def seed_via_asyncpg(data: Dict[str, Any]):
    """Seed data directly into PostgreSQL via asyncpg pool using DATABASE_URL."""
    import asyncpg

    conn = await asyncpg.connect(settings.DATABASE_URL, timeout=10.0)
    try:
        # 1. Seed curriculum_tags
        c_tags = data.get("curriculum_tags", [])
        print(f"Upserting {len(c_tags)} curriculum tags via asyncpg...")
        for tag in c_tags:
            await conn.execute("""
                INSERT INTO public.curriculum_tags (tag, lesson_id, label)
                VALUES ($1, $2, $3)
                ON CONFLICT (tag) DO UPDATE
                SET lesson_id = EXCLUDED.lesson_id, label = EXCLUDED.label;
            """, tag["tag"], tag["lesson_id"], tag["label"])

        # 2. Seed portal_sources
        sources = data.get("portal_sources", [])
        print(f"Upserting {len(sources)} portal sources via asyncpg...")
        for src in sources:
            await conn.execute("""
                INSERT INTO public.portal_sources (name, type, url_or_query, section, source_tier, enabled, fetch_interval_minutes, rate_limit_per_minute)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT DO NOTHING;
            """, src["name"], src["type"], src["url_or_query"], src["section"], src.get("source_tier", 1), src.get("enabled", True), src.get("fetch_interval_minutes", 60), src.get("rate_limit_per_minute", 30))

        # 3. Seed content_items
        items = data.get("content_items", [])
        print(f"Upserting {len(items)} curated content items via asyncpg...")
        for item in items:
            t_hash = compute_title_hash(item["title"])
            await conn.execute("""
                INSERT INTO public.content_items (
                    source, source_tier, section, title, canonical_url, title_hash,
                    published_at, abstract, summary, level, tags, curriculum_tags,
                    enriched, prompt_version
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12, $13, $14
                )
                ON CONFLICT (canonical_url) DO UPDATE
                SET title = EXCLUDED.title,
                    summary = EXCLUDED.summary,
                    abstract = EXCLUDED.abstract,
                    tags = EXCLUDED.tags,
                    curriculum_tags = EXCLUDED.curriculum_tags,
                    level = EXCLUDED.level,
                    enriched = EXCLUDED.enriched;
            """, item.get("source", "curated"), item.get("source_tier", 1), item["section"], item["title"], item["canonical_url"], t_hash, item["published_at"], item.get("abstract", ""), item.get("summary", ""), item.get("level", "Beginner"), item.get("tags", []), item.get("curriculum_tags", []), item.get("enriched", True), item.get("prompt_version", "curated.v1"))

        print("Seed completed successfully via asyncpg!")
    finally:
        await conn.close()

async def main():
    print("=" * 60)
    print("QUALUTION Community Telemetry Portal Seed Engine")
    print("=" * 60)
    data = load_seed_data()

    # Try asyncpg direct pooled connection first if available, otherwise fallback to REST
    seeded = False
    if getattr(settings, "DATABASE_URL", None):
        try:
            print(f"Attempting PostgreSQL direct connection via DATABASE_URL...")
            await seed_via_asyncpg(data)
            seeded = True
        except Exception as e:
            print(f"Direct PostgreSQL connection failed ({e}). Falling back to Supabase REST API...")

    if not seeded:
        if getattr(settings, "SUPABASE_URL", None) and getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None):
            await seed_via_rest(data)
        else:
            print("ERROR: Neither DATABASE_URL nor valid SUPABASE_URL / SERVICE_ROLE_KEY provided.")
            sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
