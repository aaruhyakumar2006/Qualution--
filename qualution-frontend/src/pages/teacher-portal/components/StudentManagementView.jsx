import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, User, Sparkles, Cpu, Award, 
  Clock, ArrowRight, X, CheckCircle, AlertTriangle, 
  ExternalLink, MessageSquare, ChevronRight, BarChart 
} from 'lucide-react';
import { initialStudents as fallbackStudents } from '../data/portalData';
import { fetchStudents } from '../api/teacherSupabaseApi';

export default function StudentManagementView({ selectedStudent, setSelectedStudent, onNavigate }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [performanceFilter, setPerformanceFilter] = useState('All');
  const [drilldownStudent, setDrilldownStudent] = useState(selectedStudent || null);
  const [students, setStudents] = useState(fallbackStudents);

  useEffect(() => {
    let isMounted = true;
    fetchStudents().then(data => {
      if (isMounted && Array.isArray(data)) {
        setStudents(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const initialStudents = students;

  const filteredStudents = initialStudents.filter(student => {
    if (!student || !student.name) return false;
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (student.course || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = courseFilter === 'All' || (student.course || '').includes(courseFilter);
    const matchesPerf = performanceFilter === 'All' || 
                        (performanceFilter === 'High' && student.accuracy >= 85) ||
                        (performanceFilter === 'Needs Help' && student.accuracy < 80);
    return matchesSearch && matchesCourse && matchesPerf;
  });

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">COHORT SURVEILLANCE</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              {initialStudents.length} ACTIVE QUANTUM LEARNERS
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            STUDENTS
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Deep inspect individual progress, circuit attempt telemetry, and Erwin misconception diagnostics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('classroom-view')} className="btn-neo btn-neo-pink">
            <span>CLASSROOM MAP</span>
          </button>
          <button onClick={() => onNavigate('analytics')} className="btn-neo btn-neo-yellow">
            <span>LEARNING ANALYTICS</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div 
        className="neo-card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1rem',
          background: 'var(--paper-cream)'
        }}
      >
        {/* Search input */}
        <div style={{ flex: '1 1 240px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
          <input
            type="text"
            placeholder="Search students by name or course..."
            className="neo-input"
            style={{ paddingLeft: '2.2rem' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Course Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>COURSE:</label>
          <select 
            className="neo-input" 
            style={{ width: 'auto', padding: '0.5rem 0.8rem' }}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="All">All Courses</option>
            <option value="Beginner">Beginner (QC-101)</option>
            <option value="Algorithms">Algorithms (QC-201)</option>
            <option value="Error Correction">Fault Tolerance (QC-301)</option>
          </select>
        </div>

        {/* Performance Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>PERFORMANCE:</label>
          <select 
            className="neo-input" 
            style={{ width: 'auto', padding: '0.5rem 0.8rem' }}
            value={performanceFilter}
            onChange={(e) => setPerformanceFilter(e.target.value)}
          >
            <option value="All">All Tiers</option>
            <option value="High">High Accuracy (&gt; 85%)</option>
            <option value="Needs Help">Needs Help (&lt; 80%)</option>
          </select>
        </div>
      </div>

      {/* Student Table */}
      <div className="neo-table-container">
        <table className="neo-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Course / Phase</th>
              <th>Progress</th>
              <th>Accuracy</th>
              <th>Challenges</th>
              <th>Active Misconception</th>
              <th>Last Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--ink-secondary)' }}>
                  No active students registered in database yet.
                </td>
              </tr>
            ) : (
              filteredStudents.map((s) => (
                <tr key={s.id} onClick={() => setDrilldownStudent(s)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '34px',
                          height: '34px',
                          background: s.avatarBg || '#FFC83B',
                          border: '2px solid #000',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: '0.8rem',
                          boxShadow: '1px 1px 0 #000'
                        }}
                      >
                        {s.initials || (s.name ? s.name.split(' ').map(n => n[0]).join('') : 'ST')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800 }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>ID: {s.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{s.course}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ink-secondary)' }}>{s.phase}</div>
                  </td>
                  <td style={{ minWidth: '130px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 800, marginBottom: '2px' }}>
                      <span>{s.progress ?? 0}%</span>
                    </div>
                    <div style={{ height: '7px', border: '1.5px solid #000', background: 'var(--paper-tint)' }}>
                      <div style={{ height: '100%', width: `${s.progress ?? 0}%`, background: 'var(--yellow)' }} />
                    </div>
                  </td>
                  <td>
                    <span 
                      className={`neo-badge ${s.accuracy >= 85 ? 'neo-badge-lime' : 'neo-badge-pink'}`}
                      style={{ fontSize: '0.75rem' }}
                    >
                      {s.accuracy}%
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                      {s.challengesCompleted || 0}
                    </span>
                  </td>
                  <td>
                    {s.misconceptionSeverity === 'high' ? (
                      <span className="neo-badge neo-badge-pink" style={{ background: '#FFD1D1', color: 'var(--crimson)' }}>
                        ⚠️ {s.misconception}
                      </span>
                    ) : s.misconceptionSeverity === 'medium' ? (
                      <span className="neo-badge neo-badge-yellow">
                        ⚡ {s.misconception}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>None Active</span>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                    {s.lastActive || 'N/A'}
                  </td>
                  <td>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDrilldownStudent(s); }}
                      className="btn-neo btn-neo-white btn-neo-sm"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Deep Drill-Down Student Profile Modal */}
      {drilldownStudent && (
        <div className="neo-modal-overlay" onClick={() => setDrilldownStudent(null)}>
          <div 
            className="neo-modal-content" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '920px', background: 'var(--paper-white)' }}
          >
            {/* Modal Header */}
            <div 
              style={{
                background: drilldownStudent.avatarBg,
                borderBottom: 'var(--border-heavy)',
                padding: '1.25rem 1.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    border: '3px solid #000',
                    background: '#FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: '1.25rem',
                    boxShadow: '3px 3px 0 #000'
                  }}
                >
                  {drilldownStudent.initials}
                </div>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900 }}>
                    {drilldownStudent.name}
                  </h2>
                  <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {drilldownStudent.course} • {drilldownStudent.phase}
                  </div>
                </div>
              </div>

              <button onClick={() => setDrilldownStudent(null)} className="btn-neo btn-neo-white btn-neo-sm">
                <X size={18} /> CLOSE
              </button>
            </div>

            {/* Profile Content Body */}
            <div style={{ padding: '1.5rem', maxHeight: '78vh', overflowY: 'auto' }}>
              {/* Quick Metrics Strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ border: '2px solid #000', padding: '0.75rem', background: 'var(--paper-cream)' }}>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>PROGRESS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{drilldownStudent.progress}%</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '0.75rem', background: 'var(--paper-cream)' }}>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>ACCURACY</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{drilldownStudent.accuracy}%</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '0.75rem', background: 'var(--paper-cream)' }}>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>CIRCUITS RUN</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{drilldownStudent.circuitAttempts}</div>
                </div>
                <div style={{ border: '2px solid #000', padding: '0.75rem', background: 'var(--paper-cream)' }}>
                  <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>ERWIN CHATS</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{drilldownStudent.aiInteractions}</div>
                </div>
              </div>

              {/* Concept Mastery Breakdown */}
              <div style={{ marginBottom: '1.5rem', border: '2px solid #000', padding: '1.25rem', background: 'var(--paper-tint)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                  CONCEPT MASTERY SCORE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {Object.entries(drilldownStudent.conceptMastery).map(([key, val]) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 800, textTransform: 'capitalize', marginBottom: '2px' }}>
                        <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span>{val}%</span>
                      </div>
                      <div style={{ height: '8px', border: '1.5px solid #000', background: '#FFF' }}>
                        <div style={{ height: '100%', width: `${val}%`, background: val > 80 ? 'var(--lime)' : val > 65 ? 'var(--yellow)' : 'var(--pink)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Misconceptions & Erwin Intelligence */}
              <div style={{ marginBottom: '1.5rem', border: '2px solid #000', padding: '1.25rem', background: drilldownStudent.misconceptionSeverity === 'none' ? '#F4F9F2' : '#FFF5F5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Sparkles size={16} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>ERWIN MISCONCEPTION DIAGNOSIS</h3>
                </div>
                {drilldownStudent.misconceptionSeverity !== 'none' ? (
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--crimson)', fontSize: '0.9rem' }}>
                      ⚠️ Active: {drilldownStudent.misconception}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', marginTop: '0.35rem' }}>
                      Erwin detected incorrect mathematical reasoning during measurement calculation in Lesson 04. 
                      Recommended action: Trigger targeted Born Rule interactive challenge.
                    </p>
                    <button
                      onClick={() => alert(`Targeted Born Rule challenge dispatched to ${drilldownStudent.name}!`)}
                      className="btn-neo btn-neo-yellow btn-neo-sm"
                      style={{ marginTop: '0.75rem' }}
                    >
                      <span>DEPLOY CUSTOM INTERVENTION</span>
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#2B8A3E', fontSize: '0.85rem', fontWeight: 700 }}>
                    ✓ No active conceptual misconceptions detected. Student demonstrates high mathematical rigor.
                  </div>
                )}
              </div>

              {/* Circuit Attempts & Challenge History */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                  RECENT QUANTUM CIRCUIT ATTEMPTS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {drilldownStudent.recentAttempts?.map((att, i) => (
                    <div key={i} style={{ border: '1.5px solid #000', padding: '0.75rem', background: '#FFF' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '0.85rem' }}>
                        <span>{att.circuit}</span>
                        <span className="neo-badge neo-badge-yellow">{att.backend}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
                        Output: <code>{att.result}</code> • {att.time}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity Timeline */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                  LEARNING ACTIVITY TIMELINE
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {drilldownStudent.timeline?.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
                      <span style={{ width: '8px', height: '8px', background: 'var(--yellow)', border: '1.5px solid #000', borderRadius: '50%' }} />
                      <span style={{ fontWeight: 700 }}>{item.action}</span>
                      <span style={{ color: 'var(--ink-muted)', fontSize: '0.7rem', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
