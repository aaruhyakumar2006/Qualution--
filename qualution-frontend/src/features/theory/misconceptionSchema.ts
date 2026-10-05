import { GateRequest } from './types';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ProbeCircuit {
  qubits: number;
  classical_bits?: number;
  gates: GateRequest[];
  measure?: boolean;
  shots?: number;
}

export interface RemediationExperiment {
  title: string;
  description: string;
  comparison_circuit?: ProbeCircuit;
}

export interface MisconceptionCatalogEntry {
  id: string;
  concept_ids: string[];
  name: string;
  faulty_rule: string;
  mutation_ref: string;
  probe_circuits: ProbeCircuit[];
  student_prompt_template: string;
  hint_ladder: [string, string, string, string]; // exactly 4 levels
  remediation_experiment: RemediationExperiment;
  severity: SeverityLevel;
}

export interface MisconceptionCatalog {
  version: string;
  entries: MisconceptionCatalogEntry[];
}
