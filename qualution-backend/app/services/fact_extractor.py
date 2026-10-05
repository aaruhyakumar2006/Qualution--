import math
import numpy as np
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, partial_trace, entropy
from app.schemas.circuit import CircuitRequest
from app.services.qiskit_service import to_qiskit_circuit

DEFAULT_QUBIT_CAP = 12

class QubitReducedState(BaseModel):
    qubit: int
    purity: float
    entanglement_entropy: float

class PairwiseEntanglement(BaseModel):
    qubit_a: int
    qubit_b: int
    is_entangled: bool
    mutual_information: float

class BasisStateAmplitude(BaseModel):
    bitstring: str
    amplitude_real: float
    amplitude_imag: float
    magnitude: float
    phase_rad: float

class ExtractedFacts(BaseModel):
    status: str = "success"
    qubits: int
    measurement_probabilities: Dict[str, float]
    statevector: List[BasisStateAmplitude]
    per_qubit_reduced_state: List[QubitReducedState]
    pairwise_entanglement: List[PairwiseEntanglement]
    relative_phase_summary: Dict[str, float]

class TooLargeResponse(BaseModel):
    status: str = "too_large"
    requested_qubits: int
    max_qubits: int
    message: str

def extract_circuit_facts(
    circuit: CircuitRequest,
    max_qubits: int = DEFAULT_QUBIT_CAP
) -> Dict[str, Any]:
    """
    Extracts generic physics facts from ANY CircuitIR circuit:
    - Measurement probabilities
    - Normalized statevector amplitudes & phases
    - Per-qubit reduced state purity & entanglement entropy
    - Pairwise entanglement & mutual information
    - Relative phase summary
    Enforces max_qubits cap.
    """
    if circuit.qubits > max_qubits:
        return {
            "status": "too_large",
            "requested_qubits": circuit.qubits,
            "max_qubits": max_qubits,
            "message": f"Circuit qubit count ({circuit.qubits}) exceeds maximum cap of {max_qubits} qubits."
        }

    # Build Qiskit QuantumCircuit
    qc = to_qiskit_circuit(circuit)
    
    # Check for mid-circuit measurement (measure followed by quantum gates)
    has_mid_circuit_measure = False
    seen_measure = False
    for g in circuit.gates:
        if g.gate == "measure":
            seen_measure = True
        elif seen_measure and g.gate != "measure":
            has_mid_circuit_measure = True
            break

    # Filter out all measurement gates for statevector calculation
    qc_no_measure = QuantumCircuit(qc.num_qubits)
    for inst in qc.data:
        if inst.operation.name != "measure":
            qc_no_measure.append(inst.operation, inst.qubits)

    # Compute exact Statevector
    sv = Statevector.from_instruction(qc_no_measure)
    num_qubits = circuit.qubits
    num_states = 1 << num_qubits

    # 1. Measurement probabilities
    if has_mid_circuit_measure:
        from qiskit_aer import AerSimulator
        sim = AerSimulator()
        result = sim.run(qc, shots=10000).result()
        counts = result.get_counts()
        total_shots = sum(counts.values())
        measurement_probabilities: Dict[str, float] = {}
        for i in range(num_states):
            bitstring = format(i, f'0{num_qubits}b')
            c = counts.get(bitstring, 0)
            measurement_probabilities[bitstring] = round(c / total_shots, 6)
    else:
        probs = sv.probabilities_dict()
        measurement_probabilities: Dict[str, float] = {}
        for i in range(num_states):
            bitstring = format(i, f'0{num_qubits}b')
            p = float(probs.get(bitstring, probs.get(format(i, 'b'), 0.0)))
            measurement_probabilities[bitstring] = round(p, 6)

    # 2. Statevector normalization (Global Phase Normalization)
    sv_data = np.array(sv.data)
    abs_vals = np.abs(sv_data)
    max_idx = int(np.argmax(abs_vals))
    ref_phase = np.angle(sv_data[max_idx]) if abs_vals[max_idx] > 1e-9 else 0.0

    # Phase-normalized amplitudes: psi_norm = psi * e^(-i * ref_phase)
    sv_normalized = sv_data * np.exp(-1j * ref_phase)

    statevector_list: List[BasisStateAmplitude] = []
    relative_phase_summary: Dict[str, float] = {}
    
    ref_bitstring = format(max_idx, f'0{num_qubits}b')

    for i in range(num_states):
        bitstring = format(i, f'0{num_qubits}b')
        amp = sv_normalized[i]
        mag = float(np.abs(amp))
        phase = float(np.angle(amp)) if mag > 1e-7 else 0.0

        statevector_list.append(BasisStateAmplitude(
            bitstring=bitstring,
            amplitude_real=round(float(np.real(amp)), 6),
            amplitude_imag=round(float(np.imag(amp)), 6),
            magnitude=round(mag, 6),
            phase_rad=round(phase, 6)
        ))

        if mag > 1e-5:
            # Relative phase w.r.t reference state
            rel_phase = phase % (2 * math.pi)
            relative_phase_summary[bitstring] = round(rel_phase, 6)

    # 3. Per-qubit reduced states (purity & von Neumann entropy)
    per_qubit_reduced: List[QubitReducedState] = []
    qubit_entropy_map: Dict[int, float] = {}

    for q in range(num_qubits):
        trace_out = [idx for idx in range(num_qubits) if idx != q]
        rho_q = partial_trace(sv, trace_out)
        
        # Purity: Tr(rho^2) using matrix multiplication (not elementwise square)
        rho_data = np.array(rho_q.data)
        purity_val = float(np.real(np.trace(rho_data @ rho_data)))
        
        # Entanglement entropy: S(rho_q) = -Tr(rho_q log2 rho_q)
        ent_val = float(entropy(rho_q, base=2))
        
        per_qubit_reduced.append(QubitReducedState(
            qubit=q,
            purity=round(purity_val, 6),
            entanglement_entropy=round(ent_val, 6)
        ))
        qubit_entropy_map[q] = ent_val

    # 4. Pairwise entanglement & Mutual Information
    pairwise_entanglement: List[PairwiseEntanglement] = []
    for qa in range(num_qubits):
        for qb in range(qa + 1, num_qubits):
            if num_qubits == 2:
                # For 2-qubit pure state, mutual info I(A;B) = 2 * S(rho_A)
                mi = 2.0 * qubit_entropy_map[qa]
                rho_ab_entropy = 0.0
            else:
                trace_out_ab = [idx for idx in range(num_qubits) if idx not in (qa, qb)]
                rho_ab = partial_trace(sv, trace_out_ab)
                rho_ab_entropy = float(entropy(rho_ab, base=2))
                mi = qubit_entropy_map[qa] + qubit_entropy_map[qb] - rho_ab_entropy
            
            mi = max(0.0, float(mi))
            is_entangled = bool(mi > 1e-4 or qubit_entropy_map[qa] > 1e-4)
            
            pairwise_entanglement.append(PairwiseEntanglement(
                qubit_a=qa,
                qubit_b=qb,
                is_entangled=is_entangled,
                mutual_information=round(mi, 6)
            ))

    return {
        "status": "success",
        "qubits": num_qubits,
        "measurement_probabilities": measurement_probabilities,
        "statevector": [s.model_dump() for s in statevector_list],
        "per_qubit_reduced_state": [p.model_dump() for p in per_qubit_reduced],
        "pairwise_entanglement": [p.model_dump() for p in pairwise_entanglement],
        "relative_phase_summary": relative_phase_summary
    }
