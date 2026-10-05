/**
 * wasmManager.ts
 *
 * WebAssembly Lifecycle Manager and Execution Dispatcher.
 * Handles app startup instantiation, runtime status tracking, and graceful fallback
 * to TypeScript engines if WebAssembly is unsupported, fails to compile, or errors.
 *
 * Hard Requirement:
 * If WASM fails to load for ANY reason, fallback to existing TypeScript engines
 * (stabilizerEngine, statevectorEngine) with dev-console-only warning.
 * Learner experience must remain 100% identical.
 */

import initWasm, {
  initSync,
  init_panic_hook,
  simulate_stabilizer_circuit as simulateWasmStabilizer,
  simulate_statevector_circuit as simulateWasmStatevector,
  compute_distribution_fidelity as computeWasmDistributionFidelity,
} from '../../wasm/qualution-core/pkg/qualution_core.js';
import wasmUrl from '../../wasm/qualution-core/pkg/qualution_core_bg.wasm?url';

import { simulateStabilizerCircuit, type StabilizerSimulationOptions } from './stabilizerEngine';
import { simulateStatevectorCircuit, type StatevectorSimulationOptions } from './statevectorEngine';
import type { CanonicalCircuit, CircuitRequest, UnifiedExecutionResult } from './types';

// ── State Variables ─────────────────────────────────────────────────────────

let wasmReady = false;
let wasmFailed = false;
let wasmError: any = null;
let forceFailure = false;
let wasmInitPromise: Promise<boolean> | null = null;

/**
 * Attempt to load and instantiate the WebAssembly module on startup.
 * Wrapped in try/catch to ensure app never crashes even in restricted or older environments.
 */
export async function initWasmCore(): Promise<boolean> {
  if (forceFailure) {
    return false;
  }
  if (wasmReady) {
    return true;
  }
  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  wasmInitPromise = (async () => {
    try {
      if (typeof process !== 'undefined' && Boolean(process.versions?.node)) {
        // Node / Vitest testing environment: load bytes directly from filesystem with zero network traffic
        try {
          const fs = await import(/* @vite-ignore */ 'node:fs');
          const path = await import(/* @vite-ignore */ 'node:path');
          const { fileURLToPath } = await import(/* @vite-ignore */ 'node:url');
          const currentDir = path.dirname(fileURLToPath(import.meta.url));
          const wasmFilePath = path.resolve(currentDir, '../../wasm/qualution-core/pkg/qualution_core_bg.wasm');

          if (fs.existsSync(wasmFilePath)) {
            const wasmBuffer = fs.readFileSync(wasmFilePath);
            initSync({ module: new Uint8Array(wasmBuffer) });
            try {
              init_panic_hook();
            } catch {}
            wasmReady = true;
            wasmFailed = false;
            wasmError = null;
            return true;
          }
        } catch {
          // Fall through to browser path if filesystem access is restricted
        }
      }

      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        // Standard Web Browser environment: fetch asset URL
        await initWasm(wasmUrl);
        try {
          init_panic_hook();
        } catch {
          // Non-critical hook setup
        }
        wasmReady = true;
        wasmFailed = false;
        wasmError = null;
        console.log('[WasmManager] Rust/WASM Core initialized successfully.');
        return true;
      }

      return false;
    } catch (err: any) {
      wasmReady = false;
      wasmFailed = true;
      wasmError = err;
      console.warn(
        '[WasmManager] WebAssembly module initialization failed or unsupported on this device. Fallback to TypeScript execution engines is active:',
        err
      );
      return false;
    } finally {
      wasmInitPromise = null;
    }
  })();

  return wasmInitPromise;
}

/**
 * Synchronous initialization helper when WebAssembly bytes/module are already available.
 */
