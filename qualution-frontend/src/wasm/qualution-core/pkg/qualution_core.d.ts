/* tslint:disable */
/* eslint-disable */

export function add(a: number, b: number): number;

/**
 * WASM-exported classical distribution fidelity calculation.
 * Accepts ideal and noisy probability maps as JsValue (JS Objects) and returns the fidelity as f64.
 */
export function compute_distribution_fidelity(ideal_json: any, noisy_json: any): number;

/**
 * Calculates estimated memory in bytes required for a statevector of n qubits:
 * 2^n amplitudes * 16 bytes (complex128: Float64 real + Float64 imag).
 * Caps at f64::MAX (equivalent to Number.MAX_VALUE) when exceeding 1020 exponent limits.
 */
export function estimate_statevector_memory(qubit_count: number): number;

export function get_default_safe_statevector_qubit_ceiling(): number;

/**
 * Evaluates the safe client-side statevector qubit threshold.
 * Uses navigator.deviceMemory (GB) when available to grant a slightly higher threshold
 * on confirmed high-memory hardware, otherwise defaults to the conservative 20-qubit cap.
 */
export function get_safe_statevector_qubit_threshold(device_memory_gb?: number | null): number;

/**
 * Sets up console_error_panic_hook so that Rust panics print full stack traces
 * to the browser/Worker console and surface as catchable JavaScript errors.
 */
export function init_panic_hook(): void;

/**
 * Pure function: Checks if all gates in a circuit belong to the Clifford group.
 * Returns false on the first non-Clifford gate encountered, true otherwise.
 * An empty or missing circuit returns true.
 * Works with both CanonicalCircuit and backend CircuitRequest representations.
 */
export function is_clifford_compatible(circuit_val: any): boolean;

/**
 * Boundary validation test helper from Phase 2
 */
export function roundtrip_circuit_test(js_circuit: any): any;

/**
 * Simulates a Clifford quantum circuit using the Aaronson-Gottesman stabilizer tableau formalism.
 * Runs in polynomial time O(N^2) gate evolution, ~O(N^3) measurement.
 * Can be invoked directly on the main thread or inside a dedicated Web Worker.
 */
export function simulate_stabilizer_circuit(circuit_json: any, shots_override: number): any;

/**
 * Simulates an arbitrary quantum circuit (including non-Clifford gates like T, Tdg, RX, RY, RZ, Phase)
 * using full-statevector amplitudes in WebAssembly.
 * Strictly capped at <= 20 qubits (~16 MB RAM) to prevent browser memory exhaustion.
 */
export function simulate_statevector_circuit(circuit_json: any, shots_override: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly add: (a: number, b: number) => number;
    readonly compute_distribution_fidelity: (a: any, b: any) => [number, number, number];
    readonly estimate_statevector_memory: (a: number) => number;
    readonly get_default_safe_statevector_qubit_ceiling: () => number;
    readonly get_safe_statevector_qubit_threshold: (a: number, b: number) => number;
    readonly init_panic_hook: () => void;
    readonly is_clifford_compatible: (a: any) => number;
    readonly roundtrip_circuit_test: (a: any) => [number, number, number];
    readonly simulate_stabilizer_circuit: (a: any, b: number) => [number, number, number];
    readonly simulate_statevector_circuit: (a: any, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
