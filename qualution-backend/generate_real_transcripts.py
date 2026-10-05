import json
import os
from pathlib import Path
from app.schemas.circuit import CircuitRequest, GateRequest
from app.services.socratic_loop import socratic_loop, SessionState
from app.services.turn_validator import validate_turn_text

TRANSCRIPTS_DIR = Path(__file__).resolve().parent.parent / "docs" / "misconception-engine" / "transcripts"
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

def generate_conversation(scenario_name, misconception_id, circuit, turns_data):
    session = SessionState(
        session_id=f"sess-{misconception_id}",
        user_id=f"user-{misconception_id}",
        current_misconception_id=misconception_id
    )
    history = []
    validation_failures = []

    for step_num, turn_input in enumerate(turns_data, start=1):
        prediction = turn_input.get("prediction")
        confidence = turn_input.get("confidence", 0.8)
        step_id = turn_input.get("step_id", f"step-{step_num}")

        session, turn = socratic_loop.process_turn(
            session=session,
            circuit=circuit,
            student_prediction=prediction,
            user_confidence=confidence,
            current_step_id=step_id
        )

        # Validate turn text with hardened validator
        val = validate_turn_text(
            text=turn.text,
            hint_level=turn.hint_level,
            misconception_name=misconception_id,
            facts_used=turn.facts_used,
            experiment_id=turn.experiment_id,
            offered_experiments=[turn.experiment_id] if turn.experiment_id else []
        )

        if not val.is_valid:
            validation_failures.append({
                "turn": step_num,
                "text": turn.text,
                "issues": val.issues
            })

        history.append({
            "turn_number": step_num,
            "student_input": turn_input.get("student_utterance", str(prediction)),
            "mario_output": turn.text,
            "metadata": {
                "state": turn.state,
                "hint_level": turn.hint_level,
                "kind": turn.kind,
                "path_used": turn.path_used,
                "experiment_id": turn.experiment_id,
                "facts_used": turn.facts_used,
                "validator_passed": val.is_valid,
                "validator_issues": val.issues
            }
        })

        if turn.state in ["RESOLVED", "HANDOFF"]:
            break

    # Save to JSON
    json_path = TRANSCRIPTS_DIR / f"{scenario_name}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "scenario": scenario_name,
            "misconception_id": misconception_id,
            "turns": history,
            "validation_failures": validation_failures
        }, f, indent=2)

    # Save to Markdown
    md_path = TRANSCRIPTS_DIR / f"{scenario_name}.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"# Socratic Conversation Transcript: {scenario_name}\n\n")
        f.write(f"- **Misconception ID**: `{misconception_id}`\n")
        f.write(f"- **Validation Failures**: {len(validation_failures)}\n\n")
        f.write("## Dialogue Transcript\n\n")
        for turn in history:
            f.write(f"### Turn {turn['turn_number']} [{turn['metadata']['state']} | Level {turn['metadata']['hint_level']} | Path: {turn['metadata']['path_used']}]\n")
            f.write(f"**Student**: {turn['student_input']}\n\n")
            f.write(f"**Mario**: {turn['mario_output']}\n\n")
            f.write(f"*Metadata*: Facts Used: `{turn['metadata']['facts_used']}` | Validator: `{'PASS' if turn['metadata']['validator_passed'] else 'FAIL'}`\n\n")

    print(f"Generated {scenario_name}: {len(history)} turns, {len(validation_failures)} validation failures.")
    return validation_failures

if __name__ == "__main__":
    # 1. Hadamard Inverts Classical Scenario
    circ_h = CircuitRequest(qubits=1, classical_bits=1, gates=[GateRequest(gate="h", targets=[0])])
    generate_conversation(
        scenario_name="transcript_hadamard_inverts_classical",
        misconception_id="hadamard-inverts-classical",
        circuit=circ_h,
        turns_data=[
            {"prediction": {"1": 1.0}, "student_utterance": "I think H|0> inverts it to |1>."},
            {"prediction": {"1": 1.0}, "student_utterance": "Still looks like it inverts to 1."},
            {"prediction": {"0": 0.5, "1": 0.5}, "student_utterance": "Ah, running the experiment shows equal 50% on both 0 and 1."}
        ]
    )

    # 2. Grover Over-Iteration Scenario
    circ_g = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1]),
            GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
            GateRequest(gate="cz", targets=[0, 1]),
            GateRequest(gate="x", targets=[0]), GateRequest(gate="x", targets=[1]),
            GateRequest(gate="h", targets=[0]), GateRequest(gate="h", targets=[1])
        ]
    )
    generate_conversation(
        scenario_name="transcript_grover_over_iteration",
        misconception_id="grover-over-iteration",
        circuit=circ_g,
        turns_data=[
            {"prediction": {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25}, "step_id": "lesson-8-grovers-search", "student_utterance": "I doubled the iterations to 2, so the probability should be higher, but it says 25% on all four states."},
            {"prediction": {"00": 0.25, "01": 0.25, "10": 0.25, "11": 0.25}, "step_id": "lesson-8-grovers-search", "student_utterance": "Does 2 iterations rotate past the target?"},
            {"prediction": {"11": 1.0}, "step_id": "lesson-8-grovers-search", "student_utterance": "I checked 1 iteration and it reached 100% |11>!"}
        ]
    )

    # 3. CNOT Control Target Swapped Scenario
    circ_c = CircuitRequest(
        qubits=2, classical_bits=2,
        gates=[GateRequest(gate="x", targets=[0]), GateRequest(gate="cx", targets=[0, 1])]
    )
    generate_conversation(
        scenario_name="transcript_cnot_swapped",
        misconception_id="cnot-control-target-swapped",
        circuit=circ_c,
        turns_data=[
            {"prediction": {"00": 1.0}, "student_utterance": "I thought qubit 1 was the control, so qubit 0 would stay unchanged."},
            {"prediction": {"11": 1.0}, "student_utterance": "Now I see qubit 0 controls qubit 1, giving |11> with probability 1."}
        ]
    )
