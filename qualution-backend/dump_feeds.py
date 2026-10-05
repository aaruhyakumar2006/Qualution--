import re, json, html, calendar
from datetime import datetime, timezone
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import feedparser

UA = "QualutionPortalBot/0.1 (contact: telemetry@qualution.org)"
FEEDS = {
    "infoq": "https://feed.infoq.com/quantumcomputing/",
    "phys": "https://phys.org/rss-feed/physics-news/quantum-physics/",
    "qiskit": "https://medium.com/feed/qiskit",
    "qjournal": "https://quantum-journal.org/feed",
    "aws": "https://aws.amazon.com/blogs/quantum-computing/feed/",
}
TRACKING = ("utm_", "fbclid", "gclid")

def canonical(url):
    p = urlsplit(url)
    q = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith(TRACKING)]
    return urlunsplit((p.scheme, p.netloc.lower(), p.path.rstrip("/"), urlencode(q), ""))

def clean(text):
    text = re.sub(r"<[^>]+>", " ", text or "")
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    # Strip RSS/Blog boilerplate patterns
    text = re.sub(r"\[…\]|\[\.\.\.\]|\[&#8230;\]|\u2026", "", text)
    text = re.sub(r"(The post|This article|Read more|Continue reading).*?appeared first on.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"(Read more|Continue reading)\b.*$", "", text, flags=re.IGNORECASE)
    return text.strip()

def parse_date(e):
    t = e.get("published_parsed") or e.get("updated_parsed")
    if not t:
        return None
    return datetime.fromtimestamp(calendar.timegm(t), tz=timezone.utc).isoformat()

items = []
for name, url in FEEDS.items():
    d = feedparser.parse(url, agent=UA)
    if d.bozo and not d.entries:
        print(name, "FAILED:", d.get("bozo_exception"))
        continue
    print(name, getattr(d, "status", "?"), len(d.entries))
    for e in d.entries:
        items.append({
            "source": name,
            "title": clean(e.get("title")),
            "url": canonical(e.get("link", "")),
            "published_at": parse_date(e),
            "abstract": clean(e.get("summary"))[:1500],
        })

with open("feed_dump.json", "w", encoding="utf-8") as f:
    json.dump(items, f, indent=2, ensure_ascii=False)
print("saved", len(items), "cleaned items to feed_dump.json")
