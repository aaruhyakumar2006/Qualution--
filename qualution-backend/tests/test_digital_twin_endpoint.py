import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 2-qubit Grover 12-gate fixture targeting |11>
GROVER_12_GATE_FIXTURE = {
    "qubits": 2,
    "gates": [
        # 1. Superposition
        {"type": "h", "targets": [0]},
        {"type": "h", "targets": [1]},
        # 2. Oracle for |11> (CZ)
        {"type": "cz", "targets": [0, 1]},
        # 3. Diffusion operator (H, X, CZ, X, H)
        {"type": "h", "targets": [0]},
        {"type": "h", "targets": [1]},
        {"type": "x", "targets": [0]},
        {"type": "x", "targets": [1]},
        {"type": "cz", "targets": [0, 1]},
        {"type": "x", "targets": [0]},
        {"type": "x", "targets": [1]},
        {"type": "h", "targets": [0]},
        {"type": "h", "targets": [1]},
    ],
    "shots": 1000,
}

def test_digital_twin_grover_12_gate_runs_and_distinguishes_noise():
    """
    Test POST /simulate/digital-twin with the Grover 12-gate fixture.
    Confirms ideal vs noisy simulations return genuinely different distributions,
    the real hardware coupling map, real T1/T2 values, real two-qubit gate errors,
    and strictly NO fidelity calculation.
    """
    response = client.post("/simulate/digital-twin", json=GROVER_12_GATE_FIXTURE)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    data = response.json()

    # 1. Backend identity
    assert data["backend_name"] == "fake_manila"
    assert data["backend_display_name"] == "FakeManilaV2"
    assert data["qubit_count"] == 5
    assert data["circuit_qubits"] == 2
    assert data["shots"] == 1000
    assert data["execution_location"] == "local_python"
    assert data["runtime_ms"] > 0

    # 2. Confirm ideal vs noisy distributions exist and are genuinely DIFFERENT
    ideal_probs = data["ideal_probabilities"]
    noisy_probs = data["noisy_probabilities"]
    assert "11" in ideal_probs
    assert ideal_probs["11"] >= 0.99, f"Ideal Grover search must yield |11> with ~100%, got {ideal_probs}"

    assert "11" in noisy_probs
    # Crucial checkpoint: noisy distribution must NOT be identical to ideal
    assert noisy_probs != ideal_probs, "Noisy probabilities must genuinely differ from ideal!"
    assert noisy_probs["11"] < 0.99, f"Noisy Grover should experience degradation, got {noisy_probs['11']}"

    # Confirm noise leakage states exist in noisy counts
    leakage_states = [s for s in ["00", "01", "10"] if s in noisy_probs and noisy_probs[s] > 0]
    assert len(leakage_states) > 0, f"Expected error leakage in noisy distribution, got {noisy_probs}"

    # 3. Confirm real coupling map (edge list)
    cmap = data["coupling_map"]
    assert isinstance(cmap, list) and len(cmap) == 8
    assert [0, 1] in cmap
    assert [1, 0] in cmap
    assert [1, 2] in cmap
    assert [2, 1] in cmap
    assert [2, 3] in cmap
    assert [3, 2] in cmap
    assert [3, 4] in cmap
    assert [4, 3] in cmap

    # 4. Confirm real per-qubit T1/T2 values
    props = data["qubit_properties"]
    assert len(props) == 5
    for p in props:
        assert "qubit" in p
        assert p["t1"] is not None and p["t1"] > 0
        assert p["t2"] is not None and p["t2"] > 0
        assert p["t1_us"] is not None and p["t1_us"] > 50  # typically 100-200 us
        assert p["t2_us"] is not None and p["t2_us"] > 10
        assert p["frequency_ghz"] is not None and 4.0 < p["frequency_ghz"] < 6.0

    # 5. Confirm real two-qubit gate error rates
    errors = data["gate_errors"]
    assert len(errors) == 8
    for e in errors:
        assert e["gate"] == "cx"
        assert len(e["qubits"]) == 2
        assert e["error"] > 0
        assert e["duration_ns"] is not None and e["duration_ns"] > 0

    # 6. Contract guarantee: NO fidelity calculation in this endpoint
    assert "fidelity" not in data, "Digital twin endpoint must NOT compute fidelity score"

def test_digital_twin_with_api_v1_prefix_and_query_param():
    """
    Verify POST /api/v1/simulate/digital-twin alias and query parameter override.
    """
    response = client.post(
        "/api/v1/simulate/digital-twin?backend_name=fake_manila",
        json=GROVER_12_GATE_FIXTURE,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["backend_name"] == "fake_manila"
    assert data["qubit_count"] == 5

def test_digital_twin_alternate_backend_jakarta():
    """
    Verify simulating on 7-qubit FakeJakartaV2 backend.
    """
    payload = dict(GROVER_12_GATE_FIXTURE)
    payload["backend_name"] = "fake_jakarta"

    response = client.post("/simulate/digital-twin", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["backend_name"] == "fake_jakarta"
    assert data["qubit_count"] == 7
    assert len(data["qubit_properties"]) == 7

def test_digital_twin_exceeds_qubit_capacity_error():
    """
    Verify 400 Bad Request when circuit exceeds backend capacity.
    """
    oversized_circuit = {
        "qubits": 6,
        "gates": [{"type": "h", "targets": [0]}],
        "backend_name": "fake_manila",  # capacity 5
    }
    response = client.post("/simulate/digital-twin", json=oversized_circuit)
    assert response.status_code == 400
    assert "exceeds fake backend" in response.json()["detail"]

def test_digital_twin_unknown_backend_error():
    """
    Verify 400 Bad Request for unrecognized backend.
    """
    bad_backend_circuit = {
        "qubits": 2,
        "gates": [{"type": "h", "targets": [0]}],
        "backend_name": "non_existent_fake_backend_999",
    }
    response = client.post("/simulate/digital-twin", json=bad_backend_circuit)
    assert response.status_code == 400
    assert "Unsupported or unknown fake backend" in response.json()["detail"]
