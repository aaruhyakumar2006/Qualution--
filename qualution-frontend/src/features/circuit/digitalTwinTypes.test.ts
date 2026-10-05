import { describe, it, expect } from 'vitest';
import type {
  DigitalTwinComparison,
  DigitalTwinFidelityResult,
  DigitalTwinFidelityEngine,
} from './types';

describe('Phase 2: Digital Twin Shared Contract Definition', () => {
  it('conforms to DigitalTwinComparison contract shape', () => {
    const comparison: DigitalTwinComparison = {
      ideal_probabilities: { '11': 1.0 },
      noisy_probabilities: { '11': 0.933, '00': 0.007, '01': 0.026, '10': 0.034 },
      coupling_map: [
        [0, 1],
        [1, 0],
        [1, 2],
        [2, 1],
        [2, 3],
        [3, 2],
        [3, 4],
        [4, 3],
      ],
      t1_times: [0.000132, 0.000125, 0.000159, 0.000179, 0.000145],
      t2_times: [0.000102, 0.000079, 0.000025, 0.000054, 0.00004],
      two_qubit_error_rates: [0.0088, 0.0088, 0.0139, 0.0139, 0.0114, 0.0114, 0.0057, 0.0057],
      backend_name: 'fake_manila',
    };

    expect(comparison.ideal_probabilities).toHaveProperty('11', 1.0);
    expect(comparison.noisy_probabilities).toHaveProperty('11', 0.933);
    expect(comparison.coupling_map).toHaveLength(8);
    expect(comparison.t1_times).toHaveLength(5);
    expect(comparison.t2_times).toHaveLength(5);
    expect(comparison.two_qubit_error_rates).toHaveLength(8);
    expect(comparison.backend_name).toBe('fake_manila');
  });

  it('conforms to DigitalTwinFidelityResult contract with honest computed_by tag', () => {
    const rustResult: DigitalTwinFidelityResult = {
      fidelity: 0.9659,
      fidelity_loss_percent: 3.41,
      computed_by: 'rust',
    };

    const tsResult: DigitalTwinFidelityResult = {
      fidelity: 0.9659,
      fidelity_loss_percent: 3.41,
      computed_by: 'typescript',
    };

    expect(rustResult.computed_by).toBe('rust');
    expect(tsResult.computed_by).toBe('typescript');

    const validEngines: DigitalTwinFidelityEngine[] = ['rust', 'typescript'];
    expect(validEngines).toContain(rustResult.computed_by);
    expect(validEngines).toContain(tsResult.computed_by);
  });
});
