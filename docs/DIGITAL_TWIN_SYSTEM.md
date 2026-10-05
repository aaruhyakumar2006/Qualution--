# QUALUTION — Digital Twin Hardware Simulation & Comparison System

A self-contained package containing all files required strictly for the **Digital Twin** feature of QUALUTION.

The **Digital Twin** mirrors real quantum hardware (IBM Falcon r5.4 architecture, FakeManilaV2) by running dual concurrent simulations:
1. **Ideal Noiseless Simulation** (Qiskit Aer plain simulator)
2. **Hardware-Calibrated Noisy Simulation** (Qiskit Aer with real physical calibration noise models from `qiskit_ibm_runtime.fake_provider`)

It then performs classical state distribution fidelity calculations via **Rust WebAssembly** (with a **TypeScript** fallback) and produces an honest, metadata-grounded **AI Tutor** explanation pinpointing exact physical error mechanisms ($T_1$, $T_2$, and two-qubit gate CX error rates).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |   Vite / React Frontend Application   |
                      +---------------------------------------+
                                    |           |
            1. POST /simulate/digital-twin      | 3. Client-Side Fidelity (Zero WAN)
                                    |           v
                                    |    +-----------------------------+
                                    |    | Dual-Engine Fidelity Core   |
                                    |    | - Primary: Rust WebAssembly |
                                    |    | - Fallback: TypeScript      |
                                    |    +-----------------------------+
                                    v
            +---------------------------------------+
            |       FastAPI Python Backend          |
            |           (127.0.0.1:8000)            |
            +---------------------------------------+
            |  Qiskit Aer Ideal vs Noisy Simulator  |
            |  - Offline IBM FakeManilaV2 snapshot  |
            |  - Physical coupling map edges        |
            |  - Calibrated T1 / T2 & CX gate errors|
            +---------------------------------------+
```

---

## Directory Structure

```
digital twin/
├── README.md                               <-- This comprehensive documentation
├── docs/
│   └── DIGITAL_TWIN_OFFLINE_PROFILE.md     <-- Network and offline architectural profile
│
├── backend/                                <-- Python FastAPI & Qiskit Aer service
│   ├── standalone_server.py                <-- Self-contained runner: python standalone_server.py
│   ├── requirements.txt                    <-- Python dependencies
│   ├── app/
│   │   ├── schemas/
│   │   │   ├── digital_twin.py             <-- QubitProperty, TwoQubitGateError, response schemas
│   │   │   └── canonical.py                <-- Circuit definition schema
│   │   ├── services/
│   │   │   └── aer_digital_twin_service.py <-- Dual Aer simulator with FakeManilaV2 snapshot
│   │   └── api/
│   │       └── routes/
│   │           └── simulation.py           <-- POST /simulate/digital-twin endpoint
│   └── tests/
│       └── test_digital_twin_endpoint.py   <-- Pytest tests (Grover 12-gate fixture, Manila, Jakarta)
│
├── frontend/                               <-- React TypeScript UI & execution engines
│   ├── package.json                        <-- Dependencies and vitest configuration
│   └── src/
│       ├── api/
│       │   ├── digitalTwinApi.ts           <-- Self-contained API caller
│       │   └── circuitApi.ts               <-- Workbench API client
│       ├── features/
│       │   ├── circuit/
│       │   │   ├── digitalTwinTypes.ts     <-- Shared contracts & types
│       │   │   ├── digitalTwinTypes.test.ts<-- Contract tests
│       │   │   ├── digitalTwinEngine.ts    <-- Dual-engine fidelity calculator (Bhattacharyya)
│       │   │   ├── digitalTwinEngine.test.ts
│       │   │   ├── digitalTwinParity.test.ts <-- Parity harness (WASM vs TS across 12 distributions)
│       │   │   ├── benchmarkDigitalTwin.test.ts <-- Fidelity calculation benchmarks
│       │   │   ├── digitalTwinOfflineProfile.test.tsx <-- Offline boundary validation tests
│       │   │   ├── wasmManager.ts          <-- WASM lifecycle & fallback dispatcher
│       │   │   └── types.ts                <-- Circuit definitions
│       │   └── tutor/
│       │       ├── digitalTwinTutor.ts     <-- AI Tutor explanation engine (grounded in metadata)
│       │       └── digitalTwinTutor.test.ts<-- Tutor explanation test suite
│       └── components/
│           ├── circuit/
│           │   ├── DigitalTwinComparisonView.tsx <-- Dual histogram comparison UI
│           │   ├── DigitalTwinComparisonView.css
│           │   ├── DigitalTwinComparisonView.test.tsx
│           │   ├── DigitalTwinTopologyOverlay.tsx <-- Hardware coupling graph & SWAP routing
│           │   ├── DigitalTwinTopologyOverlay.css
│           │   ├── DigitalTwinTopologyOverlay.test.tsx
│           │   ├── CircuitCanvas.tsx       <-- Canvas with hardware mirror toggle
│           │   └── CircuitCanvas.css
│           ├── layout/
│           │   ├── TopologyModal.tsx       <-- Studio modal with Topology and Digital Twin tabs
│           │   └── TopologyModal.test.tsx
│           └── visualization/
│               ├── ProbabilityHistogram.tsx <-- IBM Composer vertical bar chart
│               └── ProbabilityHistogram.css
│
└── wasm/                                   <-- High-performance WebAssembly fidelity core
    └── qualution-core/
        ├── Cargo.toml
        ├── src/
        │   └── lib.rs                      <-- Rust implementation (compute_distribution_fidelity)
        └── pkg/                            <-- Pre-compiled WASM package (.wasm, .js, .d.ts)
