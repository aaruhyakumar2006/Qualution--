import React, { useState } from 'react';
import { 
  CheckSquare, Cpu, Sparkles, HelpCircle, 
  ArrowRight, Save, Plus, Trash2, Play 
} from 'lucide-react';

export default function ChallengeBuilderView({ onNavigate }) {
  const [challengeData, setChallengeData] = useState({
    title: 'Bell State |Φ⁺⟩ Entanglement Synthesis',
    description: 'Construct a 2-qubit circuit that transforms the initial ground state |00⟩ into the maximally entangled Bell state (|00⟩ + |11⟩)/√2.',
    difficulty: 'Intermediate',
    concept: 'Entanglement & Bell States',
    circuitState: '|00⟩',
    expectedOutput: '|00⟩: 50.0%, |11⟩: 50.0%',
    allowedGates: ['H', 'CNOT', 'X', 'Z'],
    attempts: 3,
    passingCriteria: 'State Fidelity ≥ 99.5%',
    hints: [
      'Apply a Hadamard gate to qubit 0 to place it into an equal superposition.',
      'Use a Controlled-NOT (CNOT) gate with qubit 0 as control and qubit 1 as target.'
    ]
  });

  const [newHint, setNewHint] = useState('');
  const [referenceCircuit, setReferenceCircuit] = useState([
    { qubit: 0, gate: 'H', step: 1 },
    { qubit: 0, gate: 'CNOT (Control)', step: 2 },
    { qubit: 1, gate: 'CNOT (Target)', step: 2 }
  ]);

  const allAvailableGates = ['H', 'X', 'Y', 'Z', 'CNOT', 'SWAP', 'T', 'S', 'Rx', 'Ry', 'Rz'];

  const toggleGate = (gate) => {
    if (challengeData.allowedGates.includes(gate)) {
      setChallengeData({
        ...challengeData,
        allowedGates: challengeData.allowedGates.filter(g => g !== gate)
      });
    } else {
      setChallengeData({
        ...challengeData,
        allowedGates: [...challengeData.allowedGates, gate]
      });
    }
  };

  const addHint = () => {
    if (!newHint) return;
    setChallengeData({
      ...challengeData,
      hints: [...challengeData.hints, newHint]
    });
    setNewHint('');
  };

  const removeHint = (idx) => {
    setChallengeData({
      ...challengeData,
      hints: challengeData.hints.filter((_, i) => i !== idx)
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">ASSESSMENT AUTHORING</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              AUTO-EVALUATION PROTOCOL
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            CHALLENGE BUILDER
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Author interactive quantum challenges without manual verification scripts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => onNavigate('workbench')}
            className="btn-neo btn-neo-lime"
          >
            <Cpu size={18} />
            <span>OPEN WORKBENCH</span>
          </button>

          <button
            onClick={() => alert(`🎉 Challenge "${challengeData.title}" compiled and deployed to course catalog!`)}
            className="btn-neo btn-neo-yellow"
          >
            <Save size={18} />
            <span>SAVE CHALLENGE</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Challenge Configuration Fields + Reference Solution Builder */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        {/* Left Form: All Specified Fields */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 800, borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            CHALLENGE METADATA &amp; CONSTRAINTS
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                CHALLENGE TITLE
              </label>
              <input
                type="text"
                className="neo-input"
                value={challengeData.title}
                onChange={(e) => setChallengeData({ ...challengeData, title: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                DESCRIPTION
              </label>
              <textarea
                rows={3}
                className="neo-input"
                value={challengeData.description}
                onChange={(e) => setChallengeData({ ...challengeData, description: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  DIFFICULTY
                </label>
                <select
                  className="neo-input"
                  value={challengeData.difficulty}
                  onChange={(e) => setChallengeData({ ...challengeData, difficulty: e.target.value })}
                >
                  <option>Beginner</option>
                  <option>Intermediate</option>
                  <option>Advanced</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  CORE CONCEPT
                </label>
                <input
                  type="text"
                  className="neo-input"
                  value={challengeData.concept}
                  onChange={(e) => setChallengeData({ ...challengeData, concept: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  INITIAL CIRCUIT STATE
                </label>
                <input
                  type="text"
                  className="neo-input"
                  value={challengeData.circuitState}
                  onChange={(e) => setChallengeData({ ...challengeData, circuitState: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  ALLOWED ATTEMPTS
                </label>
                <input
                  type="number"
                  className="neo-input"
                  value={challengeData.attempts}
                  onChange={(e) => setChallengeData({ ...challengeData, attempts: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                EXPECTED OUTPUT STATE
              </label>
              <input
                type="text"
                className="neo-input"
                value={challengeData.expectedOutput}
                onChange={(e) => setChallengeData({ ...challengeData, expectedOutput: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                PASSING CRITERIA
              </label>
              <input
                type="text"
                className="neo-input"
                value={challengeData.passingCriteria}
                onChange={(e) => setChallengeData({ ...challengeData, passingCriteria: e.target.value })}
              />
            </div>

            {/* Allowed Gates Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>
                ALLOWED GATES RESTRICTIONS
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {allAvailableGates.map(gate => {
                  const isAllowed = challengeData.allowedGates.includes(gate);
                  return (
                    <button
                      key={gate}
                      type="button"
                      onClick={() => toggleGate(gate)}
                      className={`btn-neo btn-neo-sm ${isAllowed ? 'btn-neo-yellow' : 'btn-neo-white'}`}
                      style={{ padding: '0.25rem 0.6rem' }}
                    >
                      {gate} {isAllowed ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progressive Hints List */}
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>
                ERWIN SOCRATIC HINTS
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem' }}>
                {challengeData.hints.map((hint, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--paper-tint)', border: '1px solid #000', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
                    <span><strong>Hint {i + 1}:</strong> {hint}</span>
                    <button onClick={() => removeHint(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--crimson)' }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Add progressive hint..."
                  className="neo-input"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem' }}
                  value={newHint}
                  onChange={(e) => setNewHint(e.target.value)}
                />
                <button onClick={addHint} className="btn-neo btn-neo-sm btn-neo-white">
                  ADD
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Visual Reference Solution Sandbox */}
        <div className="neo-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>VISUAL REFERENCE SOLUTION</h2>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>AUTOGRADER GROUND TRUTH</p>
            </div>
            <button onClick={() => onNavigate('workbench')} className="btn-neo btn-neo-lime btn-neo-sm">
              <Cpu size={14} />
              <span>OPEN WORKBENCH</span>
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
            Teachers construct the reference solution visually on quantum registers. Qualution automatically computes the target density matrix and verifies student circuit topologies.
          </p>

          {/* Mini Interactive Circuit Wires */}
          <div className="circuit-board" style={{ flex: 1, minHeight: '260px' }}>
            <div style={{ color: '#88C0D0', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
              // REFERENCE SOLUTION: BELL PAIR SYNTHESIS
            </div>

            {/* Wire 0 */}
            <div className="circuit-wire-row">
              <div className="qubit-label-box">q[0]</div>
              <div className="circuit-wire-line" />
              <div className="gates-track">
                <div className="gate-box gate-h">H</div>
                <div className="gate-box gate-cnot">●</div>
                <div className="gate-box gate-measure">M</div>
              </div>
            </div>

            {/* Wire 1 */}
            <div className="circuit-wire-row">
              <div className="qubit-label-box">q[1]</div>
              <div className="circuit-wire-line" />
              <div className="gates-track">
                <div style={{ width: '42px' }} />
                <div className="gate-box gate-cnot">⊕</div>
                <div className="gate-box gate-measure">M</div>
              </div>
            </div>

            {/* Calculated Quantum State Output */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #4C566A', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#D8DEE9', marginBottom: '0.4rem' }}>
                COMPUTED TARGET STATEVECTOR:
              </div>
              <div style={{ background: '#2E3440', padding: '0.75rem', border: '1px solid #4C566A', color: 'var(--yellow)', fontSize: '0.85rem' }}>
                |ψ_target⟩ = 0.7071|00⟩ + 0.0000|01⟩ + 0.0000|10⟩ + 0.7071|11⟩
              </div>
            </div>
          </div>

          {/* Autograder Test Run Simulation */}
          <div style={{ marginTop: '1rem', background: 'var(--paper-cream)', border: '2px solid #000', padding: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="neo-badge neo-badge-lime">VERIFIED</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, marginLeft: '0.5rem' }}>State Fidelity: 100.0%</span>
              </div>
              <button 
                onClick={() => alert("Reference simulation passed! Statevector matches target Bell pair.")} 
                className="btn-neo btn-neo-white btn-neo-sm"
              >
                <Play size={12} />
                <span>TEST HARNESS</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
