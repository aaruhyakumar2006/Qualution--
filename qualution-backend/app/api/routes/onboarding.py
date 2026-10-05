import uuid
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Header

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

# ═══════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════

class QuestionOption(BaseModel):
    id: str
    text: str
    subtext: Optional[str] = None

class OnboardingQuestion(BaseModel):
    id: str
    dimension: str  # "knowledge" | "circuits" | "programming" | "goals"
    title: str
    prompt: str
    code_snippet: Optional[str] = None
    options: List[QuestionOption]

class DimensionScores(BaseModel):
    knowledge: float
    circuits: float
    programming: float
    algorithms: float

class DetectedMisconception(BaseModel):
    rule_id: str
    name: str
    remediation: str

class OnboardingAssessPayload(BaseModel):
    answers: Dict[str, str]  # question_id -> option_id
    learning_goals: List[str] = []
    preferred_style: Optional[str] = "visual"

class LearnerProfileData(BaseModel):
    id: str
    student_id: str
    overall_mastery: float
    prediction_accuracy: float
    circuit_skill: float
    coding_skill: float

class OnboardingStatusResponse(BaseModel):
    is_onboarded: bool
    level: Optional[str] = None
    overall_mastery: Optional[float] = None
    recommended_path: List[str] = []
    profile: Optional[LearnerProfileData] = None

class OnboardingAssessResponse(BaseModel):
    level: str  # "beginner" | "intermediate" | "advanced"
    score: int
    dimension_scores: DimensionScores
    detected_misconceptions: List[DetectedMisconception]
    recommended_path: List[str]
    curriculum_summary: str
    ai_tutor_mode: str
    learner_profile_id: str

# ═══════════════════════════════════════════════════════════════════
# Curated Question Bank (Single Source of Truth)
# ═══════════════════════════════════════════════════════════════════

DIAGNOSTIC_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "q1_superposition",
        "dimension": "knowledge",
        "title": "Quantum Fundamentals",
        "prompt": "What fundamentally distinguishes a quantum bit (qubit) from a classical bit prior to measurement?",
        "options": [
            {
                "id": "A",
                "text": "A qubit exists in a linear combination α|0⟩ + β|1⟩ with complex probability amplitudes.",
                "subtext": "Amplitudes satisfy |α|² + |β|² = 1 and can undergo interference."
            },
            {
                "id": "B",
                "text": "A qubit is a classical bit that rapidly fluctuates between 0 and 1 like a coin toss.",
                "subtext": "It has an unknown classical value that is revealed upon observation."
            },
            {
                "id": "C",
                "text": "A qubit simultaneously stores both 0 and 1 permanently, even after measurement.",
                "subtext": "Measurement reads out both states in parallel."
            },
            {
                "id": "D",
                "text": "A qubit is an analog voltage signal with continuous infinite capacity.",
                "subtext": "It operates on continuous classical wave equations."
            }
        ]
    },
    {
        "id": "q2_interference",
        "dimension": "circuits",
        "title": "Interference & Hadamard Transformation",
        "prompt": "A qubit initialized to |0⟩ passes through a Hadamard (H) gate, and then through a second H gate (H · H |0⟩). What is the final measured state?",
        "code_snippet": "q[0]: |0⟩ ──[ H ]──[ H ]── ➔ ?",
        "options": [
            {
                "id": "A",
                "text": "|0⟩ with 100% certainty (deterministic return to initial basis state).",
                "subtext": "Because H² = I, probability amplitudes interfere destructively for |1⟩ and constructively for |0⟩."
            },
            {
                "id": "B",
                "text": "A 50/50 random outcome between |0⟩ and |1⟩.",
                "subtext": "The second H gate randomizes the superposition state even further."
            },
            {
                "id": "C",
                "text": "|1⟩ with 100% certainty.",
                "subtext": "Two consecutive Hadamard gates invert the state like a double-NOT rotation."
            },
            {
                "id": "D",
                "text": "The state is destroyed or indeterminate.",
                "subtext": "Applying gates in series leads to phase decoherence."
            }
        ]
    },
    {
        "id": "q3_cnot_entanglement",
        "dimension": "circuits",
        "title": "Two-Qubit Entanglement & CNOT",
        "prompt": "A CNOT gate is applied with control qubit q[0] in equal superposition (|0⟩ + |1⟩)/√2 and target qubit q[1] initialized to |0⟩. What state is produced?",
        "code_snippet": "q[0]: (|0⟩ + |1⟩)/√2 ──●── ➔ ?\nq[1]:        |0⟩     ──⊕── ➔ ?",
        "options": [
            {
                "id": "A",
                "text": "The maximally entangled Bell state (|00⟩ + |11⟩)/√2.",
                "subtext": "The two qubits can no longer be factored into independent single-qubit states."
            },
            {
                "id": "B",
                "text": "Two independent 50% random qubits (|0⟩ + |1⟩)/√2 ⊗ (|0⟩ + |1⟩)/√2.",
                "subtext": "CNOT copies the superposition of the control directly onto the target."
            },
            {
                "id": "C",
                "text": "State |01⟩ with 100% certainty.",
                "subtext": "Target flips unconditionally because control was in superposition."
            },
            {
                "id": "D",
                "text": "State |10⟩ with 100% certainty.",
                "subtext": "Control collapses to |1⟩ and target remains |0⟩."
            }
        ]
    },
    {
        "id": "q4_measurement_collapse",
        "dimension": "knowledge",
        "title": "Measurement & Wavefunction Collapse",
        "prompt": "When an observable in the computational basis is measured on a qubit in state (|0⟩ + |1⟩)/√2, what occurs immediately following the measurement?",
        "options": [
            {
                "id": "A",
                "text": "The state irreversibly projects onto either |0⟩ or |1⟩.",
                "subtext": "Any subsequent measurement in the same basis will return the exact same outcome with certainty."
            },
            {
                "id": "B",
                "text": "The qubit remains in superposition (|0⟩ + |1⟩)/√2.",
                "subtext": "Repeated measurements on the same physical qubit continue producing random 50/50 samples."
            },
            {
                "id": "C",
                "text": "The measurement is non-destructive and outputs continuous amplitudes α and β in one run.",
                "subtext": "Wavefunction collapse only happens in multi-qubit systems."
            },
            {
                "id": "D",
                "text": "The qubit is automatically cleared and erased to hardware null state.",
                "subtext": "Physical measurement consumes all energy in the quantum register."
            }
        ]
    },
    {
        "id": "q5_programming",
        "dimension": "programming",
        "title": "Quantum Programming & Framework Experience",
        "prompt": "What best characterizes your experience with quantum computing SDKs and scientific Python?",
        "options": [
            {
                "id": "A",
                "text": "Experienced with Qiskit, Cirq, or PennyLane.",
                "subtext": "Comfortable building circuits, executing statevector simulators, and writing quantum scripts."
            },
            {
                "id": "B",
                "text": "Proficient in Python and linear algebra, but new to quantum SDKs.",
                "subtext": "Understand matrix multiplication, complex vectors, and eager to write quantum algorithms."
            },
            {
                "id": "C",
                "text": "Basic programming background, prefer visual drag-and-drop circuit tools.",
                "subtext": "Interested in seeing the synchronized code while manipulating gates visually."
            },
            {
                "id": "D",
                "text": "Completely new to programming.",
                "subtext": "Focused on intuitive conceptual understanding, Bloch spheres, and visual simulations."
            }
        ]
    }
]

