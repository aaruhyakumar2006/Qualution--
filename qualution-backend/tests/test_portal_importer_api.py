import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

SAMPLE_BIBTEX = """
@article{google_sycamore_2026,
  title = {Quantum Advantage Verification on 72-Qubit Sycamore},
  author = {Google Quantum AI},
  year = {2026},
  journal = {Nature Quantum},
  abstract = {We report experimental verification of random circuit sampling cross-entropy benchmarking on Sycamore.},
  url = {https://arxiv.org/abs/2601.12345},
  keywords = {Quantum Advantage, Superconducting, Benchmark}
}

@misc{ionq_forte_bench_2026,
  title = {Barium Qubit Coherence Times Exceeding 1000 Seconds in IonQ Forte},
  author = {IonQ Hardware Research Team},
  year = {2026},
  abstract = {Demonstration of optical clock transitions and long-lived hyperfine ground state coherence in barium-137.},
  url = {https://arxiv.org/abs/2602.54321},
  keywords = {Trapped Ion, Coherence, Hardware}
}
"""

@pytest.mark.anyio
async def test_batch_import_bibtex():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
        payload = {
            "raw_bibtex": SAMPLE_BIBTEX,
            "format": "bibtex",
            "default_section": "papers"
        }
        response = await client.post("/api/v1/portal/ingest/batch-import", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_received"] == 2
        assert data["imported_count"] >= 1
        assert len(data["results"]) == 2
        assert any("Sycamore" in r["title"] for r in data["results"])

@pytest.mark.anyio
async def test_batch_import_duplicate_skipping():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
        payload = {
            "raw_bibtex": SAMPLE_BIBTEX,
            "format": "bibtex",
            "default_section": "papers"
        }
        # First import
        await client.post("/api/v1/portal/ingest/batch-import", json=payload, headers=headers)
        # Second import of identical items
        response = await client.post("/api/v1/portal/ingest/batch-import", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["skipped_count"] >= 1
        assert any(r["status"] == "skipped_duplicate" for r in data["results"])

@pytest.mark.anyio
async def test_export_rss_feed():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/portal/export/rss")
        assert response.status_code == 200
        assert "application/rss+xml" in response.headers.get("content-type", "")
        text = response.text
        assert "<rss version=\"2.0\"" in text
        assert "<channel>" in text
        assert "QUALUTION" in text

@pytest.mark.anyio
async def test_export_bibtex_catalog():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/portal/export/bibtex")
        assert response.status_code == 200
        text = response.text
        assert "@article{" in text
        assert "title =" in text
