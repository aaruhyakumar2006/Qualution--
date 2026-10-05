import React, { useState } from 'react';
import { 
  Compass, Plus, Cpu, Clock, Layers, ArrowRight, 
  Share2, BookOpen, Download, Filter, Star 
} from 'lucide-react';
import { researchExperiments } from '../data/portalData';

export default function ResearchLabView({ onSelectExperiment, onNavigate }) {
  const [activeTab, setActiveTab] = useState('Experiments');
  const [experimentsList, setExperimentsList] = useState(researchExperiments);

  const filteredExperiments = experimentsList.filter(exp => {
    if (activeTab === 'Experiments') return true;
    if (activeTab === 'My Experiments') return exp.author.includes('Ramanathan');
    if (activeTab === 'Shared Experiments') return exp.author.includes('Emily') || exp.author.includes('Group');
    if (activeTab === 'Published Experiments') return exp.status === 'Completed';
    return true;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Hero Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">ADVANCED RESEARCH DIVISION</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              SEPARATE FROM TEACHING
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900 }}>
            RESEARCH LAB
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            High-performance tensor networks, VQE ansatz optimization, and stabilizer quantum simulations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('backend-analytics')} className="btn-neo btn-neo-white">
            <span>PERFORMANCE ANALYTICS</span>
          </button>
          <button 
            onClick={() => {
              const newExp = {
                id: `exp-${Date.now()}`,
                title: 'NEW QUANTUM TOPOLOGY EXPERIMENT',
                tag: 'Simulation',
                qubits: 64,
                backend: 'MPS',
                iterations: 1,
                executionTime: '210 ms',
                shots: 1024,
                objective: 'Investigation of entangled bond dimensions.',
                status: 'Draft',
                date: 'Just now',
                author: 'Researcher',
                results: { fidelity: '99.1%' }
              };
              setExperimentsList([newExp, ...experimentsList]);
              onSelectExperiment(newExp);
              onNavigate('experiment-detail');
            }}
            className="btn-neo btn-neo-lime"
          >
            <Plus size={18} />
            <span>NEW EXPERIMENT</span>
          </button>
        </div>
      </div>

      {/* Tabs Strip */}
      <div className="neo-tab-list" style={{ border: '2px solid #000', borderBottom: 'none' }}>
        {['Experiments', 'My Experiments', 'Shared Experiments', 'Published Experiments'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`neo-tab-item ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Experiment Cards Grid */}
      <div 
        style={{
          background: 'var(--paper-white)',
          border: 'var(--border-heavy)',
          borderTop: 'none',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.75rem'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {filteredExperiments.map((exp) => (
            <div key={exp.id} className="neo-card neo-card-interactive" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Card Header */}
              <div style={{ padding: '1.25rem', borderBottom: '2px solid #000', background: 'var(--paper-cream)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span className="neo-badge neo-badge-yellow">{exp.tag}</span>
                  <span className={`neo-badge ${exp.status === 'Completed' ? 'neo-badge-lime' : 'neo-badge-pink'}`}>
                    {exp.status}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, lineHeight: 1.3 }}>
                  {exp.title}
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
                  By {exp.author} • {exp.date}
                </div>
              </div>

              {/* Card Body with 4 Specified Fields */}
              <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginBottom: '1rem', minHeight: '44px', lineHeight: 1.4 }}>
                  {exp.objective}
                </p>

                {/* 4 Quantitative Metrics */}
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.75rem',
                    background: 'var(--paper-tint)',
                    border: '1.5px solid #000',
                    padding: '0.75rem',
                    marginBottom: '1.25rem'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>QUBITS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{exp.qubits} Qubits</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>BACKEND</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--yellow-hover)' }}>{exp.backend}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>ITERATIONS</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{exp.iterations} Steps</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>EXECUTION TIME</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{exp.executionTime}</div>
                  </div>
                </div>

                {/* Open Experiment Action Button */}
                <div style={{ marginTop: 'auto' }}>
                  <button
                    onClick={() => {
                      onSelectExperiment(exp);
                      onNavigate('experiment-detail');
                    }}
                    className="btn-neo btn-neo-yellow"
                    style={{ width: '100%' }}
                  >
                    <span>Open Experiment</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
