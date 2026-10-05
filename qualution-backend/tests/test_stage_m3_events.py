import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.evidence_store_service import evidence_store, LearnerEventCreate

client = TestClient(app)

def test_m3_event_store_auth_required():
    """Unauthenticated requests to POST /misconception/events are rejected with 401."""
    res = client.post("/misconception/events", json={
        "session_id": "sess-1",
        "lesson_id": "superposition-checkpoint-1",
        "step_id": "step-1",
        "kind": "prediction",
        "payload": {"misconception_id": "hadamard-inverts-classical"}
    })
    assert res.status_code == 401

def test_m3_event_store_and_projections():
    """Authenticated user posts event and receives updated projection state."""
    headers = {"Authorization": "Bearer jwt-eval-usr-student-999"}
    res = client.post("/misconception/events", json={
        "session_id": "sess-1",
        "lesson_id": "superposition-checkpoint-1",
        "step_id": "step-1",
        "kind": "prediction",
        "payload": {"misconception_id": "hadamard-inverts-classical", "concept_id": "hadamard_gate", "is_error": True},
        "confidence": 3
    }, headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "event_id" in data
    assert "usr-student-999" in data["user_state"]["user_id"]
    assert "hadamard-inverts-classical" in data["user_state"]["misconceptions"]

def test_m3_get_state_endpoint():
    """GET /misconception/state returns the authenticated user's current projections."""
    headers = {"Authorization": "Bearer jwt-eval-usr-student-999"}
    res = client.get("/misconception/state", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "hadamard-inverts-classical" in data["user_state"]["misconceptions"]

def test_m3_replay_equals_incremental_projection():
    """Asserts that replaying stored events yields identical projection state as incremental updates."""
    user_id = "usr-replay-test"
    # Post 2 events
    evidence_store.insert_event(user_id, LearnerEventCreate(
        session_id="s1", lesson_id="l1", step_id="st1", kind="prediction",
        payload={"misconception_id": "cnot-control-target-swapped", "concept_id": "cnot_gate", "is_error": True}, confidence=2
    ))
    evidence_store.insert_event(user_id, LearnerEventCreate(
        session_id="s1", lesson_id="l1", step_id="st2", kind="verification",
        payload={"misconception_id": "cnot-control-target-swapped", "concept_id": "cnot_gate", "is_correct": True}, confidence=3
    ))

    incremental_state = evidence_store.get_user_state(user_id)
    rebuilt_state = evidence_store.rebuild_user_projections(user_id)

    assert incremental_state["misconceptions"]["cnot-control-target-swapped"]["status"] == rebuilt_state["misconceptions"]["cnot-control-target-swapped"]["status"]
    assert incremental_state["mastery"]["cnot_gate"]["evidence_count"] == rebuilt_state["mastery"]["cnot_gate"]["evidence_count"]

def test_m3_rate_limit_enforcement():
    """Asserts that inserting more than 600 events per hour per user raises rate limit error."""
    user_id = "usr-rate-limit-test"
    for i in range(600):
        evidence_store.insert_event(user_id, LearnerEventCreate(
            session_id="s1", lesson_id="l1", step_id=f"st-{i}", kind="run",
            payload={"test": True}
        ))

    with pytest.raises(ValueError, match="Rate limit exceeded"):
        evidence_store.insert_event(user_id, LearnerEventCreate(
            session_id="s1", lesson_id="l1", step_id="st-601", kind="run",
            payload={"test": True}
        ))

def test_m3_dpdp_export_and_delete():
    """Asserts that export_and_delete_user_data exports JSON payload and clears stored events."""
    user_id = "usr-dpdp-test"
    evidence_store.insert_event(user_id, LearnerEventCreate(
        session_id="s1", lesson_id="l1", step_id="st1", kind="free_text",
        payload={"free_text": "What is superposition?", "concept_id": "superposition"}
    ))

    exported = evidence_store.export_and_delete_user_data(user_id)
    assert exported["user_id"] == user_id
    assert len(exported["events"]) == 1
    assert evidence_store.get_user_state(user_id)["misconceptions"] == {}
