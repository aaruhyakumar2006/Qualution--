import React, { useState } from 'react';
import { 
  Terminal, Play, CheckCircle, Code, Eye, 
  Sparkles, Cpu, Layers, HelpCircle, Video, 
  FileText, Activity, Save, ArrowRight, Download, Check
} from 'lucide-react';
import { defaultLessonStudioConfig } from '../data/portalData';

export default function LessonStudioView({ onNavigate }) {
  const [config, setConfig] = useState(defaultLessonStudioConfig);
  const [activeBlocks, setActiveBlocks] = useState([
    { id: 'b1', type: 'Theory', title: 'The Born Rule and State Vectors', content: 'In quantum mechanics, a pure state |ψ⟩ = α|0⟩ + β|1⟩ has probability amplitudes α and β where |α|² + |β|² = 1.' },
    { id: 'b2', type: 'Circuit', title: 'Interactive Superposition & Hadamard Gate', gates: ['H'], qubits: 1, target: '|ψ⟩ = (|0⟩ + |1⟩)/√2' },
    { id: 'b3', type: 'Question', title: 'Concept Check: Amplitude vs Probability', prompt: 'If the state vector has amplitude α = 1/√2, what is the measurement probability of observing state |0⟩?', answer: '50% (|α|² = 1/2)' },
    { id: 'b4', type: 'Challenge', title: 'Synthesis: Generate Bell State |Φ⁺⟩', expected: '|00⟩: 50%, |11⟩: 50%', allowedGates: ['H', 'CNOT'] }
  ]);

  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonValid, setJsonValid] = useState(true);
  const [copied, setCopied] = useState(false);

  const availableContentBlocks = [
    { type: 'Theory', icon: FileText, desc: 'Rich text & LaTeX quantum formulation' },
    { type: 'Video', icon: Video, desc: 'Embedded lecture or lab demonstration' },
    { type: 'Visualization', icon: Activity, desc: 'Bloch Sphere / Q-Sphere state projection' },
    { type: 'Interactive Demo', icon: Sparkles, desc: 'Draggable parameter slider & phase kickback' },
    { type: 'Question', icon: HelpCircle, desc: 'Multiple choice with Erwin diagnostic feedback' },
    { type: 'Code', icon: Code, desc: 'Live Python Qiskit or OpenQASM script editor' },
    { type: 'Circuit', icon: Cpu, desc: 'Interactive quantum circuit sandbox' },
    { type: 'Challenge', icon: CheckCircle, desc: 'Constraint verifier with reference solution' }
  ];

  const handleAddBlock = (type) => {
    const newId = `b-${Date.now()}`;
    const newBlock = {
      id: newId,
      type: type,
      title: `New ${type} Component`,
      content: `Configured parameters for ${type} node in JSON schema.`
    };
    setActiveBlocks([...activeBlocks, newBlock]);
  };

  const removeBlock = (id) => {
    setActiveBlocks(activeBlocks.filter(b => b.id !== id));
  };

  const currentJsonSchema = {
    schemaVersion: "qualution.lesson.v2",
    metadata: {
      title: config.title,
      duration: config.duration,
      difficulty: config.difficulty,
      prerequisites: config.prerequisites,
      backendEngine: config.backend,
      aiBehaviour: config.aiBehaviour
    },
    blocks: activeBlocks.map((b, idx) => ({
      index: idx + 1,
      blockType: b.type.toLowerCase(),
      title: b.title,
      payload: b
    }))
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentJsonSchema, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">JSON-DRIVEN ARCHITECTURE</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              LESSON STUDIO v2.8
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            LESSON STUDIO
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Design modular, auto-verifying quantum lessons with synchronized live preview and JSON compilation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onNavigate('challenge-builder')}
            className="btn-neo btn-neo-white"
          >
            <span>CHALLENGE BUILDER</span>
          </button>

          <button
            onClick={() => setShowJsonModal(true)}
            className="btn-neo btn-neo-cyan"
          >
            <Terminal size={16} />
            <span>VALIDATE JSON</span>
          </button>
        </div>
      </div>

      {/* 3-Column Studio Layout */}
      <div className="studio-layout">
        {/* Left Column: CONTENT Blocks */}
        <div className="studio-panel">
          <div className="studio-panel-header" style={{ background: 'var(--yellow)' }}>
            <span>CONTENT BLOCKS</span>
            <span className="neo-badge neo-badge-white">DRAG / CLICK</span>
          </div>
          <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto' }}>
            {availableContentBlocks.map((blk) => {
              const IconComp = blk.icon;
              return (
                <div
                  key={blk.type}
                  onClick={() => handleAddBlock(blk.type)}
                  className="content-block-item"
                  title="Click to insert into live lesson"
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      background: 'var(--paper-tint)',
                      border: '1.5px solid #000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <IconComp size={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem' }}>{blk.type}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ink-secondary)', fontWeight: 500 }}>
                      {blk.desc}
                    </div>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 900 }}>+</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: LIVE LESSON PREVIEW */}
        <div className="studio-panel" style={{ flex: 1 }}>
          <div className="studio-panel-header" style={{ background: 'var(--lime)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Eye size={16} />
              <span>LIVE LESSON PREVIEW</span>
            </div>
            <span className="neo-badge neo-badge-dark">STUDENT PERSPECTIVE</span>
          </div>

          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#FFFDF9' }}>
            {/* Lesson Title Banner */}
            <div style={{ borderBottom: '2px solid #000', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span className="neo-badge neo-badge-yellow" style={{ marginBottom: '0.5rem' }}>
                LESSON 03
              </span>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900 }}>
                {config.title}
              </h2>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                <span>⏱ {config.duration}</span>
                <span>•</span>
                <span>🎯 {config.difficulty}</span>
                <span>•</span>
                <span>⚡ {config.backend}</span>
              </div>
            </div>

            {/* Render Active Blocks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {activeBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  style={{
                    border: '2px solid #000',
                    background: '#FFF',
                    boxShadow: '3px 3px 0px #000',
                    padding: '1.25rem',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #E5E5E5', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="neo-badge neo-badge-yellow">0{idx + 1} {block.type}</span>
                      <strong style={{ fontSize: '0.9rem' }}>{block.title}</strong>
                    </div>
                    <button
                      onClick={() => removeBlock(block.id)}
                      className="btn-neo btn-neo-white btn-neo-sm"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', color: 'var(--crimson)' }}
                    >
                      REMOVE
                    </button>
                  </div>

                  {/* Block Content Render */}
                  {block.type === 'Theory' && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.6 }}>
                      {block.content}
                    </div>
                  )}

                  {block.type === 'Circuit' && (
                    <div style={{ background: '#111417', color: '#ECEFF4', padding: '1rem', border: '2px solid #000', fontFamily: 'var(--font-mono)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>q[0] ───[ H ]───●───[ M ]</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>q[1] ───────────X───[ M ]</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#A3BE8C', marginTop: '0.75rem' }}>
                        Target: {block.target || '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2'}
                      </div>
                    </div>
                  )}

                  {block.type === 'Question' && (
                    <div style={{ background: 'var(--paper-tint)', border: '1.5px solid #000', padding: '1rem' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        {block.prompt}
                      </p>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn-neo btn-neo-white btn-neo-sm">25%</button>
                        <button className="btn-neo btn-neo-yellow btn-neo-sm">50% (Correct)</button>
                        <button className="btn-neo btn-neo-white btn-neo-sm">70.7% (Amplitude misconception)</button>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)', marginTop: '0.5rem', fontStyle: 'italic' }}>
                        * Erwin automatically triggers corrective dialogue if learner picks amplitude 70.7%.
                      </div>
                    </div>
                  )}

                  {block.type === 'Challenge' && (
                    <div style={{ border: '2px solid var(--ink)', background: 'var(--paper-cream)', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Automated Verification Criteria</span>
                        <span className="neo-badge neo-badge-pink">PASS: FIDELITY &gt; 99%</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                        Expected Output: <code>{block.expected}</code><br />
                        Allowed Gates: <code>{block.allowedGates?.join(', ') || 'H, CNOT'}</code>
                      </div>
                    </div>
                  )}

                  {block.type !== 'Theory' && block.type !== 'Circuit' && block.type !== 'Question' && block.type !== 'Challenge' && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                      {block.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: LESSON CONFIGURATION */}
        <div className="studio-panel">
          <div className="studio-panel-header" style={{ background: 'var(--pink)' }}>
            <span>LESSON CONFIGURATION</span>
            <span className="neo-badge neo-badge-dark">PARAMS</span>
          </div>

          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                LESSON TITLE
              </label>
              <input
                type="text"
                className="neo-input"
                value={config.title}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                ESTIMATED DURATION
              </label>
              <input
                type="text"
                className="neo-input"
                value={config.duration}
                onChange={(e) => setConfig({ ...config, duration: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                DIFFICULTY
              </label>
              <select
                className="neo-input"
                value={config.difficulty}
                onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
              >
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                PREREQUISITES
              </label>
              <input
                type="text"
                className="neo-input"
                value={config.prerequisites}
                onChange={(e) => setConfig({ ...config, prerequisites: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                ASSESSMENT ENGINE
              </label>
              <input
                type="text"
                className="neo-input"
                value={config.assessment}
                onChange={(e) => setConfig({ ...config, assessment: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                SIMULATION BACKEND
              </label>
              <select
                className="neo-input"
                value={config.backend}
                onChange={(e) => setConfig({ ...config, backend: e.target.value })}
              >
                <option>Statevector Simulation</option>
                <option>Stabilizer Engine (1000+ Clifford qubits)</option>
                <option>Matrix Product State (MPS)</option>
                <option>IBM Cloud Heron / Braket QPU</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                ERWIN AI BEHAVIOUR
              </label>
              <textarea
                rows={3}
                className="neo-input"
                value={config.aiBehaviour}
                onChange={(e) => setConfig({ ...config, aiBehaviour: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Preview -> Validate JSON -> Publish */}
      <div 
        style={{
          marginTop: '1.25rem',
          background: 'var(--paper-cream)',
          border: 'var(--border-heavy)',
          boxShadow: 'var(--shadow-md)',
          padding: '0.9rem 1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="neo-badge neo-badge-dark">SCHEMA READY</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
            {activeBlocks.length} Blocks Configured
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setShowJsonModal(true)}
            className="btn-neo btn-neo-white"
          >
            <Eye size={16} />
            <span>PREVIEW JSON</span>
          </button>

          <button
            onClick={() => {
              setShowJsonModal(true);
              setJsonValid(true);
            }}
            className="btn-neo btn-neo-cyan"
          >
            <CheckCircle size={16} />
            <span>VALIDATE JSON</span>
          </button>

          <button
            onClick={() => alert(`🚀 Lesson "${config.title}" validated and published to live student syllabus!`)}
            className="btn-neo btn-neo-lime"
          >
            <Save size={16} />
            <span>PUBLISH LESSON</span>
          </button>
        </div>
      </div>

      {/* JSON Inspector Modal */}
      {showJsonModal && (
        <div className="neo-modal-overlay" onClick={() => setShowJsonModal(false)}>
          <div className="neo-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div style={{ background: 'var(--yellow)', borderBottom: 'var(--border-heavy)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="neo-badge neo-badge-dark">JSON SCHEMA COMPILER</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>VALIDATE QUALUTION LESSON JSON</h3>
              </div>
              <button onClick={() => setShowJsonModal(false)} className="btn-neo btn-neo-white btn-neo-sm">✕</button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {jsonValid && (
                <div style={{ background: '#EAFBE7', border: '2px solid #2B8A3E', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                  <Check size={18} color="#2B8A3E" />
                  <span>SCHEMA VALIDATION PASSED: All blocks conforms to qualution.lesson.v2 specification.</span>
                </div>
              )}

              <pre 
                style={{
                  background: '#111417',
                  color: '#A3BE8C',
                  border: '2px solid #000',
                  padding: '1.25rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  lineHeight: 1.5
                }}
              >
                {JSON.stringify(currentJsonSchema, null, 2)}
              </pre>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', borderTop: '2px solid #000', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                  Size: {JSON.stringify(currentJsonSchema).length} bytes
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={handleCopyJson} className="btn-neo btn-neo-white btn-neo-sm">
                    {copied ? 'COPIED!' : 'COPY RAW JSON'}
                  </button>
                  <button onClick={() => setShowJsonModal(false)} className="btn-neo btn-neo-yellow btn-neo-sm">
                    DONE
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
