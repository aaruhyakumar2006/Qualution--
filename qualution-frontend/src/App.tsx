import React, { useState, useEffect } from 'react';
import { IDEPage } from './pages/IDEPage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LearnPage } from './pages/LearnPage';
import { LessonScreen } from './pages/LessonScreen';
import { LessonPlayerPage } from './pages/LessonPlayerPage';
import { VisualLessonPlayerPage } from './pages/VisualLessonPlayerPage';
import { TeacherPortalPage } from './pages/TeacherPortalPage';
import { StudentPortalPage } from './pages/StudentPortalPage';
import { CertificateVerificationPage } from './pages/CertificateVerificationPage';
import { WasmTestPage } from './pages/WasmTestPage';
import { PortalPage } from './features/portal';
import { ThemeProvider } from './features/theme/ThemeContext';
import { AuthProvider } from './features/auth/AuthContext';
import { LoginModal } from './features/auth/LoginModal';
import { SignUpModal } from './features/auth/SignUpModal';
import { getOnboardingStatus } from './api/onboardingApi';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { GlobalErwinCompanion } from './components/common/GlobalErwinCompanion';
import { MarioCompanionOverlay } from './components/common/MarioCompanionOverlay';
import type { CircuitRequest } from './features/circuit/types';
import { QUANTUM_CURRICULUM, type LessonModule } from './features/learning/curriculumData';
import type { LessonWorkbenchHandoff } from './features/theory/lessonHandoff';

export type AppView =
  | 'landing'
  | 'ide'
  | 'login'
  | 'signup'
  | 'onboarding'
  | 'learn'
  | 'lesson-screen'
  | 'theory-lesson'
  | 'player'
  | 'teacher-portal'
  | 'student-portal'
  | 'portal'
  | 'certificate'
  | 'wasm-test';

export interface AppProps {
  initialCircuit?: CircuitRequest;
  initialRoute?: string;
  initialLessonId?: string;
  initialTheoryLessonId?: string;
}

const THEORY_TO_PRACTICAL_MAP: Record<string, string> = {
  's1-theory-what-is-quantum': 's1-initialize-measure',
  's1-theory-qubits-states': 's1-x-gate',
  's1-theory-computational-basis': 's1-initialize-measure',
  's1-theory-superposition': 's1-hadamard-superposition',
  's1-theory-measurement-probability': 's1-single-qubit-challenge',
  's1-theory-phase-shift': 's1-z-phase',
  's1-theory-interference': 's1-gate-ordering',
  's1-theory-multi-qubit': 's2-bell-state-entanglement',
  's1-theory-entanglement': 's2-bell-state-entanglement',
  's1-theory-grover': 'lesson-8-grovers-search',
  'lesson-8-grovers-search': 'lesson-8-grovers-search',
  'lesson-8': 'lesson-8-grovers-search',
  's2-grover-search': 'lesson-8-grovers-search',
  'grover-2q-11': 'lesson-8-grovers-search',
  'grover-2q': 'lesson-8-grovers-search',
  'grover-algorithm': 'lesson-8-grovers-search',
  'grover': 'lesson-8-grovers-search',
  's1-theory-assessment': 's1-assessment',
};

