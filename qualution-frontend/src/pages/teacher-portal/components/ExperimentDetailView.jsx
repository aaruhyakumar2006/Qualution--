import React, { useState } from 'react';
import { 
  BookOpen, Save, Copy, Share2, Download, 
  Cpu, Layers, BarChart, Check, ArrowLeft, RefreshCw 
} from 'lucide-react';
import { researchExperiments } from '../data/portalData';

export default function ExperimentDetailView({ selectedExperiment, onNavigate }) {
  const experiment = selectedExperiment || researchExperiments[0];

  const [activeSection, setActiveSection] = useState('Objective');
  const [researcherNotes, setResearcherNotes] = useState(
    "Observed non-linear tensor entanglement scaling beyond χ = 64 during diffusion operator repetitions. Recommend testing Clifford + T approximations on Stabilizer engine for 100+ qubits."
  );
  const [saved, setSaved] = useState(false);

  const sections = [
    'Objective', 'Circuit', 'Parameters', 'Backend', 
    'Results', 'Measurements', 'Performance', 'Comparison', 'Notes'
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header & Notebook Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <button
            onClick={() => onNavigate('research')}
            className="btn-neo btn-neo-white btn-neo-sm"
            style={{ marginBottom: '0.5rem' }}
          >
            <ArrowLeft size={14} />
            <span>BACK TO RESEARCH LAB</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">QUALUTION RESEARCH NOTEBOOK</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              EXPERIMENT ID: {experiment.id}
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 900 }}>
            {experiment.title}
          </h1>
        </div>

        {/* 4 Required Actions: Save Experiment, Duplicate, Export, Share */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <button onClick={handleSave} className="btn-neo btn-neo-lime">
            <Save size={16} />
            <span>{saved ? 'SAVED ✓' : 'Save Experiment'}</span>
          </button>

          <button onClick={() => alert("Experiment cloned as draft copy!")} className="btn-neo btn-neo-yellow">
            <Copy size={16} />
            <span>Duplicate</span>
          </button>

          <button onClick={() => onNavigate('export-publish')} className="btn-neo btn-neo-white">
            <Download size={16} />
            <span>Export</span>
          </button>

          <button onClick={() => onNavigate('collaboration')} className="btn-neo btn-neo-cyan">
            <Share2 size={16} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Notebook Tree Tabs Strip */}
      <div className="neo-tab-list" style={{ border: '2px solid #000', borderBottom: 'none' }}>
        {sections.map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`neo-tab-item ${activeSection === sec ? 'active' : ''}`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Notebook Content Container */}
      <div 
        style={{
          background: 'var(--paper-white)',
          border: 'var(--border-heavy)',
          borderTop: 'none',
          boxShadow: 'var(--shadow-lg)',
          padding: '2rem',
          minHeight: '480px'
        }}
      >
        {/* SECTION 1: OBJECTIVE */}
        {activeSection === 'Objective' && (
          <div>
            <span className="neo-badge neo-badge-yellow" style={{ marginBottom: '0.5rem' }}>SCIENTIFIC ABSTRACT</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Experimental Objective</h2>
            <p style={{ fontSize: '1rem', color: 'var(--ink)', lineHeight: 1.7, maxWidth: '850px' }}>
              {experiment.objective}
            </p>
            <div style={{ marginTop: '1.5rem', background: 'var(--paper-cream)', border: '2px solid #000', padding: '1.25rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '0.35rem' }}>THEORETICAL HYPOTHESIS:</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                H₁: Matrix Product State (MPS) tensor network representation maintains O(N) memory scaling for Grover unstructured search iterations below entanglement saturation threshold.
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: CIRCUIT */}
        {activeSection === 'Circuit' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Circuit Architecture</h2>
            <div className="circuit-board" style={{ padding: '1.5rem' }}>
              <div style={{ color: '#88C0D0', fontSize: '0.8rem', marginBottom: '1rem' }}>
                // {experiment.qubits}-QUBIT COMPRESSIBLE TOPOLOGY: {experiment.circuitSummary}
              </div>
              <div className="circuit-wire-row">
                <div className="qubit-label-box">q[0..30]</div>
                <div className="circuit-wire-line" />
                <div className="gates-track">
                  <div className="gate-box gate-h">H⊗31</div>
                  <div className="gate-box gate-z">Oracle</div>
                  <div className="gate-box gate-pink">Diffuser ×5</div>
                  <div className="gate-box gate-measure">Measure</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: PARAMETERS */}
        {activeSection === 'Parameters' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>Experimental Parameters</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ border: '2px solid #000', padding: '1rem', background: 'var(--paper-cream)' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>QUBITS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{experiment.qubits}</div>
              </div>
              <div style={{ border: '2px solid #000', padding: '1rem', background: 'var(--paper-cream)' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>ITERATIONS</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{experiment.iterations}</div>
              </div>
              <div style={{ border: '2px solid #000', padding: '1rem', background: 'var(--paper-cream)' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>SHOT COUNT</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{experiment.shots}</div>
              </div>
              <div style={{ border: '2px solid #000', padding: '1rem', background: 'var(--paper-cream)' }}>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>CIRCUIT DEPTH</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{experiment.depth || 17}</div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: BACKEND */}
        {activeSection === 'Backend' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Engine Configuration</h2>
            <div style={{ border: '2px solid #000', padding: '1.25rem', background: 'var(--paper-tint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span className="neo-badge neo-badge-yellow">{experiment.backend} ENGINE</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Single-Precision MPS Simulator</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                Bond dimension χ = 64, truncation error tolerance = 1e-10, parallel threaded on SSN-SNUC HPC cluster.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 5: RESULTS & SECTION 6: MEASUREMENTS */}
        {(activeSection === 'Results' || activeSection === 'Measurements') && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '1rem' }}>Experimental Telemetry Results</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {Object.entries(experiment.results).map(([k, v]) => (
                <div key={k} style={{ border: '2px solid #000', padding: '1rem', background: '#FFF' }}>
                  <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-secondary)' }}>
                    {k.replace(/([A-Z])/g, ' $1')}
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, marginTop: '0.2rem' }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 7: PERFORMANCE & SECTION 8: COMPARISON */}
        {(activeSection === 'Performance' || activeSection === 'Comparison') && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>Execution Performance Benchmark</h2>
            <div style={{ background: '#FFF', border: '2px solid #000', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 800, fontSize: '0.9rem' }}>
                <span>Execution Time</span>
                <span>{experiment.executionTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontWeight: 800, fontSize: '0.9rem' }}>
                <span>Estimated Memory Peak</span>
                <span>1.2 MB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.9rem' }}>
                <span>Convergence Status</span>
                <span className="neo-badge neo-badge-lime">OPTIMAL</span>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 9: NOTES */}
        {activeSection === 'Notes' && (
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Researcher Field Notes &amp; Observations</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
              Editable research notebook stream saved with version history.
            </p>
            <textarea
              rows={5}
              className="neo-input"
              value={researcherNotes}
              onChange={(e) => setResearcherNotes(e.target.value)}
              style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
            />
            <div style={{ marginTop: '1rem' }}>
              <button onClick={handleSave} className="btn-neo btn-neo-yellow">
                <Save size={16} />
                <span>SAVE RESEARCH NOTES</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
