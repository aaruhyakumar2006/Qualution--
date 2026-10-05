/**
 * statevectorWorker.ts
 *
 * Dedicated Web Worker runner for non-blocking statevector circuit simulation.
 * Uses high-performance Rust/WASM full-statevector engine with graceful fallback
 * to TypeScript simulation.
 * Reuses the strict resource guard (<=20 qubits) before dispatching to WASM.
 */

import {
  simulateStatevectorCircuit,
  type StatevectorSimulationOptions,
  estimateStatevectorMemory,
  getSafeStatevectorQubitThreshold,
} from './statevectorEngine';
import type { CanonicalCircuit, CircuitRequest, UnifiedExecutionResult } from './types';
import initWasm, {
  simulate_statevector_circuit as simulateWasmStatevector,
} from '../../wasm/qualution-core/pkg/qualution_core.js';
import wasmUrl from '../../wasm/qualution-core/pkg/qualution_core_bg.wasm?url';

export interface StatevectorWorkerRequest {
  id: string;
  circuit: CanonicalCircuit | CircuitRequest;
  options?: StatevectorSimulationOptions & { useWasm?: boolean };
}

export interface StatevectorWorkerResponse {
  id: string;
  result?: UnifiedExecutionResult;
  error?: string;
}

let wasmInitPromise: Promise<any> | null = null;
async function ensureWasmReady() {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(wasmUrl);
  }
  return wasmInitPromise;
}

// ── Web Worker Script Entry Point ─────────────────────────────────────────
if (typeof self !== 'undefined' && typeof (self as any).importScripts !== 'undefined') {
  self.onmessage = async (event: MessageEvent<StatevectorWorkerRequest>) => {
    const { id, circuit, options } = event.data;
    try {
      // 1. Enforce Resource Guard in worker before calling WASM
      const numQubits = circuit.qubits;
      const safeCap = getSafeStatevectorQubitThreshold();
      if (numQubits > safeCap) {
        const memoryMb = (estimateStatevectorMemory(numQubits) / (1024 * 1024)).toFixed(1);
        throw new Error(
          `Statevector simulation exceeds safe client memory limits for ${numQubits} qubits (requires ~${memoryMb} MB statevector RAM; safe threshold is ${safeCap} qubits). Use stabilizer or remote cloud execution.`
        );
      }

      let result: UnifiedExecutionResult;
      const shots = options?.shots ?? circuit.shots ?? 1024;

      try {
        await ensureWasmReady();
        result = simulateWasmStatevector(circuit, shots);
      } catch (wasmErr) {
        console.warn(
          '[StatevectorWorker] Rust/WASM execution failed or unavailable, falling back to TypeScript engine:',
          wasmErr
        );
        result = simulateStatevectorCircuit(circuit, options);
      }

      self.postMessage({ id, result } satisfies StatevectorWorkerResponse);
    } catch (err: any) {
      self.postMessage({
        id,
        error: err?.message || String(err),
      } satisfies StatevectorWorkerResponse);
    }
  };
}

// ── Web Worker Client Invoker ─────────────────────────────────────────────

let sharedWorker: Worker | null = null;
const pendingRequests = new Map<
  string,
  {
    resolve: (res: UnifiedExecutionResult) => void;
    reject: (err: Error) => void;
  }
>();

function getOrCreateWorker(): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return null;
  }

  if (!sharedWorker) {
    try {
      sharedWorker = new Worker(new URL('./statevectorWorker.ts', import.meta.url), {
        type: 'module',
      });

      sharedWorker.onmessage = (event: MessageEvent<StatevectorWorkerResponse>) => {
        const { id, result, error } = event.data;
        const pending = pendingRequests.get(id);
        if (pending) {
          pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else if (result) {
            pending.resolve(result);
          }
        }
      };

      sharedWorker.onerror = (err) => {
        console.warn('[StatevectorWorker] Worker error encountered, falling back to direct:', err);
        for (const [id, pending] of pendingRequests.entries()) {
          pending.reject(new Error(`Worker error: ${err.message}`));
          pendingRequests.delete(id);
        }
        sharedWorker?.terminate();
        sharedWorker = null;
      };
    } catch (e) {
      console.warn('[StatevectorWorker] Could not instantiate Web Worker:', e);
      return null;
    }
  }

  return sharedWorker;
}

/**
 * Executes an arbitrary quantum circuit inside a Web Worker using Rust/WASM statevector engine.
 * Enforces the <= 20 qubit memory ceiling upfront before worker dispatch.
 */
export async function runStatevectorInWorker(
  circuit: CanonicalCircuit | CircuitRequest,
  options: StatevectorSimulationOptions & { useWasm?: boolean } = {}
): Promise<UnifiedExecutionResult> {
  // Pre-dispatch resource guard check
  const numQubits = circuit.qubits;
  const safeCap = getSafeStatevectorQubitThreshold();
  if (numQubits > safeCap) {
    const memoryMb = (estimateStatevectorMemory(numQubits) / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Statevector simulation exceeds safe client memory limits for ${numQubits} qubits (requires ~${memoryMb} MB statevector RAM; safe threshold is ${safeCap} qubits). Use stabilizer or remote cloud execution.`
    );
  }

  const worker = getOrCreateWorker();

  if (!worker) {
    // Graceful direct fallback
    try {
      await ensureWasmReady();
      const shots = options.shots ?? circuit.shots ?? 1024;
      return simulateWasmStatevector(circuit, shots);
    } catch {
      return simulateStatevectorCircuit(circuit, options);
    }
  }

  const id = `sv-sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  return new Promise<UnifiedExecutionResult>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, circuit, options } satisfies StatevectorWorkerRequest);
  });
}
