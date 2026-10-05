# QUALUTION Misconception Engine Core - Audit Report (M0)

**Date**: 2026-10-04  
**Project**: QUALUTION Quantum Learning Platform  
**System Scope**: Backend FastAPI + Qiskit/Aer, Frontend React 19 + TypeScript  

---

## 1. Existing Misconception Module

### Files & Paths
- **Frontend Catalog**: `qualution-frontend/src/features/theory/misconceptionCatalog.ts`
- **Frontend Types**: `qualution-frontend/src/features/theory/types.ts`, `qualution-frontend/src/features/theory/learningEvidence.ts`
- **Frontend Analyzer**: `qualution-frontend/src/features/theory/learnerEvidenceAnalyzer.ts`
- **Frontend Evidence Collector & API**: `qualution-frontend/src/features/evidence/evidenceCollector.ts`, `qualution-frontend/src/api/evidenceApi.ts`
- **Backend Diagnostic Rules**: `qualution-backend/app/api/routes/onboarding.py`

### Catalog Format
The existing frontend catalog defines a TypeScript record `MISCONCEPTION_CATALOG: Record<string, MisconceptionRule>` with the following shape:
```typescript
export interface MisconceptionRule {
  id: string;
  concept: string;
  name: string;
  description: string;
  learnerFeedback: string;
  matchingAnswers: {
    checkpointOptionIds?: string[];
    checkpointTexts?: string[];
    assessmentOptionIds?: string[];
    assessmentTexts?: string[];
  };
}
```

The current catalog contains 6 rules:
1. `measurement-deterministic` (Concept: `measurement`)
2. `superposition-not-mixture` (Concept: `superposition`)
3. `hadamard-inverts-classical` (Concept: `hadamard`)
4. `grover-oracle-bit-flip` (Concept: `grover-oracle`)
5. `grover-oracle-single-qubit-phase` (Concept: `grover-oracle`)
6. `grover-oracle-cnot-without-hadamard` (Concept: `grover-oracle`)

### Python Backend Onboarding Rules
In `qualution-backend/app/api/routes/onboarding.py`, 3 diagnostic rules are evaluated during student onboarding:
- `RULE_SUPERPOS_RANDOM`: Superposition as Classical Randomness
- `RULE_CNOT_COPY`: CNOT as Classical Copying
- `RULE_MEASURE_NO_EFFECT`: Measurement Does Not Affect State

### Status Logic & Evidence Sources
- **Confidence Levels**:
  - `SUPPORTED`: `evidenceItems.length >= 2` (repeated evidence across checkpoint prediction and assessment touchpoints).
  - `POSSIBLE`: `evidenceItems.length === 1` and final assessment incorrect.
  - `NOT_SUPPORTED`: No matching evidence found.
  - `CLEARED` (`UNDERSTOOD`): Final assessment is correct after prior mistakes.
- **Concept Mastery Statuses**:
  - `NOT_ATTEMPTED`: No learner interactions recorded.
  - `ATTEMPTED`: Assessment completed but no multi-source repeated pattern.
  - `UNDERSTOOD`: Assessment answered correctly.
  - `NEEDS_REINFORCEMENT`: At least one `SUPPORTED` misconception pattern detected.
- **Evidence Sources**:
  - `checkpoint`: Prediction question response (`checkpointId`, `selectedAnswer`).
  - `experiment`: Workbench execution evidence (`completed`, `shots`, `counts`).
  - `assessment`: Post-lesson mastery question (`assessmentId`, `selectedAnswer`).

---

## 2. Lesson Format Audit & Opened Lessons

### Lesson File Schemas Found
The codebase utilizes two primary formats for lessons:
1. **Theory Board Lessons** (`JSON` format in `qualution-frontend/src/features/theory/lessons/`):
   - Schema: `v`, `id`, `title`, `description`, `concepts`, `misconceptions`, `defaults`, `styles`, `objects`, `actions`/`steps`.
2. **Teaching Sprint Lessons** (`TS`/`JSON` in `qualution-frontend/src/features/teaching/lessons/`):
   - Schema: `id`, `title`, `track`, `segments`, `checkpoints`.

### 4 Specific Opened Lessons
1. **Basics Lesson**:
   - **Path**: `qualution-frontend/src/features/theory/lessons/declarative/qubitLesson.json`
   - **Fields**: `version: 1`, `id: "qubit"`, `title: "What is a Qubit?"`, `concepts: ["qubit", "statevector", "bloch-sphere"]`, `actions`: 14 board/narration actions.
2. **Grover Search Lesson**:
   - **Path**: `qualution-frontend/src/features/theory/lessons/declarative/groverLesson.json`
   - **Fields**: `version: 1`, `id: "grover-search"`, `title: "Grover's Search Algorithm"`, `concepts: ["grover-search", "oracle", "diffuser", "amplitude-amplification"]`, `actions`: 34 actions (including `CHECKPOINT` for oracle construction).
