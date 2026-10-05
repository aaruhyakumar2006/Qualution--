import { describe, it, expect } from 'vitest';
import { computeDistributionFidelityTs, computeDistributionFidelity } from './digitalTwinEngine';

describe('Phase 3 Task 1: TypeScript Classical Distribution Fidelity', () => {
  it('gives fidelity = 1.0 exactly for two identical distributions', () => {
    // Single state
    expect(computeDistributionFidelity({ '11': 1.0 }, { '11': 1.0 })).toBe(1.0);

    // Uniform superposition over 4 states
    const bellUniform = {
      '00': 0.5,
      '11': 0.5,
    };
    expect(computeDistributionFidelity(bellUniform, bellUniform)).toBe(1.0);

    // 4-state distribution
    const dist4 = {
      '00': 0.25,
      '01': 0.25,
      '10': 0.25,
      '11': 0.25,
    };
    expect(computeDistributionFidelity(dist4, dist4)).toBe(1.0);
  });

  it('gives fidelity = 0.0 exactly for two completely disjoint-support distributions', () => {
    // Pure orthogonality
    const ideal = { '00': 1.0 };
    const noisy = { '11': 1.0 };
    expect(computeDistributionFidelity(ideal, noisy)).toBe(0.0);

    // Multi-state disjoint support
    const idealEven = { '00': 0.5, '10': 0.5 };
    const noisyOdd = { '01': 0.7, '11': 0.3 };
    expect(computeDistributionFidelity(idealEven, noisyOdd)).toBe(0.0);
  });

  it('matches known partial-overlap case computed by hand', () => {
    // Hand-computed Case 1:
    // P_ideal = { '0': 0.5, '1': 0.5 }
    // P_noisy = { '0': 0.8, '1': 0.2 }
    // sqrt(0.5 * 0.8) + sqrt(0.5 * 0.2) = sqrt(0.4) + sqrt(0.1) = 2/sqrt(10) + 1/sqrt(10) = 3/sqrt(10)
    // F = (3/sqrt(10))^2 = 9/10 = 0.9
    const ideal1 = { '0': 0.5, '1': 0.5 };
    const noisy1 = { '0': 0.8, '1': 0.2 };
    const f1 = computeDistributionFidelity(ideal1, noisy1);
    expect(f1).toBeCloseTo(0.9, 10);

    // Hand-computed Case 2:
    // P_ideal = { '0': 1.0, '1': 0.0 }
    // P_noisy = { '0': 0.64, '1': 0.36 }
    // sqrt(1.0 * 0.64) = 0.8
    // F = 0.8^2 = 0.64
    const ideal2 = { '0': 1.0 };
    const noisy2 = { '0': 0.64, '1': 0.36 };
    const f2 = computeDistributionFidelity(ideal2, noisy2);
    expect(f2).toBeCloseTo(0.64, 10);

    // Hand-computed Case 3 (3-state):
    // P_ideal = { '00': 0.36, '01': 0.64 }
    // P_noisy = { '00': 0.49, '01': 0.25, '10': 0.26 }
    // sqrt(0.36 * 0.49) + sqrt(0.64 * 0.25) = (0.6 * 0.7) + (0.8 * 0.5) = 0.42 + 0.40 = 0.82
    // F = 0.82^2 = 0.6724
    const ideal3 = { '00': 0.36, '01': 0.64 };
    const noisy3 = { '00': 0.49, '01': 0.25, '10': 0.26 };
    const f3 = computeDistributionFidelity(ideal3, noisy3);
    expect(f3).toBeCloseTo(0.6724, 10);
  });

  it('handles empty distributions gracefully returning 0.0', () => {
    expect(computeDistributionFidelity({}, {})).toBe(0.0);
    expect(computeDistributionFidelity({ '0': 1.0 }, {})).toBe(0.0);
    expect(computeDistributionFidelity({}, { '1': 1.0 })).toBe(0.0);
  });

  it('accurately evaluates Phase 1 real backend Grover noisy distribution', () => {
    // Real output from Phase 1 test on FakeManilaV2:
    const idealGrover = { '11': 1.0 };
    const noisyGrover = {
      '00': 0.007,
      '01': 0.026,
      '10': 0.034,
      '11': 0.933,
    };
    // sqrt(1.0 * 0.933)^2 = 0.933
    const f = computeDistributionFidelity(idealGrover, noisyGrover);
    expect(f).toBeCloseTo(0.933, 6);
  });
});
