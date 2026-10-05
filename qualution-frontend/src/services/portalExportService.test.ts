import { describe, it, expect } from 'vitest';
import {
  generateMarkdownBrief,
  generateJsonBrief,
  generateBibtexCitations,
  generateHtmlDigest,
  type ExportableSignal,
} from './portalExportService';

describe('Portal Research Brief Exporter Service (Phase 7)', () => {
  const mockSignals: ExportableSignal[] = [
    {
      id: 'sig-01',
      title: 'Google Willow Quantum Processor Reaches Below-Threshold Error Rates',
      source: 'Nature Quantum',
      source_tier: 1,
      section: 'research',
      published_at: '2026-09-15T08:00:00Z',
      canonical_url: 'https://nature.com/articles/s41586-026-001',
      summary: 'Demonstrates exponential suppression of physical errors with scaling surface code distance.',
      abstract: 'We report experimental operation of a 105-qubit planar superconducting processor...',
      level: 'Advanced',
      tags: ['Error Correction', 'Surface Codes', 'Superconducting'],
      curriculum_tags: ['Error Correction'],
      author_display_name: 'Google Quantum AI Team',
      circuit_qasm: 'OPENQASM 2.0;\nqreg q[2];\nh q[0];\ncx q[0], q[1];',
    },
    {
      id: 'sig-02',
      title: 'IBM Condor-2 Modular Architecture Road-Test',
      source: 'IBM Research',
      source_tier: 1,
      section: 'hardware',
      published_at: '2026-08-20T12:00:00Z',
      canonical_url: 'https://research.ibm.com/blog/condor-2-telemetry',
      summary: 'Cross-chip coupler fidelities reach 99.4% in multi-chassis cryostat configurations.',
      tags: ['Modular Quantum', 'Cryogenics'],
    },
  ];

  it('generates structured Markdown research brief with metadata, summaries, and QASM code blocks', () => {
    const md = generateMarkdownBrief('Fault-Tolerant Architectures', mockSignals);

    expect(md).toContain('# QUALUTION Quantum Telemetry Research Brief');
    expect(md).toContain('**Collection:** Fault-Tolerant Architectures');
    expect(md).toContain('1. Google Willow Quantum Processor Reaches Below-Threshold Error Rates');
    expect(md).toContain('`[Advanced]`');
    expect(md).toContain('`⚛ Error Correction`');
    expect(md).toContain('```qasm\nOPENQASM 2.0;');
    expect(md).toContain('## References & Direct Citations');
    expect(md).toContain('Google Quantum AI Team (2026)');
  });

  it('generates standard BibTeX citations with clean keys and metadata', () => {
    const bib = generateBibtexCitations(mockSignals);

    expect(bib).toContain('@misc{qualution_naturequantum_2026_1');
    expect(bib).toContain('title = {Google Willow Quantum Processor Reaches Below-Threshold Error Rates}');
    expect(bib).toContain('author = {Google Quantum AI Team}');
    expect(bib).toContain('\\url{https://nature.com/articles/s41586-026-001}');
    expect(bib).toContain('@misc{qualution_ibmresearch_2026_2');
  });

  it('generates valid JSON brief dataset with all signal attributes', () => {
    const jsonStr = generateJsonBrief('Hardware Benchmarks', mockSignals);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.brief_title).toBe('QUALUTION Telemetry Brief: Hardware Benchmarks');
    expect(parsed.signal_count).toBe(2);
    expect(parsed.signals[0].title).toContain('Google Willow');
    expect(parsed.signals[0].circuit_qasm).toContain('OPENQASM 2.0');
    expect(parsed.signals[1].source).toBe('IBM Research');
  });

  it('generates standalone printable HTML digest document', () => {
    const html = generateHtmlDigest('Curated Digest', mockSignals);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>QUALUTION Research Digest — Curated Digest</title>');
    expect(html).toContain('Google Willow Quantum Processor Reaches Below-Threshold Error Rates');
    expect(html).toContain('tag tag-curric">⚛ Error Correction</span>');
    expect(html).toContain('https://nature.com/articles/s41586-026-001');
  });
});