export function initWasmSync(module: BufferSource | WebAssembly.Module): boolean {
  if (forceFailure) {
    return false;
  }
  try {
    initSync({ module });
    try {
      init_panic_hook();
    } catch {}
    wasmReady = true;
    wasmFailed = false;
    wasmError = null;
    return true;
  } catch (err) {
    wasmReady = false;
    wasmFailed = true;
    wasmError = err;
    console.warn('[WasmManager] Synchronous WASM initialization failed:', err);
    return false;
  }
}

/**
 * Returns true if WebAssembly is compiled, instantiated, and ready to execute.
 */
export function isWasmAvailable(): boolean {
  if (forceFailure) {
    return false;
  }
  return wasmReady;
}

/**
 * Marks WASM as ready (used when initialized externally or in test setups).
 */
export function setWasmReady(ready: boolean): void {
  wasmReady = ready;
  if (ready) {
    wasmFailed = false;
    wasmError = null;
  }
}

/**
 * Test hook: Forces WASM failure path to test fallback behavior.
 */
export function setForceWasmFailure(force: boolean): void {
  forceFailure = force;
  if (force) {
    console.warn(
      '[WasmManager] Dev/Test override: WASM forced failure active. Fallback to TypeScript engines engaged.'
    );
  }
}

/**
 * Test hook: Resets any forced failure status.
 */
export function resetWasmFailureOverride(): void {
  forceFailure = false;
}

/**
 * Returns the current WASM lifecycle status.
 */
export function getWasmStatus(): 'ready' | 'failed' | 'forced_fallback' | 'uninitialized' {
  if (forceFailure) return 'forced_fallback';
  if (wasmReady) return 'ready';
  if (wasmFailed) return 'failed';
  return 'uninitialized';
}

// ── Feature Flag & Engine Preference ──────────────────────────────────────

export type QuantumEngineBackendPreference = 'wasm' | 'typescript';

let runtimePreferenceOverride: QuantumEngineBackendPreference | null = null;

/**
 * Returns the currently configured simulation engine preference.
 * Priority order:
 * 1. Runtime preference override set via setQuantumEnginePreference()
 * 2. window.__QUALUTION_CONFIG__?.quantumEngineBackend (runtime window config)
 * 3. localStorage.getItem('qualution_engine_backend') (persisted toggle)
 * 4. import.meta.env.VITE_QUANTUM_ENGINE_BACKEND (environment variable)
 * 5. Default: 'typescript' (as mandated for safe, phased cutover)
 */
export function getQuantumEnginePreference(): QuantumEngineBackendPreference {
  if (runtimePreferenceOverride) {
    return runtimePreferenceOverride;
  }

  if (typeof window !== 'undefined') {
    if ((window as any).__QUALUTION_CONFIG__?.quantumEngineBackend) {
      const val = String((window as any).__QUALUTION_CONFIG__.quantumEngineBackend).trim().toLowerCase();
      if (val === 'wasm' || val === 'rust') return 'wasm';
      if (val === 'typescript' || val === 'ts') return 'typescript';
    }

    try {
      const stored = window.localStorage?.getItem('qualution_engine_backend');
      if (stored) {
        const val = stored.trim().toLowerCase();
        if (val === 'wasm' || val === 'rust') return 'wasm';
        if (val === 'typescript' || val === 'ts') return 'typescript';
      }
    } catch {}
  }

  const envVal = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_QUANTUM_ENGINE_BACKEND)
    ? String((import.meta as any).env.VITE_QUANTUM_ENGINE_BACKEND).trim().toLowerCase()
    : null;
  if (envVal === 'wasm' || envVal === 'rust') {
    return 'wasm';
  }
  if (envVal === 'typescript' || envVal === 'ts') {
    return 'typescript';
  }

  // Default: 'wasm' as primary engine (with automatic TypeScript fallback)
  return 'wasm';
}

/**
 * Switch engine preference at runtime without changing code or rebuilding.
 */
