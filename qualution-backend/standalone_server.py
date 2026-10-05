"""
Standalone FastAPI runner for the QUALUTION Digital Twin Backend.
Run with:
    python standalone_server.py
or
    uvicorn standalone_server:app --reload --port 8000
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn

from app.schemas.canonical import CanonicalCircuitInput
from app.schemas.digital_twin import DigitalTwinSimulationResponse
from app.services.aer_digital_twin_service import aer_digital_twin_service

app = FastAPI(
    title="QUALUTION Digital Twin API",
    description="Hardware-calibrated noisy Aer digital twin simulation service",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "qualution-digital-twin"}

@app.post("/simulate/digital-twin", response_model=DigitalTwinSimulationResponse)
def simulate_digital_twin(
    circuit: CanonicalCircuitInput,
    backend_name: Optional[str] = Query(default=None, description="Target fake backend name (defaults to fake_manila)")
):
    """
    Simulates the circuit simultaneously on:
    1. Ideal noiseless Aer simulator
    2. Hardware-calibrated noisy Aer simulator (configured with IBM FakeManilaV2 snapshot)
    Returns probability distributions, physical coupling graph, T1/T2 properties, and gate error rates.
    """
    try:
        return aer_digital_twin_service.simulate(circuit, backend_name=backend_name)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Digital twin simulation error: {str(e)}")

# Mount alias for /api/v1/simulate/digital-twin
@app.post("/api/v1/simulate/digital-twin", response_model=DigitalTwinSimulationResponse)
def simulate_digital_twin_v1(
    circuit: CanonicalCircuitInput,
    backend_name: Optional[str] = Query(default=None, description="Target fake backend name (defaults to fake_manila)")
):
    return simulate_digital_twin(circuit, backend_name=backend_name)

if __name__ == "__main__":
    print("Starting QUALUTION Digital Twin standalone server on http://127.0.0.1:8000 ...")
    uvicorn.run("standalone_server:app", host="127.0.0.1", port=8000, reload=True)
