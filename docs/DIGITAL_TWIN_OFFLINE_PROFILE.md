# QUALUTION Digital Twin: Architectural Offline Profile & Network Boundaries

## 1. Executive Summary

QUALUTION operates on a contract-first, client-primary architecture. While our core simulation engines (Tier 1 Stabilizer and Tier 2 Statevector) run **100% offline in-browser** via compiled Rust WebAssembly and Web Workers, the **Digital Twin Feature** and **Matrix Product State (MPS) Engine** operate under a strictly defined, honest architectural exception.

This document precisely defines the network and offline boundaries of the Digital Twin feature.

---

## 2. Component Network Profiles

| Stage / Component | Execution Location | External Internet (WAN) Dependency | Local Network (LAN / Localhost) Dependency | Offline Profile & Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 0: Calibration Data** | Local Python runtime (`qiskit-ibm-runtime`) | **NONE (0 calls)** | **NONE (0 calls)** | Calibration data ($T_1$, $T_2$, coupling map, readout & CX gate error rates) is bundled inside the locally installed `qiskit_ibm_runtime.fake_provider` package (`FakeManilaV2`). No connection to IBM Quantum Cloud or external servers. |
| **Phase 1: Dual Simulation Endpoint** | Local Python FastAPI (`qualution-backend` :8000) | **NONE (0 calls)** | **REQUIRED (`http://127.0.0.1:8000`)** | Runs both noiseless Aer and hardware-calibrated noisy Aer (`AerSimulator.from_backend`) locally on the machine CPU. Requires the local Python service to be reachable (same boundary as MPS). |
| **Phase 2 & 3: Fidelity Calculation** | Client Browser (`qualution-frontend`) | **NONE (0 calls)** | **NONE (0 calls)** | Classical state fidelity $F = \left(\sum_x \sqrt{P_{\text{ideal}}(x) P_{\text{noisy}}(x)}\right)^2$ runs entirely on the client CPU via **Rust WebAssembly** (`qualution_core.compute_distribution_fidelity`) with a transparent TypeScript fallback. Zero network calls. |
| **Phase 4: Hardware Topology Mirror** | Client Browser (`qualution-frontend`) | **NONE (0 calls)** | Optional live telemetry (falls back to offline snapshot) | Pure SVG/CSS rendering of Falcon r5.4 linear coupling graph and circuit SWAP routing penalty arches. **Toggle is OFF by default**. |
| **Phase 5: Side-by-Side Comparison** | Client Browser (`qualution-frontend`) | **NONE (0 calls)** | Optional live telemetry (falls back to offline snapshot) | Dual histograms and metadata-grounded AI Tutor explanation. Displays a clear warning banner if local backend is unreachable. |

---

## 3. The Local Network vs. Internet Distinction

It is critical not to conflate **"requires local Python backend"** with **"requires internet"**:

1. **No External Internet (WAN) Required**:
   At no point does the Digital Twin feature connect to IBM Quantum, cloud APIs, telemetry collectors, or external CDNs. Even if external network interfaces are completely severed, the feature functions identically provided the local `uvicorn app.main:app` service is running on `127.0.0.1`.
2. **Localhost / LAN Dependency**:
   Because Qiskit Aer noise modeling and density-matrix noise kernels do not have a lightweight Rust or TypeScript equivalent, noisy hardware simulation must run in Python. This introduces an HTTP dependency between the Vite frontend and the local FastAPI backend.

---

## 4. Default State & Fault Tolerance (Zero Degradation)

To ensure that backend unavailability never impairs a student's learning or workbench workflow:

1. **Toggle is OFF by Default**:
   * `"Mirror Fake Manila Topology"` is initialized to `false`.
   * The digital twin comparison view is only mounted upon deliberate user engagement.
2. **Clear "Backend Unavailable" State**:
   * If the local Python backend is unreachable (e.g., server stopped, port blocked), the Digital Twin components catch the network error gracefully.
   * A prominent warning banner is surfaced:
     > `⚠️ Local Python Backend Service Offline (http://127.0.0.1:8000). Operating in verified offline snapshot mode for FakeManilaV2.`
   * The UI never crashes, blanks out, or shows unhandled promise rejections.
3. **Zero Degradation of Core Engines**:
   * While the Digital Twin backend is down, Tier 1 Clifford Stabilizer and Tier 2 Dense Statevector continue executing in-browser via Rust/WASM and Web Workers with full speed and zero degradation.
   * Guided lessons, OpenQASM / Qiskit code parsing, MathBridge, Bloch Sphere, and IndexedDB local persistence function with 100% availability.

---

## 5. Architectural Parity Matrix Across Simulation Tiers

| Engine / Feature | Runtime Target | Math Core | Network Boundary | Offline Status |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1: Clifford Stabilizer** | Browser (Web Worker) | Rust WASM / TypeScript fallback | None | **100% In-Browser Offline** |
| **Tier 2: Dense Statevector** | Browser (Web Worker) | Rust WASM / TypeScript fallback | None | **100% In-Browser Offline** |
| **Tier 3: Tensor Network (MPS)** | Local Python service | Qiskit Aer MPS | Localhost (:8000) | **Local Offline (LAN/IPC)** |
| **Digital Twin Hardware Twin** | Dual (Backend Sim + Client Fidelity) | Qiskit Aer + Rust WASM Fidelity | Localhost (:8000) | **Local Offline (LAN/IPC)** |
| **Tier 4: Physical QPU Cloud** | Remote Quantum Cloud | Hardware QPUs | External WAN | **Online Cloud (Roadmap Stub)** |