3. **QAOA / VQE Lesson**:
   - **Path**: `qualution-frontend/src/pages/teacher-portal/data/portalSeedFallback.ts` (VQE / QAOA modules referenced in course tracks and telemetry).
   - **Note**: Dedicated JSON lesson files for VQE/QAOA were **NOT FOUND** in `features/theory/lessons/`; VQE/QAOA concepts exist in portal data and curriculum specs.
4. **Longest Lesson**:
   - **Path**: `qualution-frontend/src/features/theory/lessons/lesson-8-grovers-search.json`
   - **Fields**: `id: "lesson-8-grovers-search"`, `title: "Grover's Search Algorithm"`, 360 lines of detailed interactive actions & checkpoints.

### Complete List of Lessons Found & Step/Action Counts
| Lesson ID | File Path | Format | Step/Action Count |
| :--- | :--- | :--- | :--- |
| `classicalBitLesson` | `src/features/theory/lessons/declarative/classicalBitLesson.json` | JSON Board | 12 actions |
| `classicalBitToQubitLesson` | `src/features/theory/lessons/declarative/classicalBitToQubitLesson.json` | JSON Board | 18 actions |
| `qubitLesson` | `src/features/theory/lessons/declarative/qubitLesson.json` | JSON Board | 14 actions |
| `qubitSuperpositionCheckpoint` | `src/features/theory/lessons/declarative/qubitSuperpositionCheckpointLesson.json` | JSON Board | 16 actions |
| `groverLesson` | `src/features/theory/lessons/declarative/groverLesson.json` | JSON Board | 34 actions |
| `classical-bit-to-superposition` | `src/features/theory/lessons/classical-bit-to-superposition.json` | JSON Board | 42 actions |
| `lesson-8-grovers-search` | `src/features/theory/lessons/lesson-8-grovers-search.json` | JSON Board | 58 actions |
| `grover-2q-11` | `src/features/teaching/lessons/grover-2q-11.json` | JSON Teaching | 24 segments |
| `lesson-classical-vs-qubit` | `lesson-classical-vs-qubit/lesson.json` | Keyframe Video | 8 keyframes |

---

## 3. CircuitIR Definition & Backend Pipeline

### CircuitIR Schema
- **File**: `qualution-backend/app/schemas/circuit.py`
- **Class**: `CircuitRequest` & `GateRequest`
```python
class GateRequest(BaseModel):
    gate: AllGates  # e.g., "h", "x", "y", "z", "s", "t", "rx", "ry", "rz", "p", "cx", "cz", "swap", "ccx", "measure", "reset", "barrier"
    targets: List[int]
    angle: Optional[float] = None
    id: Optional[str] = None
    column: Optional[int] = None
    name: Optional[str] = None

class CircuitRequest(BaseModel):
    qubits: int = Field(..., ge=1, le=2000)
    classical_bits: int = Field(0, ge=0, le=2000)
    gates: List[GateRequest] = Field(default_factory=list)
    measure: bool = Field(False)
    shots: int = Field(1024, ge=1, le=100000)
    topology: Optional[str] = None
```

### Supported Gates
- **Single-Qubit**: `h`, `x`, `y`, `z`, `s`, `t`, `rx`, `ry`, `rz`, `p`, `id`, `reset`, `control`, `sdg`, `tdg`, `sx`
- **Two-Qubit**: `cx`, `cz`, `swap`, `cp`, `crx`, `cry`, `crz`, `ch`
- **Three-Qubit**: `ccx` (Toffoli)
- **Special/Control**: `measure`, `barrier`, `mcx`

### Execution Path to Backends
1. **JSON Payload** sent to `qualution-backend/app/api/routes/simulation.py` or `/circuits/run`.
2. `to_qiskit_circuit(circuit)` converts `CircuitRequest` to a Qiskit `QuantumCircuit` object.
3. Transpiled or dispatched to target backend in `app/backends/registry.py`:
   - `qiskit_aer`: Qiskit Aer `AerSimulator` (statevector / stabilizer / shot simulation).
   - `pennylane`: PennyLane default.qubit / autograd.
   - `mps_backend`: Qiskit Aer Matrix Product State for large qubit counts.

---

## 4. Simulation API & Response Shapes

### Simulation Endpoints (`app/api/routes/simulation.py`)
- `POST /simulate`: Shot-based measurement counts (`SimulationResponse`).
- `POST /simulate/statevector`: Exact complex statevector, state probabilities, and single-qubit Bloch vectors (`StatevectorResponse`).
- `POST /simulate/mps`: Matrix Product State simulation (`UnifiedExecutionResultResponse`).
- `POST /simulate/timeline`: Gate-by-gate intermediate statevector evolution (`TimelineResponse`).

