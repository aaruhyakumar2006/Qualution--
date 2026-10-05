import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.schemas.portal_benchmark import (
    BenchmarkPreset,
    QPUTranspileResult,
    BenchmarkComparisonResponse,
)
from app.services.portal_hardware_service import portal_hardware_service

BENCHMARK_PRESETS: List[BenchmarkPreset] = [
    BenchmarkPreset(
        id="grover_3q",
        name="Grover's Search (3-Qubit Oracle)",
        algorithm="Grover",
        num_qubits=3,
        circuit_depth=12,
        gate_count=18,
        description="Quadratic quantum search for target state |111> using diffusion operator.",
        qasm="""OPENQASM 2.0;
include "qelib1.inc";
qreg q[3];
h q[0];
h q[1];
h q[2];
// Oracle for |111>
cz q[0], q[2];
cz q[1], q[2];
// Diffusion
h q[0];
h q[1];
h q[2];
x q[0];
x q[1];
x q[2];
cz q[0], q[2];
x q[0];
x q[1];
x q[2];
h q[0];
h q[1];
h q[2];
"""
    ),
    BenchmarkPreset(
        id="qft_4q",
        name="Quantum Fourier Transform (4-Qubit)",
        algorithm="QFT",
        num_qubits=4,
        circuit_depth=16,
        gate_count=22,
        description="Fundamental quantum subroutine converting state vectors between computational and Fourier basis.",
        qasm="""OPENQASM 2.0;
include "qelib1.inc";
qreg q[4];
h q[0];
cu1(pi/2) q[1], q[0];
cu1(pi/4) q[2], q[0];
cu1(pi/8) q[3], q[0];
h q[1];
cu1(pi/2) q[2], q[1];
cu1(pi/4) q[3], q[1];
h q[2];
cu1(pi/2) q[3], q[2];
h q[3];
swap q[0], q[3];
swap q[1], q[2];
"""
    ),
    BenchmarkPreset(
        id="bv_4q",
        name="Bernstein-Vazirani Secret String (4-Qubit)",
        algorithm="Bernstein-Vazirani",
        num_qubits=4,
        circuit_depth=6,
        gate_count=10,
        description="Deterministic single-query identification of hidden bitstring s=101.",
        qasm="""OPENQASM 2.0;
include "qelib1.inc";
qreg q[4];
x q[3];
h q[0];
h q[1];
h q[2];
h q[3];
cx q[0], q[3];
cx q[2], q[3];
h q[0];
h q[1];
h q[2];
"""
    ),
    BenchmarkPreset(
        id="qaoa_maxcut_4q",
        name="QAOA MaxCut Graph Partition (4-Qubit)",
        algorithm="QAOA",
        num_qubits=4,
        circuit_depth=14,
        gate_count=20,
        description="Variational quantum optimization finding maximum cut on 4-node ring topology.",
        qasm="""OPENQASM 2.0;
include "qelib1.inc";
qreg q[4];
h q[0];
h q[1];
h q[2];
h q[3];
// Problem Hamiltonian cost layer (gamma = 0.392)
cx q[0], q[1];
rz(0.392) q[1];
cx q[0], q[1];
cx q[1], q[2];
rz(0.392) q[2];
cx q[1], q[2];
cx q[2], q[3];
rz(0.392) q[3];
cx q[2], q[3];
// Mixer Hamiltonian layer (beta = 0.785)
rx(0.785) q[0];
rx(0.785) q[1];
rx(0.785) q[2];
rx(0.785) q[3];
"""
    ),
]

def get_benchmark_presets() -> List[BenchmarkPreset]:
    return BENCHMARK_PRESETS

