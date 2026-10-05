import re
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from app.services.portal_db_service import portal_db_service
from app.schemas.portal_explainer import (
    ExplainRequest,
    ExplainResponse,
    ExplanationTier,
    ConceptMapNode
)

class MarioPortalExplainerService:
    """
    Generates multi-tiered quantum explanations and mathematical concept dependency maps
    powered by Mario Quantum AI.
    """

    async def generate_explanation(self, req: ExplainRequest) -> ExplainResponse:
        item: Optional[Dict[str, Any]] = None
        if req.item_id:
            item = await portal_db_service.get_portal_item_by_id(req.item_id)

        title = (item.get("title") if item else None) or req.title or "Quantum Research Preprint"
        abstract = (item.get("abstract") or item.get("summary") if item else None) or req.abstract or ""
        text_corpus = f"{title} {abstract} {req.user_query or ''}".lower()

        # Domain Heuristics detection
        is_qec = any(k in text_corpus for k in ["error correction", "surface code", "syndrome", "fault-tolerant", "logical qubit", "transmon", "stabilizer"])
        is_neutral = any(k in text_corpus for k in ["neutral atom", "rydberg", "optical tweezer", "quera", "tweezer array"])
        is_vqa = any(k in text_corpus for k in ["vqe", "variational", "qaoa", "hamiltonian", "ansatz", "chemistry"])
        is_trapped_ion = any(k in text_corpus for k in ["ion", "trapped ion", "ionq", "all-to-all", "ytterbium"])
        is_grover_algo = any(k in text_corpus for k in ["grover", "search", "oracle", "amplitude amplification", "diffusion"])

        # Tier 1: Beginner
        if is_qec:
            t1_summary = "This paper explains how to protect delicate quantum information from noise by spreading one logical qubit across multiple physical qubits, like having a team check each other's work without disturbing the secret."
            t1_breakthrough = "Achieving fault-tolerant syndrome measurements below the physical error threshold."
            t1_analogy = "Like spelling a word with redundant backup letters so if a typo occurs, you can fix it instantly without reading the secret message."
            t1_math = "Logical State |0_L> = (|0000000> + |1111111>)/sqrt(2) protects parity against single-qubit bit/phase flips."
            t1_takeaways = [
                "Physical qubits are noisy, but logical qubits can run indefinitely if errors are caught quickly.",
                "Syndrome extraction detects errors without collapsing the quantum superposition."
            ]
        elif is_neutral:
            t1_summary = "Researchers control individual neutral atoms trapped in laser tweezers to create flexible 2D/3D quantum processors with high connectivity."
            t1_breakthrough = "Dynamic rearrangement of neutral atom arrays during circuit execution."
            t1_analogy = "Like robotic arms moving billiard balls on a frictionless table to interact whenever needed."
            t1_math = "Rydberg blockade radius R_b enforces strong dipole-dipole repulsion preventing multiple simultaneous excitations."
            t1_takeaways = [
                "Laser tweezers position hundreds of identical atoms in custom geometric grids.",
                "Qubits can physically shuttle across the chip for long-range interactions."
            ]
        elif is_vqa:
            t1_summary = "This work uses a hybrid quantum-classical feedback loop to calculate molecular energy ground states and optimization challenges."
            t1_breakthrough = "Mitigating barren plateaus using shallow parameterized quantum circuits."
            t1_analogy = "Like a hiker (classical computer) adjusting their compass headings based on quick altitude measurements from a scout drone (quantum processor)."
            t1_math = "Energy E(θ) = <ψ(θ)| H |ψ(θ)> is minimized using classical gradient descent."
            t1_takeaways = [
                "Quantum QPU evaluates quantum states while classical CPU optimizes parameter angles θ.",
                "Crucial for near-term NISQ devices without full error correction."
            ]
        elif is_grover_algo:
            t1_summary = "An algorithm that searches through unsorted data in O(sqrt(N)) steps instead of O(N) classical steps by amplifying the correct answer's probability amplitude."
            t1_breakthrough = "Quadratic speedup for unstructured search using phase kickback and inversion about the mean."
            t1_analogy = "Like constructive wave interference in a pool where water waves build up at the winning location and cancel out everywhere else."
            t1_math = "Grover operator G = (2|s><s| - I) O flips the phase of target |w> and reflects about superposition |s>."
            t1_takeaways = [
                "Requires ~ (π/4) * sqrt(N) oracle queries.",
                "Inverts amplitudes around the mean to boost probability of measuring the target state."
            ]
        else:
            t1_summary = f"This paper explores novel quantum computing architectures and protocols based on: {title}."
            t1_breakthrough = "Demonstrating measurable fidelity improvements on quantum hardware."
            t1_analogy = "Like synchronizing instruments in an orchestra so quantum waves reinforce valid computational paths."
            t1_math = "State vector evolution |ψ(t)> = U(t)|ψ(0)> preserving unitarity U†U = I."
            t1_takeaways = [
                "Quantum state coherence is preserved throughout the computational pipeline.",
                "Results bridge theoretical quantum bounds with experimental physical realization."
            ]

        beginner_tier = ExplanationTier(
            tier="beginner",
            title="Intuitive & Conceptual (Mario AI Beginner Guide)",
            summary=t1_summary,
            key_breakthrough=t1_breakthrough,
            mathematical_intuition=t1_math,
            analogy=t1_analogy,
            actionable_takeaways=t1_takeaways
        )

        # Tier 2: Undergraduate (Rigorous Physics & Linear Algebra)
        undergrad_tier = ExplanationTier(
            tier="undergraduate",
            title="Undergraduate Physics & Linear Algebra Breakdown",
            summary=f"Rigorous mathematical formulation of the Hamiltonian dynamics, unitary gate decompositions, and quantum state projections described in '{title}'.",
            key_breakthrough="Characterizing Kraus operator channels and state fidelity preservation under decoherence.",
            mathematical_intuition="Density matrix evolution via Lindblad master equation: dρ/dt = -i[H, ρ] + Σ_k (L_k ρ L_k† - 1/2 {L_k† L_k, ρ}).",
            analogy="Bloch sphere trajectory trajectory mapped onto SU(2) / SU(2^N) projective Hilbert space.",
            actionable_takeaways=[
                "Calculates exact state overlap fidelity F(ρ, σ) = (Tr[sqrt(sqrt(ρ) σ sqrt(ρ))])^2.",
                "Analyzes Clifford gate synthesis and T-gate depth overhead for fault-tolerant compilation."
            ]
        )

        # Tier 3: Hardware Practitioner (Pulse Level, Heavy-Hex / Topology Routing)
        practitioner_tier = ExplanationTier(
            tier="practitioner",
            title="QPU Hardware & Pulse Calibration Practitioner View",
            summary=f"Experimental QPU execution parameters, microwave cross-resonance drive frequencies, and SWAP routing overhead for deployment on physical processors.",
            key_breakthrough="Dynamical decoupling sequence (XY4/CPMG) suppression of low-frequency 1/f flux noise.",
            mathematical_intuition="Cross-Resonance Hamiltonian H_CR = (ω_12 / 2) (ZX - IX) used for calibrated all-microwave CNOT synthesis.",
            analogy="Microwave pulse envelope shaping (DRAG) to suppress leakage into non-computational transmon |2> states.",
            actionable_takeaways=[
                "Minimizes 2-qubit CX gate count to prevent thermal dephasing across Heavy-Hex / Grid couplers.",
                "Compiles native single-qubit RZ gates virtually via frame changes (zero duration, zero error)."
            ]
        )

        # Concept Map Nodes
        concept_nodes = [
            ConceptMapNode(
                id="c1",
                label="Quantum Superposition & Born Rule",
                category="prerequisite",
                description="State space linear combinations |ψ> = α|0> + β|1> with probability |α|^2 + |β|^2 = 1.",
                depends_on=[]
            ),
            ConceptMapNode(
                id="c2",
                label="Two-Qubit Entangling Hamiltonian",
                category="prerequisite",
                description="Coupled interaction Hamiltonian generating non-separable tensor product states.",
                depends_on=["c1"]
            ),
            ConceptMapNode(
                id="c3",
                label="Core Algorithmic / Physical Mechanism",
                category="core_mechanism",
                description=f"Primary mechanism: {t1_breakthrough}",
                depends_on=["c2"]
            ),
            ConceptMapNode(
                id="c4",
                label="Physical Noise & Decoherence Limits",
                category="hardware_constraint",
                description="T1 energy relaxation and T2 phase dephasing decay constraints during gate execution.",
                depends_on=["c3"]
            ),
            ConceptMapNode(
                id="c5",
                label="Fault-Tolerant Quantum Advantage",
                category="outcome",
                description="Demonstrated computational speedup or error-suppression benchmark outcome.",
                depends_on=["c3", "c4"]
            )
        ]

        return ExplainResponse(
            item_id=req.item_id,
            paper_title=title,
            assistant_name="Mario Quantum AI",
            tiers={
                "beginner": beginner_tier,
                "undergraduate": undergrad_tier,
                "practitioner": practitioner_tier
            },
            concept_map=concept_nodes,
            generated_at_iso=datetime.now(timezone.utc).isoformat()
        )

mario_portal_explainer_service = MarioPortalExplainerService()