### Response Shapes
- `StatevectorResponse`:
```python
{
  "statevector": [{"real": float, "imag": float}],
  "probabilities": {"00": 0.5, "11": 0.5},
  "bloch_vectors": [{"x": float, "y": float, "z": float}],
  "qubits": int
}
```

### Qubit Limits
- Statevector simulation: Configured in `app/core/config.py` (`MAX_STATEVECTOR_QUBITS = 16`).
- Timeline simulation: Configured in `app/core/config.py` (`MAX_TIMELINE_QUBITS = 12`, `MAX_TIMELINE_STEPS = 100`).

---

## 5. Learner-Event Logging & Supabase Tables

### Learner-Event Logging
- Frontend logs events via `qualution-frontend/src/features/evidence/evidenceCollector.ts` and `qualution-frontend/src/api/evidenceApi.ts`.
- Events captured: `QUIZ_ANSWER`, `PREDICTION_ANSWER`, `CIRCUIT_CONSTRUCTION`, `CIRCUIT_MODIFICATION`, `SIMULATION_RUN`, `SIMULATION_INTERPRETATION`, `GATE_PLACEMENT`, `GATE_REMOVAL`, `EXPLANATION_VIEW`, `LESSON_STEP`.

### Supabase Tables (`supabase/migrations/`)
- `students`: Learner profiles, accuracy, circuits run, misconception risk level.
- `courses`: Course definitions, modules, tags.
- `teacher_overview`: Aggregate cohort stats.
- `challenges`: Student quantum challenges.
- `certificates`: Issued completion certificates.
- `circuits`: Saved student circuit runs.
- `erwin_insights`: Pedagogical alerts & recommended actions.
- `portal_posts`, `portal_comments`, `portal_likes`, `portal_submissions`, `moderation_queue`: Community & Telemetry portal.

### Items NOT FOUND
1. **Dedicated VQE / QAOA JSON Lessons**: While VQE and QAOA concepts are present in portal fallback data, dedicated JSON lesson files for VQE/QAOA were NOT FOUND in `src/features/theory/lessons/`.
2. **Persistent `learning_events` Table in Supabase Migrations**: The `learning_events` table is not present in SQL migration scripts; events are managed via backend endpoints (`onboarding.py`, `evidenceApi.ts`) and local storage fallback.

---

## Architectural Decisions for M1 & M2

1. **Taxonomy & Concept DAG (M1.1)**:
   - Create `qualution-backend/app/data/concept_taxonomy.json` containing 20 versioned quantum concepts covering single-qubit gates, superposition, measurement, phase, entanglement, Grover search, VQE, and error correction.
   - Implement DAG cycle validation in Pytest.

2. **Misconception Catalog Schema (M1.2)**:
   - Backend Pydantic schema `MisconceptionCatalogEntry` in `app/schemas/misconception.py`.
   - Matching TypeScript interface in `qualution-frontend/src/features/theory/misconceptionSchema.ts`.
   - 4-level hint ladder where level 4 reveals answer, levels 1-3 do not.
   - Migrate 6 existing frontend rules into the unified schema.

3. **Lesson-Step Metadata Extension (M1.3)**:
   - Extend `jsonLessonSchema` with backward-compatible optional fields: `concepts[]`, `goal`, `checkpoint { circuit_ref, question_type }`.

4. **Physics-Grounded Fact Extractor (M1.4)**:
   - FastAPI endpoint `POST /misconception/facts` in `app/api/routes/misconception.py`.
   - Calculates probabilities, normalized amplitudes/phases, single-qubit reduced density matrix purity $Tr(\rho^2)$, entanglement entropy $S(\rho) = -Tr(\rho \log_2 \rho)$, pairwise entanglement indicators, and relative-phase summaries using Qiskit Aer statevector simulation.
   - Enforces a 12-qubit cap, returning structured `too_large` response above the cap.

5. **Mutation Library & Diagnosis Engine (M2)**:
   - Immutable CircuitIR mutations (`swap_cnot_control_target`, `replace_h_with_x`, `replace_x_with_h`, `drop_gate`, `ignore_z_phase`, `treat_relative_as_global_phase`, `wrong_grover_oracle_marked_state`, `wrong_grover_iteration_count`, `bad_vqe_parameter_init`).
   - Simulation-driven distance metric (Total Variation Distance + relative phase distance) to diagnose synthetic predictions.
   - Deterministic evidence and confidence-weighting engine (`SUPPORTED`, `POSSIBLE`, `CLEARED`).
   - Coverage sweep script writing to `docs/misconception-engine/coverage-report.md`.