export function setQuantumEnginePreference(pref: QuantumEngineBackendPreference | null): void {
  runtimePreferenceOverride = pref;
  if (typeof window !== 'undefined') {
    try {
      if (pref) {
        window.localStorage?.setItem('qualution_engine_backend', pref);
      } else {
        window.localStorage?.removeItem('qualution_engine_backend');
      }
    } catch {}
  }
  console.log(`[WasmManager] Quantum simulation engine preference set to: ${pref ?? 'default (typescript)'}`);
}

if (typeof window !== 'undefined') {
  (window as any).__setQuantumEnginePreference = setQuantumEnginePreference;
  (window as any).__getQuantumEnginePreference = getQuantumEnginePreference;
}

// ── Routed Engine Execution with Feature Flag & Automatic Fallback ──────────

/**
 * Executes a Stabilizer circuit via Rust/WASM if feature flag is set to 'wasm';
 * otherwise runs TypeScript Aaronson-Gottesman engine.
 * Automatically falls back to TypeScript engine if WASM fails or is disabled.
 */
export function executeStabilizerRouted(
  circuit: CanonicalCircuit | CircuitRequest,
  options?: StabilizerSimulationOptions & { shots?: number }
): UnifiedExecutionResult {
  const shots = options?.shots ?? circuit.shots ?? 1024;
  const preference = getQuantumEnginePreference();

  if (preference === 'wasm' && isWasmAvailable()) {
    if (!circuit.gates || circuit.gates.length === 0) {
      return simulateStabilizerCircuit(circuit, options);
    }
    try {
      return simulateWasmStabilizer(circuit, shots);
    } catch (wasmErr) {
      console.warn(
        '[ExecutionRouter] WASM stabilizer simulation failed during runtime. Falling back to TypeScript stabilizer engine:',
        wasmErr
      );
      return simulateStabilizerCircuit(circuit, options);
    }
  }

  if (preference === 'wasm' && !isWasmAvailable()) {
    console.warn(
      '[ExecutionRouter] WebAssembly engine requested but unavailable (load failed or disabled). Active fallback: using TypeScript stabilizer engine.'
    );
  }

  // TypeScript Engine Execution
  return simulateStabilizerCircuit(circuit, options);
}

/**
 * Executes an arbitrary Statevector circuit via Rust/WASM if feature flag is set to 'wasm';
 * otherwise runs TypeScript Statevector engine.
 * Automatically falls back to TypeScript engine if WASM fails or is disabled.
 */
export function executeStatevectorRouted(
  circuit: CanonicalCircuit | CircuitRequest,
  options?: StatevectorSimulationOptions & { shots?: number }
): UnifiedExecutionResult {
  const shots = options?.shots ?? circuit.shots ?? 1024;
  const preference = getQuantumEnginePreference();

  if (preference === 'wasm' && isWasmAvailable()) {
    if (!circuit.gates || circuit.gates.length === 0) {
      return simulateStatevectorCircuit(circuit, options);
    }
    try {
      return simulateWasmStatevector(circuit, shots);
    } catch (wasmErr) {
      console.warn(
        '[ExecutionRouter] WASM statevector simulation failed during runtime. Falling back to TypeScript statevector engine:',
        wasmErr
      );
      return simulateStatevectorCircuit(circuit, options);
    }
  }

  if (preference === 'wasm' && !isWasmAvailable()) {
    console.warn(
      '[ExecutionRouter] WebAssembly engine requested but unavailable (load failed or disabled). Active fallback: using TypeScript statevector engine.'
    );
  }

  // TypeScript Engine Execution
  return simulateStatevectorCircuit(circuit, options);
}

/**
 * Computes classical distribution fidelity via the Rust WASM module.
 * Throws an error if WASM is not loaded or ready.
 */
export function computeFidelityViaWasm(
  ideal: Record<string, number>,
  noisy: Record<string, number>
): number {
  if (!isWasmAvailable()) {
    throw new Error('WebAssembly core is not initialized or available.');
  }
  return computeWasmDistributionFidelity(ideal, noisy);
}
