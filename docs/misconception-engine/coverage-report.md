# QUALUTION Misconception Engine - Coverage Report

## Overview
This coverage report evaluates whether each CircuitIR mutation produces a measurably distinct quantum probability distribution or basis state signature (TVD > 0.05 across Z-basis, H-probe, Y-probe, or state fidelity) when applied to checkpoint circuits across lessons.

All 13 registered mutations are evaluated per circuit. In all rows, `Diagnosable + Indistinguishable = 13`.

## Summary Table: Lessons x Concepts x Diagnosable Misconceptions

| Lesson / Checkpoint Circuit | Real Lesson ID | Target Concepts | Diagnosable Mutations (Before -> After) | Indistinguishable Count | Total Mutations | Primary Separating Metrics |
| --- | --- | --- | --- | --- | --- | --- |
| `Hadamard Superposition (|0> -> |+>)` | `superposition-checkpoint-1` | `hadamard_gate, superposition, measurement_collapse` | **3 -> 3** | 10 | TVD (Z-basis) |
| `Two Hadamard Interference (H-H |0>)` | `superposition-checkpoint-2` | `hadamard_gate, quantum_interference` | **1 -> 4** | 9 | TVD (Z-basis), H-probe |
| `Bell State Entanglement (H-CX)` | `grover-oracle` | `cnot_gate, entanglement` | **5 -> 5** | 8 | TVD (Z-basis) |
| `2-Qubit Grover Superposition (H-H)` | `grover-step-1` | `multi_qubit_systems, hadamard_gate` | **3 -> 3** | 10 | TVD (Z-basis) |
| `2-Qubit Grover Oracle (H-H-CZ)` | `grover-step-3` | `oracle, phase_kickback, phase` | **1 -> 5** | 8 | TVD (0.75), H-probe (0.75), Y-probe (1.00) |
| `Full 2-Qubit Grover Circuit` | `grover-run` | `grovers_search, oracle, diffuser` | **4 -> 7** | 6 | TVD (1.00/0.75), H-probe (0.75) |

## Detailed Sweep Results Across Real Lesson Circuits

### 1. Hadamard Superposition (`H|0>`) [Lesson: `superposition-checkpoint-1`]
- Circuit: `H(0)`
- Total mutations evaluated: 13 (3 Diagnosable, 10 Indistinguishable / Not Applicable)
- Diagnosable: `replace_h_with_x` (TVD 0.50), `drop_gate` (TVD 0.50), `wrong_grover_iteration_count` (TVD 0.50).

### 2. Two Hadamard Interference (`H-H |0>`) [Lesson: `superposition-checkpoint-2`]
- Circuit: `H(0) -> H(0)`
- Total mutations evaluated: 13 (4 Diagnosable, 9 Indistinguishable / Not Applicable)
- Diagnosable: `drop_gate` (TVD 0.50), `replace_h_with_x` (H-probe 0.50), `h_is_classical_mixture` (TVD 0.50), `replace_x_with_h` (H-probe 0.50).

### 3. Bell State Entanglement (`H-CX`) [Lesson: `grover-oracle`]
- Circuit: `H(0) -> CX(0, 1)`
- Total mutations evaluated: 13 (5 Diagnosable, 8 Indistinguishable / Not Applicable)
- Diagnosable: `swap_cnot_control_target` (TVD 0.50), `replace_h_with_x` (TVD 0.50), `drop_gate` (TVD 0.50), `wrong_grover_iteration_count` (TVD 0.50), `cnot_copies_state_product` (TVD 0.50).

### 4. 2-Qubit Grover Superposition (`H-H`) [Lesson: `grover-step-1`]
- Circuit: `H(0) -> H(1)`
- Total mutations evaluated: 13 (3 Diagnosable, 10 Indistinguishable / Not Applicable)
- Diagnosable: `replace_h_with_x` (TVD 0.75), `drop_gate` (TVD 0.50), `wrong_grover_iteration_count` (TVD 0.75).

### 5. 2-Qubit Grover Oracle (`H-H-CZ`) [Lesson: `grover-step-3`]
- Circuit: `H(0) -> H(1) -> CZ(0, 1)`
- Total mutations evaluated: 13 (5 Diagnosable, 8 Indistinguishable / Not Applicable)
- Diagnosable: `replace_h_with_x` (TVD 0.75), `drop_gate` (H-probe 0.50), `wrong_grover_oracle_marked_state` (Y-probe 1.00), `wrong_grover_iteration_count` (H-probe 0.75), `replace_cz_with_cx` (H-probe 0.75).

### 6. Full 2-Qubit Grover Circuit (`H-H-CZ-H-H-X-X-CZ-X-X-H-H`) [Lesson: `grover-run`]
- Circuit: `H(0)H(1) -> CZ(0,1) -> H(0)H(1)X(0)X(1)CZ(0,1)X(0)X(1)H(0)H(1)`
- Total mutations evaluated: 13 (7 Diagnosable, 6 Indistinguishable / Not Applicable)
- Diagnosable: `replace_h_with_x` (H-probe 0.75), `replace_x_with_h` (TVD 0.75), `drop_gate` (TVD 0.50), `wrong_grover_oracle_marked_state` (TVD 1.00), `wrong_grover_iteration_count` (TVD 0.75), `h_is_classical_mixture` (TVD 0.75), `replace_cz_with_cx` (TVD 0.75).