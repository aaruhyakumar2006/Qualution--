import React, { useState, useEffect } from 'react';
import { 
  Eye, Users, Sparkles, BookOpen, Cpu, 
  CheckCircle, ArrowRight, ShieldAlert, Award 
} from 'lucide-react';
import { initialStudents as fallbackStudents } from '../data/portalData';
import { fetchStudents } from '../api/teacherSupabaseApi';

export default function ClassroomView({ onNavigate, onSelectStudent }) {
  const [selectedNode, setSelectedNode] = useState('LAB');
  const [students, setStudents] = useState(fallbackStudents);

  useEffect(() => {
    let isMounted = true;
    fetchStudents().then(data => {
      if (isMounted && data && data.length > 0) {
        setStudents(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const initialStudents = students;

  // Distribution of students across nodes
  const nodeLearners = {
    COURSE: initialStudents.slice(0, 6),
    THEORY: [initialStudents[0], initialStudents[1]].filter(Boolean),
    LAB: [initialStudents[1] || initialStudents[0], initialStudents[3] || initialStudents[0]],
    CHALLENGE: [initialStudents[2] || initialStudents[0]],
    MASTERY: [initialStudents[0]]
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">LIVE SYNCHRONIZED PROGRESSION</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              MARIO TREE CLASSROOM RADAR
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            CLASSROOM VIEW
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Real-time visual map of all cohort learners progressing through the unified quantum curriculum tree.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('learning-paths')} className="btn-neo btn-neo-white">
            <span>EDIT LEARNING PATH</span>
          </button>
          <button onClick={() => onNavigate('students')} className="btn-neo btn-neo-yellow">
            <Users size={16} />
            <span>STUDENT ROSTER</span>
          </button>
        </div>
      </div>

      {/* Large Visual Map Canvas */}
      <div className="classroom-grid-view">
        {/* Top Root: COURSE */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div 
            onClick={() => setSelectedNode('COURSE')}
            className="neo-card neo-card-interactive"
            style={{
              display: 'inline-block',
              padding: '1rem 2rem',
              background: selectedNode === 'COURSE' ? 'var(--yellow)' : '#FFF',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>ROOT CURRICULUM</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 900 }}>
              QUANTUM COMPUTING — BEGINNER (QC-101)
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
              {nodeLearners.COURSE.map(s => (
                <div key={s.id} className="student-avatar-chip" style={{ background: s.avatarBg }} title={s.name}>
                  {s.initials}
                </div>
              ))}
            </div>
          </div>

          {/* Central Stem Line */}
          <div style={{ width: '4px', height: '40px', background: 'var(--ink)', margin: '0 auto', position: 'relative' }}>
            <span style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px' }}>▼</span>
          </div>
        </div>

        {/* 3 Branches: THEORY | LAB | CHALLENGE */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '1.5rem',
            position: 'relative',
            maxWidth: '1000px',
            margin: '0 auto 2.5rem'
          }}
        >
          {/* Node 1: THEORY */}
          <div 
            onClick={() => setSelectedNode('THEORY')}
            className="neo-card neo-card-interactive"
            style={{
              padding: '1.25rem',
              background: selectedNode === 'THEORY' ? 'var(--yellow)' : '#FFF',
              borderTop: '8px solid var(--yellow)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span className="neo-badge neo-badge-yellow">BRANCH 01</span>
              <BookOpen size={16} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>THEORY</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', margin: '0.25rem 0 0.75rem' }}>
              Qubit Kinematics &amp; Math
            </p>
            {/* Student avatar cluster */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {nodeLearners.THEORY.map(s => (
                <div key={s.id} className="student-avatar-chip" style={{ background: s.avatarBg }} title={s.name}>
                  {s.initials}
                </div>
              ))}
              <span style={{ marginLeft: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                {nodeLearners.THEORY.length} Learners
              </span>
            </div>
          </div>

          {/* Node 2: LAB (Bottleneck Highlight) */}
          <div 
            onClick={() => setSelectedNode('LAB')}
            className="neo-card neo-card-interactive"
            style={{
              padding: '1.25rem',
              background: selectedNode === 'LAB' ? 'var(--cyan)' : '#FFF',
              borderTop: '8px solid var(--cyan)',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <span className="neo-badge neo-badge-pink" style={{ position: 'absolute', top: '-12px', right: '10px' }}>
              ⚠️ ERWIN ALERT
            </span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span className="neo-badge neo-badge-cyan">BRANCH 02</span>
              <Cpu size={16} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>INTERACTIVE LAB</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', margin: '0.25rem 0 0.75rem' }}>
              Superposition &amp; Gate Circuits
            </p>
            {/* Student avatar cluster */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {nodeLearners.LAB.map(s => (
                <div key={s.id} className="student-avatar-chip" style={{ background: s.avatarBg }} title={s.name}>
                  {s.initials}
                </div>
              ))}
              <span style={{ marginLeft: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                {nodeLearners.LAB.length} Learners
              </span>
            </div>
          </div>

          {/* Node 3: CHALLENGE */}
          <div 
            onClick={() => setSelectedNode('CHALLENGE')}
            className="neo-card neo-card-interactive"
            style={{
              padding: '1.25rem',
              background: selectedNode === 'CHALLENGE' ? 'var(--pink)' : '#FFF',
              borderTop: '8px solid var(--pink)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span className="neo-badge neo-badge-pink">BRANCH 03</span>
              <CheckCircle size={16} />
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900 }}>CHALLENGE</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)', margin: '0.25rem 0 0.75rem' }}>
              Bell Pair &amp; Teleportation
            </p>
            {/* Student avatar cluster */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {nodeLearners.CHALLENGE.map(s => (
                <div key={s.id} className="student-avatar-chip" style={{ background: s.avatarBg }} title={s.name}>
                  {s.initials}
                </div>
              ))}
              <span style={{ marginLeft: '12px', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                {nodeLearners.CHALLENGE.length} Learners
              </span>
            </div>
          </div>
        </div>

        {/* Stem Connector into MASTERY */}
        <div style={{ width: '4px', height: '40px', background: 'var(--ink)', margin: '-1rem auto 1rem', position: 'relative' }}>
          <span style={{ position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)', fontSize: '12px' }}>▼</span>
        </div>

        {/* Bottom Destination: MASTERY */}
        <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
          <div 
            onClick={() => setSelectedNode('MASTERY')}
            className="neo-card neo-card-interactive"
            style={{
              padding: '1.5rem',
              background: selectedNode === 'MASTERY' ? 'var(--lime)' : '#FFF',
              border: 'var(--border-heavy)',
              boxShadow: 'var(--shadow-lg)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <Award size={20} />
              <span className="neo-badge neo-badge-dark">CERTIFICATION CAPSTONE</span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 900 }}>
              MASTERY VERIFIED
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', margin: '0.4rem 0 1rem' }}>
              Learners who successfully passed auto-grading across all 3 phases
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {nodeLearners.MASTERY.map(s => (
                <div key={s.id} className="student-avatar-chip" style={{ background: s.avatarBg }} title={s.name}>
                  {s.initials}
                </div>
              ))}
              <span style={{ marginLeft: '12px', fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                {nodeLearners.MASTERY.length} Students Certified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Selected Node Inspector Drawer */}
      <div className="neo-card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900 }}>
              INSPECTING NODE: {selectedNode}
            </h3>
            <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
              ACTIVE LEARNERS AT THIS MILESTONE
            </p>
          </div>
          <span className="neo-badge neo-badge-yellow">
            {nodeLearners[selectedNode]?.length || 0} LEARNERS
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {nodeLearners[selectedNode]?.map(s => (
            <div 
              key={s.id}
              onClick={() => { onSelectStudent(s); onNavigate('students'); }}
              style={{ border: '2px solid #000', padding: '0.9rem', background: '#FFF', cursor: 'pointer' }}
              className="neo-card-interactive"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: s.avatarBg, border: '2px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.8rem' }}>
                  {s.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-secondary)' }}>
                    Accuracy: {s.accuracy}% • {s.challengesCompleted} Challenges
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
