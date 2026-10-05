import React from 'react';
import { Cpu, Compass, ArrowRight, Sparkles, Layers, Zap } from 'lucide-react';
import { initialMetrics } from '../data/portalData';
import QuantumBook3D from './QuantumBook3D';

export default function LandingHeroView({ onNavigate }) {
  return (
    <div className="bg-grid" style={{ minHeight: 'calc(100vh - 70px)' }}>
      {/* Ticker Tape Marquee */}
      <div className="ticker-wrap">
        <div className="ticker-content">
          <span>★ QUALUTION QUANTUM PLATFORM v2.8 ACTIVATED</span>
          <span>⚡ 500-QUBIT STABILIZER ENGINE ONLINE</span>
          <span>◆ ERWIN AI DIAGNOSTIC SYSTEM ENGAGED</span>
          <span>▲ 2,400+ ACTIVE LEARNERS</span>
          <span>● SSN-SNUC ACADEMIC PARTNERSHIP</span>
          <span>★ QUALUTION QUANTUM PLATFORM v2.8 ACTIVATED</span>
          <span>⚡ 500-QUBIT STABILIZER ENGINE ONLINE</span>
          <span>◆ ERWIN AI DIAGNOSTIC SYSTEM ENGAGED</span>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero-container">
        {/* Two-column hero split */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center' }}>

          {/* LEFT: text + CTAs */}
          <div>
            {/* Pill Badge */}
            <div className="hero-pill-badge">
              <Sparkles size={16} />
              <span>Next-Generation Quantum Pedagogy &amp; Simulation</span>
            </div>

            {/* Hero Title */}
            <h1 className="hero-title">
              <span>QUALUTION FOR</span><br />
              <span className="highlight-box">EDUCATORS &amp; RESEARCHERS</span>
            </h1>

            {/* Subtitle */}
            <div className="hero-subtitle">
              Teach. Experiment. Measure. Discover.
            </div>

            {/* Short Description */}
            <p className="hero-desc">
              A professional quantum learning and research environment for creating courses, monitoring learners,
              running experiments, and analysing quantum circuits. Designed from the ground up for high-fidelity pedagogy
              and tensor network simulation.
            </p>

            {/* CTA Buttons */}
            <div className="hero-cta-group">
              <button
                onClick={() => onNavigate('dashboard')}
                className="btn-neo"
                style={{ padding: '0.85rem 1.75rem', fontSize: '0.95rem' }}
              >
                <span>TEACH WITH QUALUTION</span>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => onNavigate('workbench')}
                className="btn-neo btn-neo-lime"
                style={{ padding: '0.85rem 1.75rem', fontSize: '0.95rem' }}
              >
                <Cpu size={18} />
                <span>OPEN WORKBENCH</span>
              </button>

              <button
                onClick={() => onNavigate('research')}
                className="btn-neo btn-neo-white"
                style={{ padding: '0.85rem 1.5rem', fontSize: '0.95rem' }}
              >
                <Compass size={18} />
                <span>EXPLORE RESEARCH</span>
              </button>
            </div>
          </div>

          {/* RIGHT: 3D Book */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minWidth: 260 }}>
            <QuantumBook3D onClick={() => onNavigate('courses')} />
          </div>
        </div>

        {/* Impact Strip - 4 Large Numerical Blocks */}
        <div style={{ marginTop: '3.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span className="neo-badge neo-badge-dark">SYSTEM TELEMETRY</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
              REAL ACADEMIC &amp; SIMULATION DATA
            </span>
          </div>

          <div className="impact-grid">
            {/* Metric 1 */}
            <div className="impact-block">
              <span className="impact-block-tag" style={{ background: 'var(--yellow)' }}>ACADEMIC</span>
              <div className="impact-number" style={{ color: 'var(--ink)' }}>{initialMetrics.learners}</div>
              <div className="impact-label">Learners</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
                Enrolled across undergraduate &amp; graduate cohorts
              </div>
            </div>

            {/* Metric 2 */}
            <div className="impact-block">
              <span className="impact-block-tag" style={{ background: 'var(--lime)' }}>EXECUTION</span>
              <div className="impact-number" style={{ color: 'var(--ink)' }}>{initialMetrics.circuitsExecuted}</div>
              <div className="impact-label">Circuits Executed</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
                Across Statevector, MPS &amp; Stabilizer backends
              </div>
            </div>

            {/* Metric 3 */}
            <div className="impact-block">
              <span className="impact-block-tag" style={{ background: 'var(--pink)' }}>CURRICULUM</span>
              <div className="impact-number" style={{ color: 'var(--ink)' }}>{initialMetrics.courses}</div>
              <div className="impact-label">Courses</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
                Structured modules with interactive challenge paths
              </div>
            </div>

            {/* Metric 4 */}
            <div className="impact-block">
              <span className="impact-block-tag" style={{ background: 'var(--cyan)' }}>RESEARCH</span>
              <div className="impact-number" style={{ color: 'var(--ink)' }}>{initialMetrics.experiments}</div>
              <div className="impact-label">Experiments</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '0.4rem' }}>
                Peer-reviewed notebooks, oracles &amp; VQE benchmarks
              </div>
            </div>
          </div>
        </div>

        {/* Architectural Highlights Strip */}
        <div style={{ marginTop: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div className="neo-card" style={{ padding: '1.25rem', borderLeft: '6px solid var(--yellow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Layers size={18} />
              <h3 style={{ fontSize: '0.95rem' }}>JSON-Driven Lesson Studio</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              Design modular quantum lessons combining theory, live interactive circuit simulators, and auto-graded challenge verifiers.
            </p>
          </div>

          <div className="neo-card" style={{ padding: '1.25rem', borderLeft: '6px solid var(--lime)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Sparkles size={18} />
              <h3 style={{ fontSize: '0.95rem' }}>Erwin Misconception Intelligence</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              Detect student misunderstandings (e.g. amplitude vs probability) automatically and deploy targeted interventions in 1-click.
            </p>
          </div>

          <div className="neo-card" style={{ padding: '1.25rem', borderLeft: '6px solid var(--pink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Zap size={18} />
              <h3 style={{ fontSize: '0.95rem' }}>Full Pro Research Workbench</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)' }}>
              Simulate up to 500 qubits on Stabilizer engine, Matrix Product States, Q-Sphere state vector projections and OpenQASM export.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