# In-memory store for session persistence
_LEARNER_PROFILES: Dict[str, Dict[str, Any]] = {}

# ═══════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/questions", response_model=List[OnboardingQuestion])
def get_onboarding_questions(authorization: Optional[str] = Header(None)):
    """Returns the official diagnostic question bank for quantum awareness onboarding."""
    return DIAGNOSTIC_QUESTIONS

@router.get("/status", response_model=OnboardingStatusResponse)
def get_onboarding_status(authorization: Optional[str] = Header(None)):
    """
    Checks if the user has completed onboarding assessment.
    Enables returning users to directly enter Quantum Studio.
    """
    user_id = "usr-sih-evaluator-001"
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token.startswith("jwt-eval-"):
            user_id = token.replace("jwt-eval-", "")

    profile = _LEARNER_PROFILES.get(user_id)
    if not profile or profile.get("overall_mastery", 0.0) <= 0.0:
        return OnboardingStatusResponse(
            is_onboarded=False,
            level=None,
            overall_mastery=0.0,
            recommended_path=[],
            profile=None
        )

    return OnboardingStatusResponse(
        is_onboarded=True,
        level=profile["level"],
        overall_mastery=profile["overall_mastery"],
        recommended_path=profile["recommended_path"],
        profile=LearnerProfileData(
            id=profile["id"],
            student_id=user_id,
            overall_mastery=profile["overall_mastery"],
            prediction_accuracy=profile["prediction_accuracy"],
            circuit_skill=profile["circuit_skill"],
            coding_skill=profile["coding_skill"]
        )
    )

