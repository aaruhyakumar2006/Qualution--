/**
 * digitalTwinEngine.ts
 *
 * Dual-Engine Classical State Fidelity Calculator for Digital Twin Benchmarks.
 * Evaluates Bhattacharyya coefficient squared over ideal vs hardware-calibrated noisy distributions:
 * F = (sum_{x} sqrt(P_ideal(x) * P_noisy(x)))^2
 *
 * Architecture:
 * - Primary: Rust WebAssembly (pkg/qualution_core)
 * - Fallback: Pure TypeScript implementation
 * - Transparent `computed_by` tag indicating which engine executed
 */

import type { DigitalTwinFidelityResult } from './digitalTwinTypes';
import { isWasmAvailable, computeFidelityViaWasm } from './wasmManager';

/**
 * Pure TypeScript implementation of classical distribution fidelity:
 * F = (sum_{x} sqrt(P_ideal(x) * P_noisy(x)))^2
 */
export function computeDistributionFidelityTs(
  ideal: Record<string, number>,
  noisy: Record<string, number>
): number {
  if (!ideal || !noisy) {
    return 0.0;
  }

  const idealKeys = Object.keys(ideal);
  const noisyKeys = Object.keys(noisy);

  if (idealKeys.length === 0 || noisyKeys.length === 0) {
    return 0.0;
  }

  let overlapSum = 0.0;

  // Iterate through the keys of the smaller object for optimal efficiency
  const [primary, secondary] =
    idealKeys.length <= noisyKeys.length ? [ideal, noisy] : [noisy, ideal];

  for (const outcome in primary) {
    const p1 = primary[outcome];
    const p2 = secondary[outcome];
    if (p1 !== undefined && p2 !== undefined && p1 > 0.0 && p2 > 0.0) {
      overlapSum += Math.sqrt(p1 * p2);
    }
  }

  const fidelity = overlapSum * overlapSum;
  // Numerical clamp to strict [0.0, 1.0] interval
  return Math.max(0.0, Math.min(1.0, fidelity));
}

/**
 * Direct invocation of the Rust/WASM implementation.
 * Throws if WebAssembly is not available.
 */
export function computeDistributionFidelityWasm(
  ideal: Record<string, number>,
  noisy: Record<string, number>
): number {
  const f = computeFidelityViaWasm(ideal, noisy);
  return Math.max(0.0, Math.min(1.0, f));
}

/**
 * Default export: pure numeric fidelity calculator (Task 1 contract)
 */
export const computeDistributionFidelity = computeDistributionFidelityTs;

/**
 * Dual-engine fidelity calculator with automatic WASM-first fallback dispatching.
 *
 * Pattern:
 * 1. Checks `isWasmAvailable()` via the shared WasmManager.
 * 2. If available, computes via the compiled Rust WebAssembly core and tags `computed_by: 'rust'`.
 * 3. If WASM is unavailable, throws, or is disabled, gracefully falls back to TypeScript,
 *    logs a dev-console warning, and tags `computed_by: 'typescript'`.
 */
export function evaluateDistributionFidelity(
  ideal: Record<string, number>,
  noisy: Record<string, number>
): DigitalTwinFidelityResult {
  // Attempt Rust/WASM first if available
  if (isWasmAvailable()) {
    try {
      const fidelity = computeDistributionFidelityWasm(ideal, noisy);
      const fidelityLossPercent = Math.max(0.0, Math.min(100.0, (1.0 - fidelity) * 100.0));
      return {
        fidelity,
        fidelity_loss_percent: Number(fidelityLossPercent.toFixed(4)),
        computed_by: 'rust',
      };
    } catch (wasmErr) {
      console.warn(
        '[WasmManager] WebAssembly compute_distribution_fidelity failed during execution. Fallback to TypeScript execution engaged:',
        wasmErr
      );
    }
  }

  // Fallback: TypeScript execution
  const fidelity = computeDistributionFidelityTs(ideal, noisy);
  const fidelityLossPercent = Math.max(0.0, Math.min(100.0, (1.0 - fidelity) * 100.0));

  return {
    fidelity,
    fidelity_loss_percent: Number(fidelityLossPercent.toFixed(4)),
    computed_by: 'typescript',
  };
}
