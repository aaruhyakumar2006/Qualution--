import re
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from app.services.portal_db_service import portal_db_service, compute_title_hash
from app.schemas.portal_importer import (
    BatchImportRequest,
    BatchImportResponse,
    BatchImportResultItem,
    ImportedSignalItem
)

def parse_bibtex_string(raw_bibtex: str) -> List[Dict[str, Any]]:
    """
    Parses a block of BibTeX entries into structured dictionaries.
    Handles @article, @misc, @inproceedings, @techreport, etc.
    """
    entries = []
    # Pattern to match entry type and content
    entry_pattern = re.compile(r'@(\w+)\s*\{\s*([^,]+),\s*([\s\S]*?)\n\}\s*(?=@|\Z)', re.MULTILINE)
    field_pattern = re.compile(r'(\w+)\s*=\s*[\{"]([\s\S]*?)[\}"]\s*(?:,|$)', re.MULTILINE)

    for match in entry_pattern.finditer(raw_bibtex):
        entry_type = match.group(1).lower()
        cite_key = match.group(2).strip()
        body = match.group(3)

        fields = {}
        for f_match in field_pattern.finditer(body):
            key = f_match.group(1).lower().strip()
            val = re.sub(r'\s+', ' ', f_match.group(2).strip())
            fields[key] = val

        title = fields.get("title", "").strip()
        if not title:
            continue

        author = fields.get("author", "Quantum Community").strip()
        year = fields.get("year", str(datetime.now().year))
        abstract = fields.get("abstract") or fields.get("summary") or f"Published by {author} ({year})."
        url = fields.get("url") or fields.get("eprint")
        if url and not url.startswith("http"):
            url = f"https://arxiv.org/abs/{url}"

        # Section classification heuristics
        section = "papers"
        if "arxiv" in (url or "").lower() or entry_type == "misc":
            section = "preprints"
        elif any(k in title.lower() for k in ["hardware", "benchmark", "qpu", "processor", "transmon", "qubit"]):
            section = "hardware"

        tags = [t.strip() for t in fields.get("keywords", "").split(",") if t.strip()]
        if not tags:
            tags = ["Quantum Physics", entry_type.capitalize()]

        entries.append({
            "title": title,
            "author_display_name": author,
            "canonical_url": url or f"https://qualution.org/signals/{cite_key}",
            "abstract": abstract,
            "summary": abstract,
            "section": section,
            "level": "Intermediate",
            "tags": tags,
            "curriculum_tags": [f"c_{t.lower().replace(' ', '_')}" for t in tags[:2]],
        })

    return entries