@router.post("/assess", response_model=OnboardingAssessResponse)
def assess_onboarding(
    payload: OnboardingAssessPayload,
    authorization: Optional[str] = Header(None)
):
    """
    Deterministic evaluation of quantum awareness answers.
    Detects misconceptions, calculates dimension scores, persists LearnerProfile,
    and returns a tailored learning path.
    """
    user_id = "usr-sih-evaluator-001"
    if isinstance(authorization, str) and authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token.startswith("jwt-eval-"):
            user_id = token.replace("jwt-eval-", "")

    answers = payload.answers

    # Knowledge score (Q1, Q4)
    knowledge_correct = 0
    total_knowledge = 2
    if answers.get("q1_superposition") == "A":
        knowledge_correct += 1
    if answers.get("q4_measurement_collapse") == "A":
        knowledge_correct += 1
    knowledge_score = (knowledge_correct / total_knowledge) * 100.0

    # Circuits score (Q2, Q3)
    circuits_correct = 0
    total_circuits = 2
    if answers.get("q2_interference") == "A":
        circuits_correct += 1
    if answers.get("q3_cnot_entanglement") == "A":
        circuits_correct += 1
    circuits_score = (circuits_correct / total_circuits) * 100.0

    # Programming score (Q5)
    prog_choice = answers.get("q5_programming", "C")
    prog_map = {"A": 100.0, "B": 75.0, "C": 50.0, "D": 25.0}
    programming_score = prog_map.get(prog_choice, 50.0)

    # Algorithms weighted score
    algorithms_score = (circuits_score * 0.6) + (programming_score * 0.4)

    # Composite overall score
    overall_score_float = (
        (knowledge_score * 0.35) +
        (circuits_score * 0.35) +
        (programming_score * 0.30)
    )
    overall_score = int(round(overall_score_float))

    # Detect misconceptions
    detected_misconceptions: List[DetectedMisconception] = []

    if answers.get("q2_interference") == "B":
        detected_misconceptions.append(DetectedMisconception(
            rule_id="RULE_SUPERPOS_RANDOM",
            name="Superposition as Classical Randomness",
            remediation="Quantum amplitudes can be negative, leading to destructive interference (e.g., H followed by H returns to |0⟩ with 100% certainty, not 50/50 random)."
        ))

    if answers.get("q3_cnot_entanglement") == "B":
        detected_misconceptions.append(DetectedMisconception(
            rule_id="RULE_CNOT_COPY",
            name="CNOT as Classical Copying",
            remediation="Review entanglement and the Bell state. CNOT does not duplicate superposition; by the No-Cloning Theorem it entangles control and target."
        ))

    if answers.get("q4_measurement_collapse") == "B":
        detected_misconceptions.append(DetectedMisconception(
            rule_id="RULE_MEASURE_NO_EFFECT",
            name="Measurement Does Not Affect State",
            remediation="Measurement irreversibly projects the quantum statevector onto one of the eigenbasis states |0⟩ or |1⟩."
        ))

    # Determine classification level and pathway
    if overall_score >= 80 and not detected_misconceptions:
        level = "advanced"
        ai_tutor_mode = "advanced"
        recommended_path = [
            "Multi-Qubit Entanglement & GHZ State Synthesis",
            "Quantum Phase Estimation & Shor's Algorithm Walkthrough",
            "Deterministic Circuit Optimization & Pass Scheduling",
            "Hardware Noise Modeling & Error Mitigation Analysis"
        ]
        curriculum_summary = (
            "Demonstrated strong command of quantum interference, statevector algebra, and multi-qubit gates. "
            "Your workspace is pre-configured with advanced multi-framework simulators and circuit optimization tools."
        )
    elif overall_score >= 50:
        level = "intermediate"
        ai_tutor_mode = "intermediate"
        recommended_path = [
            "Hadamard Transformations & Phase Kickback",
            "Two-Qubit Controlled Gates & Bell State Synthesis",
            "Quantum State Reconstruction & Bloch Vector Tomography",
            "Introductory Grover Search Circuit Construction"
        ]
        curriculum_summary = (
            "Solid grasp of baseline concepts. We have configured interactive circuit walkthroughs "
            "and synchronized Qiskit / PennyLane code views to strengthen multi-qubit mechanics."
        )
    else:
        level = "beginner"
        ai_tutor_mode = "beginner"
        recommended_path = [
            "Single-Qubit Rotations & Superposition Essentials",
            "Bloch Sphere Intuition & Statevector Visualization",
            "Quantum Measurement & Non-Deterministic Projection",
            "Building Your First Two-Qubit Entanglement Circuit"
        ]
        curriculum_summary = (
            "Welcome to quantum computing! Your workspace starts with visual, guided experiments, "
            "interactive Bloch spheres, and intuitive step-by-step AI voice tutoring."
        )

    profile_id = f"prof-{uuid.uuid4().hex[:8]}"
    _LEARNER_PROFILES[user_id] = {
        "id": profile_id,
        "level": level,
        "overall_mastery": overall_score_float,
        "prediction_accuracy": knowledge_score,
        "circuit_skill": circuits_score,
        "coding_skill": programming_score,
        "recommended_path": recommended_path,
        "misconceptions": detected_misconceptions,
    }

    return OnboardingAssessResponse(
        level=level,
        score=overall_score,
        dimension_scores=DimensionScores(
            knowledge=knowledge_score,
            circuits=circuits_score,
            programming=programming_score,
            algorithms=algorithms_score
        ),
        detected_misconceptions=detected_misconceptions,
        recommended_path=recommended_path,
        curriculum_summary=curriculum_summary,
        ai_tutor_mode=ai_tutor_mode,
        learner_profile_id=profile_id
    )
