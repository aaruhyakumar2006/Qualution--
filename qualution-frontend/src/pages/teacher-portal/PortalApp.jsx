import React, { useState } from 'react';
import './styles/portal.css';
import Navbar from './components/Navbar';
import LandingHeroView from './components/LandingHeroView';
import DashboardView from './components/DashboardView';
import CourseManagementView from './components/CourseManagementView';
import LearningPathBuilderView from './components/LearningPathBuilderView';
import LessonStudioView from './components/LessonStudioView';
import ChallengeBuilderView from './components/ChallengeBuilderView';
import StudentManagementView from './components/StudentManagementView';
import TeacherAnalyticsView from './components/TeacherAnalyticsView';
import ErwinInsightsView from './components/ErwinInsightsView';
import WorkbenchView from './components/WorkbenchView';
import ResearchLabView from './components/ResearchLabView';
import ExperimentDetailView from './components/ExperimentDetailView';
import BackendAnalyticsView from './components/BackendAnalyticsView';
import CollaborationView from './components/CollaborationView';
import CertificationsView from './components/CertificationsView';
import ClassroomView from './components/ClassroomView';
import ResearchPublicationView from './components/ResearchPublicationView';
import SettingsView from './components/SettingsView';
import TelemetryPortal from './components/TelemetryPortal';
import { initialCourses, initialStudents, researchExperiments } from './data/portalData';

export default function App({ onLaunchIDE }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(initialCourses[0]);
  const [selectedExperiment, setSelectedExperiment] = useState(researchExperiments[0]);

  // Intercept 'workbench' → send teacher to the real Qualution IDE
  const handleSetActiveTab = (tab) => {
    if (tab === 'workbench' && typeof onLaunchIDE === 'function') {
      onLaunchIDE();
      return;
    }
    setActiveTab(tab);
  };

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setActiveTab('students');
  };

  const handleSelectCourse = (course) => {
    setSelectedCourse(course);
    setActiveTab('learning-paths');
  };

  const handleSelectExperiment = (exp) => {
    setSelectedExperiment(exp);
    setActiveTab('experiment-detail');
  };

  return (
    <div className="bg-grid" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Sticky Neo-Brutalist Navigation Bar */}
      <Navbar activeTab={activeTab} setActiveTab={handleSetActiveTab} />

      {/* Main View Router */}
      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {activeTab === 'home' && (
          <LandingHeroView onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'dashboard' && (
          <DashboardView 
            onNavigate={handleSetActiveTab}
            onSelectStudent={handleSelectStudent}
            onSelectCourse={handleSelectCourse}
          />
        )}

        {activeTab === 'courses' && (
          <CourseManagementView 
            onNavigate={handleSetActiveTab}
            onSelectCourse={handleSelectCourse}
          />
        )}

        {activeTab === 'learning-paths' && (
          <LearningPathBuilderView 
            selectedCourse={selectedCourse}
            onNavigate={handleSetActiveTab}
          />
        )}

        {activeTab === 'lesson-studio' && (
          <LessonStudioView onNavigate={handleSetActiveTab} />
        )}

        {(activeTab === 'challenges' || activeTab === 'challenge-builder') && (
          <ChallengeBuilderView onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'students' && (
          <StudentManagementView 
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            onNavigate={handleSetActiveTab}
          />
        )}

        {activeTab === 'analytics' && (
          <TeacherAnalyticsView onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'erwin-insights' && (
          <ErwinInsightsView onNavigate={handleSetActiveTab} />
        )}

        {/* 'workbench' tab is intercepted by handleSetActiveTab above — never renders here */}

        {activeTab === 'research' && (
          <ResearchLabView 
            onSelectExperiment={handleSelectExperiment}
            onNavigate={handleSetActiveTab}
          />
        )}

        {activeTab === 'experiment-detail' && (
          <ExperimentDetailView 
            selectedExperiment={selectedExperiment}
            onNavigate={handleSetActiveTab}
          />
        )}

        {activeTab === 'backend-analytics' && (
          <BackendAnalyticsView onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'collaboration' && (
          <CollaborationView onNavigate={handleSetActiveTab} onSelectExperiment={handleSelectExperiment} />
        )}

        {activeTab === 'certificates' && (
          <CertificationsView onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'classroom-view' && (
          <ClassroomView 
            onNavigate={handleSetActiveTab}
            onSelectStudent={handleSelectStudent}
          />
        )}

        {activeTab === 'export-publish' && (
          <ResearchPublicationView selectedExperiment={selectedExperiment} onNavigate={handleSetActiveTab} />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}

        {activeTab === 'telemetry' && (
          <TelemetryPortal onNavigate={handleSetActiveTab} />
        )}
      </main>



      {/* Footer */}
      <footer 
        style={{
          background: 'var(--paper-cream)',
          borderTop: 'var(--border-heavy)',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.78rem',
          fontWeight: 700
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <span className="neo-badge neo-badge-yellow">QUALUTION ARCHITECTURE</span>
          <span>CAMPUS: SSN-SNUC CHENNAI</span>
          <span>•</span>
          <span>THEME: INVENTE '26 NEO-BRUTALISM</span>
        </div>
        <p style={{ color: 'var(--ink-secondary)' }}>
          © 2026 QUALUTION QUANTUM PLATFORM • TEACHER &amp; RESEARCHER ENVIRONMENT • ALL 18 ARCHITECTURAL SPECIFICATIONS IMPLEMENTED
        </p>
      </footer>
    </div>
  );
}