```

---

## Quick Start

### 1. Running the Backend Service

```bash
cd backend
pip install -r requirements.txt
python standalone_server.py
```
Backend will start on `http://127.0.0.1:8000`. You can test health:
```bash
curl http://127.0.0.1:8000/health
```

Run backend unit tests:
```bash
python -m pytest tests/test_digital_twin_endpoint.py
```

### 2. Testing the Frontend & Dual-Engine Core

```bash
cd frontend
npm install
npm test
```

Tests run with Vitest:
- `digitalTwinTypes.test.ts` (contract definitions)
- `digitalTwinEngine.test.ts` (mathematical fidelity tests)
- `digitalTwinParity.test.ts` (12-case parity between Rust WASM and TypeScript fallback)
- `digitalTwinTutor.test.ts` (AI Tutor explanation generation)
- `DigitalTwinComparisonView.test.tsx` (Side-by-side histogram rendering)
- `DigitalTwinTopologyOverlay.test.tsx` (Physical coupling graph rendering)
- `TopologyModal.test.tsx` (Hardware Topology & Digital Twin Studio modal)
- `digitalTwinOfflineProfile.test.tsx` (Offline boundaries and fallback verification)

---

## Key Mathematical Formulation

### Classical State Distribution Fidelity
The fidelity between the ideal distribution $P_{\text{ideal}}(x)$ and the noisy distribution $P_{\text{noisy}}(x)$ is evaluated using the squared Bhattacharyya coefficient:

$$F(P_{\text{ideal}}, P_{\text{noisy}}) = \left( \sum_{x} \sqrt{P_{\text{ideal}}(x) \cdot P_{\text{noisy}}(x)} \right)^2$$

- **Exact identity**: $F = 1.0$ (when $P_{\text{ideal}} = P_{\text{noisy}}$)
- **Complete orthogonality**: $F = 0.0$ (when distributions have disjoint supports)
- Clamped strictly to $[0.0, 1.0]$.
- Computed with Rust WebAssembly for speed, automatically falling back to TypeScript if WASM is disabled or unsupported.

---

## Offline Boundary Guarantee

As detailed in `docs/DIGITAL_TWIN_OFFLINE_PROFILE.md`:
- **0 external internet calls**: IBM Fake Provider data is bundled locally in `qiskit_ibm_runtime.fake_provider`.
- Runs fully offline on localhost (`127.0.0.1:8000`).
- If the Python backend is offline, the frontend catches the network error gracefully, displays an informative warning banner, and falls back to a verified offline snapshot of `FakeManilaV2`.
