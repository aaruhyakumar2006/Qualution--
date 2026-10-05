import React, { useState } from 'react';
import { 
  Share2, Users, MessageSquare, History, GitCompare, 
  Plus, Check, Send, ArrowRight, Shield, Lock, FileCode 
} from 'lucide-react';

export default function CollaborationView({ onNavigate, onSelectExperiment }) {
  const [activeTab, setActiveTab] = useState('My Workspace');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Co-Researcher (Edit & Run)');
  const [comments, setComments] = useState([
    {
      author: 'Dr. Emily Zhao (Stanford / SSN Lab)',
      role: 'Co-PI',
      text: 'Verified the 31-qubit Grover simulation on MPS. Can we benchmark noise mitigation on IBM Heron next week?',
      time: '2 hours ago',
      avatarBg: '#B0EF9E'
    },
    {
      author: 'Researcher',
      role: 'Lead Researcher',
      text: 'Yes, I added the decoy state measurement parameters to branch v1.1.0. Let me know what you think.',
      time: '35 mins ago',
      avatarBg: '#FFC83B'
    }
  ]);
  const [newComment, setNewComment] = useState('');

  const [versions, setVersions] = useState([
    { version: 'v1.1.0', author: 'Lead Researcher', date: 'Today 11:30', changes: 'Added 5th Grover diffuser pass & noise threshold check' },
    { version: 'v1.0.1', author: 'Dr. Emily Zhao', date: 'Yesterday 18:20', changes: 'Optimized bond dimension χ = 64 cutoff parameter' },
    { version: 'v1.0.0', author: 'Lead Researcher', date: '26 Sep 2026', changes: 'Initial commit of MPS 31-qubit ansatz' }
  ]);

  const [compareOpen, setCompareOpen] = useState(false);

  const handlePostComment = () => {
    if (!newComment) return;
    setComments([
      ...comments,
      {
        author: 'Researcher',
        role: 'Lead Researcher',
        text: newComment,
        time: 'Just now',
        avatarBg: '#FFC83B'
      }
    ]);
    setNewComment('');
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">MULTI-INSTITUTION RESEARCH NETWORK</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              CROSS-LAB REPOSITORIES
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            COLLABORATIVE RESEARCH
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Real-time peer review, shared experiment notebooks, branch diffing, and version tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setCompareOpen(true)} className="btn-neo btn-neo-white">
            <GitCompare size={16} />
            <span>COMPARE VERSIONS</span>
          </button>
          <button onClick={() => setShowInviteModal(true)} className="btn-neo btn-neo-yellow">
            <Plus size={16} />
            <span>INVITE RESEARCHER</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="neo-tab-list" style={{ border: '2px solid #000', borderBottom: 'none' }}>
        {['My Workspace', 'Shared With Me', 'Research Groups', 'Collaborators'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`neo-tab-item ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Grid: Workspaces / Comments / Version History */}
      <div 
        style={{
          background: 'var(--paper-white)',
          border: 'var(--border-heavy)',
          borderTop: 'none',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.75rem'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {/* Left: Active Research Workspace */}
          <div className="neo-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>MY WORKSPACE REPOSITORIES</h2>
              <span className="neo-badge neo-badge-lime">4 ACTIVE LABS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { title: 'Grover Search Tensor Network Scaling', group: 'SSN-SNUC Algorithms Lab', collaborators: 4, visibility: 'Shared' },
                { title: 'Surface Code Lattice Thresholds', group: 'Fault-Tolerant Quantum Cluster', collaborators: 6, visibility: 'Shared' },
                { title: 'VQE Molecular Dissociation Benchmark', group: 'Computational Chemistry Cohort', collaborators: 3, visibility: 'Private' }
              ].map((repo, idx) => (
                <div key={idx} style={{ border: '2px solid #000', padding: '1rem', background: 'var(--paper-cream)', boxShadow: '2px 2px 0 #000' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 800 }}>{repo.title}</h3>
                    <span className="neo-badge neo-badge-yellow">{repo.visibility}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', marginTop: '0.35rem' }}>
                    {repo.group} • {repo.collaborators} Researchers
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <button onClick={() => { onSelectExperiment && onSelectExperiment(null); onNavigate('experiment-detail'); }} className="btn-neo btn-neo-white btn-neo-sm">
                      OPEN NOTEBOOK
                    </button>
                    <button onClick={() => alert("Experiment link copied to clipboard!")} className="btn-neo btn-neo-cyan btn-neo-sm">
                      SHARE LINK
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live Comments Stream & Version History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Version History Card */}
            <div className="neo-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={16} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>VERSION HISTORY</h3>
                </div>
                <button onClick={() => setCompareOpen(true)} className="btn-neo btn-neo-sm btn-neo-white">
                  DIFF VERSIONS
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {versions.map((ver) => (
                  <div key={ver.version} style={{ border: '1.5px solid #000', padding: '0.65rem 0.85rem', background: '#FFF' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="neo-badge neo-badge-yellow">{ver.version}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>{ver.date}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', fontWeight: 700 }}>
                      {ver.changes}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                      Author: {ver.author}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments Stream */}
            <div className="neo-card" style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                <MessageSquare size={16} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>RESEARCH DISCUSSION</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', flex: 1, maxHeight: '240px', marginBottom: '1rem' }}>
                {comments.map((c, i) => (
                  <div key={i} style={{ border: '1.5px solid #000', padding: '0.75rem', background: 'var(--paper-tint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <strong style={{ fontSize: '0.8rem' }}>{c.author}</strong>
                      <span style={{ fontSize: '0.68rem', color: 'var(--ink-secondary)' }}>{c.time}</span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink)', lineHeight: 1.4 }}>
                      {c.text}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <input
                  type="text"
                  placeholder="Add researcher comment or note..."
                  className="neo-input"
                  style={{ fontSize: '0.8rem' }}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePostComment()}
                />
                <button onClick={handlePostComment} className="btn-neo btn-neo-yellow btn-neo-sm">
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compare Versions Modal */}
      {compareOpen && (
        <div className="neo-modal-overlay" onClick={() => setCompareOpen(false)}>
          <div className="neo-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div style={{ background: 'var(--yellow)', borderBottom: 'var(--border-heavy)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="neo-badge neo-badge-dark">QUANTUM TOPOLOGY DIFF</span>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 900 }}>COMPARE EXPERIMENT VERSIONS</h2>
              </div>
              <button onClick={() => setCompareOpen(false)} className="btn-neo btn-neo-white btn-neo-sm">✕</button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Version A */}
                <div style={{ border: '2px solid #000', padding: '1rem', background: '#FFF' }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>v1.0.1 (Previous)</div>
                  <pre style={{ background: '#111417', color: '#ECEFF4', padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
{`// 4 Diffuser passes
grover_diffuser(qc, qubits=31)
mps_cutoff = 1e-10
chi_max = 64`}
                  </pre>
                </div>

                {/* Version B */}
                <div style={{ border: '2px solid #000', padding: '1rem', background: '#EAFBE7' }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.5rem', color: '#2B8A3E' }}>v1.1.0 (Current)</div>
                  <pre style={{ background: '#111417', color: '#A3BE8C', padding: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
{`// 5 Diffuser passes (Target Amplified)
grover_diffuser(qc, qubits=31, passes=5)
mps_cutoff = 1e-12
chi_max = 128 // Doubled bond dimension`}
                  </pre>
                </div>
              </div>

              <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                <button onClick={() => setCompareOpen(false)} className="btn-neo btn-neo-yellow btn-neo-sm">
                  CLOSE COMPARISON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Researcher Modal */}
      {showInviteModal && (
        <div className="neo-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="neo-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ background: 'var(--lime)', borderBottom: 'var(--border-heavy)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>INVITE RESEARCHER</h3>
              <button onClick={() => setShowInviteModal(false)} className="btn-neo btn-neo-white btn-neo-sm">✕</button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>
                  RESEARCHER INSTITUTIONAL EMAIL
                </label>
                <input
                  type="email"
                  placeholder="e.g. colleague@ssn.edu.in"
                  className="neo-input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>
                  PERMISSION LEVEL
                </label>
                <select
                  className="neo-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                >
                  <option>Co-Researcher (Edit &amp; Run)</option>
                  <option>Reviewer (Read-Only &amp; Comments)</option>
                  <option>Principal Investigator (Full Admin)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button onClick={() => setShowInviteModal(false)} className="btn-neo btn-neo-white btn-neo-sm">
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    alert(`Invitation sent to ${inviteEmail || 'colleague'}!`);
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="btn-neo btn-neo-lime btn-neo-sm"
                >
                  SEND INVITATION
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
