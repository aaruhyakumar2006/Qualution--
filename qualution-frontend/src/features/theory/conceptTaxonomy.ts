export interface ConceptDefinition {
  id: string;
  name: string;
  definition: string;
  prerequisite_ids: string[];
  lesson_step_ids: string[];
}

export interface ConceptTaxonomy {
  version: string;
  concepts: ConceptDefinition[];
}

export const CONCEPT_TAXONOMY: ConceptTaxonomy = {
  version: "1.0.0",
  concepts: [
    {
      id: "qubit_basis",
      name: "Qubit & Computational Basis States",
      definition: "Understanding state representations |0> and |1> and state vector representation.",
      prerequisite_ids: [],
      lesson_step_ids: ["welcome-1", "bloch-sphere-1"]
    },
    {
      id: "single_qubit_gates",
      name: "Single-Qubit Quantum Gates",
      definition: "Unitary operations acting on a single qubit such as X, Y, Z, H gates.",
      prerequisite_ids: ["qubit_basis"],
      lesson_step_ids: ["welcome-1", "bloch-sphere-1"]
    },
    {
      id: "superposition",
      name: "Quantum Superposition",
      definition: "Linear combinations of basis states allowing qubits to exist in state alpha|0> + beta|1>.",
      prerequisite_ids: ["qubit_basis"],
      lesson_step_ids: ["superposition-step-1", "superposition-checkpoint-1", "superposition-checkpoint-2"]
    },
    {
      id: "hadamard_gate",
      name: "Hadamard Gate & Superposition Creation",
      definition: "The H gate maps computational basis states into equal superposition states |+> and |->.",
      prerequisite_ids: ["superposition", "single_qubit_gates"],
      lesson_step_ids: ["superposition-step-1", "superposition-checkpoint-2", "grover-superposition", "grover-step-1"]
    },
    {
      id: "measurement_collapse",
      name: "Measurement & Statevector Collapse",
      definition: "Projective measurement yielding probabilistic outcome |x> with probability |c_x|^2 and collapsing statevector.",
      prerequisite_ids: ["superposition"],
      lesson_step_ids: ["measurement-step-1", "superposition-checkpoint-3", "summary-1"]
    },
    {
      id: "phase",
      name: "Quantum Phase & Phase Shifts",
      definition: "Complex exponential factor e^(i phi) modifying state amplitudes.",
      prerequisite_ids: ["single_qubit_gates"],
      lesson_step_ids: ["grover-oracle"]
    },
    {
      id: "relative_vs_global_phase",
      name: "Relative Phase vs Global Phase",
      definition: "Global phase has no observable physical impact while relative phase causes interference upon basis change.",
      prerequisite_ids: ["phase"],
      lesson_step_ids: ["grover-oracle"]
    },
    {
      id: "multi_qubit_systems",
      name: "Multi-Qubit Systems & Product States",
      definition: "Tensor product representation of multi-qubit quantum state space.",
      prerequisite_ids: ["qubit_basis"],
      lesson_step_ids: ["grover-intro", "grover-step-1"]
    },
    {
      id: "cnot_gate",
      name: "Controlled-NOT (CNOT) Gate",
      definition: "Two-qubit conditional operation flipping target qubit if control qubit is |1>.",
      prerequisite_ids: ["multi_qubit_systems", "single_qubit_gates"],
      lesson_step_ids: ["grover-oracle", "grover-step-3"]
    },
    {
      id: "entanglement",
      name: "Quantum Entanglement & Bell States",
      definition: "Non-separable quantum states where measurement outcomes are intrinsically correlated.",
      prerequisite_ids: ["cnot_gate", "hadamard_gate"],
      lesson_step_ids: ["grover-oracle"]
    },
    {
      id: "quantum_interference",
      name: "Quantum Interference",
      definition: "Constructive and destructive combination of probability amplitudes via transformation matrices.",
      prerequisite_ids: ["relative_vs_global_phase", "hadamard_gate"],
      lesson_step_ids: ["grover-diffuser", "grover-step-4"]
    },
    {
      id: "phase_kickback",
      name: "Phase Kickback Mechanism",
      definition: "Transfer of eigenvalue phase factor from target qubit workspace to control qubit via controlled operations.",
      prerequisite_ids: ["cnot_gate", "phase", "quantum_interference"],
      lesson_step_ids: ["grover-oracle", "grover-step-3"]
    },
    {
      id: "oracle",
      name: "Quantum Oracle & Marking States",
      definition: "Black-box unitary transformation f(x) that flips the phase of target solution computational basis state.",
      prerequisite_ids: ["phase_kickback", "multi_qubit_systems"],
      lesson_step_ids: ["grover-oracle", "grover-step-3"]
    },
    {
      "id": "diffuser",
      "name": "Grover Diffuser / Inversion About Mean",
      "definition": "Unitary transformation (2|s><s| - I) amplifying target amplitude by reflecting about mean amplitude.",
      "prerequisite_ids": ["hadamard_gate", "quantum_interference"],
      "lesson_step_ids": ["grover-diffuser", "grover-step-4"]
    },
    {
      id: "grovers_search",
      name: "Grover's Search Algorithm",
      definition: "Quantum search algorithm providing quadratic speedup O(sqrt(N)) over classical unstructured search.",
      prerequisite_ids: ["oracle", "diffuser"],
      lesson_step_ids: ["grover-intro", "grover-run", "grover-step-1", "grover-step-2", "grover-step-3", "grover-step-4", "grover-step-5"]
    },
    {
      id: "rotation_gates",
      name: "Parametrized Rotation Gates",
      definition: "Continuous single-qubit rotations Rx(theta), Ry(theta), Rz(theta) around Bloch sphere axes.",
      prerequisite_ids: ["single_qubit_gates", "phase"],
      lesson_step_ids: []
    },
    {
      id: "vqe_ansatz",
      name: "VQE Ansatz State Preparation",
      definition: "Parametrized quantum circuit preparing candidate trial state |psi(theta)> for variational energy evaluation.",
      prerequisite_ids: ["rotation_gates", "entanglement"],
      lesson_step_ids: []
    },
    {
      id: "vqe_parameterization",
      name: "VQE Parameter Initialization & Optimization",
      definition: "Classical optimization loop adjusting ansatz parameters theta to minimize expected Hamiltonian energy.",
      prerequisite_ids: ["vqe_ansatz"],
      lesson_step_ids: []
    }
  ]
};