def _parse_qasm_metrics(qasm: str) -> Dict[str, int]:
    """Extract rough depth, qubit count, 1Q, and 2Q gate counts from OpenQASM."""
    lines = [line.strip() for line in qasm.splitlines() if line.strip() and not line.strip().startswith("//")]
    
    qubits = 2
    for line in lines:
        match = re.search(r"qreg\s+\w+\[(\d+)\];", line)
        if match:
            qubits = max(qubits, int(match.group(1)))

    gate_1q = 0
    gate_2q = 0

    for line in lines:
        if line.startswith("OPENQASM") or line.startswith("include") or line.startswith("qreg") or line.startswith("creg") or line.startswith("barrier") or line.startswith("measure"):
            continue
        # Check for 2-qubit gates
        if any(g in line for g in ["cx", "cz", "swap", "cu1", "crz", "ccx", "rzz", "cnot"]):
            gate_2q += 1
        elif any(g in line for g in ["h", "x", "y", "z", "s", "t", "rx", "ry", "rz", "u1", "u2", "u3", "id", "sx"]):
            gate_1q += 1

    depth = max(1, gate_2q * 2 + (gate_1q // 2))
    return {
        "num_qubits": qubits,
        "gate_1q": max(1, gate_1q),
        "gate_2q": max(1, gate_2q),
        "depth": depth,
    }

def compare_circuit_across_qpus(
    preset_id: Optional[str] = None,
    custom_qasm: Optional[str] = None,
) -> BenchmarkComparisonResponse:
    preset = None
    if preset_id:
        preset = next((p for p in BENCHMARK_PRESETS if p.id == preset_id), None)

    if preset:
        qasm = preset.qasm
        bench_name = preset.name
        metrics = {
            "num_qubits": preset.num_qubits,
            "gate_1q": preset.gate_count - (preset.gate_count // 2),
            "gate_2q": preset.gate_count // 2,
            "depth": preset.circuit_depth,
        }
    elif custom_qasm and custom_qasm.strip():
        qasm = custom_qasm.strip()
        bench_name = "Custom QASM Circuit"
        metrics = _parse_qasm_metrics(qasm)
    else:
        # Default to first preset
        preset = BENCHMARK_PRESETS[0]
        qasm = preset.qasm
        bench_name = preset.name
        metrics = {
            "num_qubits": preset.num_qubits,
            "gate_1q": preset.gate_count - (preset.gate_count // 2),
            "gate_2q": preset.gate_count // 2,
            "depth": preset.circuit_depth,
        }

    telemetry = portal_hardware_service.get_hardware_telemetry()
    results: List[QPUTranspileResult] = []

    for provider in telemetry.providers:
        # Transpilation overhead factor based on architecture
        if provider.id == "nvidia_cuquantum":
            # GPU Simulator: zero routing overhead, minimal depth expansion
            transpiled_depth = max(metrics["depth"], int(metrics["depth"] * 1.0))
            gate_1q = metrics["gate_1q"]
            gate_2q = metrics["gate_2q"]
            # Near perfect numerical fidelity
            estimated_fidelity = 99.98
            runtime_ms = 4.2 + (metrics["num_qubits"] * 0.4)
            reason = "Ideal for rapid debugging, tensor network simulation, and high shot counts with zero quantum noise."
        elif provider.id == "ibm_heron":
            # Heavy-Hex layout requires SWAP insertion if not nearest neighbor
            routing_factor = 1.35
            transpiled_depth = int(metrics["depth"] * routing_factor)
            gate_1q = int(metrics["gate_1q"] * 1.2)
            gate_2q = int(metrics["gate_2q"] * 1.4)
            # Fidelity: (1 - 2q_error)^N2q * (1 - 1q_error)^N1q * readout^Qubits
            cal = provider.calibration
            fid = ((1.0 - cal.avg_2q_error) ** gate_2q) * ((1.0 - cal.avg_1q_error) ** gate_1q) * (cal.readout_fidelity ** metrics["num_qubits"])
            estimated_fidelity = round(max(50.0, fid * 100.0), 2)
            runtime_ms = 45.0 + (transpiled_depth * 0.8)
            reason = "High entangling gate speed with 133-qubit Heron architecture; best for multi-qubit physical experiments."
        elif provider.id == "ionq_aria":
            # All-to-all connectivity: zero SWAP routing needed
            transpiled_depth = int(metrics["depth"] * 1.05)
            gate_1q = metrics["gate_1q"]
            gate_2q = metrics["gate_2q"]
            cal = provider.calibration
            fid = ((1.0 - cal.avg_2q_error) ** gate_2q) * ((1.0 - cal.avg_1q_error) ** gate_1q) * (cal.readout_fidelity ** metrics["num_qubits"])
            estimated_fidelity = round(max(50.0, fid * 100.0), 2)
            runtime_ms = 180.0 + (transpiled_depth * 2.5)
            reason = "Highest physical fidelity with all-to-all ion connectivity; zero SWAP gate degradation."
        elif provider.id == "rigetti_ankaa":
            # Square-octagonal CZ native gates
            routing_factor = 1.45
            transpiled_depth = int(metrics["depth"] * routing_factor)
            gate_1q = int(metrics["gate_1q"] * 1.3)
            gate_2q = int(metrics["gate_2q"] * 1.5)
            cal = provider.calibration
            fid = ((1.0 - cal.avg_2q_error) ** gate_2q) * ((1.0 - cal.avg_1q_error) ** gate_1q) * (cal.readout_fidelity ** metrics["num_qubits"])
            estimated_fidelity = round(max(50.0, fid * 100.0), 2)
            runtime_ms = 65.0 + (transpiled_depth * 1.1)
            reason = "Fast tunable coupler architecture with parametric CZ entanglers."
        else:
            transpiled_depth = metrics["depth"]
            gate_1q = metrics["gate_1q"]
            gate_2q = metrics["gate_2q"]
            estimated_fidelity = 95.0
            runtime_ms = 50.0
            reason = "Standard QPU provider."

        results.append(
            QPUTranspileResult(
                provider_id=provider.id,
                provider_name=provider.name,
                architecture=provider.architecture,
                status=provider.status,
                original_depth=metrics["depth"],
                transpiled_depth=transpiled_depth,
                gate_count_1q=gate_1q,
                gate_count_2q=gate_2q,
                estimated_fidelity=estimated_fidelity,
                estimated_runtime_ms=round(runtime_ms, 2),
                queue_wait_sec=provider.est_wait_time_sec,
                recommended_reason=reason,
            )
        )

    # Sort results by highest fidelity, then lowest runtime
    best_physical = max([r for r in results if r.provider_id != "nvidia_cuquantum"], key=lambda r: r.estimated_fidelity, default=results[0])
    recommended_id = best_physical.provider_id

    return BenchmarkComparisonResponse(
        timestamp=datetime.now(timezone.utc).isoformat(),
        benchmark_name=bench_name,
        num_qubits=metrics["num_qubits"],
        original_depth=metrics["depth"],
        recommended_provider_id=recommended_id,
        results=results,
    )
