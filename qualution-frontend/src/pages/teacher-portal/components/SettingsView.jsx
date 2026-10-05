import React, { useState } from 'react';
import { 
  Settings, User, Building, BookOpen, Bell, 
  Sparkles, Cpu, Shield, Key, Save, Check 
} from 'lucide-react';

export default function SettingsView() {
  const [activeSection, setActiveSection] = useState('Profile');
  const [saved, setSaved] = useState(false);

  const sections = [
    { id: 'Profile', label: 'Profile', icon: User },
    { id: 'Institution', label: 'Institution', icon: Building },
    { id: 'Courses', label: 'Courses', icon: BookOpen },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
    { id: 'AISettings', label: 'AI Settings', icon: Sparkles },
    { id: 'BackendSettings', label: 'Backend Settings', icon: Cpu },
    { id: 'DataPrivacy', label: 'Data & Privacy', icon: Shield },
    { id: 'APIIntegrations', label: 'API / Integrations', icon: Key }
  ];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">PORTAL PREFERENCES</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              QUALUTION PLATFORM CONFIGURATION
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            SETTINGS
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Configure institutional identities, Erwin intelligence models, and quantum backend API keys.
          </p>
        </div>

        <button onClick={handleSave} className="btn-neo btn-neo-yellow">
          <Save size={16} />
          <span>{saved ? 'SETTINGS SAVED ✓' : 'SAVE CHANGES'}</span>
        </button>
      </div>

      {/* Main Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        {/* Left Side: Settings Navigation */}
        <div className="neo-card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {sections.map((sec) => {
              const IconComp = sec.icon;
              const isSelected = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: isSelected ? 'var(--yellow)' : 'transparent',
                    border: isSelected ? '2px solid #000' : '1px solid transparent',
                    boxShadow: isSelected ? '2px 2px 0 #000' : 'none',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-heading)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <IconComp size={16} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active Settings Panel */}
        <div className="neo-card" style={{ padding: '1.75rem' }}>
          {activeSection === 'Profile' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Professor Profile</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>FULL NAME</label>
                  <input type="text" className="neo-input" placeholder="Enter full name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>INSTITUTIONAL EMAIL</label>
                  <input type="email" className="neo-input" placeholder="Enter institutional email" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>DESIGNATION</label>
                  <input type="text" className="neo-input" placeholder="Enter designation" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>ORCID ID</label>
                  <input type="text" className="neo-input" placeholder="Enter ORCID ID" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Institution' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Institution Details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>INSTITUTION NAME</label>
                  <input type="text" className="neo-input" placeholder="Enter institution name" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>CAMPUS LOCATION</label>
                  <input type="text" className="neo-input" placeholder="Enter campus location" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>CLUSTER DOMAIN</label>
                  <input type="text" className="neo-input" placeholder="Enter cluster domain" />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'Courses' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Course Defaults</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Auto-enroll cohort into prerequisite review quizzes</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Enable Mario-style game path progression verifier</span>
                </label>
              </div>
            </div>
          )}

          {activeSection === 'Notifications' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Alert Preferences</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" defaultChecked />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Instant notification when 10+ students trigger the same misconception</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" defaultChecked />
                  <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Weekly research simulation resource report</span>
                </label>
              </div>
            </div>
          )}

          {activeSection === 'AISettings' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Erwin AI Engine Configuration</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>SOCRATIC PEDAGOGY LEVEL</label>
                  <select className="neo-input" defaultValue="Guided Socratic (Ask questions before revealing state answers)">
                    <option>Strict Socratic (Never gives answers, only hints)</option>
                    <option>Guided Socratic (Ask questions before revealing state answers)</option>
                    <option>Direct Diagnostic (Explains quantum math immediately)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>MISCONCEPTION RADAR SENSITIVITY</label>
                  <select className="neo-input" defaultValue="High (Flags 1st inversion attempt)">
                    <option>Low (Requires 3 failed attempts)</option>
                    <option>Medium (Requires 2 failed attempts)</option>
                    <option>High (Flags 1st inversion attempt)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'BackendSettings' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Quantum Simulation Engines</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>DEFAULT CLASSROOM SIMULATOR</label>
                  <select className="neo-input" defaultValue="Matrix Product State (MPS)">
                    <option>Statevector (CPU Threaded)</option>
                    <option>Stabilizer Engine (Clifford Only)</option>
                    <option>Matrix Product State (MPS)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>MAX SHOTS PER EXECUTION</label>
                  <input type="number" className="neo-input" defaultValue={8192} />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'DataPrivacy' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Data &amp; Privacy</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
                Student circuit attempts and Erwin chat telemetry are stored strictly within the private institutional database with GDPR &amp; FERPA compliance.
              </p>
              <button className="btn-neo btn-neo-white btn-neo-sm">
                DOWNLOAD COHORT DATA ARCHIVE
              </button>
            </div>
          )}

          {activeSection === 'APIIntegrations' && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '1rem' }}>Cloud QPU API Integrations</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>IBM QUANTUM PLATFORM API TOKEN</label>
                  <input type="password" className="neo-input" placeholder="Enter IBM Quantum API token" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>AWS BRAKET ACCESS KEY</label>
                  <input type="password" className="neo-input" placeholder="Enter AWS Braket access key" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