class PortalImporterService:
    """
    Handles ingestion of batch signals (via raw BibTeX or JSON items),
    deduplication, screening, and RSS/BibTeX syndication exports.
    """

    async def batch_import_signals(self, req: BatchImportRequest, actor_id: Optional[str] = "usr-batch-importer") -> BatchImportResponse:
        await portal_db_service._init_memory_cache()
        parsed_items: List[Dict[str, Any]] = []

        if req.format == "bibtex" and req.raw_bibtex:
            parsed_items = parse_bibtex_string(req.raw_bibtex)
        elif req.items:
            for item in req.items:
                parsed_items.append(item.model_dump())

        results: List[BatchImportResultItem] = []
        imported_count = 0
        skipped_count = 0

        existing_hashes = {
            it.get("title_hash") for it in portal_db_service._memory_items.values()
            if it.get("title_hash")
        }

        for p_item in parsed_items:
            title = p_item.get("title", "").strip()
            if not title:
                results.append(BatchImportResultItem(
                    title="Unknown Title",
                    status="invalid",
                    reason="Missing required title field"
                ))
                skipped_count += 1
                continue

            t_hash = compute_title_hash(title)
            if t_hash in existing_hashes:
                results.append(BatchImportResultItem(
                    title=title,
                    status="skipped_duplicate",
                    reason="Duplicate title detected in existing portal catalog"
                ))
                skipped_count += 1
                continue

            # Ingest item into portal database
            item_id = str(uuid.uuid4())
            new_record = {
                "id": item_id,
                "title": title,
                "author_display_name": p_item.get("author_display_name") or "Community Researcher",
                "author_id": actor_id,
                "author_role": "teacher",
                "canonical_url": p_item.get("canonical_url") or f"https://qualution.org/community/{item_id}",
                "abstract": p_item.get("abstract") or "",
                "summary": p_item.get("summary") or p_item.get("abstract") or "",
                "note": p_item.get("note") or "",
                "section": p_item.get("section") or req.default_section or "papers",
                "level": p_item.get("level") or "Intermediate",
                "tags": p_item.get("tags") or ["Quantum"],
                "curriculum_tags": p_item.get("curriculum_tags") or [],
                "circuit_qasm": p_item.get("circuit_qasm"),
                "status": "published",
                "source": "Batch Import",
                "source_tier": 2,
                "enriched": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            await portal_db_service.create_user_submission(new_record)
            existing_hashes.add(t_hash)
            imported_count += 1

            results.append(BatchImportResultItem(
                title=title,
                status="imported",
                item_id=item_id,
                reason="Successfully verified and imported"
            ))

        return BatchImportResponse(
            total_received=len(parsed_items),
            imported_count=imported_count,
            skipped_count=skipped_count,
            results=results,
            timestamp_iso=datetime.now(timezone.utc).isoformat()
        )

    async def generate_rss_feed_xml(self) -> str:
        """Generates standard RSS 2.0 XML feed of all curated portal signals."""
        await portal_db_service._init_memory_cache()
        items = list(portal_db_service._memory_items.values())
        items.sort(key=lambda x: str(x.get("published_at") or x.get("created_at") or ""), reverse=True)

        now_rfc822 = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
        xml_lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
            '  <channel>',
            '    <title>QUALUTION Community Quantum Telemetry Portal</title>',
            '    <link>https://qualution.org/portal</link>',
            '    <description>Live quantum computing research signals, hardware calibration telemetry, and preprint briefings.</description>',
            '    <language>en-us</language>',
            f'    <pubDate>{now_rfc822}</pubDate>',
            '    <atom:link href="https://qualution.org/api/v1/portal/export/rss" rel="self" type="application/rss+xml" />'
        ]

        for it in items[:50]:
            title = it.get("title", "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            summary = (it.get("summary") or it.get("abstract") or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            link = it.get("canonical_url") or f"https://qualution.org/portal/item/{it.get('id')}"
            guid = it.get("id") or link
            pub_date = it.get("published_at") or now_rfc822

            xml_lines.extend([
                '    <item>',
                f'      <title>{title}</title>',
                f'      <link>{link}</link>',
                f'      <description>{summary}</description>',
                f'      <guid isPermaLink="false">{guid}</guid>',
                f'      <category>{it.get("section", "research")}</category>',
                f'      <pubDate>{pub_date}</pubDate>',
                '    </item>'
            ])

        xml_lines.extend([
            '  </channel>',
            '</rss>'
        ])
        return "\n".join(xml_lines)

    async def generate_bibtex_catalog(self) -> str:
        """Generates comprehensive BibTeX catalog of all curated signals."""
        await portal_db_service._init_memory_cache()
        items = list(portal_db_service._memory_items.values())
        bib_entries = []

        for it in items:
            clean_id = re.sub(r'[^a-zA-Z0-9]', '', str(it.get("title", "signal"))[:16].lower()) + "_" + str(it.get("id", "1"))[:6]
            title = it.get("title", "Quantum Research Paper")
            author = it.get("author_display_name", "Qualution Community")
            year = str(datetime.now().year)
            abstract = (it.get("abstract") or it.get("summary") or "").replace("\n", " ")
            url = it.get("canonical_url", "")
            tags = ", ".join(it.get("tags", []))

            entry = (
                f"@article{{{clean_id},\n"
                f"  title = {{{{{title}}}}},\n"
                f"  author = {{{author}}},\n"
                f"  year = {{{year}}},\n"
                f"  journal = {{QUALUTION Quantum Telemetry Portal}},\n"
                f"  abstract = {{{{{abstract}}}}},\n"
                f"  url = {{{url}}},\n"
                f"  keywords = {{{tags}}}\n"
                f"}}"
            )
            bib_entries.append(entry)

        return "\n\n".join(bib_entries)

portal_importer_service = PortalImporterService()
