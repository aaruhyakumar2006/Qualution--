import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.anyio
async def test_get_hardware_pulse_presets():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/portal/hardware/pulses/presets")
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 3
        preset_ids = [p["id"] for p in data]
        assert "ibm-heron-drag-x90" in preset_ids
        assert "rigetti-ankaa-gaussian-square" in preset_ids

@pytest.mark.anyio
async def test_simulate_drag_pulse_waveform():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "pulse_type": "drag",
            "duration_ns": 32.0,
            "sample_rate_ghz": 4.5,
            "amplitude": 0.8,
            "sigma_ns": 6.0,
            "beta_drag": 0.3,
            "phase_rad": 0.0,
            "detuning_mhz": 0.0,
            "samples_count": 80
        }
        res = await client.post("/api/v1/portal/hardware/pulses/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["pulse_type"] == "drag"
        assert len(data["samples"]) == 80
        assert len(data["spectrum"]) > 0
        assert data["leakage_suppression_ratio"] > 90.0
        assert data["estimated_gate_fidelity"] > 0.99
        # Check sample structure
        first_sample = data["samples"][0]
        assert "t_ns" in first_sample
        assert "i_real" in first_sample
        assert "q_imag" in first_sample
        assert "envelope" in first_sample

@pytest.mark.anyio
async def test_simulate_cross_resonance_pulse():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "pulse_type": "cross_resonance",
            "duration_ns": 120.0,
            "sigma_ns": 15.0,
            "amplitude": 0.7,
            "detuning_mhz": 100.0,
            "samples_count": 60
        }
        res = await client.post("/api/v1/portal/hardware/pulses/simulate", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["pulse_type"] == "cross_resonance"
        assert len(data["samples"]) == 60
        assert "Rotary echo tone" in data["calibration_advice"]
