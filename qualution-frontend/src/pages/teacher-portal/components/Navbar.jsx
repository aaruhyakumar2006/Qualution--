import React, { useState } from 'react';
import { 
  Menu, X, Bell, User, Cpu, BookOpen, Layers, 
  Award, BarChart2, Sparkles, Network, Compass, 
  Share2, Settings, Download, Eye, Terminal
} from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, unreadNotifications = 0, userName = 'Professor' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const mainTabs = [
    { id: 'telemetry', label: '⚛ Telemetry' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'courses', label: 'Courses' },
    { id: 'learning-paths', label: 'Learning Paths' },
    { id: 'challenges', label: 'Challenges' },
    { id: 'students', label: 'Students' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'workbench', label: 'Workbench' },
    { id: 'certificates', label: 'Certificates' }
  ];

  const fullPortalMenu = [
    { id: 'home', label: '1. Home / Landing', icon: Compass, color: '#C1F8FF', desc: 'Hero, impact strip & portal entry' },
    { id: 'dashboard', label: '2. Teacher Dashboard', icon: BarChart2, color: '#FFC83B', desc: 'Main teaching overview & active KPIs' },
    { id: 'courses', label: '3. Course Management', icon: BookOpen, color: '#B0EF9E', desc: 'Course builder & module flows' },
    { id: 'learning-paths', label: '4. Unified Path Builder', icon: Layers, color: '#FE90E9', desc: 'Mario-style connected path nodes' },
    { id: 'lesson-studio', label: '5. Lesson Studio (JSON)', icon: Terminal, color: '#FFC83B', desc: '3-Column JSON architecture studio' },
    { id: 'challenge-builder', label: '6. Challenge Builder', icon: Cpu, color: '#C1F8FF', desc: 'Constraints & visual workbench solver' },
    { id: 'students', label: '7. Student Management', icon: User, color: '#B0EF9E', desc: 'Drilldown profile, attempts & AI log' },
    { id: 'analytics', label: '8. Learning Analytics', icon: BarChart2, color: '#FE90E9', desc: 'Concept mastery & misconception map' },
    { id: 'erwin-insights', label: '9. Erwin AI Intelligence', icon: Sparkles, color: '#FFC83B', desc: 'Misconception resolution & triggers' },
    { id: 'workbench', label: '10. Professional Workbench', icon: Cpu, color: '#C1F8FF', desc: 'Circuit editor, Q-Sphere & Analyzer' },
    { id: 'research', label: '11. Research Lab', icon: Compass, color: '#B0EF9E', desc: 'Experiments & quantum tensor models' },
    { id: 'experiment-detail', label: '12. Experiment Notebook', icon: BookOpen, color: '#FE90E9', desc: 'Interactive research lab notebook' },
    { id: 'backend-analytics', label: '13. Execution Analysis', icon: BarChart2, color: '#FFC83B', desc: 'Stabilizer, MPS & Cloud benchmarks' },
    { id: 'collaboration', label: '14. Collaboration Lab', icon: Share2, color: '#C1F8FF', desc: 'Workspaces, comments & version diff' },
    { id: 'certificates', label: '15. Certification Center', icon: Award, color: '#B0EF9E', desc: 'Custom template builder & issue' },
    { id: 'classroom-view', label: '16. Classroom View (Tree)', icon: Eye, color: '#FE90E9', desc: 'Live visual classroom progression' },
    { id: 'export-publish', label: '17. Export & Publication', icon: Download, color: '#FFC83B', desc: 'QASM, JSON, CSV & Jupyter Notebook' },
    { id: 'settings', label: '18. Portal Settings', icon: Settings, color: '#C1F8FF', desc: 'Institution, API & Erwin config' }
  ];

  const handleSelectTab = (id) => {
    setActiveTab(id);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="portal-header">
        <div className="portal-nav-shell">
          {/* Logo brand */}
          <div className="logo-brand" onClick={() => handleSelectTab('home')}>
            <div className="logo-cube">Q</div>
            <div>
              <div className="logo-title">QUALUTION</div>
              <div className="logo-sub">TEACHER QUANTUM PORTAL</div>
            </div>
          </div>

          {/* Center Main Tabs */}
          <nav className="nav-links-scroll" aria-label="Portal Navigation">
            {mainTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleSelectTab(tab.id)}
                className={`nav-link-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right Action Buttons */}
          <div className="header-right-actions">
            {/* Quick Workbench Shortcut Button */}
            <button
              onClick={() => handleSelectTab('workbench')}
              className="btn-neo btn-neo-sm btn-neo-yellow"
              style={{ display: 'none', md: 'inline-flex' }}
            >
              <Cpu size={14} />
              <span>RUN BENCH</span>
            </button>

            {/* Notifications Button */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="btn-neo btn-neo-white btn-neo-sm"
                aria-label="View notifications"
                style={{ position: 'relative', padding: '0.45rem 0.65rem' }}
              >
                <Bell size={16} />
                {unreadNotifications > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: 'var(--crimson)',
                      color: '#FFF',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1.5px solid #000'
                    }}
                  >
                    {unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div
                  className="neo-card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '120%',
                    width: '320px',
                    zIndex: 100,
                    background: '#FFF',
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', fontSize: '0.85rem' }}>CLASS ALERTS</span>
                    <span className="neo-badge neo-badge-lime">{unreadNotifications} ALERTS</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.8rem' }}>
                    <div style={{ padding: '0.5rem', background: 'var(--paper-tint)', border: '1px solid #000' }}>
                      <div style={{ fontWeight: 700, color: 'var(--ink)' }}>⚛ Quantum Telemetry Active</div>
                      <div style={{ color: 'var(--ink-secondary)' }}>All live execution engines connected and listening.</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setNotificationsOpen(false); handleSelectTab('erwin-insights'); }}
                    className="btn-neo btn-neo-sm btn-neo-yellow" 
                    style={{ width: '100%', marginTop: '0.75rem' }}
                  >
                    Review with Erwin
                  </button>
                </div>
              )}
            </div>

            {/* Profile Avatar Pill */}
            <div
              onClick={() => handleSelectTab('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'var(--paper-white)',
                border: 'var(--border-thick)',
                boxShadow: 'var(--shadow-sm)',
                padding: '0.25rem 0.65rem',
                cursor: 'pointer'
              }}
              title="Professor Profile & Settings"
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  background: 'var(--lime)',
                  border: '1.5px solid #000',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.75rem'
                }}
              >
                P
              </div>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.78rem' }}>
                {userName}
              </span>
            </div>

            {/* Signature SSN-SNUC Invente '26 MENU Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="btn-neo btn-neo-lime"
              style={{ padding: '0.45rem 0.9rem' }}
              aria-label="Toggle Portal Menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
              <span>MENU</span>
            </button>
          </div>
        </div>
      </header>

      {/* Signature SSN-SNUC Invente '26 Style Full Portal Puzzle Menu Drawer */}
      {menuOpen && (
        <div className="neo-modal-overlay" onClick={() => setMenuOpen(false)}>
          <div
            className="neo-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '1050px', background: 'var(--paper-cream)' }}
          >
            {/* Drawer Header */}
            <div
              style={{
                background: 'var(--yellow)',
                borderBottom: 'var(--border-heavy)',
                padding: '1.25rem 1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}>
                  QUALUTION NAVIGATION MATRIX
                </h2>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>
                  DIRECT ACCESS TO ALL 18 ARCHITECTURAL MODULES
                </p>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="btn-neo btn-neo-white btn-neo-sm"
              >
                <X size={18} /> CLOSE
              </button>
            </div>

            {/* 18-Tile Matrix Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
                padding: '1.5rem'
              }}
            >
              {fullPortalMenu.map((item) => {
                const IconComponent = item.icon;
                const isCurrent = activeTab === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    className="neo-card neo-card-interactive"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      background: isCurrent ? 'var(--yellow)' : '#FFF',
                      borderLeft: `8px solid ${item.color}`
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-heading)' }}>
                        {item.label}
                      </span>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          background: item.color,
                          border: '1.5px solid #000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <IconComponent size={14} color="#1F1F1F" />
                      </div>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', lineHeight: 1.4 }}>
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Bottom Status Ribbon */}
            <div
              style={{
                padding: '0.8rem 1.5rem',
                background: 'var(--ink)',
                color: 'var(--yellow)',
                display: 'flex',
                justifyContent: 'space-between',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                fontWeight: 700
              }}
            >
              <span>ENGINE: QUALUTION STABILIZER v4.2</span>
              <span>CAMPUS: SSN-SNUC CHENNAI QUANTUM CLUSTER</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
