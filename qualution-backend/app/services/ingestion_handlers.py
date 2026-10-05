import html
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import httpx

logger = logging.getLogger("ingestion_handlers")

USER_AGENT = "QUALUTION-Community-Telemetry-Bot/1.0 (+https://qualution.org/telemetry)"
TRACKING_PARAMS = ("utm_", "fbclid", "gclid")

def clean_tracking_url(url: str) -> str:
    """Removes tracking query parameters (utm_*, fbclid, gclid) and trailing slashes."""
    if not url:
        return ""
    p = urlsplit(url)
    q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith(TRACKING_PARAMS)]
    return urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip("/"), urlencode(q), ""))

def clean_rss_text(text: Optional[str]) -> str:
    """Strips HTML tags, unescapes entities, and cleans RSS/blog boilerplate strings."""
    if not text:
        return ""
    t = re.sub(r"<[^>]+>", " ", text)
    t = re.sub(r"\s+", " ", html.unescape(t)).strip()
    t = re.sub(r"\[…\]|\[\.\.\.\]|\[&#8230;\]|\u2026", "", t)
    t = re.sub(r"(The post|This article|Read more|Continue reading).*?appeared first on.*$", "", t, flags=re.IGNORECASE)
    t = re.sub(r"(Read more|Continue reading)\b.*$", "", t, flags=re.IGNORECASE)
    return t.strip()

class ArxivHandler:
    """Ingests recent research papers from the official arXiv API via Atom XML."""
    async def fetch(self, source: Dict[str, Any]) -> List[Dict[str, Any]]:
        query = source.get("url_or_query", "cat:quant-ph")
        # Format query if simple category
        if ":" not in query:
            query = f"all:{query}"
        api_url = f"http://export.arxiv.org/api/query?search_query={query}&max_results=8&sortBy=submittedDate&sortOrder=descending"

        items = []
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(api_url)
            if resp.status_code != 200:
                logger.warning(f"arXiv API returned status {resp.status_code} for query {query}")
                return []

            try:
                root = ET.fromstring(resp.text)
            except Exception as e:
                logger.warning(f"arXiv response XML parsing failed for query {query}: {e}")
                return []
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            for entry in root.findall("atom:entry", ns):
                title_elem = entry.find("atom:title", ns)
                id_elem = entry.find("atom:id", ns)
                summary_elem = entry.find("atom:summary", ns)
                published_elem = entry.find("atom:published", ns)

                if title_elem is None or id_elem is None:
                    continue

                raw_title = " ".join(title_elem.text.split()) if title_elem.text else "Untitled"
                canonical_url = id_elem.text.strip() if id_elem.text else ""
                abstract = " ".join(summary_elem.text.split()) if summary_elem is not None and summary_elem.text else ""
                published_at = published_elem.text.strip() if published_elem is not None and published_elem.text else datetime.now(timezone.utc).isoformat()

                # Clean arXiv URL to standard format
                canonical_url = re.sub(r"^http:", "https:", canonical_url)
                canonical_url = re.sub(r"v\d+$", "", canonical_url)

                items.append({
                    "source": source.get("name", "arXiv"),
                    "source_tier": source.get("source_tier", 1),
                    "section": source.get("section", "research"),
                    "title": raw_title,
                    "canonical_url": canonical_url,
                    "published_at": published_at,
                    "abstract": abstract[:3000],
                })
        return items

