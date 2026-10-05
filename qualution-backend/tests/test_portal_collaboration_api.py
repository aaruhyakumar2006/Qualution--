import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_join_room_and_fetch_annotations():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
        join_payload = {
            "user_id": "usr-teacher-prof-ram",
            "user_name": "Prof. Ram",
            "user_role": "teacher"
        }
        res = await client.post(
            "/api/v1/portal/rooms/paper-surface-code-123/join",
            json=join_payload,
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["room_id"] == "room-paper-surface-code-123"
        assert len(data["active_participants"]) >= 1
        assert len(data["annotations"]) >= 3
        assert len(data["recent_messages"]) >= 2

@pytest.mark.anyio
async def test_create_and_delete_annotation():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
        ann_payload = {
            "item_id": "paper-surface-code-123",
            "selected_text": "QEC syndrome extraction fidelity reaching 99.88%",
            "paragraph_ref": "Section 5 Concluding Benchmark",
            "comment": "Impressive milestone for 156-qubit architecture.",
            "tag": "breakthrough",
            "color": "#10B981"
        }
        create_res = await client.post(
            "/api/v1/portal/rooms/paper-surface-code-123/annotations",
            json=ann_payload,
            headers=headers
        )
        assert create_res.status_code == 200
        ann_data = create_res.json()
        assert ann_data["comment"] == "Impressive milestone for 156-qubit architecture."
        assert ann_data["tag"] == "breakthrough"
        ann_id = ann_data["id"]

        # Fetch annotations
        get_res = await client.get("/api/v1/portal/rooms/paper-surface-code-123/annotations")
        assert get_res.status_code == 200
        all_anns = get_res.json()
        assert any(a["id"] == ann_id for a in all_anns)

        # Delete annotation
        del_res = await client.delete(
            f"/api/v1/portal/rooms/paper-surface-code-123/annotations/{ann_id}",
            headers=headers
        )
        assert del_res.status_code == 200
        assert del_res.json()["status"] == "success"

@pytest.mark.anyio
async def test_post_room_chat_message():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer usr-teacher-prof-ram"}
        msg_payload = {
            "item_id": "paper-surface-code-123",
            "message": "Let's check the Lindbladian dissipation rates in Section 2."
        }
        res = await client.post(
            "/api/v1/portal/rooms/paper-surface-code-123/chat",
            json=msg_payload,
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["message"] == "Let's check the Lindbladian dissipation rates in Section 2."
        assert data["user_role"] == "teacher"
