// QUALUTION Data Store & Initial State
export const initialMetrics = {
  learners: '0',
  circuitsExecuted: '0',
  courses: 0,
  experiments: '0'
};

export const teacherOverview = {
  activeCourses: 0,
  students: 0,
  completionRate: '0%',
  challenges: 0,
  certificates: 0,
  circuitsRun: 0
};

export const initialCourses = [
  {
    id: 'qc-101',
    title: 'QUANTUM COMPUTING — BEGINNER',
    code: 'QC-101',
    level: 'Beginner',
    status: 'Published',
    modules: 12,
    challenges: 8,
    students: 0,
    completion: 0,
    description: 'Foundations of quantum information, single-qubit rotations, superposition, and fundamental two-qubit entanglement states.',
    phases: [
      {
        id: 'phase-1',
        title: 'PHASE 01: QUANTUM FOUNDATIONS',
        flow: ['THEORY', 'INTERACTIVE LAB', 'CHALLENGE', 'MASTERY'],
        nodes: [
          { id: 'n1', num: '01', title: 'Bits vs Qubits', type: 'THEORY + LAB', badgeColor: 'yellow', duration: '25m', learnersAt: 0 },
          { id: 'n2', num: '02', title: 'Superposition & Hadamard', type: 'THEORY + LAB', badgeColor: 'cyan', duration: '40m', learnersAt: 0 },
          { id: 'n3', num: '03', title: 'Entanglement & Bell States', type: 'THEORY + LAB', badgeColor: 'pink', duration: '50m', learnersAt: 0 },
          { id: 'n4', num: '04', title: 'Measurement Postulates', type: 'THEORY + CHALLENGE', badgeColor: 'lime', duration: '35m', learnersAt: 0 }
        ]
      }
    ]
  },
  {
    id: 'qc-201',
    title: 'QUANTUM ALGORITHMS & HARDWARE',
    code: 'QC-201',
    level: 'Intermediate',
    status: 'Published',
    modules: 16,
    challenges: 12,
    students: 0,
    completion: 0,
    description: 'Deconstruct Deutsch-Jozsa, Simon, Quantum Phase Estimation, and Grover Search with noise mitigation analysis.',
    phases: [
      {
        id: 'phase-2',
        title: 'PHASE 02: ORACLES & SEARCH',
        flow: ['THEORY', 'LAB', 'CHALLENGE', 'MASTERY'],
        nodes: [
          { id: 'n5', num: '01', title: 'Quantum Oracles & Phase Kickback', type: 'THEORY + LAB', badgeColor: 'yellow', duration: '45m', learnersAt: 0 },
          { id: 'n6', num: '02', title: 'Grover Diffusion Operator', type: 'WORKBENCH LAB', badgeColor: 'pink', duration: '60m', learnersAt: 0 },
          { id: 'n7', num: '03', title: 'Quantum Phase Estimation', type: 'CHALLENGE', badgeColor: 'lime', duration: '75m', learnersAt: 0 },
          { id: 'n8', num: '04', title: 'Shor Period Finding Engine', type: 'PROJECT', badgeColor: 'purple', duration: '90m', learnersAt: 0 }
        ]
      }
    ]
  },
  {
    id: 'qc-301',
    title: 'ERROR CORRECTION & FAULT TOLERANCE',
    code: 'QC-301',
    level: 'Advanced',
    status: 'Drafts',
    modules: 8,
    challenges: 6,
    students: 0,
    completion: 0,
    description: 'Surface codes, stabilizer formalism, syndrome measurement, and fault-tolerant logical Clifford + T implementations.',
    phases: [
      {
        id: 'phase-3',
        title: 'PHASE 01: STABILIZER CODE BASICS',
        flow: ['THEORY', 'LAB', 'CHALLENGE', 'MASTERY'],
        nodes: [
          { id: 'n9', num: '01', title: 'Bit-Flip & Phase-Flip 3-Qubit Codes', type: 'THEORY + LAB', badgeColor: 'yellow', duration: '40m', learnersAt: 0 },
          { id: 'n10', num: '02', title: 'Shor 9-Qubit Architecture', type: 'THEORY + CHALLENGE', badgeColor: 'cyan', duration: '60m', learnersAt: 0 },
          { id: 'n11', num: '03', title: 'Surface Code Lattice Surgery', type: 'PROJECT', badgeColor: 'lime', duration: '90m', learnersAt: 0 }
        ]
      }
    ]
  }
];

export const initialStudents = [];

export const conceptMasteryData = [];

export const misconceptionMapData = [];

export const erwinIntel = {
  misconceptionsDetected: 0,
  resolved: 0,
  requiringAttention: 0,
  highlightedIssue: {
    title: 'No Active Misconceptions',
    summary: 'Learner telemetry operating normally with 0 active misconceptions.',
    affectedLearners: 0,
    concept: 'None',
    recommendedIntervention: 'No intervention required.',
    suggestedAction: 'System Normal'
  }
};

