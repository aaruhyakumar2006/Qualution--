import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, CheckCircle, Award, Cpu, 
  Sparkles, ArrowRight, AlertTriangle, Plus, 
  Activity, Play, ExternalLink, RefreshCw, Zap
} from 'lucide-react';
import { teacherOverview as fallbackOverview, erwinIntel } from '../data/portalData';
import { fetchTeacherOverview, fetchErwinInsights, fetchCourses, fetchStudents } from '../api/teacherSupabaseApi';

export default function DashboardView({ onNavigate, onSelectStudent, onSelectCourse }) {
  const [interventionDeployed, setInterventionDeployed] = useState(false);
  const [overview, setOverview] = useState(fallbackOverview);
  const [insights, setInsights] = useState([]);
  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetchTeacherOverview().then(data => {
      if (isMounted && data) {
        setOverview(data);
      }
    });
    fetchErwinInsights().then(data => {
      if (isMounted && data) {
        setInsights(data);
      }
    });
    fetchCourses().then(data => {
      if (isMounted && data) {
        setCourses(data);
      }
    });
    fetchStudents().then(data => {
      if (isMounted && data) {
        setStudents(data);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const teacherOverview = overview;
  const activeInsight = insights.length > 0 ? insights[0] : null;

  const handleDeployIntervention = () => {
    setInterventionDeployed(true);
    setTimeout(() => {
      alert("✅ Targeted Intervention Deployed! Lesson 04 Born Rule drill pushed to 24 affected students.");
    }, 200);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Dashboard Hero Greeting */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span className="neo-badge neo-badge-yellow">PROFESSOR DASHBOARD</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-secondary)' }}>
              AUTUMN SEMESTER 2026
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', fontWeight: 900, lineHeight: 1.1 }}>
            Good morning, Professor.
          </h1>
          <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
            Your teaching overview
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
          <button
            onClick={() => onNavigate('courses')}
            className="btn-neo btn-neo-yellow"
          >
            <Plus size={16} />
            <span>CREATE COURSE</span>
          </button>

          <button
            onClick={() => onNavigate('workbench')}
            className="btn-neo btn-neo-lime"
          >
            <Cpu size={16} />
            <span>OPEN WORKBENCH</span>
          </button>

          <button
            onClick={() => onNavigate('classroom-view')}
            className="btn-neo btn-neo-pink"
          >
            <Activity size={16} />
            <span>CLASSROOM MAP</span>
          </button>
        </div>
      </div>

      {/* 6 Metric Cards */}
      <div className="kpi-grid">
        {/* Card 1 */}
        <div className="kpi-card kpi-yellow neo-card-interactive" onClick={() => onNavigate('courses')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">ACTIVE COURSES</div>
          <div className="kpi-val">{String(teacherOverview.activeCourses || 0).padStart(2, '0')}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.activeCourses > 0 ? `${teacherOverview.activeCourses} Active Cohorts` : '0 Active Cohorts'}</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 2 */}
        <div className="kpi-card kpi-lime neo-card-interactive" onClick={() => onNavigate('students')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">STUDENTS</div>
          <div className="kpi-val">{teacherOverview.students || 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.students > 0 ? 'Enrolled Students' : '0 Registered'}</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 3 */}
        <div className="kpi-card kpi-pink neo-card-interactive" onClick={() => onNavigate('analytics')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">COMPLETION</div>
          <div className="kpi-val">{teacherOverview.completionRate || '0%'}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.students > 0 ? 'Cohort Average' : '0% Completion'}</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="kpi-card kpi-cyan neo-card-interactive" onClick={() => onNavigate('challenges')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">CHALLENGES</div>
          <div className="kpi-val">{teacherOverview.challenges || 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.challenges > 0 ? `${teacherOverview.challenges} Auto-graded` : '0 Auto-graded'}</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 5 */}
        <div className="kpi-card kpi-purple neo-card-interactive" onClick={() => onNavigate('certificates')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">CERTIFICATES</div>
          <div className="kpi-val">{teacherOverview.certificates || 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.certificates > 0 ? `${teacherOverview.certificates} Issued` : '0 Issued'}</span>
            <ArrowRight size={14} />
          </div>
        </div>

        {/* Card 6 */}
        <div className="kpi-card kpi-orange neo-card-interactive" onClick={() => onNavigate('workbench')} style={{ cursor: 'pointer' }}>
          <div className="kpi-title">CIRCUITS</div>
          <div className="kpi-val">{(teacherOverview.circuitsRun || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{teacherOverview.circuitsRun > 0 ? 'Engines Active' : '0 Runs Recorded'}</span>
            <ArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* Erwin AI Priority Intervention Alert Banner */}
      <div 
        className="neo-card"
        style={{
          marginTop: '1.75rem',
          background: '#FFFDF0',
          borderLeft: '12px solid var(--yellow)',
          padding: '1.25rem 1.5rem',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', maxWidth: '850px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                background: 'var(--yellow)',
                border: '2px solid #000',
                boxShadow: '2px 2px 0px #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                <span className="neo-badge neo-badge-pink">ERWIN MISCONCEPTION RADAR</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                  {activeInsight && activeInsight.affectedStudentsCount > 0 ? `${activeInsight.affectedStudentsCount} LEARNERS AFFECTED` : '0 LEARNERS AFFECTED'}
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                {activeInsight && activeInsight.affectedStudentsCount > 0 ? activeInsight.title : erwinIntel.highlightedIssue.title}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--ink-secondary)', marginTop: '0.25rem' }}>
                <strong>Recommended action:</strong> {activeInsight && activeInsight.affectedStudentsCount > 0 ? activeInsight.recommendedAction : erwinIntel.highlightedIssue.recommendedIntervention}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleDeployIntervention}
              className="btn-neo btn-neo-yellow btn-neo-sm"
              disabled={interventionDeployed}
              style={{ opacity: interventionDeployed ? 0.7 : 1 }}
            >
              <Zap size={14} />
              <span>{interventionDeployed ? 'INTERVENTION DEPLOYED' : 'DEPLOY TARGETED CHALLENGE'}</span>
            </button>

            <button
              onClick={() => onNavigate('erwin-insights')}
              className="btn-neo btn-neo-white btn-neo-sm"
            >
              <span>VIEW ERWIN REASONING</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Courses + Real-time Student Submissions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.75rem' }}>
        {/* Active Courses Card */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>ACTIVE COURSES</h2>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>COHORTS IN PROGRESS</p>
            </div>
            <button onClick={() => onNavigate('courses')} className="btn-neo btn-neo-white btn-neo-sm">
              VIEW ALL
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {courses.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--ink-secondary)', border: '2px dashed #000' }}>
                No active courses configured in database yet.
              </div>
            ) : (
              courses.slice(0, 3).map((c) => (
                <div 
                  key={c.id} 
                  onClick={() => { onSelectCourse(c); onNavigate('learning-paths'); }}
                  style={{
                    border: '2px solid #000',
                    padding: '1rem',
                    background: 'var(--paper-cream)',
                    boxShadow: '2px 2px 0px #000',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease'
                  }}
                  className="neo-card-interactive"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{c.title}</span>
                    <span className="neo-badge neo-badge-yellow">{c.level}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)', marginBottom: '0.65rem' }}>
                    <span>{c.modulesCount || c.modules || 0} Modules</span>
                    <span>•</span>
                    <span>{c.challengesCompleted || 0} Challenges</span>
                    <span>•</span>
                    <span>{c.studentsCount || c.students || 0} Students</span>
                  </div>
                  {/* Progress bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                      <span>Cohort Completion</span>
                      <span>{c.progress || c.completion || 0}%</span>
                    </div>
                    <div style={{ height: '8px', border: '1.5px solid #000', background: '#FFF' }}>
                      <div style={{ height: '100%', width: `${c.progress || c.completion || 0}%`, background: 'var(--lime)' }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Student Telemetry & Circuit Attempts */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800 }}>LIVE CLASS TELEMETRY</h2>
              <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>RECENT STUDENT CIRCUITS &amp; LABS</p>
            </div>
            <button onClick={() => onNavigate('students')} className="btn-neo btn-neo-white btn-neo-sm">
              ALL LEARNERS
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {students.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', color: 'var(--ink-secondary)', border: '2px dashed #000' }}>
                No student activity recorded in database yet.
              </div>
            ) : (
              students.slice(0, 4).map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSelectStudent(s)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    border: '1.5px solid #000',
                    background: '#FFF',
                    cursor: 'pointer'
                  }}
                  className="neo-card-interactive"
                >
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
                        fontWeight: 800,
                        fontSize: '0.8rem'
                      }}
                    >
                      {s.initials || (s.name ? s.name.split(' ').map(n => n[0]).join('') : 'ST')}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{s.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-secondary)' }}>
                        {(s.course || '').split('—')[0]} • {s.challengesCompleted || 0} Challenges
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 800, color: s.accuracy > 85 ? 'var(--ink)' : 'var(--crimson)' }}>
                      {s.accuracy}% Accuracy
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>
                      {s.lastActive}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button
              onClick={() => onNavigate('classroom-view')}
              className="btn-neo btn-neo-cyan btn-neo-sm"
              style={{ width: '100%' }}
            >
              <span>INSPECT UNIFIED CLASSROOM TREE</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