class RssHandler:
    """Ingests news and events from standard RSS 2.0 and Atom feeds."""
    async def fetch(self, source: Dict[str, Any]) -> List[Dict[str, Any]]:
        feed_url = source.get("url_or_query")
        if not feed_url or not feed_url.startswith("http"):
            logger.warning(f"Invalid or missing RSS feed URL: '{feed_url}'")
            return []

        items = []
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}, follow_redirects=True) as client:
            try:
                resp = await client.get(feed_url)
            except Exception as e:
                logger.warning(f"RSS connection error for {feed_url}: {e}")
                return []

            if resp.status_code != 200:
                logger.warning(f"RSS feed returned status {resp.status_code} for {feed_url}")
                return []

            try:
                root = ET.fromstring(resp.text)
            except Exception as e:
                logger.warning(f"RSS XML parsing failed for {feed_url}: {e}")
                return []

            # Check if RSS 2.0
            channel = root.find("channel")
            if channel is not None:
                for item in channel.findall("item"):
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    desc_elem = item.find("description")
                    pub_elem = item.find("pubDate")

                    if title_elem is None or not title_elem.text:
                        continue

                    title = clean_rss_text(title_elem.text)
                    raw_link = link_elem.text.strip() if link_elem is not None and link_elem.text else ""
                    link = clean_tracking_url(raw_link)
                    if not link or not title:
                        continue

                    raw_desc = desc_elem.text if desc_elem is not None and desc_elem.text else ""
                    clean_desc = clean_rss_text(raw_desc)

                    items.append({
                        "source": source.get("name", "RSS Feed"),
                        "source_tier": source.get("source_tier", 2),
                        "section": source.get("section", "news"),
                        "title": title,
                        "canonical_url": link,
                        "published_at": datetime.now(timezone.utc).isoformat(),
                        "abstract": clean_desc[:2500],
                    })
            else:
                # Check Atom feed
                ns = {"atom": "http://www.w3.org/2005/Atom"}
                for entry in root.findall("atom:entry", ns) or root.findall("entry"):
                    title_elem = entry.find("atom:title", ns) if "atom" in ns else entry.find("title")
                    link_elem = entry.find("atom:link", ns) if "atom" in ns else entry.find("link")
                    summary_elem = entry.find("atom:summary", ns) if "atom" in ns else entry.find("summary")

                    if title_elem is None or not title_elem.text:
                        continue

                    title = clean_rss_text(title_elem.text)
                    raw_link = link_elem.attrib.get("href", "") if link_elem is not None else ""
                    link = clean_tracking_url(raw_link)
                    if not link or not title:
                        continue

                    raw_sum = summary_elem.text if summary_elem is not None and summary_elem.text else ""
                    clean_sum = clean_rss_text(raw_sum)

                    items.append({
                        "source": source.get("name", "Atom Feed"),
                        "source_tier": source.get("source_tier", 2),
                        "section": source.get("section", "news"),
                        "title": title,
                        "canonical_url": link,
                        "published_at": datetime.now(timezone.utc).isoformat(),
                        "abstract": clean_sum[:2500],
                    })
        return items

class GithubHandler:
    """Ingests official release announcements via the GitHub Releases API."""
    async def fetch(self, source: Dict[str, Any]) -> List[Dict[str, Any]]:
        repo = source.get("url_or_query", "").strip()
        # Clean owner/repo
        repo = re.sub(r"^https?://github\.com/", "", repo).strip("/")
        if "/" not in repo:
            return []

        api_url = f"https://api.github.com/repos/{repo}/releases?per_page=5"
        items = []
        async with httpx.AsyncClient(timeout=15.0, headers={"User-Agent": USER_AGENT}) as client:
            resp = await client.get(api_url)
            if resp.status_code != 200:
                logger.warning(f"GitHub API returned {resp.status_code} for repo {repo}")
                return []

            releases = resp.json()
            if not isinstance(releases, list):
                return []

            for rel in releases:
                tag = rel.get("tag_name", "")
                name = rel.get("name") or tag
                title = f"{repo.split('/')[-1]} {tag}: {name}" if name != tag else f"{repo.split('/')[-1]} Release {tag}"
                html_url = rel.get("html_url", "")
                body = rel.get("body", "")
                published_at = rel.get("published_at") or datetime.now(timezone.utc).isoformat()

                if not html_url:
                    continue

                clean_body = re.sub(r"<[^>]+>", "", body).strip()
                clean_body = " ".join(clean_body.split())

                items.append({
                    "source": source.get("name", f"GitHub {repo}"),
                    "source_tier": source.get("source_tier", 1),
                    "section": source.get("section", "qualution"),
                    "title": title,
                    "canonical_url": html_url,
                    "published_at": published_at,
                    "abstract": clean_body[:2500] or f"Official release of {title} with updated features and bug fixes.",
                })
        return items

HANDLERS = {
    "arxiv": ArxivHandler(),
    "rss": RssHandler(),
    "github": GithubHandler(),
}

async def fetch_source_items(source: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Dispatches to the correct handler based on source type with safe error isolation."""
    stype = source.get("type", "").lower()
    handler = HANDLERS.get(stype)
    if not handler:
        logger.warning(f"Unknown source type '{stype}' for source '{source.get('name')}'")
        return []

    try:
        return await handler.fetch(source)
    except Exception as e:
        logger.error(f"Failed to fetch from source '{source.get('name')}' ({stype}): {e}")
        return []