export const researchExperiments = [
  {
    id: 'exp-01',
    title: 'GROVER SEARCH OPTIMIZATION',
    tag: 'Algorithms',
    qubits: 31,
    backend: 'MPS',
    iterations: 5,
    executionTime: '184 ms',
    shots: 4096,
    objective: 'Benchmark Matrix Product State (MPS) tensor network compression during diffusion operator scaling on unstructured database search.',
    depth: 17,
    status: 'Completed',
    date: '28 Sep 2026',
    author: 'Prof. S. R. Ramanathan',
    circuitSummary: 'H(31) -> Oracle_Diff -> Diffuser_x5 -> Measurement',
    results: {
      targetState: '|10110...1⟩',
      fidelity: '98.7%',
      entanglementEntropy: 'Low (0.34 nat)',
      classicalSpeedupRatio: '5.8x'
    }
  },
  {
    id: 'exp-02',
    title: 'VARIATIONAL QUANTUM EIGENSOLVER (VQE) FOR H2',
    tag: 'Quantum Chemistry',
    qubits: 4,
    backend: 'Statevector',
    iterations: 45,
    executionTime: '64 ms',
    shots: 8192,
    objective: 'Ground state energy dissociation curve calculation for diatomic hydrogen molecule using UCCSD ansatz and COBYLA classical optimizer.',
    depth: 12,
    status: 'Completed',
    date: '26 Sep 2026',
    author: 'Dr. Emily Zhao & Qualution Lab',
    circuitSummary: 'Ry-Rz Ansatz + Entangler CNOTs -> Pauli-Z Expectations',
    results: {
      groundStateEnergy: '-1.137 Hartree',
      chemicalAccuracyDelta: '0.0014 Hartree',
      convergenceSteps: 34
    }
  },
  {
    id: 'exp-03',
    title: 'SURFACE CODE STABILIZER FAULT SIMULATION',
    tag: 'Error Correction',
    qubits: 500,
    backend: 'Stabilizer',
    iterations: 100,
    executionTime: '214 ms',
    shots: 100,
    objective: 'Simulate threshold theorem on rotated surface code with Clifford syndrome extraction circuits for bit-flip and phase-flip error chains.',
    depth: 23,
    status: 'Active',
    date: '30 Sep 2026',
    author: 'Prof. S. R. Ramanathan',
    circuitSummary: '500 Qubits -> 842 Clifford Gates -> Tableau Clifford Updates',
    results: {
      logicalErrorRate: '1.2e-4',
      memoryConsumed: '978 KB',
      thresholdDetected: 'p_th = 0.98%'
    }
  },
  {
    id: 'exp-04',
    title: 'QUANTUM KEY DISTRIBUTION (BB84 PROTOCOL)',
    tag: 'Cryptography',
    qubits: 16,
    backend: 'Cloud (IBM Heron)',
    iterations: 1,
    executionTime: '1,420 ms',
    shots: 10000,
    objective: 'Experimental test of quantum bit error rate (QBER) under simulated intercept-resend eavesdropping on cloud hardware.',
    depth: 8,
    status: 'Completed',
    date: '22 Sep 2026',
    author: 'Qualution Cryptography Group',
    circuitSummary: 'Random Basis Prep -> Quantum Channel -> Sifting -> Privacy Amplification',
    results: {
      qber: '1.8%',
      eavesdropperDetectProb: '99.4%',
      finalSiftedKeyBits: 4890
    }
  }
];

export const executionAnalysisData = {
  circuitQubits: 500,
  circuitDepth: 23,
  gateCount: 842,
  selectedBackend: 'Stabilizer',
  executionTime: '214 ms',
  memory: '978 KB',
  shots: 100,
  backendsMatrix: [
    { backend: 'Stabilizer', runtime: '214 ms', memory: '978 KB', supported: 'Clifford only (1000+ qubits)', status: 'Executed' },
    { backend: 'Statevector', runtime: '—', memory: '—', supported: 'Universal (≤ 30 qubits)', status: 'Not Run (Exceeds Memory)' },
    { backend: 'MPS', runtime: '—', memory: '—', supported: 'Low-entanglement (≤ 100 qubits)', status: 'Available' },
    { backend: 'Cloud', runtime: '—', memory: '—', supported: 'Physical QPU (Queue required)', status: 'Standby' }
  ]
};

export const defaultLessonStudioConfig = {
  title: 'Lesson 03: Entanglement & Bell State Synthesis',
  duration: '45 mins',
  difficulty: 'Intermediate',
  prerequisites: 'Lesson 01 (Qubits), Lesson 02 (Superposition)',
  assessment: 'Challenge & 3 Conceptual Checks',
  backend: 'Statevector Simulation',
  hints: '3 Progressive hints with Erwin dialogue assistance',
  aiBehaviour: 'Active misconception detection on measurement phase collapse'
};
