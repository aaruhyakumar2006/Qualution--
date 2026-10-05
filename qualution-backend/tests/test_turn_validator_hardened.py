import pytest
from app.services.turn_validator import validate_turn_text

# 10 Bad Examples that MUST ALL FAIL validation
BAD_EXAMPLES = [
    # 1. Answer leak (solution keyword below level 4)
    {
        "text": "The correct answer is to apply a Hadamard gate to qubit 0.",
        "hint_level": 2,
        "facts_used": [0],
        "expected_issue_sub": "solution keyword 'answer'"
    },
    # 2. Outcome leak phrased without banned words
    {
        "text": "The circuit should produce |11> with 100% probability.",
        "hint_level": 2,
        "correct_outcome": {"11": 1.0},
        "facts_used": ["11", 100],
        "expected_issue_sub": "Leaked correct target state '11' with 100% probability"
    },
    # 3. Compound question (multiple interrogative clauses)
    {
        "text": "What did you expect to see, and what did the simulator measure?",
        "hint_level": 1,
        "facts_used": [],
        "expected_issue_sub": "Compound question detected"
    },
    # 4. Invented number (not grounded in facts_used)
    {
        "text": "Notice that 99 percent of the phase is lost here?",
        "hint_level": 2,
        "facts_used": [0.5, 50],
        "expected_issue_sub": "Number '99' in turn text was not found in facts_used"
    },
    # 5. Wrong experiment_id
    {
        "text": "Would you like to run the comparison experiment?",
        "hint_level": 3,
        "experiment_id": "exp-invalid-wrong-id",
        "offered_experiments": ["exp-grover-iteration-diff", "exp-hadamard-basis"],
        "expected_issue_sub": "Experiment ID 'exp-invalid-wrong-id' is not in offered experiments set"
    },
    # 6. Over word limit (> 40 words)
    {
        "text": "When you observe the quantum state after multiple gates, the superposition collapses into one of the basis states with a certain probability defined by the amplitude squared, which means that you cannot observe the relative phase directly without using an interference circuit?",
        "hint_level": 1,
        "facts_used": [],
        "expected_issue_sub": "exceeds word limit"
    },
    # 7. URL in text
    {
        "text": "Visit https://qualution.io/quantum-guide to see the Bloch sphere?",
        "hint_level": 1,
        "facts_used": [],
        "expected_issue_sub": "unallowed URL"
    },
    # 8. Markdown code block
    {
        "text": "Try running this circuit:\n```python\nqc.h(0)\n```\nWhat happens?",
        "hint_level": 2,
        "facts_used": [0],
        "expected_issue_sub": "Markdown code fences"
    },
    # 9. HTML tags in text
    {
        "text": "Look closely at the <span class='gate'>X</span> gate?",
        "hint_level": 1,
        "facts_used": [],
        "expected_issue_sub": "HTML tags"
    },
    # 10. Misconception name leaked below level 4
    {
        "text": "Are you showing the grover-over-iteration error?",
        "hint_level": 2,
        "misconception_name": "grover-over-iteration",
        "facts_used": [],
        "expected_issue_sub": "Leaked misconception name 'grover-over-iteration'"
    },
    # Bonus: Prohibited mascot catchphrase
    {
        "text": "Mamma mia, look at the probability distribution on qubit 0?",
        "hint_level": 1,
        "facts_used": [0],
        "expected_issue_sub": "prohibited commercial mascot catchphrase"
    }
]

# 10 Good Examples that MUST ALL PASS validation
GOOD_EXAMPLES = [
    # 1. Clean reflection question (Level 1)
    {
        "text": "What do the measurement probabilities on qubit 0 show after the gate?",
        "hint_level": 1,
        "facts_used": [0],
        "misconception_name": "hadamard-inverts-classical"
    },
    # 2. Targeted observation question (Level 2)
    {
        "text": "How does the statevector change when you apply the Hadamard gate?",
        "hint_level": 2,
        "facts_used": [],
        "misconception_name": "superposition-random"
    },
    # 3. Observation with grounded numbers (Level 2)
    {
        "text": "The measurement probability is 50 percent; why does this happen?",
        "hint_level": 2,
        "facts_used": [0.5, 50],
        "misconception_name": "measurement-deterministic"
    },
    # 4. Single-qubit probe with Bloch angle (Level 2)
    {
        "text": "Look at the Bloch sphere vector along the Z axis; what angle do you observe?",
        "hint_level": 2,
        "facts_used": [],
        "misconception_name": "phase-shift-bitflip"
    },
    # 5. Clean experiment suggestion with valid experiment_id (Level 3)
    {
        "text": "Can you run the comparison panel to observe how the two states differ?",
        "hint_level": 3,
        "experiment_id": "exp-grover-diff",
        "offered_experiments": ["exp-grover-diff"],
        "facts_used": [],
        "misconception_name": "grover-over-iteration"
    },
    # 6. Relative phase shift probe (Level 2)
    {
        "text": "Why did the relative phase shift from positive to negative?",
        "hint_level": 2,
        "facts_used": [],
        "misconception_name": "relative-phase-invisible"
    },
    # 7. Non-compound question with bitstring outcome (Level 1)
    {
        "text": "What outcome did you measure on the first qubit?",
        "hint_level": 1,
        "facts_used": [],
        "misconception_name": "cnot-control-target-swapped"
    },
    # 8. Rotation question without leaking target state (Level 2)
    {
        "text": "How does rotating the statevector past 90 degrees affect measurement probability?",
        "hint_level": 2,
        "facts_used": [90],
        "misconception_name": "grover-over-iteration"
    },
    # 9. Entangled pair purity probe (Level 2)
    {
        "text": "What happens to the purity when you measure one qubit of the Bell pair?",
        "hint_level": 2,
        "facts_used": [],
        "misconception_name": "entanglement-local-phase"
    },
    # 10. Level 4 direct remediation (allowed to explain principle and correct outcome)
    {
        "text": "Because Grover search is periodic, a single iteration rotates 60 degrees to reach 100 percent probability.",
        "hint_level": 4,
        "correct_outcome": {"11": 1.0},
        "facts_used": [60, 100, "11"],
        "misconception_name": "grover-over-iteration"
    }
]

@pytest.mark.parametrize("example", BAD_EXAMPLES)
def test_hardened_validator_rejects_bad_examples(example):
    res = validate_turn_text(
        text=example["text"],
        hint_level=example.get("hint_level", 1),
        misconception_name=example.get("misconception_name"),
        correct_outcome=example.get("correct_outcome"),
        facts_used=example.get("facts_used", []),
        experiment_id=example.get("experiment_id"),
        offered_experiments=example.get("offered_experiments", [])
    )
    assert not res.is_valid, f"Expected validation failure for: '{example['text']}'"
    assert any(example["expected_issue_sub"].lower() in issue.lower() for issue in res.issues), (
        f"Expected issue containing '{example['expected_issue_sub']}', but got: {res.issues}"
    )

@pytest.mark.parametrize("example", GOOD_EXAMPLES)
def test_hardened_validator_accepts_good_examples(example):
    res = validate_turn_text(
        text=example["text"],
        hint_level=example.get("hint_level", 1),
        misconception_name=example.get("misconception_name"),
        correct_outcome=example.get("correct_outcome"),
        facts_used=example.get("facts_used", []),
        experiment_id=example.get("experiment_id"),
        offered_experiments=example.get("offered_experiments", [])
    )
    assert res.is_valid, f"Expected validation success, but got issues: {res.issues} for text: '{example['text']}'"
