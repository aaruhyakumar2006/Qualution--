import json
from pathlib import Path
from typing import Dict, List, Any

from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.fact_extractor import extract_circuit_facts
from app.services.mutation_library import mutation_registry
from app.services.diagnosis_engine import compute_tvd
from app.schemas.misconception import MisconceptionCatalog

REPORT_FILE_PATH = Path(__file__).parent.parent.parent.parent / "docs" / "misconception-engine" / "coverage-report.md"

def generate_coverage_report() -> Dict[str, Any]:
    """
    Runs coverage sweep across checkpoint probe circuits, testing each mutation
    to determine whether it produces a measurably distinct quantum probability distribution.
    Generates docs/misconception-engine/coverage-report.md.
    """
    # Define representative checkpoint probe circuits for lesson steps
    checkpoint_circuits = {
        "Hadamard Superposition (|0> -> |+>)": {
            "lesson": "qubitLesson.json / qubitSuperpositionCheckpointLesson.json",
            "concepts": ["hadamard_gate", "superposition", "measurement_collapse"],
            "circuit": CircuitRequest(
                qubits=1, classical_bits=1,
                gates=[GateRequest(gate="h", targets=[0])]
            )
        },
        "Two Hadamard Interference (H-H |0>)": {
            "lesson": "qubitSuperpositionCheckpointLesson.json",
            "concepts": ["hadamard_gate", "quantum_interference"],
            "circuit": CircuitRequest(
                qubits=1, classical_bits=1,
                gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[0])]
            )
        },
        "Bell State Entanglement (H-CX)": {
            "lesson": "onboarding.py / misconceptionCatalog.ts",
            "concepts": ["cnot_gate", "entanglement"],
            "circuit": CircuitRequest(
                qubits=2, classical_bits=2,
                gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]
            )
        },
        "2-Qubit Grover Superposition (H-H)": {
            "lesson": "groverLesson.json / lesson-8-grovers-search.json",
            "concepts": ["multi_qubit_systems", "hadamard_gate"],
            "circuit": CircuitRequest(
                qubits=2, classical_bits=2,
                gates=[GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])]
            )
        },
        "2-Qubit Grover Oracle (H-H-CZ)": {
            "lesson": "groverLesson.json / lesson-8-grovers-search.json",
            "concepts": ["oracle", "phase_kickback", "phase"],
            "circuit": CircuitRequest(
                qubits=2, classical_bits=2,
                gates=[
                    GateRequest(gate="h", targets=[0]),
                    GateRequest(gate="h", targets=[1]),
                    GateRequest(gate="cz", targets=[0, 1])
                ]
            )
        },
        "Full 2-Qubit Grover Circuit": {
            "lesson": "groverLesson.json / lesson-8-grovers-search.json",
            "concepts": ["grovers_search", "oracle", "diffuser"],
            "circuit": CircuitRequest(
                qubits=2, classical_bits=2,
                gates=[
                    GateRequest(gate="h", targets=[0]),
                    GateRequest(gate="h", targets=[1]),
                    GateRequest(gate="cz", targets=[0, 1]),
                    GateRequest(gate="h", targets=[0]),
                    GateRequest(gate="h", targets=[1]),
                    GateRequest(gate="x", targets=[0]),
                    GateRequest(gate="x", targets=[1]),
                    GateRequest(gate="cz", targets=[0, 1]),
                    GateRequest(gate="x", targets=[0]),
                    GateRequest(gate="x", targets=[1]),
                    GateRequest(gate="h", targets=[0]),
                    GateRequest(gate="h", targets=[1])
                ]
            )
        }
    }

    all_mutations = mutation_registry.list_all()
    sweep_results: List[Dict[str, Any]] = []
    summary_table_rows: List[Dict[str, Any]] = []

    for circuit_name, info in checkpoint_circuits.items():
        lesson_name = info["lesson"]
        concepts = info["concepts"]
        circ = info["circuit"]

        correct_facts = extract_circuit_facts(circ)
        correct_probs = correct_facts["measurement_probabilities"]

        diagnosable_count = 0
        indistinguishable_mutations: List[str] = []

        for m_def in all_mutations:
            m_id = m_def.id
            if not mutation_registry.is_applicable(m_id, circ):
                indistinguishable_mutations.append(f"{m_id} (not applicable)")
                continue

            mutated_circ = mutation_registry.mutate(m_id, circ)
            mutated_facts = extract_circuit_facts(mutated_circ)
            mutated_probs = mutated_facts["measurement_probabilities"]

            tvd_dist = compute_tvd(correct_probs, mutated_probs)

            if tvd_dist > 0.05:
                diagnosable_count += 1
                sweep_results.append({
                    "circuit": circuit_name,
                    "mutation_id": m_id,
                    "status": "DIAGNOSABLE",
                    "tvd": tvd_dist
                })
            else:
                indistinguishable_mutations.append(f"{m_id} (TVD={tvd_dist})")
                sweep_results.append({
                    "circuit": circuit_name,
                    "mutation_id": m_id,
                    "status": "INDISTINGUISHABLE",
                    "tvd": tvd_dist
                })

        summary_table_rows.append({
            "lesson": lesson_name,
            "checkpoint": circuit_name,
            "concepts": ", ".join(concepts),
            "diagnosable": diagnosable_count,
            "indistinguishable": len(indistinguishable_mutations),
            "indistinguishable_list": ", ".join(indistinguishable_mutations[:3])
        })

    # Generate Markdown documentation file
    md_lines = [
        "# QUALUTION Misconception Engine - Coverage Report",
        "",
        "## Overview",
        "This coverage report evaluates whether each CircuitIR mutation produces a measurably distinct quantum probability distribution (TVD > 0.05) when applied to checkpoint circuits across lessons.",
        "",
        "## Summary Table: Lessons x Concepts x Diagnosable Misconceptions",
        "",
        "| Lesson / Checkpoint Circuit | Target Concepts | Diagnosable Mutations | Indistinguishable Count | Example Indistinguishable Mutations |",
        "| --- | --- | --- | --- | --- |"
    ]

    for row in summary_table_rows:
        md_lines.append(
            f"| `{row['checkpoint']}` | `{row['concepts']}` | **{row['diagnosable']}** | {row['indistinguishable']} | `{row['indistinguishable_list']}` |"
        )

    md_lines.extend([
        "",
        "## Detailed Sweep Results",
        "",
        "| Checkpoint Circuit | Mutation ID | Status | TVD Distance |",
        "| --- | --- | --- | --- |"
    ])

    for res in sweep_results:
        status_str = f"✅ **{res['status']}**" if res["status"] == "DIAGNOSABLE" else f"⚠️ {res['status']}"
        md_lines.append(f"| {res['circuit']} | `{res['mutation_id']}` | {status_str} | `{res['tvd']}` |")

    REPORT_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(REPORT_FILE_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    return {
        "status": "success",
        "report_path": str(REPORT_FILE_PATH),
        "total_checkpoints_swept": len(checkpoint_circuits),
        "summary_table": summary_table_rows
    }

if __name__ == "__main__":
    generate_coverage_report()
