import React, { useState, useEffect } from 'react';
import { 
  BarChart2, TrendingUp, AlertTriangle, Users, 
  Sparkles, Award, ArrowRight, ShieldCheck, Download 
} from 'lucide-react';
import { conceptMasteryData, misconceptionMapData, teacherOverview as fallbackOverview } from '../data/portalData';
import { fetchTeacherOverview } from '../api/teacherSupabaseApi';

export default function TeacherAnalyticsView({ onNavigate }) {
  const [overview, setOverview] = useState(fallbackOverview);

  useEffect(() => {
    let isMounted = true;
    fetchTeacherOverview().then(data => {
      if (isMounted && data) {
        setOverview(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">PEDAGOGICAL INTELLIGENCE</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              ERWIN DIAGNOSTIC TELEMETRY
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            LEARNING ANALYTICS
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Real-time concept mastery tracking, misconception mapping, and student cognitive models.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => onNavigate('erwin-insights')} className="btn-neo btn-neo-pink">
            <Sparkles size={16} />
            <span>ERWIN INSIGHTS</span>
          </button>
          <button onClick={() => onNavigate('research')} className="btn-neo btn-neo-white">
            <Download size={16} />
            <span>GO TO RESEARCH LAB</span>
          </button>
        </div>
      </div>

      {/* Top 3 Impact Metric Blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--yellow)' }}>COHORT</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>{overview.students || 0}</div>
          <div className="impact-label">ACTIVE LEARNERS</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.3rem' }}>
            Across {overview.activeCourses || 0} active courses
          </div>
        </div>

        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--lime)' }}>PROFICIENCY</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>{overview.completionRate || '0%'}</div>
          <div className="impact-label">AVG MASTERY</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.3rem' }}>
            {overview.students > 0 ? 'Live telemetry tracked' : '0% Average'}
          </div>
        </div>

        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--pink)' }}>PACING</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>{overview.completionRate || '0%'}</div>
          <div className="impact-label">COMPLETION</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.3rem' }}>
            {overview.students > 0 ? 'Course completion pacing' : 'No active data'}
          </div>
        </div>
      </div>

      {/* Main Analytics Grid: Concept Mastery + Misconception Map */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.5rem' }}>
        {/* Graph 1: Concept Mastery */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>CONCEPT MASTERY</h2>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>COHORT PROFICIENCY BY DOMAIN</p>
            </div>
            <span className="neo-badge neo-badge-lime">UPDATED REAL-TIME</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {conceptMasteryData.map((item) => (
              <div key={item.concept}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{item.concept}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9rem' }}>{item.percentage}%</span>
                </div>
                {/* Visual Bar matching neo-brutalist prompt */}
                <div style={{ height: '22px', border: '2px solid #000', background: 'var(--paper-tint)', padding: '2px', boxShadow: '2px 2px 0px #000' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: item.barWidth, 
                      background: item.color,
                      transition: 'width 0.5s ease',
                      borderRight: '2px solid #000'
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: 'var(--paper-cream)', border: '1.5px solid #000', fontSize: '0.75rem' }}>
            <strong>Analysis:</strong> Learners demonstrate exceptional grasp of single-qubit kinematics (94%), with expected drop-off at multi-qubit entanglement (63%) and Grover diffusion operator scaling (52%).
          </div>
        </div>

        {/* Graph 2: Misconception Map */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>MISCONCEPTION MAP</h2>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>ERWIN COGNITIVE ANOMALY DETECTION</p>
            </div>
            <span className="neo-badge neo-badge-pink">{misconceptionMapData.length} ACTIVE PATTERNS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {misconceptionMapData.map((misc) => (
              <div 
                key={misc.name}
                style={{
                  border: '2px solid #000',
                  padding: '1rem',
                  background: misc.impact === 'High' ? '#FFF5F5' : '#FFFDF5',
                  boxShadow: '2px 2px 0px #000'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.92rem', color: misc.impact === 'High' ? 'var(--crimson)' : 'var(--ink)' }}>
                    {misc.name}
                  </strong>
                  <span className={`neo-badge ${misc.impact === 'High' ? 'neo-badge-pink' : 'neo-badge-yellow'}`}>
                    {misc.count} STUDENTS
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
                  <strong>Intervention:</strong> {misc.recommendation}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
            <button
              onClick={() => onNavigate('erwin-insights')}
              className="btn-neo btn-neo-yellow btn-neo-sm"
              style={{ width: '100%' }}
            >
              <span>OPEN ERWIN INTELLIGENCE CONSOLE</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
