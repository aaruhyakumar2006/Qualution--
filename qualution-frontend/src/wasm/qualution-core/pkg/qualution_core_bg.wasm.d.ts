/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const add: (a: number, b: number) => number;
export const compute_distribution_fidelity: (a: any, b: any) => [number, number, number];
export const estimate_statevector_memory: (a: number) => number;
export const get_default_safe_statevector_qubit_ceiling: () => number;
export const get_safe_statevector_qubit_threshold: (a: number, b: number) => number;
export const init_panic_hook: () => void;
export const is_clifford_compatible: (a: any) => number;
export const roundtrip_circuit_test: (a: any) => [number, number, number];
export const simulate_stabilizer_circuit: (a: any, b: number) => [number, number, number];
export const simulate_statevector_circuit: (a: any, b: number) => [number, number, number];
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;
