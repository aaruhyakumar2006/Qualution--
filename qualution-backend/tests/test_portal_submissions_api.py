import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.portal_db_service import portal_db_service

@pytest.mark.anyio
async def test_submission_api_requires_auth():
    """Verify that posting a submission without an auth token returns HTTP 401."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/portal/submissions", json={
            "submission_type": "project",
            "title": "Quantum Error Mitigated Circuit"
        })
        assert res.status_code == 401

@pytest.mark.anyio
async def test_submission_api_student_pending_and_sanitization():
    """Verify that a student submission is created as 'pending', HTML is stripped, and control characters removed."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-student-alex"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/portal/submissions", headers=headers, json={
            "submission_type": "resource",
            "title": "<b>Quantum</b> Grover Search <i>Interactive Notebook</i>\x00\x07",
            "note": "<script>alert('xss')</script>A practical guided tutorial for undergraduates.",
            "url": "https://github.com/qualution/grover-tutorial?utm_source=twitter&utm_medium=social"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "pending"
        # HTML stripped & sanitized
        assert "<" not in data["title"]
        assert "Quantum Grover Search Interactive Notebook" in data["title"]
        assert "<script>" not in data["note"]
        # Tracking stripped
        assert "utm_source" not in data["canonical_url"]
        assert data["canonical_url"] == "https://github.com/qualution/grover-tutorial"
        assert data["author_role"] == "student"

@pytest.mark.anyio
async def test_submission_api_teacher_auto_approval():
    """Verify that teacher or admin submissions are auto-approved on creation."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/portal/submissions", headers=headers, json={
            "submission_type": "courses",
            "title": "Advanced Quantum Error Correction Lab Syllabus 2026",
            "note": "Complete laboratory coursework for undergraduate second year students.",
            "url": "https://qualution.org/syllabus/qec-2026"
        })
        assert res.status_code == 201
        data = res.json()
        assert data["status"] == "approved"
        assert data["author_role"] == "teacher"

@pytest.mark.anyio
async def test_submission_api_url_scheme_validation():
    """Verify that unsafe URL schemes like javascript:, data:, file: are rejected with 422 Unprocessable Entity."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-student-alex"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        for unsafe_url in [
            "javascript:alert(1)",
            "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            "file:///etc/passwd",
            "ftp://files.example.com/item"
        ]:
            res = await ac.post("/api/v1/portal/submissions", headers=headers, json={
                "submission_type": "news",
                "title": "Unsafe URL Test Submission",
                "url": unsafe_url
            })
            assert res.status_code == 422, f"Failed for url: {unsafe_url}"

@pytest.mark.anyio
async def test_submission_api_duplicate_url_rejection():
    """Verify that submitting a duplicate canonical URL is rejected with HTTP 409 Conflict."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-student-sarah"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        dup_url = "https://quantum-journal.org/papers/q-2026-duplicate-check"
        # First submission
        res1 = await ac.post("/api/v1/portal/submissions", headers=headers, json={
            "submission_type": "project",
            "title": "Initial Quantum Walk Telemetry",
            "url": dup_url
        })
        assert res1.status_code == 201

        # Second submission with same URL (even with tracking query params)
        res2 = await ac.post("/api/v1/portal/submissions", headers=headers, json={
            "submission_type": "project",
            "title": "Second Quantum Walk Submission",
            "url": f"{dup_url}?utm_source=reddit"
        })
        assert res2.status_code == 409
        assert "already been submitted" in res2.json()["detail"].lower()

@pytest.mark.anyio
async def test_my_submissions_and_deletion():
    """Verify that an author can view their submissions and delete their own submission."""
    transport = ASGITransport(app=app)
    author_headers = {"Authorization": "Bearer usr-student-dev"}
    other_headers = {"Authorization": "Bearer usr-student-other"}

    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Create submission
        res = await ac.post("/api/v1/portal/submissions", headers=author_headers, json={
            "submission_type": "event",
            "title": "Chennai Quantum Hackathon Meetup",
            "note": "Weekend community coding hackathon at SSN campus."
        })
        assert res.status_code == 201
        item_id = res.json()["id"]

        # View in /mine
        res_mine = await ac.get("/api/v1/portal/submissions/mine", headers=author_headers)
        assert res_mine.status_code == 200
        mine_items = res_mine.json()
        assert any(i["id"] == item_id for i in mine_items)

        # Other user cannot delete
        res_del_other = await ac.delete(f"/api/v1/portal/submissions/{item_id}", headers=other_headers)
        assert res_del_other.status_code == 404

        # Real author can delete
        res_del = await ac.delete(f"/api/v1/portal/submissions/{item_id}", headers=author_headers)
        assert res_del.status_code == 200

@pytest.mark.anyio
async def test_post_report_endpoint():
    """Verify that authenticated users can report an existing content item."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-student-reporter"}
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # Get an item
        items_res = await ac.get("/api/v1/portal/items?limit=1")
        items = items_res.json()["items"]
        assert len(items) > 0
        target_item_id = items[0]["id"]

        # Report item
        res = await ac.post(f"/api/v1/portal/items/{target_item_id}/report", headers=headers, json={
            "reason": "Suspected spam and misleading quantum speedup claim."
        })
        assert res.status_code == 201
        assert res.json()["status"] == "success"

@pytest.mark.anyio
async def test_submission_with_circuit_embed():
    """Verify that submissions with OpenQASM code are validated, persisted, and returned."""
    transport = ASGITransport(app=app)
    headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
    bell_qasm = "OPENQASM 2.0;\ninclude \"qelib1.inc\";\nqreg q[2];\nh q[0];\ncx q[0], q[1];\n"
    
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/v1/portal/submissions", headers=headers, json={
            "submission_type": "project",
            "title": "Interactive Bell State Circuit Telemetry",
            "note": "A minimal 2-qubit Bell state entanglement circuit demonstration.",
            "circuit_qasm": bell_qasm
        })
        assert res.status_code == 201
        data = res.json()
        assert data["circuit_qasm"] == bell_qasm.strip()
        assert data["status"] == "approved"
        item_id = data["id"]

        # Verify it appears in /submissions/mine
        res_mine = await ac.get("/api/v1/portal/submissions/mine", headers=headers)
        assert res_mine.status_code == 200
        mine_item = next((i for i in res_mine.json() if i["id"] == item_id), None)
        assert mine_item is not None
        assert mine_item["circuit_qasm"] == bell_qasm.strip()

