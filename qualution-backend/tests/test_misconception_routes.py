import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoint_facts_valid():
    payload = {
        "circuit": {
            "qubits": 2,
            "classical_bits": 2,
            "gates": [
                {"gate": "h", "targets": [0]},
                {"gate": "cx", "targets": [0, 1]}
            ]
        },
        "max_qubits": 12
    }
    response = client.post("/misconception/facts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "measurement_probabilities" in data
    assert data["measurement_probabilities"]["00"] == 0.5
    assert data["measurement_probabilities"]["11"] == 0.5

def test_endpoint_facts_too_large():
    payload = {
        "circuit": {
            "qubits": 15,
            "classical_bits": 15,
            "gates": []
        },
        "max_qubits": 12
    }
    response = client.post("/misconception/facts", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "too_large"
    assert data["requested_qubits"] == 15

def test_endpoint_diagnose_valid():
    payload = {
        "circuit": {
            "qubits": 1,
            "classical_bits": 1,
            "gates": [{"gate": "h", "targets": [0]}]
        },
        "student_prediction": {"1": 1.0},
        "confidence": 0.9,
        "current_step_id": "superposition-step-1"
    }
    response = client.post("/misconception/diagnose", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["misconception_detected", "matches_correct_answer"]

def test_endpoint_diagnose_correct_student():
    payload = {
        "circuit": {
            "qubits": 1,
            "classical_bits": 1,
            "gates": [{"gate": "h", "targets": [0]}]
        },
        "student_prediction": {"0": 0.5, "1": 0.5},
        "confidence": 0.9
    }
    response = client.post("/misconception/diagnose", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "matches_correct_answer"

def test_endpoint_status_valid():
    payload = {
        "events": [
            {
                "kind": "prediction_error",
                "misconception_id": "superposition-not-mixture",
                "concept_ids": ["superposition"],
                "step_id": "step-1",
                "strength": 1.0,
                "timestamp": 100.0,
                "confidence": 0.9
            },
            {
                "kind": "prediction_error",
                "misconception_id": "superposition-not-mixture",
                "concept_ids": ["superposition"],
                "step_id": "step-2",
                "strength": 1.0,
                "timestamp": 105.0,
                "confidence": 0.9
            }
        ]
    }
    response = client.post("/misconception/status", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "superposition-not-mixture" in data["statuses"]
    assert data["statuses"]["superposition-not-mixture"]["status"] == "SUPPORTED"

def test_endpoint_prerequisite_trace():
    response = client.get("/misconception/prerequisite_trace/grovers_search")
    assert response.status_code == 200
    data = response.json()
    assert data["failing_concept_id"] == "grovers_search"

def test_endpoint_malformed_input():
    payload = {
        "circuit": "not_a_circuit"
    }
    response = client.post("/misconception/facts", json=payload)
    assert response.status_code == 422
