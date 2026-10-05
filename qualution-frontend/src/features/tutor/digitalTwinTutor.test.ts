import { describe, it, expect } from 'vitest';
import { generateDigitalTwinTutorExplanation } from './digitalTwinTutor';
import type { CircuitRequest } from '../circuit/types';
import type {
  DigitalTwinBackendGateError,
  DigitalTwinBackendQubitProperty,
} from '../circuit/digitalTwinTypes';

describe('Digital Twin AI Tutor Explanation (Task 4)', () => {
  const mockQubitProps: DigitalTwinBackendQubitProperty[] = [
    { qubit: 0, t1_us: 131.53, t2_us: 102.20, frequency_ghz: 4.962 },
    { qubit: 1, t1_us: 124.54, t2_us: 79.01, frequency_ghz: 4.838 },
    { qubit: 2, t1_us: 158.62, t2_us: 25.15, frequency_ghz: 5.037 },
  ];

  const mockGateErrors: DigitalTwinBackendGateError[] = [
    { gate: 'cx', qubits: [0, 1], error: 0.0088277, duration_ns: 277.33 },
    { gate: 'cx', qubits: [1, 2], error: 0.0139404, duration_ns: 469.33 },
  ];

  it('generates accurate single sentence for adjacent two-qubit gate using real calibrated error', () => {
    const circuit: CircuitRequest = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { gate: 'h', targets: [0], column: 0 },
        { gate: 'cx', targets: [0, 1], column: 1 },
      ],
      measure: true,
      shots: 1000,
    };

    const explanation = generateDigitalTwinTutorExplanation({
      backendDisplayName: 'FakeManilaV2',
      fidelity: 0.9458,
      fidelityLossPercent: 5.42,
      circuit,
      gateErrors: mockGateErrors,
      qubitProperties: mockQubitProps,
    });

    expect(explanation).toContain('On FakeManilaV2, this circuit\'s fidelity drops to 0.95');
    expect(explanation).toContain('largely from the two-qubit gate at qubits 0 and 1');
    expect(explanation).toContain('measured error rate of 0.88%');
  });

  it('generates accurate sentence flagging non-adjacent SWAP routing overhead', () => {
    const circuit: CircuitRequest = {
      qubits: 3,
      classical_bits: 3,
      gates: [
        { gate: 'h', targets: [0], column: 0 },
        { gate: 'cx', targets: [0, 2], column: 1 }, // Non-adjacent on Manila!
      ],
      measure: true,
      shots: 1000,
    };

    const explanation = generateDigitalTwinTutorExplanation({
      backendDisplayName: 'FakeManilaV2',
      fidelity: 0.9124,
      fidelityLossPercent: 8.76,
      circuit,
      gateErrors: mockGateErrors,
      qubitProperties: mockQubitProps,
    });

    expect(explanation).toContain('On FakeManilaV2, this circuit\'s fidelity drops to 0.91');
    expect(explanation).toContain('non-adjacent two-qubit gate at qubits 0 and 2 requiring SWAP routing');
    expect(explanation).toContain('8.8% loss');
  });

  it('generates decoherence explanation when circuit contains only single-qubit gates', () => {
    const circuit: CircuitRequest = {
      qubits: 1,
      classical_bits: 1,
      gates: [{ gate: 'h', targets: [0], column: 0 }],
      measure: true,
      shots: 1000,
    };

    const explanation = generateDigitalTwinTutorExplanation({
      backendDisplayName: 'FakeManilaV2',
      fidelity: 0.985,
      fidelityLossPercent: 1.5,
      circuit,
      gateErrors: mockGateErrors,
      qubitProperties: mockQubitProps,
    });

    expect(explanation).toContain('On FakeManilaV2');
    expect(explanation).toContain('decoherence');
    expect(explanation).toContain('qubit 2'); // qubit 2 has lowest T2 (25.1µs)
    expect(explanation).toContain('25.1µs');
  });
});