export const App: React.FC<AppProps> = ({ initialCircuit, initialRoute, initialLessonId, initialTheoryLessonId }) => {
  const parseTheoryLessonId = (routeStr?: string): string | undefined => {
    if (initialTheoryLessonId) return initialTheoryLessonId;
    if (routeStr && routeStr.includes('theory-lesson=')) {
      const match = routeStr.match(/[?&]theory-lesson=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    if (routeStr && routeStr.includes('theory=')) {
      const match = routeStr.match(/[?&]theory=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const qTheoryLesson = searchParams.get('theory-lesson');
        if (qTheoryLesson) return qTheoryLesson;
        const qTheory = searchParams.get('theory');
        if (qTheory) return qTheory;
      } catch {
        // Ignore
      }
    }
    return undefined;
  };

  const parseLessonId = (routeStr?: string): string | undefined => {
    if (initialLessonId) return initialLessonId;
    if (routeStr && (routeStr.includes('lesson=') || routeStr.includes('assessment='))) {
      const match = routeStr.match(/[?&](?:lesson|assessment)=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    if (typeof window !== 'undefined') {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const qLesson = searchParams.get('lesson') || searchParams.get('assessment');
        if (qLesson) return qLesson;

        const qTheory = searchParams.get('theory');
        if (qTheory && THEORY_TO_PRACTICAL_MAP[qTheory]) {
          return THEORY_TO_PRACTICAL_MAP[qTheory];
        }

        if (window.location.hash.includes('lesson=') || window.location.hash.includes('assessment=')) {
          const hashPart = window.location.hash.split('?')[1];
          if (hashPart) {
            const hashParams = new URLSearchParams(hashPart);
            const hLesson = hashParams.get('lesson') || hashParams.get('assessment');
            if (hLesson) return hLesson;
          }
        }
      } catch {
        // Ignore
      }
    }
    return undefined;
  };

  const parseRoute = (routeStr?: string): AppView => {
    if (routeStr) {
      if (routeStr.includes('collab') || routeStr.includes('collaborative')) return 'ide';
      if (routeStr.includes('certificate') || routeStr.includes('verify=') || routeStr.includes('cert=')) return 'certificate';
      if (routeStr.includes('teacher')) return 'teacher-portal';
      if (routeStr.includes('student')) return 'student-portal';
      if (routeStr === 'portal' || routeStr === '/portal' || routeStr === '#portal' || (routeStr.includes('portal') && !routeStr.includes('teacher') && !routeStr.includes('student'))) return 'portal';
      if (routeStr.includes('player')) return 'player';
      if (routeStr.includes('theory-lesson=')) return 'theory-lesson';
      if (routeStr.includes('theory=')) return 'learn';
      if (routeStr.includes('skill-tree') || routeStr.includes('learn') || routeStr.includes('academy')) return 'learn';
      if (routeStr.includes('lesson=') || routeStr.includes('assessment=')) return 'ide';
      if (routeStr === 'certificate' || routeStr === '/certificate' || routeStr === '#certificate') return 'certificate';
      if (routeStr === 'login' || routeStr === '/login' || routeStr === '#login') return 'login';
      if (routeStr === 'signup' || routeStr === '/signup' || routeStr === '#signup' || routeStr === '/register' || routeStr === '#register') return 'signup';
      if (routeStr === 'onboarding' || routeStr === '/onboarding' || routeStr === '#onboarding') return 'onboarding';
      if (routeStr === 'landing' || routeStr === '/') return 'landing';
      if (routeStr === 'ide' || routeStr === 'studio' || routeStr === '/studio') return 'ide';
      if (routeStr.includes('wasm') || routeStr === 'wasm-test' || routeStr === '/wasm-test' || routeStr === '#wasm-test') return 'wasm-test';
      if (routeStr === 'lesson-screen' || routeStr === '/lesson-screen') return 'lesson-screen';
    }
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      const path = window.location.pathname;

      // 1. Explicit hash view overrides take priority over stale query params
      if (hash.includes('collab') || hash.includes('collaborative')) return 'ide';
      if (hash.includes('certificate') || hash.includes('cert') || hash.includes('verify')) return 'certificate';
      if (hash.includes('teacher')) return 'teacher-portal';
      if (hash.includes('student')) return 'student-portal';
      if (hash === '#portal' || (hash.includes('portal') && !hash.includes('teacher') && !hash.includes('student'))) return 'portal';
      if (hash.includes('player')) return 'player';
      if (hash.includes('theory-lesson')) return 'theory-lesson';
      if (hash.includes('skill-tree') || hash.includes('learn') || hash.includes('academy') || hash.includes('curriculum') || hash.includes('how-it-works') || hash.includes('faq')) return 'learn';
      if (hash.includes('login')) return 'login';
      if (hash.includes('signup') || hash.includes('register')) return 'signup';
      if (hash.includes('onboarding')) return 'onboarding';
      if (hash.includes('wasm')) return 'wasm-test';
      if (hash === '#landing') return 'landing';
      if (hash.startsWith('#ide') || hash.startsWith('#studio') || hash.includes('lesson=') || hash.includes('assessment=')) return 'ide';
      if (hash === '#lesson-screen') return 'lesson-screen';

      // 2. Query param routing
      if (search.includes('verify=') || search.includes('cert=') || search.includes('certificate')) return 'certificate';
      if (search.includes('collab') || search.includes('room=')) return 'ide';
      if (search.includes('teacher')) return 'teacher-portal';
      if (search.includes('student')) return 'student-portal';
      if (search.includes('portal') && !search.includes('teacher') && !search.includes('student')) return 'portal';
      if (search.includes('player')) return 'player';
      if (search.includes('theory-lesson=')) return 'theory-lesson';
      if (search.includes('theory=')) return 'learn';
      if (search.includes('wasm')) return 'wasm-test';
      if (search.includes('lesson=') || search.includes('assessment=')) return 'ide';

      // 3. Path routing
      if (path.includes('/certificate') || path.includes('/verify')) return 'certificate';
      if (path.includes('/collab') || path.includes('/collaborative')) return 'ide';
      if (path.includes('/teacher')) return 'teacher-portal';
      if (path.includes('/student')) return 'student-portal';
      if (path === '/portal' || path.startsWith('/portal/') || (path.includes('/portal') && !path.includes('/teacher') && !path.includes('/student'))) return 'portal';
      if (path.includes('/player')) return 'player';
      if (path.includes('/theory-lesson')) return 'theory-lesson';
      if (path.includes('/login')) return 'login';
      if (path.includes('/signup') || path.includes('/register')) return 'signup';
      if (path.includes('/onboarding')) return 'onboarding';
      if (path.includes('/learn') || path.includes('/academy')) return 'learn';
      if (path.includes('/studio') || path.includes('/ide')) return 'ide';
      if (path.includes('/wasm')) return 'wasm-test';
      if (path.includes('/lesson-screen')) return 'lesson-screen';
    }
    return import.meta.env.MODE === 'test' ? 'ide' : 'landing';
  };

  const resolveAssessment = (lessonId?: string): LessonModule | null => {
    if (!lessonId) return null;
    return QUANTUM_CURRICULUM.find((m) => m.id === lessonId) || null;
  };

  const [currentView, setCurrentView] = useState<AppView>(() => parseRoute(initialRoute));
  const [activeAssessment, setActiveAssessment] = useState<LessonModule | null>(() => {
    const lId = parseLessonId(initialRoute);
    return resolveAssessment(lId);
  });
  const [activeCircuit, setActiveCircuit] = useState<CircuitRequest | undefined>(initialCircuit);
  const [activeLessonId, setActiveLessonId] = useState<string | undefined>(() => parseLessonId(initialRoute));
  const [activeTheoryLessonId, setActiveTheoryLessonId] = useState<string | undefined>(() => parseTheoryLessonId(initialRoute));
  const [activeLessonHandoff, setActiveLessonHandoff] = useState<LessonWorkbenchHandoff | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignUpModalOpen, setIsSignUpModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      setCurrentView(parseRoute());
      const lId = parseLessonId();
      setActiveLessonId(lId);
      setActiveAssessment(resolveAssessment(lId));
      setActiveTheoryLessonId(parseTheoryLessonId());
    };

    const onLogout = () => {
      setCurrentView('landing');
      setActiveLessonId(undefined);
      setActiveAssessment(null);
      setActiveTheoryLessonId(undefined);
      setActiveCircuit(undefined);
      setActiveLessonHandoff(null);
    };

    window.addEventListener('popstate', onPopState);
    window.addEventListener('hashchange', onPopState);
    window.addEventListener('qualution:logout', onLogout);
    return () => {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('hashchange', onPopState);
      window.removeEventListener('qualution:logout', onLogout);
    };
  }, []);

  const navigateTo = (
    view: AppView | string,
    params?: { theoryLessonId?: string; experimentId?: string; handoff?: LessonWorkbenchHandoff }
  ) => {
    const resolvedView = parseRoute(view);
    setCurrentView(resolvedView);
    
    // Update theory lesson ID if provided
    if (params?.theoryLessonId !== undefined) {
      setActiveTheoryLessonId(params.theoryLessonId);
    }

    // Handle Phase 13 structured lesson handoff
    if (resolvedView === 'ide' && params?.handoff) {
      setActiveLessonHandoff(params.handoff);
      setActiveCircuit(params.handoff.circuit);
      const handoffLessonId = params.handoff.lessonId;
      setActiveLessonId(handoffLessonId || undefined);
      setActiveAssessment(resolveAssessment(handoffLessonId));
    } else if (resolvedView === 'ide' && !params?.handoff && !params?.experimentId) {
      // Direct IDE access clears prior lesson handoff
      setActiveLessonHandoff(null);
    }
    
    // Handle experiment preset for Workbench
    if (resolvedView === 'ide' && params?.experimentId) {
      setActiveLessonHandoff(null);
      import('./features/learning/experimentPresets').then(({ getExperimentPreset }) => {
        const experiment = getExperimentPreset(params.experimentId);
        if (experiment) {
          setActiveCircuit(experiment.circuit);
          setActiveLessonId(undefined); // Clear any active lesson
          setActiveAssessment(null);
        } else {
          console.error(`[App] Experiment preset not found: ${params.experimentId}`);
          setActiveCircuit(undefined);
        }
      });
    }
    
    if (typeof window !== 'undefined' && window.history) {
      let targetUrl = '';
      
      if (resolvedView === 'theory-lesson' && params?.theoryLessonId) {
        targetUrl = `?theory-lesson=${params.theoryLessonId}`;
      } else if (resolvedView === 'ide' && params?.experimentId) {
        targetUrl = `?experiment=${params.experimentId}`;
      } else {
        const targetHash = resolvedView === 'landing' ? '' : `#${resolvedView}`;
        targetUrl = targetHash ? `${window.location.pathname}${targetHash}` : window.location.pathname;
      }
      
      window.history.pushState({ view: resolvedView }, '', targetUrl);
    }
  };

  const handlePostAuthSuccess = (intendedRole?: 'student' | 'teacher') => {
    let role = intendedRole;
    if (!role && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('qualution_user_data');
        if (raw) {
          const u = JSON.parse(raw);
          if (u.role === 'teacher') role = 'teacher';
          else role = 'student';
        }
      } catch {
        role = 'student';
      }
    }

    if (role === 'teacher') {
      navigateTo('teacher-portal');
    } else {
      navigateTo('student-portal');
    }
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        {currentView === 'landing' && (
          <LandingPage
            onLaunchIDE={() => {
              setActiveAssessment(null);
              setActiveLessonId(undefined);
              navigateTo('ide');
            }}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenSignUp={() => setIsSignUpModalOpen(true)}
            onNavigateLearn={() => navigateTo('learn')}
            onNavigateTeacherPortal={() => navigateTo('teacher-portal')}
            onNavigateStudentPortal={() => navigateTo('student-portal')}
            onNavigateCollab={() => navigateTo('collaborative')}
          />
        )}

        {currentView === 'teacher-portal' && (
          <TeacherPortalPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateStudentPortal={() => navigateTo('student-portal')}
            onNavigateCollab={() => navigateTo('ide')}
            onLaunchIDE={() => navigateTo('ide')}
            onNavigateLearn={() => navigateTo('learn')}
          />
        )}

        {currentView === 'student-portal' && (
          <StudentPortalPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateTeacherPortal={() => navigateTo('teacher-portal')}
            onNavigateCollab={() => navigateTo('ide')}
            onLaunchIDE={() => navigateTo('ide')}
            onNavigateLearn={() => navigateTo('learn')}
          />
        )}

        {currentView === 'certificate' && (
          <CertificateVerificationPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateStudio={() => navigateTo('ide')}
            onNavigateStudentPortal={() => navigateTo('student-portal')}
          />
        )}

        {currentView === 'learn' && (
          <LearnPage
            initialTheoryLessonId={parseTheoryLessonId(initialRoute)}
            onLaunchIDE={(assessmentCircuit, assessmentData, guidedLessonId) => {
              if (guidedLessonId) {
                setActiveLessonId(guidedLessonId);
                setActiveCircuit(undefined);
                setActiveAssessment(null);
                navigateTo('ide');
                if (typeof window !== 'undefined' && window.history) {
                  window.history.pushState({ view: 'ide', lesson: guidedLessonId }, '', `?lesson=${guidedLessonId}`);
                }
                return;
              }
              setActiveLessonId(undefined);
              if (assessmentCircuit) {
                setActiveCircuit(assessmentCircuit);
              }
              setActiveAssessment(assessmentData || null);
              navigateTo('ide');
            }}
            onLaunchTheoryLesson={(theoryLessonId) => {
              navigateTo('theory-lesson', { theoryLessonId });
            }}
            onNavigateHome={() => navigateTo('landing')}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            onOpenSignUp={() => setIsSignUpModalOpen(true)}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateSignUp={() => navigateTo('signup')}
            onSuccess={handlePostAuthSuccess}
          />
        )}

        {currentView === 'signup' && (
          <SignUpPage
            onNavigateHome={() => navigateTo('landing')}
            onNavigateLogin={() => navigateTo('login')}
            onSuccess={handlePostAuthSuccess}
            onNavigateTeacherPortal={() => navigateTo('teacher-portal')}
            onNavigateStudentPortal={() => navigateTo('student-portal')}
          />
        )}

        {currentView === 'onboarding' && (
          <OnboardingPage
            onNavigateHome={() => navigateTo('landing')}
            onComplete={() => navigateTo('ide')}
          />
        )}

        {currentView === 'ide' && (
          <IDEPage
            initialCircuit={activeCircuit}
            initialLessonId={activeLessonId}
            onNavigateHome={() => navigateTo('landing')}
            onNavigateLearn={() => navigateTo('learn')}
            onNavigateTeacherPortal={() => navigateTo('teacher-portal')}
            onNavigateStudentPortal={() => navigateTo('student-portal')}
            onNavigateTheory={() =>
              navigateTo('theory-lesson', {
                theoryLessonId: activeTheoryLessonId || 'qubit-superposition-checkpoint',
              })
            }
            activeAssessment={activeAssessment}
            lessonHandoff={activeLessonHandoff}
          />
        )}

        {currentView === 'lesson-screen' && (
          <LessonScreen />
        )}

        {currentView === 'player' && (
          <VisualLessonPlayerPage onNavigateBack={() => navigateTo('learn')} />
        )}

        {currentView === 'wasm-test' && (
          <WasmTestPage />
        )}

        {currentView === 'portal' && (
          <PortalPage
            onNavigateHome={() => navigateTo('landing')}
            onOpenLogin={() => setIsLoginModalOpen(true)}
          />
        )}

        {currentView === 'theory-lesson' && activeTheoryLessonId && (
          <ErrorBoundary context="Theory Lesson Player" onError={(error) => {
            console.error('[App] Lesson player error:', error);
          }}>
            <LessonPlayerPage
              lessonId={activeTheoryLessonId}
              onNavigateBack={() => navigateTo('learn')}
              onLessonComplete={(lessonId) => {
                console.log(`[App] Lesson completed: ${lessonId}`);
              }}
              onLaunchExperiment={(experimentId) => {
                console.log(`[App] Launching experiment preset: ${experimentId}`);
                navigateTo('ide', { experimentId });
              }}
              onLaunchWorkbench={(handoff) => {
                console.log(`[App] Launching Workbench with handoff from: ${handoff.lessonId}`);
                navigateTo('ide', { handoff });
              }}
            />
          </ErrorBoundary>
        )}

        {/* Modal fallback for contextual interactions */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onSwitchToSignUp={() => {
            setIsLoginModalOpen(false);
            setIsSignUpModalOpen(true);
          }}
          onSuccess={handlePostAuthSuccess}
        />

        <SignUpModal
          isOpen={isSignUpModalOpen}
          onClose={() => setIsSignUpModalOpen(false)}
          onSwitchToLogin={() => {
            setIsSignUpModalOpen(false);
            setIsLoginModalOpen(true);
          }}
          onSuccess={handlePostAuthSuccess}
        />

        {/* Persistent Global Mario Companion — Active across entire website on all pages */}
        <GlobalErwinCompanion size={96} showBubble={false} />

        {/* Mario Misconception Engine Companion Overlay — Feature Flag Gated */}
        {import.meta.env.VITE_ENABLE_MARIO_ENGINE === 'true' && (
          <MarioCompanionOverlay currentTurn={null} />
        )}


      </AuthProvider>
    </ThemeProvider>
  );
};
export default App;
