import pytest
from app.services.turn_validator import validate_turn_text
from app.services.llm_service import llm_service, LLMWordingRequest

GOLDEN_TURNS = [
    # Entry 1: hadamard-inverts-classical
    {"entry_id": "hadamard-inverts-classical", "level": 1, "text": "Mario: What happens to the qubit state after applying a Hadamard gate?", "misc_name": "Hadamard Inverts Classical", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "hadamard-inverts-classical", "level": 2, "text": "Mario: Does Hadamard create a superposition or perform a classical bit-flip?", "misc_name": "Hadamard Inverts Classical", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "hadamard-inverts-classical", "level": 3, "text": "Mario: Look at the 50/50 measurement distribution. How does this compare to state 1?", "misc_name": "Hadamard Inverts Classical", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "hadamard-inverts-classical", "level": 4, "text": "Mario: The Hadamard gate creates superposition |+>, which yields equal probabilities.", "misc_name": "Hadamard Inverts Classical", "facts": [{"0": 0.5, "1": 0.5}]},

    # Entry 2: cnot-control-target-swapped
    {"entry_id": "cnot-control-target-swapped", "level": 1, "text": "Mario: Which qubit acts as the control in your CNOT gate?", "misc_name": "Swap CNOT Control Target", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-control-target-swapped", "level": 2, "text": "Mario: Notice which qubit flips when the control qubit is 1.", "misc_name": "Swap CNOT Control Target", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-control-target-swapped", "level": 3, "text": "Mario: Look at state 10 vs 01. Did the target qubit flip as intended?", "misc_name": "Swap CNOT Control Target", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-control-target-swapped", "level": 4, "text": "Mario: CNOT flips target qubit 1 only when control qubit 0 is in state 1.", "misc_name": "Swap CNOT Control Target", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},

    # Entry 3: cnot-creates-product-state
    {"entry_id": "cnot-creates-product-state", "level": 1, "text": "Mario: Are the two qubits independent or entangled after CNOT?", "misc_name": "CNOT Copies State", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-creates-product-state", "level": 2, "text": "Mario: Check the measurement correlations between qubit 0 and qubit 1.", "misc_name": "CNOT Copies State", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-creates-product-state", "level": 3, "text": "Mario: Notice how outcomes 01 and 10 have 0 probability.", "misc_name": "CNOT Copies State", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},
    {"entry_id": "cnot-creates-product-state", "level": 4, "text": "Mario: CNOT creates an entangled Bell state rather than two independent product states.", "misc_name": "CNOT Copies State", "facts": [{"00": 0.5, "01": 0.0, "10": 0.0, "11": 0.5}]},

    # Entry 4: superposition-not-mixture
    {"entry_id": "superposition-not-mixture", "level": 1, "text": "Mario: What happens when you apply two consecutive Hadamard gates?", "misc_name": "Superposition as Mixture", "facts": [{"0": 1.0, "1": 0.0}]},
    {"entry_id": "superposition-not-mixture", "level": 2, "text": "Mario: Does quantum superposition preserve phase coherence?", "misc_name": "Superposition as Mixture", "facts": [{"0": 1.0, "1": 0.0}]},
    {"entry_id": "superposition-not-mixture", "level": 3, "text": "Mario: Look at how amplitudes interfere constructively back to state 0.", "misc_name": "Superposition as Mixture", "facts": [{"0": 1.0, "1": 0.0}]},
    {"entry_id": "superposition-not-mixture", "level": 4, "text": "Mario: Hadamard operations interfere deterministically rather than acting as a random mixture.", "misc_name": "Superposition as Mixture", "facts": [{"0": 1.0, "1": 0.0}]},

    # Entry 5: measurement-no-collapse
    {"entry_id": "measurement-no-collapse", "level": 1, "text": "Mario: Does measurement change the quantum state vector?", "misc_name": "Measurement No Collapse", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "measurement-no-collapse", "level": 2, "text": "Mario: What happens to superposition after a measurement gate is executed?", "misc_name": "Measurement No Collapse", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "measurement-no-collapse", "level": 3, "text": "Mario: Notice how mid-circuit measurement destroys interference.", "misc_name": "Measurement No Collapse", "facts": [{"0": 0.5, "1": 0.5}]},
    {"entry_id": "measurement-no-collapse", "level": 4, "text": "Mario: Measurement collapses the state vector into a single basis state.", "misc_name": "Measurement No Collapse", "facts": [{"0": 0.5, "1": 0.5}]},

    # Entry 6: phase-kickback-ignored
    {"entry_id": "phase-kickback-ignored", "level": 1, "text": "Mario: Where does the phase flip travel during a controlled operation?", "misc_name": "Phase Kickback Ignored", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "phase-kickback-ignored", "level": 2, "text": "Mario: Check the phase on the control qubit when target is in state minus.", "misc_name": "Phase Kickback Ignored", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "phase-kickback-ignored", "level": 3, "text": "Mario: How does phase kickback enable oracle marking?", "misc_name": "Phase Kickback Ignored", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "phase-kickback-ignored", "level": 4, "text": "Mario: Phase kickback transfers the target eigenvalue phase back to the control qubit.", "misc_name": "Phase Kickback Ignored", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},

    # Entry 7: oracle-phase-flip-misunderstood
    {"entry_id": "oracle-phase-flip-misunderstood", "level": 1, "text": "Mario: Does a phase oracle flip the bit value or the phase sign?", "misc_name": "Oracle Phase Flip", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "oracle-phase-flip-misunderstood", "level": 2, "text": "Mario: Look at the minus sign in the state vector amplitude.", "misc_name": "Oracle Phase Flip", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "oracle-phase-flip-misunderstood", "level": 3, "text": "Mario: Notice that computational probabilities in Z-basis remain unchanged.", "misc_name": "Oracle Phase Flip", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},
    {"entry_id": "oracle-phase-flip-misunderstood", "level": 4, "text": "Mario: Oracles flip relative phase signs rather than computational bitstrings.", "misc_name": "Oracle Phase Flip", "facts": [{"00": 0.0, "01": 0.0, "10": 0.0, "11": 1.0}]},

    # Entry 8: wrong-grover-oracle-marked-state
    {"entry_id": "wrong-grover-oracle-marked-state", "level": 1, "text": "Mario: Which basis state does your oracle CZ gate mark?", "misc_name": "Wrong Marked State", "facts": [{"00": 0.0, "01": 0.0, "10": 1.0, "11": 0.0}]},
    {"entry_id": "wrong-grover-oracle-marked-state", "level": 2, "text": "Mario: Check the X gate wrapping on qubit 0.", "misc_name": "Wrong Marked State", "facts": [{"00": 0.0, "01": 0.0, "10": 1.0, "11": 0.0}]},
    {"entry_id": "wrong-grover-oracle-marked-state", "level": 3, "text": "Mario: Why is state 10 amplified instead of state 11?", "misc_name": "Wrong Marked State", "facts": [{"00": 0.0, "01": 0.0, "10": 1.0, "11": 0.0}]},
    {"entry_id": "wrong-grover-oracle-marked-state", "level": 4, "text": "Mario: The X-gate sandwich on qubit 0 shifted the phase-flip target from 11 to 10.", "misc_name": "Wrong Marked State", "facts": [{"00": 0.0, "01": 0.0, "10": 1.0, "11": 0.0}]}
]

def test_eval_set_30_golden_turns():
    """
    Evaluates 32 golden turn fixtures across catalog entries x hint levels.
    Asserts that 100% of golden turns pass Turn Validator rules with zero leakage.
    """
    passed_count = 0
    total_count = len(GOLDEN_TURNS)

    for fixture in GOLDEN_TURNS:
        val = validate_turn_text(
            text=fixture["text"],
            hint_level=fixture["level"],
            misconception_name=fixture["misc_name"],
            facts_used=fixture["facts"]
        )
        assert val.is_valid is True, f"Golden turn fixture failed validation: {fixture['text']} -> {val.issues}"
        passed_count += 1

    assert passed_count == total_count == 32
