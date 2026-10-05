/**
 * Digital Twin Contracts & Shared Data Types
 *
 * Establishes the contract-first interface between Phase 1's backend output
 * and Phase 3's dual-engine (Rust WASM / TypeScript fallback) fidelity calculation.
 */

/**
 * Shared data contract representing the comparison dataset between ideal simulation
 * and hardware-calibrated noisy execution on an IBM digital twin fake backend.
 * Consumed by the dual-engine fidelity calculation functions.
 */
export interface DigitalTwinComparison {
  ideal_probabilities: Record<string, number>;
  noisy_probabilities: Record<string, number>;
  coupling_map: [number, number][];
  t1_times: number[];
  t2_times: number[];
  two_qubit_error_rates: number[];
  backend_name: string;
}

/**
 * Provenance tag identifying which mathematical engine performed the fidelity calculation.
 * Follows the project's honest transparency principle (akin to ExecutionRouter.routing_reason).
 */
export type DigitalTwinFidelityEngine = 'rust' | 'typescript';

/**
 * Output contract of Phase 3's dual-engine fidelity calculation step.
 */
export interface DigitalTwinFidelityResult {
  fidelity: number;
  fidelity_loss_percent: number;
  computed_by: 'rust' | 'typescript';
}

/** Alias for semantic flexibility across modules */
export type DigitalTwinFidelityOutput = DigitalTwinFidelityResult;

/**
 * Calibrated per-qubit physical parameters from backend hardware snapshot.
 */
export interface DigitalTwinBackendQubitProperty {
  qubit: number;
  t1?: number | null;
  t2?: number | null;
  t1_us?: number | null;
  t2_us?: number | null;
  frequency_ghz?: number | null;
}

/**
 * Calibrated two-qubit gate error parameter from backend hardware snapshot.
 */
export interface DigitalTwinBackendGateError {
  gate: string;
  qubits: [number, number] | number[];
  error: number;
  duration_ns?: number | null;
}

/**
 * Raw JSON response contract from POST /simulate/digital-twin.
 */
export interface DigitalTwinBackendResponse {
  backend_name: string;
  backend_display_name: string;
  qubit_count: number;
  circuit_qubits: number;
  shots: number;
  ideal_probabilities: Record<string, number>;
  noisy_probabilities: Record<string, number>;
  ideal_counts: Record<string, number>;
  noisy_counts: Record<string, number>;
  coupling_map: [number, number][];
  qubit_properties: DigitalTwinBackendQubitProperty[];
  gate_errors: DigitalTwinBackendGateError[];
  runtime_ms: number;
  execution_location: string;
  warnings?: string[] | null;
}
