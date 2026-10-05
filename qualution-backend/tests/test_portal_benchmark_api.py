import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_get_benchmark_presets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/api/v1/portal/benchmark/presets")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 4
        ids = [p["id"] for p in data]
        assert "grover_3q" in ids
        assert "qft_4q" in ids
        assert "bv_4q" in ids
        assert "qaoa_maxcut_4q" in ids

@pytest.mark.anyio
async def test_compare_circuit_performance_preset():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"preset_id": "grover_3q"}
        response = await ac.post("/api/v1/portal/benchmark/compare", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["benchmark_name"] == "Grover's Search (3-Qubit Oracle)"
        assert len(data["results"]) >= 4

        # Verify providers exist
        provider_ids = [r["provider_id"] for r in data["results"]]
        assert "ibm_heron_r2" in provider_ids
        assert "nvidia_cuquantum_cluster" in provider_ids
        assert "ionq_aria_trapped_ion" in provider_ids
        assert "rigetti_ankaa_9q" in provider_ids

        # Fidelity between 0 and 100%
        for r in data["results"]:
            assert 0.0 <= r["estimated_fidelity"] <= 100.0
            assert r["transpiled_depth"] >= 1

@pytest.mark.anyio
async def test_compare_circuit_performance_custom_qasm():
    custom_qasm = """OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
h q[0];
cx q[0], q[1];
"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {"custom_qasm": custom_qasm}
        response = await ac.post("/api/v1/portal/benchmark/compare", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["benchmark_name"] == "Custom QASM Circuit"
        assert data["num_qubits"] == 2
        assert len(data["results"]) >= 4
