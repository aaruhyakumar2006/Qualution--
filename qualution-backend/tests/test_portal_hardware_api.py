import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_hardware_telemetry_endpoint():
    """Verify that GET /api/v1/portal/hardware/telemetry returns all hardware providers and calibration metrics."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/portal/hardware/telemetry")
        assert res.status_code == 200
        data = res.json()
        assert "timestamp" in data
        assert data["total_qpus"] >= 4
        assert data["online_qpus"] >= 4
        assert len(data["providers"]) >= 4

        # Verify IBM Heron provider
        heron = next((p for p in data["providers"] if p["id"] == "ibm_heron_r2"), None)
        assert heron is not None
        assert heron["provider"] == "ibm"
        assert heron["qubit_count"] == 133
        assert heron["status"] == "ONLINE"
        assert heron["topology_type"] == "Heavy-Hex"
        assert heron["calibration"]["avg_2q_error"] < 0.01
        assert len(heron["topology_nodes"]) > 0

        # Verify NVIDIA provider
        nvidia = next((p for p in data["providers"] if p["id"] == "nvidia_cuquantum_cluster"), None)
        assert nvidia is not None
        assert nvidia["provider"] == "nvidia"
        assert nvidia["architecture"] == "gpu_accelerator"
        assert nvidia["status"] == "ONLINE"

@pytest.mark.anyio
async def test_hardware_status_endpoint():
    """Verify that GET /api/v1/portal/hardware/status returns aggregated system status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/portal/hardware/status")
        assert res.status_code == 200
        data = res.json()
        assert data["system_status"] in ["OPERATIONAL", "DEGRADED", "MAINTENANCE"]
        assert data["online_count"] >= 4
        assert data["total_count"] >= 4
        assert data["best_2q_fidelity"] > 99.0
        assert len(data["lowest_queue_provider"]) > 0
