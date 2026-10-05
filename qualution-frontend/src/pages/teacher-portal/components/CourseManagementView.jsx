import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Plus, Layers, CheckCircle2, ChevronRight, 
  ArrowRight, Sparkles, Filter, Archive, Edit3, Trash2, Cpu
} from 'lucide-react';
import { initialCourses as fallbackCourses } from '../data/portalData';
import InventeScrollBook3D from './InventeScrollBook3D';
import { fetchCourses } from '../api/teacherSupabaseApi';

export default function CourseManagementView({ onNavigate, onSelectCourse }) {
  const [activeCourseTab, setActiveCourseTab] = useState('All');
  const [coursesList, setCoursesList] = useState(fallbackCourses);

  useEffect(() => {
    let isMounted = true;
    fetchCourses().then(data => {
      if (isMounted && data && data.length > 0) {
        setCoursesList(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const initialCourses = coursesList;
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderStep, setBuilderStep] = useState(1);
  const [newCourse, setNewCourse] = useState({
    title: '',
    code: '',
    level: 'Beginner',
    status: 'Drafts',
    modules: 0,
    challenges: 0,
    students: 0,
    completion: 0,
    description: ''
  });

  const filteredCourses = coursesList.filter(course => {
    if (activeCourseTab === 'All') return true;
    return (course.status || 'Published').toLowerCase() === activeCourseTab.toLowerCase();
  });

  const builderSteps = [
    { num: 1, label: 'Course Information' },
    { num: 2, label: 'Learning Path' },
    { num: 3, label: 'Lessons' },
    { num: 4, label: 'Challenges' },
    { num: 5, label: 'Assessments' },
    { num: 6, label: 'Publish' }
  ];

  const handleCreateCourseSubmit = () => {
    setCoursesList([
      ...coursesList,
      {
        id: `qc-${Date.now()}`,
        ...newCourse,
        phases: []
      }
    ]);
    setShowBuilder(false);
    setBuilderStep(1);
    alert(`🎉 Course "${newCourse.title}" successfully created and published!`);
  };

  const courseSpreads = [
    {
      tabLabel: "1. Core Foundations",
      tabColor: "#C1F8FF",
      tabShort: "FOUNDATIONS",
      title: "FOUNDATIONS & QUBIT MECHANICS",
      code: "QC-101 / QC-201",
      tag: "BEGINNER — INTERMEDIATE",
      summary: "Single-qubit states, superposition, Bloch sphere representations, Pauli gates, and Bell-state entanglement.",
      highlights: [
        "Dirac bra-ket notation & Hilbert space vectors",
        "Hadamard, X, Y, Z, S, and T quantum gates",
        "Entanglement verification & CHSH inequality",
        "Measurement collapse and state fidelity calculations"
      ],
      actionLabel: "EXPLORE QC-101 →",
      stats: { modules: 14, hours: "28h", students: 184 },
      courseRef: initialCourses[0]
    },
    {
      tabLabel: "2. Algorithms & VQE",
      tabColor: "#FFC83B",
      tabShort: "ALGORITHMS",
      title: "VARIATIONAL & SPEEDUP PROTOCOLS",
      code: "QC-301 / QC-401",
      tag: "ADVANCED ARCHITECTURE",
      summary: "Grover amplitude amplification, Quantum Fourier Transform, and hybrid classical-quantum variational eigensolvers.",
      highlights: [
        "Grover quadratic database search oracle",
        "Phase estimation & order finding for Shor's algorithm",
        "VQE molecular ground-state calculations",
        "Surface code stabilizer fault tolerance & thresholds"
      ],
      actionLabel: "EXPLORE QC-301 →",
      stats: { modules: 18, hours: "36h", students: 122 },
      courseRef: initialCourses[1]
    },
    {
      tabLabel: "3. NISQ & Lab Studio",
      tabColor: "#FE90E9",
      tabShort: "RESEARCH",
      title: "TENSOR NETWORKS & NOISY HARDWARE",
      code: "QC-501 / QC-701",
      tag: "POSTGRADUATE CURRICULUM",
      summary: "Matrix Product States (MPS), density matrix decoherence, readout error mitigation, and pulse control.",
      highlights: [
        "Matrix Product States & tensor bond truncation",
        "T1/T2 relaxation and depolarizing channels",
        "Cross-resonance microwave pulse scheduling",
        "Live QASM export & classroom workbench sync"
      ],
      actionLabel: "EXPLORE QC-501 →",
      stats: { modules: 22, hours: "48h", students: 89 },
      courseRef: initialCourses[2] || initialCourses[0]
    }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>

      {/* ── SSN-SNUC INVENTE '26 SCROLLING 3D OPENING BOOK ── */}
      <InventeScrollBook3D
        theme="courses"
        badgeText="QUALUTION CURRICULUM"
        bookTitle="QUANTUM ARCHITECTURE & CURRICULUM"
        bookSubtitle="SSN-SNUC INVENTE '26 EDITION"
        spreads={courseSpreads}
        onSelectAction={(spread) => {
          if (spread.courseRef && onSelectCourse) {
            onSelectCourse(spread.courseRef);
          } else if (onNavigate) {
            onNavigate('learning-paths');
          }
        }}
      />


      {/* Header & Actions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">ACADEMIC CURRICULUM</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
              MODULE &amp; CHALLENGE ARCHITECTURE
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            COURSES
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Design, deploy, and inspect unified quantum learning paths and cohorts.
          </p>
        </div>

        <button
          onClick={() => setShowBuilder(true)}
          className="btn-neo btn-neo-yellow"
          style={{ padding: '0.75rem 1.5rem' }}
        >
          <Plus size={18} />
          <span>CREATE COURSE</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="neo-tab-list" style={{ border: '2px solid #000', borderBottom: 'none' }}>
        {['All', 'Published', 'Drafts', 'Archived'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveCourseTab(tab)}
            className={`neo-tab-item ${activeCourseTab === tab ? 'active' : ''}`}
          >
            {tab} ({tab === 'All' ? coursesList.length : coursesList.filter(c => (c.status || 'Published').toLowerCase() === tab.toLowerCase()).length})
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div 
        style={{
          background: 'var(--paper-white)',
          border: 'var(--border-heavy)',
          borderTop: 'none',
          boxShadow: 'var(--shadow-lg)',
          padding: '1.75rem'
        }}
      >
        <div className="course-card-grid">
          {filteredCourses.map((course) => (
            <div key={course.id} className="course-card">
              {/* Card Header */}
              <div className="course-card-header">
                <div>
                  <span className="neo-badge neo-badge-cyan" style={{ marginBottom: '0.4rem' }}>
                    {course.code} • {course.level}
                  </span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.35rem' }}>
                    {course.title}
                  </h3>
                </div>
                <span className={`neo-badge ${course.status === 'Published' ? 'neo-badge-lime' : course.status === 'Drafts' ? 'neo-badge-yellow' : 'neo-badge-white'}`}>
                  {course.status}
                </span>
              </div>

              {/* Card Body */}
              <div className="course-card-body">
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', minHeight: '48px', lineHeight: 1.5 }}>
                  {course.description}
                </p>

                {/* 4 Numerical Metrics */}
                <div className="course-metrics-row">
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>MODULES</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 900 }}>{course.modules} Modules</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>CHALLENGES</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 900 }}>{course.challenges} Challenges</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>STUDENTS</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 900 }}>{course.students} Students</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--ink-secondary)' }}>COMPLETION</div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 900 }}>{course.completion}%</div>
                  </div>
                </div>

                {/* Completion Bar */}
                <div style={{ marginTop: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ height: '10px', border: '2px solid #000', background: 'var(--paper-tint)' }}>
                    <div style={{ height: '100%', width: `${course.completion}%`, background: 'var(--yellow)' }} />
                  </div>
                </div>

                {/* Manage Course Action Button */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { onSelectCourse(course); onNavigate('learning-paths'); }}
                    className="btn-neo btn-neo-yellow btn-neo-sm"
                    style={{ flex: 1 }}
                  >
                    <span>Manage Course</span>
                    <ArrowRight size={14} />
                  </button>

                  <button
                    onClick={() => onNavigate('lesson-studio')}
                    className="btn-neo btn-neo-white btn-neo-sm"
                    title="Open in Lesson Studio"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Course Builder Multi-Step Flow Modal */}
      {showBuilder && (
        <div className="neo-modal-overlay" onClick={() => setShowBuilder(false)}>
          <div 
            className="neo-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '880px', background: 'var(--bg-page)' }}
          >
            {/* Modal Header */}
            <div style={{ background: 'var(--yellow)', borderBottom: 'var(--border-heavy)', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="neo-badge neo-badge-dark" style={{ marginBottom: '0.25rem' }}>STEP-BY-STEP WIZARD</span>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900 }}>QUALUTION COURSE BUILDER</h2>
              </div>
              <button onClick={() => setShowBuilder(false)} className="btn-neo btn-neo-white btn-neo-sm">
                CANCEL
              </button>
            </div>

            {/* Stepper Progress Ribbon */}
            <div style={{ display: 'flex', borderBottom: 'var(--border-thick)', background: 'var(--paper-cream)', overflowX: 'auto' }}>
              {builderSteps.map((step, idx) => (
                <div
                  key={step.num}
                  onClick={() => setBuilderStep(step.num)}
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: builderStep === step.num ? 'var(--lime)' : builderStep > step.num ? '#E2F7DA' : 'transparent',
                    borderRight: '1px solid #000',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span>{step.num}. {step.label}</span>
                  {idx < builderSteps.length - 1 && <ChevronRight size={14} color="#555" />}
                </div>
              ))}
            </div>

            {/* Step Body */}
            <div style={{ padding: '1.75rem' }}>
              {builderStep === 1 && (
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem', fontWeight: 800 }}>Course Information</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>COURSE TITLE</label>
                      <input
                        type="text"
                        className="neo-input"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>COURSE CODE</label>
                      <input
                        type="text"
                        className="neo-input"
                        value={newCourse.code}
                        onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>DIFFICULTY LEVEL</label>
                      <select
                        className="neo-input"
                        value={newCourse.level}
                        onChange={(e) => setNewCourse({ ...newCourse, level: e.target.value })}
                      >
                        <option>Beginner</option>
                        <option>Intermediate</option>
                        <option>Advanced</option>
                        <option>Research Cohort</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>SIMULATION BACKEND</label>
                      <select className="neo-input">
                        <option>Statevector (up to 30 qubits)</option>
                        <option>Stabilizer (up to 1,000 Clifford qubits)</option>
                        <option>Matrix Product State (MPS)</option>
                        <option>Hybrid Cloud (IBM Heron / Braket)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.35rem' }}>SYLLABUS ABSTRACT</label>
                    <textarea
                      rows={3}
                      className="neo-input"
                      value={newCourse.description}
                      onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {builderStep === 2 && (
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 800 }}>Unified Learning Path Architecture</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
                    Curriculum and challenges are unified in a Mario-style progressive tree.
                  </p>
                  <div style={{ background: 'var(--paper-cream)', border: '2px solid #000', padding: '1rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: '0.5rem' }}>PHASE 01: QUANTUM FOUNDATIONS</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="neo-badge neo-badge-yellow">01 THEORY: Qubit Kinematics</span>
                      <span className="neo-badge neo-badge-cyan">02 LAB: Superposition &amp; Hadamard</span>
                      <span className="neo-badge neo-badge-pink">03 CHALLENGE: Bell State Verification</span>
                      <span className="neo-badge neo-badge-lime">04 MASTERY CAPSTONE</span>
                    </div>
                  </div>
                </div>
              )}

              {builderStep >= 3 && builderStep < 6 && (
                <div>
                  <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem', fontWeight: 800 }}>
                    Step {builderStep}: {builderSteps[builderStep - 1].label} Configuration
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginBottom: '1rem' }}>
                    Configuring interactive auto-graded verifiers and Erwin real-time diagnostic checks for this phase.
                  </p>
                  <div style={{ padding: '1rem', border: '2px solid #000', background: 'var(--paper-tint)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      ✓ Auto-generate JSON module schema<br />
                      ✓ Pre-configure Erwin Misconception Rule Sets (Amplitude, Phase, Entanglement)<br />
                      ✓ Connect Reference Circuit in Workbench
                    </div>
                  </div>
                </div>
              )}

              {builderStep === 6 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <div style={{ width: '60px', height: '60px', background: 'var(--lime)', border: '3px solid #000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '3px 3px 0 #000' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 900 }}>Ready to Publish Course!</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                    This will immediately generate student-facing Mario-style paths, enroll prospective students, and activate Erwin misconception heuristics.
                  </p>
                  <button onClick={handleCreateCourseSubmit} className="btn-neo btn-neo-lime" style={{ padding: '0.85rem 2rem' }}>
                    CONFIRM &amp; PUBLISH NOW
                  </button>
                </div>
              )}

              {/* Stepper Navigation Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', borderTop: '2px solid #000', paddingTop: '1rem' }}>
                <button
                  disabled={builderStep === 1}
                  onClick={() => setBuilderStep(prev => prev - 1)}
                  className="btn-neo btn-neo-white btn-neo-sm"
                  style={{ opacity: builderStep === 1 ? 0.5 : 1 }}
                >
                  PREVIOUS
                </button>

                {builderStep < 6 && (
                  <button
                    onClick={() => setBuilderStep(prev => prev + 1)}
                    className="btn-neo btn-neo-yellow btn-neo-sm"
                  >
                    <span>NEXT STEP</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
