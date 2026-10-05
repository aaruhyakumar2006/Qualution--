import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.portal_db_service import portal_db_service
from unittest.mock import patch

@pytest.mark.anyio
async def test_student_forbidden_from_moderation_queue():
    headers = {"Authorization": "Bearer usr-student-alice"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/portal/moderation/queue",
            headers=headers
        )
        assert resp.status_code == 403
        assert "Access restricted" in resp.json()["detail"]

@pytest.mark.anyio
async def test_teacher_can_access_moderation_queue():
    headers = {"Authorization": "Bearer usr-teacher-bob"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/v1/portal/moderation/queue?status=pending",
            headers=headers
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

@pytest.mark.anyio
async def test_moderation_flow_approve_and_self_review_block():
    student_headers = {"Authorization": "Bearer usr-student-charlie"}
    teacher_headers = {"Authorization": "Bearer usr-teacher-dana"}
    transport = ASGITransport(app=app)

    # 1. Student submits a signal
    mock_screening = '{"relevance_score": 0.95, "spam_likelihood": 0.05, "flags": [], "reason": "Great quantum post."}'
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", return_value=(mock_screening, {}, "success")):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            sub_resp = await client.post(
                "/api/v1/portal/submissions",
                headers=student_headers,
                json={
                    "title": "Introduction to Surface Codes in Quantum Error Correction",
                    "submission_type": "paper",
                    "note": "Super clear paper on surface codes.",
                    "url": "https://arxiv.org/abs/2602.99999"
                }
            )
            assert sub_resp.status_code == 201
            item_data = sub_resp.json()
            assert item_data["status"] == "pending"
            item_id = item_data["id"]

            # 2. Student attempts to approve own submission -> 403 forbidden role
            self_appr_resp = await client.post(
                f"/api/v1/portal/moderation/{item_id}/approve",
                headers=student_headers
            )
            assert self_appr_resp.status_code == 403

            # 3. Teacher approves the student's submission -> 200 OK
            appr_resp = await client.post(
                f"/api/v1/portal/moderation/{item_id}/approve",
                headers=teacher_headers
            )
            assert appr_resp.status_code == 200
            assert appr_resp.json()["status"] == "success"

            # 4. Verify item is now in public items feed
            feed_resp = await client.get("/api/v1/portal/items?section=all")
            assert feed_resp.status_code == 200
            feed_items = feed_resp.json()["items"]
            matching = [i for i in feed_items if i["id"] == item_id]
            assert len(matching) == 1
            assert matching[0]["status"] == "approved"
            assert matching[0]["author_role"] == "student"

@pytest.mark.anyio
async def test_teacher_cannot_review_own_post_if_pending():
    teacher_headers = {"Authorization": "Bearer usr-teacher-self"}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Create submission directly as pending by usr-teacher-self in memory
        item = await portal_db_service.create_user_submission({
            "title": "Quantum Foundations Note by Teacher",
            "submission_type": "news",
            "section": "news",
            "author_id": "usr-teacher-self",
            "author_display_name": "Prof. Self",
            "author_role": "teacher",
            "status": "pending",
            "canonical_url": "https://qualution.org/community/test-tch-03"
        })
        item_id = str(item["id"])

        # usr-teacher-self tries to approve their own item
        resp = await client.post(
            f"/api/v1/portal/moderation/{item_id}/approve",
            headers=teacher_headers
        )
        assert resp.status_code == 403
        assert "cannot approve their own submissions" in resp.json()["detail"]

@pytest.mark.anyio
async def test_moderation_reject_flow():
    student_headers = {"Authorization": "Bearer usr-student-dan"}
    teacher_headers = {"Authorization": "Bearer usr-teacher-mod"}
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        item = await portal_db_service.create_user_submission({
            "title": "Off topic essay on crypto tokens",
            "submission_type": "news",
            "section": "news",
            "author_id": "usr-student-dan",
            "author_display_name": "Dan Student",
            "author_role": "student",
            "status": "pending",
            "canonical_url": "https://qualution.org/community/test-crypto-essay"
        })
        item_id = str(item["id"])

        # Reject without reason should fail validation (<3 chars)
        bad_rej = await client.post(
            f"/api/v1/portal/moderation/{item_id}/reject",
            headers=teacher_headers,
            json={"reason": "no"}
        )
        assert bad_rej.status_code == 422

        # Reject with valid reason
        rej_resp = await client.post(
            f"/api/v1/portal/moderation/{item_id}/reject",
            headers=teacher_headers,
            json={"reason": "Off-topic content unrelated to quantum computing."}
        )
        assert rej_resp.status_code == 200
        assert rej_resp.json()["status"] == "success"

        # Check student sees status as rejected with reason
        my_subs = await client.get(
            "/api/v1/portal/submissions/mine",
            headers=student_headers
        )
        assert my_subs.status_code == 200
        rej_item = [i for i in my_subs.json() if i["id"] == item_id][0]
        assert rej_item["status"] == "rejected"
        assert "Off-topic" in rej_item["review_reason"]

@pytest.mark.anyio
async def test_auto_rejection_on_spam_threshold():
    student_headers = {"Authorization": "Bearer usr-student-spambot"}
    transport = ASGITransport(app=app)

    # Mock high spam likelihood (0.95 >= 0.80)
    mock_screening = '{"relevance_score": 0.05, "spam_likelihood": 0.95, "flags": ["spam"], "reason": "Detected promotional spam."}'
    with patch("app.services.providers.nvidia_provider.nvidia_provider._call_chat_completions", return_value=(mock_screening, {}, "success")):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/portal/submissions",
                headers=student_headers,
                json={
                    "title": "Earn money fast with crypto betting",
                    "submission_type": "opportunity",
                    "note": "Free spins and coins",
                    "url": "https://spamcasino.xyz"
                }
            )
            assert resp.status_code == 201
            data = resp.json()
            assert data["status"] == "rejected"
            assert "spam" in data["review_reason"].lower()
            assert data["screening"]["spam_likelihood"] == 0.95
