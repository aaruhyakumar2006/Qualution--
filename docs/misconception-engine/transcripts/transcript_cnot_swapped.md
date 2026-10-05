# Socratic Conversation Transcript: transcript_cnot_swapped

- **Misconception ID**: `cnot-control-target-swapped`
- **Validation Failures**: 0

## Dialogue Transcript

### Turn 1 [QUESTION | Level 1 | Path: template]
**Student**: I thought qubit 1 was the control, so qubit 0 would stay unchanged.

**Mario**: Mario: Notice how the quantum transformation affects state probabilities.

*Metadata*: Facts Used: `[{'source': 'student_prediction', 'probabilities': {'00': 1.0}}, {'source': 'circuit_simulator', 'probabilities': {'00': 0.0, '01': 0.0, '10': 0.0, '11': 1.0}}]` | Validator: `PASS`

### Turn 2 [RESOLVED | Level 1 | Path: template]
**Student**: Now I see qubit 0 controls qubit 1, giving |11> with probability 1.

**Mario**: Mario: Spot on! Your quantum state prediction matches the simulator perfectly.

*Metadata*: Facts Used: `[{'source': 'student_prediction', 'probabilities': {'11': 1.0}}, {'source': 'circuit_simulator', 'probabilities': {'00': 0.0, '01': 0.0, '10': 0.0, '11': 1.0}}]` | Validator: `PASS`

