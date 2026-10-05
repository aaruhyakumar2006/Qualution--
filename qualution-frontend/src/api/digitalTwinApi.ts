/**
 * Standalone Digital Twin API Client
 */
import type { CircuitRequest } from '../features/circuit/types';
import type { DigitalTwinBackendResponse } from '../features/circuit/digitalTwinTypes';

const API_BASE_URL = (typeof process !== 'undefined' && (process.env as any)?.VITE_API_URL) || 'http://127.0.0.1:8000';

export async function runDigitalTwinSimulation(
  circuit: CircuitRequest,
  backendName: string = 'fake_manila'
): Promise<DigitalTwinBackendResponse> {
  const payload = {
    qubits: circuit.qubits,
    classical_bits: circuit.classical_bits,
    gates: (circuit.gates || []).map((g, idx) => ({
      id: g.id || `g_${idx}`,
      type: (g as any).type || g.gate,
      targets: g.targets,
      column: g.column ?? idx,
      angle: g.angle,
    })),
    measurements: (circuit.gates || [])
      .filter((g) => ((g as any).type || g.gate || '').toLowerCase() === 'measure')
      .map((g) => ({ qubit: g.targets[0], classical_bit: g.targets[0] })),
    measure: circuit.measure ?? true,
    shots: circuit.shots || 1000,
  };

  const response = await fetch(
    `${API_BASE_URL}/simulate/digital-twin?backend_name=${encodeURIComponent(backendName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Digital Twin API error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as DigitalTwinBackendResponse;
}
