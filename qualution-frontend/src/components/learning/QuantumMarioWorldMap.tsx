import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Play, BookOpen, X, Check, Trophy, ChevronRight, ChevronLeft, Sparkles, Clock, Zap, Lock, Unlock, Compass, MoveHorizontal } from 'lucide-react';
import { QUANTUM_CURRICULUM, type LessonModule } from '../../features/learning/curriculumData';
import type { CircuitRequest } from '../../features/circuit/types';
import './QuantumMarioWorldMap.css';

export interface QuantumChallengeItem {
  id: string;
  challengeNumber: string;
  category: 'guided' | 'foundation' | 'algorithm' | 'advanced';
  categoryLabel: string;
  title: string;
  badge: string;
  description: string;
  criteriaSummary: string;
  requiredGates?: string[];
  targetState?: string;
  duration: string;
  xpReward: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  type: 'task' | 'curriculum' | 'guided';
  guidedLessonId?: string;
  curriculumModuleId?: string;
  taskModule?: LessonModule;
}

export type MapNodeType = 'curriculum' | 'pipe' | 'mystery' | 'star' | 'boss';

export interface UnifiedMapNode {
  id: string;
  nodeType: MapNodeType;
  isChallenge: boolean;
  label: string;
  shortTitle: string;
  title: string;
  worldNumber: 1 | 2 | 3;
  xPercent: number;
  yPercent: number;
  xpReward: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  category?: 'guided' | 'foundation' | 'algorithm' | 'advanced';
  curriculumModule?: LessonModule;
  challenge?: QuantumChallengeItem;
  targetState?: string;
  requiredGates?: string[];
  formula?: string;
  description: string;
  alignedLessonTitle?: string;
}

export interface CurriculumTrack {
  id: string;
  trackNumber: number;
  title: string;
  level: string;
  description: string;
  modules: LessonModule[];
}

export interface QuantumMarioWorldMapProps {
  completedLessonIds: string[];
  totalXP: number;
  challenges: QuantumChallengeItem[];
  tracks: CurriculumTrack[];
  onLaunchAssessment: (lesson: LessonModule) => void;
  onLaunchChallenge: (challenge: QuantumChallengeItem) => void;
  onOpenTheoryLesson: (theoryId: string) => void;
  onLaunchIDE: (starterCircuit?: CircuitRequest, lesson?: LessonModule, guidedLessonId?: string) => void;
  onSelectLessonModule?: (lesson: LessonModule) => void;
  isChallengeCompleted: (challenge: QuantumChallengeItem) => boolean;
}

export type PathMode = 'beginner' | 'intermediate' | 'advanced' | 'single-pathway';

// Continuous world dimensions in pixels
const WORLD_WIDTH = 2800;
const WORLD_HEIGHT = 600;

// Smooth cubic Bezier spline generator across 2D points
function generateSmoothSpline(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const tension = 0.28;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return d;
}

export const QuantumMarioWorldMap: React.FC<QuantumMarioWorldMapProps> = ({
  completedLessonIds,
  totalXP,
  challenges,
  tracks,
  onLaunchAssessment,
  onLaunchChallenge,
  onOpenTheoryLesson,
  onLaunchIDE,
  onSelectLessonModule,
  isChallengeCompleted,
}) => {
  // Pathway Mode: Beginner (Green), Intermediate (Yellow), Advanced (Red), or Single Pathway (Unified All 3 Unlocked)
  const [pathMode, setPathMode] = useState<PathMode>('beginner');
  const [selectedWorld, setSelectedWorld] = useState<'all' | 1 | 2 | 3>('all');
  const [activeFilterType, setActiveFilterType] = useState<'all' | 'curriculum' | 'challenges'>('all');
  const [activeNodeId, setActiveNodeId] = useState<string>(QUANTUM_CURRICULUM[0].id);
  const [inspectingNode, setInspectingNode] = useState<UnifiedMapNode | null>(null);
  const [isMarioWalking, setIsMarioWalking] = useState<boolean>(false);
  const [activeViewMode, setActiveViewMode] = useState<'map' | 'structured'>('map');

  // Direct DOM Refs for 60+ FPS zero-lag hardware accelerated parallax scrolling
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const farLayerRef = useRef<HTMLDivElement | null>(null);
  const midLayerRef = useRef<HTMLDivElement | null>(null);
  const playfieldRef = useRef<HTMLDivElement | null>(null);
  const miniMapWindowRef = useRef<HTMLDivElement | null>(null);
  const miniMapBarRef = useRef<HTMLDivElement | null>(null);

  const currentCameraXRef = useRef<number>(0);
  const targetCameraXRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartCameraXRef = useRef<number>(0);
  const velocityHistoryRef = useRef<Array<{ x: number; time: number }>>([]);
  const dragRafRef = useRef<number | null>(null);
  const inertiaRafRef = useRef<number | null>(null);
  const wheelTargetXRef = useRef<number | null>(null);
  const wheelLerpRafRef = useRef<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);

  // Lock Alert Modal state for gated progression
  const [lockAlertModal, setLockAlertModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    requiredWorld: 1 | 2;
  } | null>(null);

  // Challenges filter tab state for ledger in structured view
  const [activeChallengeFilter, setActiveChallengeFilter] = useState<'all' | 'guided' | 'foundation' | 'algorithm' | 'advanced'>('all');

  // Interactive Quiz state for curriculum modules
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});

  // Audio Context for map SFX & Interactive Retro Synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playMapSFX = (type: 'step' | 'boss' | 'coin' | 'lock' | 'jump' | 'squish' | 'pipe' | 'powerup') => {
    try {
      if (!audioCtxRef.current && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      if (type === 'step') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'boss') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.28);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'lock') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.setValueAtTime(150, now + 0.08);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'jump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.16);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'squish') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.14);
        gain.gain.setValueAtTime(0.13, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'pipe') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.setValueAtTime(280, now + 0.07);
        osc.frequency.setValueAtTime(220, now + 0.14);
        osc.frequency.setValueAtTime(160, now + 0.21);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'powerup') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const notes = [330, 392, 659, 523, 587, 784];
        notes.forEach((freq, idx) => {
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        });
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.38);
      }
    } catch {
      // Audio optional
    }
  };

  // Interactive Easter eggs & live animated entity state (Zero-Lag, lightweight)
  const [squishedGoombas, setSquishedGoombas] = useState<Record<string, boolean>>({});
  const [hitBlocks, setHitBlocks] = useState<Record<string, boolean>>({});
  const [collectedCoins, setCollectedCoins] = useState<Record<string, boolean>>({});
  const [koopaShells, setKoopaShells] = useState<Record<string, boolean>>({});
  const [isMarioJumping, setIsMarioJumping] = useState(false);
  const [floatingScores, setFloatingScores] = useState<Array<{ id: number; text: string; x: number; y: number }>>([]);

  const spawnFloatingScore = (text: string, x: number, y: number) => {
    const id = Date.now() + Math.random();
    setFloatingScores(prev => [...prev.slice(-5), { id, text, x, y }]);
    setTimeout(() => {
      setFloatingScores(prev => prev.filter(s => s.id !== id));
    }, 1200);
  };

  const handleGoombaClick = (id: string, x: number, y: number) => {
    playMapSFX('squish');
    setSquishedGoombas(prev => ({ ...prev, [id]: true }));
    spawnFloatingScore('+100', x, y - 4);
    setTimeout(() => {
      setSquishedGoombas(prev => ({ ...prev, [id]: false }));
    }, 2200);
  };

  const handleKoopaClick = (id: string, x: number, y: number) => {
    playMapSFX('jump');
    setKoopaShells(prev => ({ ...prev, [id]: !prev[id] }));
    spawnFloatingScore('SHELL! 🐢', x, y - 4);
    setTimeout(() => {
      setKoopaShells(prev => ({ ...prev, [id]: false }));
    }, 3000);
  };

  const handleCoinClick = (id: string, x: number, y: number) => {
    if (collectedCoins[id]) return;
    playMapSFX('coin');
    setCollectedCoins(prev => ({ ...prev, [id]: true }));
    spawnFloatingScore('+50 XP', x, y - 4);
    setTimeout(() => {
      setCollectedCoins(prev => ({ ...prev, [id]: false }));
    }, 4500);
  };

  const handleMysteryBlockClick = (id: string, x: number, y: number) => {
    playMapSFX('powerup');
    setHitBlocks(prev => ({ ...prev, [id]: true }));
    spawnFloatingScore('★ 1-UP! +100', x, y - 6);
    setTimeout(() => {
      setHitBlocks(prev => ({ ...prev, [id]: false }));
    }, 1500);
  };

  const handleMarioAvatarClick = () => {
    playMapSFX('jump');
    setIsMarioJumping(true);
    if (activeNode) {
      spawnFloatingScore('YAHOO! ⭐', activeNode.xPercent, activeNode.yPercent - 8);
    }
    setTimeout(() => setIsMarioJumping(false), 600);
  };

  // Progression Gating Checks
  const world1LessonIds = useMemo(() => [
    'lesson-1-bits-vs-qubits',
    'lesson-2-superposition-hadamard',
    'lesson-3-entanglement-bell',
    'lesson-4-measurement-probability'
  ], []);

  const world1ChallengeIds = useMemo(() => [
    's1-initialize-measure',
    's1-x-gate',
    's1-hadamard-superposition',
    's1-z-phase',
    's1-gate-ordering',
    's1-single-qubit-challenge',
    's1-assessment',
    'challenge-lesson-1',
    'challenge-lesson-2',
    'challenge-lesson-3',
    'challenge-lesson-4'
  ], []);

  const world2LessonIds = useMemo(() => [
    'lesson-5-gate-library',
    'lesson-6-circuit-complexity',
    'lesson-7-deutsch-jozsa',
    'lesson-8-grovers-search'
  ], []);

  const world2ChallengeIds = useMemo(() => [
    'challenge-lesson-5',
    'challenge-lesson-6',
    'challenge-lesson-7',
    'challenge-lesson-8'
  ], []);

  const isWorld1Complete = useMemo(() => {
    const lessonsDone = world1LessonIds.every(id => completedLessonIds.includes(id));
    const challengesDone = world1ChallengeIds.every(id => {
      const ch = challenges.find(c => c.id === id);
      return ch ? isChallengeCompleted(ch) : false;
    });
    return lessonsDone && challengesDone;
  }, [world1LessonIds, world1ChallengeIds, completedLessonIds, challenges, isChallengeCompleted]);

  const isWorld2Complete = useMemo(() => {
    const lessonsDone = world2LessonIds.every(id => completedLessonIds.includes(id));
    const challengesDone = world2ChallengeIds.every(id => {
      const ch = challenges.find(c => c.id === id);
      return ch ? isChallengeCompleted(ch) : false;
    });
    return isWorld1Complete && lessonsDone && challengesDone;
  }, [isWorld1Complete, world2LessonIds, world2ChallengeIds, completedLessonIds, challenges, isChallengeCompleted]);

  const isNodeLocked = (node: UnifiedMapNode): boolean => {
    if (pathMode === 'single-pathway') return false;
    if (node.worldNumber === 1) return false;
    if (node.worldNumber === 2) return !isWorld1Complete;
    if (node.worldNumber === 3) return !isWorld2Complete;
    return false;
  };

  // 31 Stage Nodes across 3 Continuous Biomes
  const allMapNodes: UnifiedMapNode[] = useMemo(() => {
    const world1Nodes: UnifiedMapNode[] = [
      {
        id: 'lesson-1-bits-vs-qubits',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '1-1',
        shortTitle: 'Bits/Qubits',
        title: 'Bits vs. Qubits',
        worldNumber: 1,
        xPercent: 5.5,
        yPercent: 72,
        xpReward: 150,
        difficulty: 'Beginner',
        description: 'Classical determinism vs. 2D complex state vectors and state collapse.'
      },
      {
        id: 's1-initialize-measure',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-01',
        shortTitle: 'Init |0⟩',
        title: 'Single Qubit: Init & Measure',
        worldNumber: 1,
        xPercent: 11.0,
        yPercent: 78,
        xpReward: 100,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Initialize a qubit to |0⟩ and perform projective computational basis measurement.',
        alignedLessonTitle: 'Lesson 1-1 (Bits vs. Qubits)'
      },
      {
        id: 's1-x-gate',
        nodeType: 'mystery',
        isChallenge: true,
        label: 'T-02',
        shortTitle: 'Pauli-X',
        title: 'Pauli-X Bit Flip',
        worldNumber: 1,
        xPercent: 16.5,
        yPercent: 72,
        xpReward: 150,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Apply the Pauli-X quantum NOT gate to invert |0⟩ into state |1⟩.',
        alignedLessonTitle: 'Lesson 1-1 (Bits vs. Qubits)'
      },
      {
        id: 'challenge-lesson-1',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-08',
        shortTitle: 'State Prep',
        title: 'Lesson 1 Verification: Deterministic State Prep',
        worldNumber: 1,
        xPercent: 22.0,
        yPercent: 76,
        xpReward: 150,
        difficulty: 'Beginner',
        category: 'foundation',
        description: 'Synthesize deterministic computational basis states with 100% fidelity.',
        alignedLessonTitle: 'Lesson 1-1 (Bits vs. Qubits)'
      },
      {
        id: 's1-z-phase',
        nodeType: 'mystery',
        isChallenge: true,
        label: 'T-04',
        shortTitle: 'Pauli-Z',
        title: 'Pauli-Z Phase Flip',
        worldNumber: 1,
        xPercent: 28.0,
        yPercent: 70,
        xpReward: 200,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Shift quantum relative phase by π converting |+⟩ into |-⟩.',
        alignedLessonTitle: 'Lesson 1-2 (Hadamard)'
      },
      {
        id: 'challenge-lesson-2',
        nodeType: 'star',
        isChallenge: true,
        label: 'T-09',
        shortTitle: 'Equal Sup',
        title: 'Lesson 2 Verification: Equal Superposition Prep',
        worldNumber: 1,
        xPercent: 29.0,
        yPercent: 52,
        xpReward: 200,
        difficulty: 'Beginner',
        category: 'foundation',
        description: 'Verify 50/50 probability distribution across computational basis states.',
        alignedLessonTitle: 'Lesson 1-2 (Hadamard)'
      },
      {
        id: 'lesson-2-superposition-hadamard',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '1-2',
        shortTitle: 'Hadamard',
        title: 'Hadamard & Superposition',
        worldNumber: 1,
        xPercent: 23.5,
        yPercent: 48,
        xpReward: 200,
        difficulty: 'Beginner',
        description: 'Equal superposition state |+⟩ and non-deterministic 50/50 collapse.'
      },
      {
        id: 's1-hadamard-superposition',
        nodeType: 'star',
        isChallenge: true,
        label: 'T-03',
        shortTitle: 'H-Gate',
        title: 'Hadamard Superposition',
        worldNumber: 1,
        xPercent: 17.5,
        yPercent: 52,
        xpReward: 200,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Create equal superposition state |+⟩ = (|0⟩ + |1⟩)/√2 using the Hadamard gate.',
        alignedLessonTitle: 'Lesson 1-2 (Hadamard)'
      },
      {
        id: 'lesson-3-entanglement-bell',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '1-3',
        shortTitle: 'Bell State',
        title: 'Entanglement & Bell Pairs',
        worldNumber: 1,
        xPercent: 11.5,
        yPercent: 48,
        xpReward: 250,
        difficulty: 'Beginner',
        description: 'Maximal 2-qubit entanglement |Φ+⟩ with CNOT non-local correlations.'
      },
      {
        id: 's1-gate-ordering',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-05',
        shortTitle: 'Gate Order',
        title: 'Gate Ordering & Phase Kickback',
        worldNumber: 1,
        xPercent: 5.5,
        yPercent: 46,
        xpReward: 250,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Analyze non-commutative unitary matrix multiplication and kickback.',
        alignedLessonTitle: 'Lesson 1-3 (Bell Pairs)'
      },
      {
        id: 'challenge-lesson-3',
        nodeType: 'mystery',
        isChallenge: true,
        label: 'T-10',
        shortTitle: 'Bell Pair',
        title: 'Lesson 3 Verification: Bell State Creation',
        worldNumber: 1,
        xPercent: 6.5,
        yPercent: 26,
        xpReward: 250,
        difficulty: 'Beginner',
        category: 'foundation',
        description: 'Construct the EPR pair (|00⟩ + |11⟩)/√2 and measure correlation parity.',
        alignedLessonTitle: 'Lesson 1-3 (Bell Pairs)'
      },
      {
        id: 'lesson-4-measurement-probability',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '1-4',
        shortTitle: 'Born Rule',
        title: 'Measurement & Probability',
        worldNumber: 1,
        xPercent: 13.5,
        yPercent: 24,
        xpReward: 200,
        difficulty: 'Beginner',
        description: 'Born rule P(x) = |⟨x|ψ⟩|² and projective state reduction.'
      },
      {
        id: 'challenge-lesson-4',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-11',
        shortTitle: 'Born Stats',
        title: 'Lesson 4 Verification: State Measurement & Statistics',
        worldNumber: 1,
        xPercent: 20.5,
        yPercent: 28,
        xpReward: 200,
        difficulty: 'Beginner',
        category: 'foundation',
        description: 'Collect 1024 quantum measurement shots and calculate empirical probabilities.',
        alignedLessonTitle: 'Lesson 1-4 (Born Rule)'
      },
      {
        id: 's1-single-qubit-challenge',
        nodeType: 'boss',
        isChallenge: true,
        label: 'T-06',
        shortTitle: 'Synthesis',
        title: 'Single-Qubit State Synthesis',
        worldNumber: 1,
        xPercent: 27.0,
        yPercent: 22,
        xpReward: 300,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Synthesize an arbitrary single-qubit target state on the Bloch Sphere.',
        alignedLessonTitle: 'World 1 Capstone Fortress'
      },
      {
        id: 's1-assessment',
        nodeType: 'star',
        isChallenge: true,
        label: 'T-07',
        shortTitle: 'Capstone',
        title: 'Single-Qubit Capstone Challenge',
        worldNumber: 1,
        xPercent: 33.0,
        yPercent: 26,
        xpReward: 350,
        difficulty: 'Beginner',
        category: 'guided',
        description: 'Complete the rigorous World 1 mastery assessment to unlock the Warp Gateway.',
        alignedLessonTitle: 'World 1 Warp Gateway Gatekeeper'
      },
    ];

    const world2Nodes: UnifiedMapNode[] = [
      {
        id: 'lesson-5-gate-library',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '2-1',
        shortTitle: 'Gate Library',
        title: 'Universal Gate Library',
        worldNumber: 2,
        xPercent: 41.0,
        yPercent: 58,
        xpReward: 250,
        difficulty: 'Intermediate',
        description: 'Clifford+T gate set, Euler rotations, and arbitrary unitary synthesis.'
      },
      {
        id: 'challenge-lesson-5',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-12',
        shortTitle: 'Synthesis',
        title: 'Lesson 5 Verification: Gate Synthesis & Decomposition',
        worldNumber: 2,
        xPercent: 45.0,
        yPercent: 72,
        xpReward: 250,
        difficulty: 'Intermediate',
        category: 'algorithm',
        description: 'Decompose arbitrary 2x2 unitary matrix into Rx, Ry, Rz rotation gates.',
        alignedLessonTitle: 'Lesson 2-1 (Gate Library)'
      },
      {
        id: 'lesson-6-circuit-complexity',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '2-2',
        shortTitle: 'Depth/Cost',
        title: 'Circuit Complexity & Depth',
        worldNumber: 2,
        xPercent: 49.0,
        yPercent: 52,
        xpReward: 250,
        difficulty: 'Intermediate',
        description: 'Gate depth minimization and quantum volume optimization.'
      },
      {
        id: 'challenge-lesson-6',
        nodeType: 'mystery',
        isChallenge: true,
        label: 'T-13',
        shortTitle: 'Depth Opt',
        title: 'Lesson 6 Verification: Circuit Depth Minimization',
        worldNumber: 2,
        xPercent: 53.0,
        yPercent: 32,
        xpReward: 250,
        difficulty: 'Intermediate',
        category: 'algorithm',
        description: 'Compress gate depth by 40% through commutation and gate cancellation.',
        alignedLessonTitle: 'Lesson 2-2 (Circuit Complexity)'
      },
      {
        id: 'lesson-7-deutsch-jozsa',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '2-3',
        shortTitle: 'Deutsch',
        title: 'Deutsch-Jozsa Algorithm',
        worldNumber: 2,
        xPercent: 57.0,
        yPercent: 56,
        xpReward: 300,
        difficulty: 'Intermediate',
        description: 'Deterministic constant vs. balanced oracle evaluation in single query.'
      },
      {
        id: 'challenge-lesson-7',
        nodeType: 'star',
        isChallenge: true,
        label: 'T-14',
        shortTitle: 'DJ Oracle',
        title: 'Lesson 7 Verification: Deutsch-Jozsa Oracle',
        worldNumber: 2,
        xPercent: 61.0,
        yPercent: 72,
        xpReward: 300,
        difficulty: 'Intermediate',
        category: 'algorithm',
        description: 'Implement quantum query oracle determining function property with 1 query.',
        alignedLessonTitle: 'Lesson 2-3 (Deutsch-Jozsa)'
      },
      {
        id: 'lesson-8-grovers-search',
        nodeType: 'boss',
        isChallenge: false,
        label: '2-4',
        shortTitle: 'Grover Boss',
        title: "Grover's Search Algorithm",
        worldNumber: 2,
        xPercent: 64.5,
        yPercent: 46,
        xpReward: 300,
        difficulty: 'Intermediate',
        description: 'Phase inversion and amplitude amplification for O(√N) database search.'
      },
      {
        id: 'challenge-lesson-8',
        nodeType: 'boss',
        isChallenge: true,
        label: 'T-15',
        shortTitle: 'Grover Step',
        title: 'Lesson 8 Verification: Grover Iteration Step',
        worldNumber: 2,
        xPercent: 67.5,
        yPercent: 28,
        xpReward: 300,
        difficulty: 'Intermediate',
        category: 'algorithm',
        description: 'Construct the Grover diffusion operator 2|s⟩⟨s| - I for marked state amplification.',
        alignedLessonTitle: "Lesson 2-4 (Grover's Boss)"
      },
    ];

    const world3Nodes: UnifiedMapNode[] = [
      {
        id: 'lesson-9-variational-circuits',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '3-1',
        shortTitle: 'Ansatz',
        title: 'Parameterized & Variational',
        worldNumber: 3,
        xPercent: 73.5,
        yPercent: 64,
        xpReward: 300,
        difficulty: 'Advanced',
        description: 'Parameterized rotation gates and hardware-efficient quantum ansatz.'
      },
      {
        id: 'challenge-lesson-9',
        nodeType: 'pipe',
        isChallenge: true,
        label: 'T-16',
        shortTitle: 'Rot Ansatz',
        title: 'Lesson 9 Verification: Parameterized Rotation Ansatz',
        worldNumber: 3,
        xPercent: 77.5,
        yPercent: 74,
        xpReward: 300,
        difficulty: 'Advanced',
        category: 'advanced',
        description: 'Build parameterized Ry-Rz entangling layer for variational quantum learning.',
        alignedLessonTitle: 'Lesson 3-1 (Variational Circuits)'
      },
      {
        id: 'lesson-10-qaoa',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '3-2',
        shortTitle: 'QAOA',
        title: 'QAOA for Max-Cut',
        worldNumber: 3,
        xPercent: 81.5,
        yPercent: 52,
        xpReward: 350,
        difficulty: 'Advanced',
        description: 'Alternating problem Hamiltonian and transverse mixer optimization.'
      },
      {
        id: 'challenge-lesson-10',
        nodeType: 'mystery',
        isChallenge: true,
        label: 'T-17',
        shortTitle: 'Max-Cut',
        title: 'Lesson 10 Verification: 2-Qubit Max-Cut QAOA',
        worldNumber: 3,
        xPercent: 85.5,
        yPercent: 32,
        xpReward: 350,
        difficulty: 'Advanced',
        category: 'advanced',
        description: 'Execute QAOA gamma/beta parameter sweep to maximize cut expectation value.',
        alignedLessonTitle: 'Lesson 3-2 (QAOA Max-Cut)'
      },
      {
        id: 'lesson-11-vqe',
        nodeType: 'curriculum',
        isChallenge: false,
        label: '3-3',
        shortTitle: 'VQE Mol',
        title: 'VQE Molecular Chemistry',
        worldNumber: 3,
        xPercent: 89.5,
        yPercent: 56,
        xpReward: 350,
        difficulty: 'Advanced',
        description: 'Unitary coupled cluster ansatz for molecular hydrogen ground energy.'
      },
      {
        id: 'challenge-lesson-11',
        nodeType: 'star',
        isChallenge: true,
        label: 'T-18',
        shortTitle: 'H2 Energy',
        title: 'Lesson 11 Verification: H2 Ground State VQE',
        worldNumber: 3,
        xPercent: 93.0,
        yPercent: 72,
        xpReward: 350,
        difficulty: 'Advanced',
        category: 'advanced',
        description: 'Estimate Hamiltonian Pauli strings <Z0>, <Z1>, <Z0Z1> to find ground energy.',
        alignedLessonTitle: 'Lesson 3-3 (VQE Chemistry)'
      },
      {
        id: 'lesson-12-adaptive-execution',
        nodeType: 'boss',
        isChallenge: false,
        label: '3-4',
        shortTitle: 'Bowser Keep',
        title: 'Adaptive Execution & ZNE',
        worldNumber: 3,
        xPercent: 95.0,
        yPercent: 38,
        xpReward: 350,
        difficulty: 'Advanced',
        description: 'Mid-circuit dynamic feedforward and Zero-Noise Extrapolation error mitigation.'
      },
      {
        id: 'challenge-lesson-12',
        nodeType: 'boss',
        isChallenge: true,
        label: 'T-19',
        shortTitle: 'Feedforward',
        title: 'Lesson 12 Verification: Dynamic Circuit Feedforward',
        worldNumber: 3,
        xPercent: 97.5,
        yPercent: 64,
        xpReward: 350,
        difficulty: 'Advanced',
        category: 'advanced',
        description: 'Trigger conditional Pauli-X gate conditioned on mid-circuit measurement qubit 0.',
        alignedLessonTitle: 'Lesson 3-4 (Bowser Keep Summit)'
      },
    ];

    const rawAll = [...world1Nodes, ...world2Nodes, ...world3Nodes];

    return rawAll.map(node => {
      if (node.isChallenge) {
        const matchedCh = challenges.find(c => c.id === node.id);
        return {
          ...node,
          challenge: matchedCh,
          targetState: matchedCh?.targetState,
          requiredGates: matchedCh?.requiredGates,
        };
      } else {
        const matchedMod = QUANTUM_CURRICULUM.find(m => m.id === node.id);
        return {
          ...node,
          curriculumModule: matchedMod,
          formula: matchedMod?.formula,
          targetState: matchedMod?.assessment.criteria.targetStateDescription,
          requiredGates: matchedMod?.assessment.criteria.requiredGates,
        };
      }
    });
  }, [challenges]);

  const nodesW1 = useMemo(() => allMapNodes.filter(n => n.worldNumber === 1), [allMapNodes]);
  const nodesW2 = useMemo(() => allMapNodes.filter(n => n.worldNumber === 2), [allMapNodes]);
  const nodesW3 = useMemo(() => allMapNodes.filter(n => n.worldNumber === 3), [allMapNodes]);

  // Scaled spline points for 2800px x 600px continuous coordinate space
  const pathGreenD = useMemo(() => {
    const points = nodesW1.map(n => ({ x: n.xPercent * 28, y: n.yPercent * 6.0 }));
    return generateSmoothSpline(points);
  }, [nodesW1]);

  const pathYellowD = useMemo(() => {
    const points = nodesW2.map(n => ({ x: n.xPercent * 28, y: n.yPercent * 6.0 }));
    return generateSmoothSpline(points);
  }, [nodesW2]);

  const pathRedD = useMemo(() => {
    const points = nodesW3.map(n => ({ x: n.xPercent * 28, y: n.yPercent * 6.0 }));
    return generateSmoothSpline(points);
  }, [nodesW3]);

  const gateway1BridgeD = useMemo(() => {
    if (nodesW1.length === 0 || nodesW2.length === 0) return '';
    const lastW1 = nodesW1[nodesW1.length - 1];
    const firstW2 = nodesW2[0];
    const x1 = lastW1.xPercent * 28;
    const y1 = lastW1.yPercent * 6.0;
    const x2 = firstW2.xPercent * 28;
    const y2 = firstW2.yPercent * 6.0;
    const gateX = 37.0 * 28;
    const gateY = 46.0 * 6.0;
    return generateSmoothSpline([{ x: x1, y: y1 }, { x: gateX, y: gateY }, { x: x2, y: y2 }]);
  }, [nodesW1, nodesW2]);

  const gateway2BridgeD = useMemo(() => {
    if (nodesW2.length === 0 || nodesW3.length === 0) return '';
    const lastW2 = nodesW2[nodesW2.length - 1];
    const firstW3 = nodesW3[0];
    const x1 = lastW2.xPercent * 28;
    const y1 = lastW2.yPercent * 6.0;
    const x2 = firstW3.xPercent * 28;
    const y2 = firstW3.yPercent * 6.0;
    const gateX = 70.5 * 28;
    const gateY = 46.0 * 6.0;
    return generateSmoothSpline([{ x: x1, y: y1 }, { x: gateX, y: gateY }, { x: x2, y: y2 }]);
  }, [nodesW2, nodesW3]);

  const singleUnifiedPathD = useMemo(() => {
    const points = allMapNodes.map(n => ({ x: n.xPercent * 28, y: n.yPercent * 6.0 }));
    return generateSmoothSpline(points);
  }, [allMapNodes]);

  const activeNode = useMemo(() => {
    return allMapNodes.find(n => n.id === activeNodeId) || allMapNodes[0];
  }, [allMapNodes, activeNodeId]);

  const visibleNodes = useMemo(() => {
    return allMapNodes.filter(node => {
      if (selectedWorld !== 'all' && node.worldNumber !== selectedWorld) return false;
      if (activeFilterType === 'curriculum' && node.isChallenge) return false;
      if (activeFilterType === 'challenges' && !node.isChallenge) return false;
      return true;
    });
  }, [allMapNodes, selectedWorld, activeFilterType]);

  const isNodeCompleted = (node: UnifiedMapNode): boolean => {
    if (node.isChallenge && node.challenge) {
      return isChallengeCompleted(node.challenge);
    }
    return completedLessonIds.includes(node.id);
  };

  // ══════════════════════════════════════════════════════════════
  // ULTRA-SMOOTH ZERO-LAG CAMERA ENGINE (DIRECT DOM GPU TRANSFORMS)
  // ══════════════════════════════════════════════════════════════
  // ULTRA-SMOOTH ZERO-LAG CAMERA ENGINE (DIRECT DOM GPU TRANSFORMS & INERTIAL GLIDE)
  // ══════════════════════════════════════════════════════════════
  const applyCameraTransform = useCallback((x: number, animate: boolean = false) => {
    currentCameraXRef.current = x;

    const transitionStyle = animate ? 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';

    if (playfieldRef.current) {
      playfieldRef.current.style.transition = transitionStyle;
      playfieldRef.current.style.transform = `translate3d(${-x}px, 0, 0)`;
    }
    if (midLayerRef.current) {
      midLayerRef.current.style.transition = transitionStyle;
      midLayerRef.current.style.transform = `translate3d(${-x * 0.55}px, 0, 0)`;
    }
    if (farLayerRef.current) {
      farLayerRef.current.style.transition = transitionStyle;
      farLayerRef.current.style.transform = `translate3d(${-x * 0.25}px, 0, 0)`;
    }
    if (miniMapWindowRef.current) {
      miniMapWindowRef.current.style.transition = transitionStyle;
      const mmWidth = miniMapBarRef.current?.clientWidth || 440;
      const scale = mmWidth / WORLD_WIDTH;
      miniMapWindowRef.current.style.transform = `translate3d(${x * scale}px, 0, 0)`;
    }
  }, []);

  const stopAllMotion = useCallback(() => {
    if (inertiaRafRef.current) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
    if (wheelLerpRafRef.current) {
      cancelAnimationFrame(wheelLerpRafRef.current);
      wheelLerpRafRef.current = null;
    }
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
  }, []);

  const centerCameraOnNode = useCallback((node: UnifiedMapNode, animate: boolean = true) => {
    stopAllMotion();
    const vw = viewportRef.current?.clientWidth || 1200;
    const nodePixelX = (node.xPercent / 100) * WORLD_WIDTH;
    const maxScroll = Math.max(0, WORLD_WIDTH - vw);
    const targetX = Math.max(0, Math.min(maxScroll, nodePixelX - vw / 2));
    applyCameraTransform(targetX, animate);
  }, [applyCameraTransform, stopAllMotion]);

  useEffect(() => {
    const updateWidth = () => {
      if (viewportRef.current) {
        const vw = viewportRef.current.clientWidth;
        setViewportWidth(vw);
        if (miniMapWindowRef.current) {
          miniMapWindowRef.current.style.width = `${(vw / WORLD_WIDTH) * 100}%`;
        }
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Jump camera directly to world
  const handleJumpToWorld = (w: 'all' | 1 | 2 | 3) => {
    stopAllMotion();
    setSelectedWorld(w);
    const vw = viewportRef.current?.clientWidth || 1200;
    const maxScroll = Math.max(0, WORLD_WIDTH - vw);
    if (w === 1 || w === 'all') {
      applyCameraTransform(0, true);
    } else if (w === 2) {
      applyCameraTransform(Math.max(0, Math.min(maxScroll, 1300 - vw / 2)), true);
    } else if (w === 3) {
      applyCameraTransform(maxScroll, true);
    }
    playMapSFX('step');
  };

  const handleSelectNode = (node: UnifiedMapNode) => {
    if (isNodeLocked(node)) {
      playMapSFX('lock');
      const targetWorld = node.worldNumber as 2 | 3;
      if (targetWorld === 2) {
        setLockAlertModal({
          open: true,
          title: '🔒 WARP GATEWAY 1 LOCKED',
          message: 'World 2 (Intermediate) is locked! You must complete all 4 lessons and 11 challenges in World 1 (Beginner) first, OR switch to "👑 Single Pathway" to travel anywhere freely.',
          requiredWorld: 1,
        });
      } else {
        setLockAlertModal({
          open: true,
          title: '🔒 CASTLE GATEWAY 2 LOCKED',
          message: 'World 3 (Advanced) is locked! You must complete all 4 lessons and 4 challenges in World 2 (Intermediate) first, OR switch to "👑 Single Pathway" to travel anywhere freely.',
          requiredWorld: 2,
        });
      }
      return;
    }

    setIsMarioWalking(true);
    playMapSFX(node.nodeType === 'boss' ? 'boss' : node.isChallenge ? 'coin' : 'step');
    setActiveNodeId(node.id);
    setInspectingNode(node);
    centerCameraOnNode(node, true);

    if (node.curriculumModule && onSelectLessonModule) {
      onSelectLessonModule(node.curriculumModule);
    }

    const elemId = node.isChallenge ? `challenge-card-${node.id}` : `module-beat-${node.id}`;
    const el = document.getElementById(elemId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => setIsMarioWalking(false), 650);
  };

  const handleMoveStep = (delta: number) => {
    const list = visibleNodes.filter(n => !isNodeLocked(n));
    if (list.length === 0) return;
    const currentIndex = list.findIndex(n => n.id === activeNodeId);
    const nextIndex = Math.max(0, Math.min(list.length - 1, (currentIndex >= 0 ? currentIndex : 0) + delta));
    const nextNode = list[nextIndex];
    if (nextNode) {
      handleSelectNode(nextNode);
    }
  };

  const handleLaunchNodeAction = (node: UnifiedMapNode) => {
    if (node.id === 's1-hadamard-superposition' || node.challenge?.id === 's1-hadamard-superposition') {
      onLaunchIDE(undefined, undefined, 's1-hadamard-superposition');
      return;
    }
    if (node.isChallenge && node.challenge) {
      onLaunchChallenge(node.challenge);
    } else if (node.curriculumModule) {
      onLaunchAssessment(node.curriculumModule);
    }
  };

  // Keyboard navigation across pathway
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleMoveStep(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleMoveStep(-1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visibleNodes, activeNodeId]);

  // Clean unmount of animation frames
  useEffect(() => {
    return () => {
      stopAllMotion();
    };
  }, [stopAllMotion]);

  // High-Performance Drag-to-Pan Handlers with Window Tracking & Inertial Glide
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement;
    if (
      target.closest('.mario-map-node') ||
      target.closest('.mario-minimap-bar-container') ||
      target.closest('button') ||
      target.closest('.mario-level-preview-modal') ||
      target.closest('.mario-gateway-marker') ||
      target.closest('.mystery-floating-block') ||
      target.closest('.spinning-map-coin') ||
      target.closest('.goomba-patroller') ||
      target.closest('.koopa-patroller') ||
      target.closest('.mario-pipe-fixture') ||
      target.closest('.mario-map-walker') ||
      target.closest('.summit-star-floating')
    ) {
      return;
    }

    stopAllMotion();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartCameraXRef.current = currentCameraXRef.current;
    targetCameraXRef.current = currentCameraXRef.current;
    velocityHistoryRef.current = [{ x: e.clientX, time: performance.now() }];

    if (viewportRef.current) {
      viewportRef.current.style.cursor = 'grabbing';
    }

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvt.clientX - dragStartXRef.current;
      const vw = viewportRef.current?.clientWidth || 1200;
      const maxScroll = Math.max(0, WORLD_WIDTH - vw);
      const nextX = Math.max(0, Math.min(maxScroll, dragStartCameraXRef.current - dx));
      targetCameraXRef.current = nextX;

      const now = performance.now();
      velocityHistoryRef.current.push({ x: moveEvt.clientX, time: now });
      if (velocityHistoryRef.current.length > 8) {
        velocityHistoryRef.current.shift();
      }

      if (!dragRafRef.current) {
        dragRafRef.current = requestAnimationFrame(() => {
          applyCameraTransform(targetCameraXRef.current, false);
          dragRafRef.current = null;
        });
      }
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      if (viewportRef.current) {
        viewportRef.current.style.cursor = 'grab';
      }

      const history = velocityHistoryRef.current;
      if (history.length >= 2) {
        const last = history[history.length - 1];
        const recent = history.filter(p => last.time - p.time <= 120);
        const first = recent[0] || history[0];
        const dt = last.time - first.time;
        if (dt > 10) {
          const dx = last.x - first.x;
          const vx = (dx / dt) * 16.67;

          if (Math.abs(vx) > 1.0) {
            const vw = viewportRef.current?.clientWidth || 1200;
            const maxScroll = Math.max(0, WORLD_WIDTH - vw);
            let velocity = -vx;

            const glideStep = () => {
              if (isDraggingRef.current) return;
              velocity *= 0.92;
              if (Math.abs(velocity) < 0.25) return;

              const nextX = Math.max(0, Math.min(maxScroll, currentCameraXRef.current + velocity));
              applyCameraTransform(nextX, false);

              if (nextX > 0 && nextX < maxScroll) {
                inertiaRafRef.current = requestAnimationFrame(glideStep);
              }
            };

            inertiaRafRef.current = requestAnimationFrame(glideStep);
          }
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
  };

  // Silky Smooth Mouse Wheel with Exponential Decay
  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 1) return;

    stopAllMotion();

    const vw = viewportRef.current?.clientWidth || 1200;
    const maxScroll = Math.max(0, WORLD_WIDTH - vw);

    const base = wheelTargetXRef.current ?? currentCameraXRef.current;
    const targetX = Math.max(0, Math.min(maxScroll, base + delta * 0.95));
    wheelTargetXRef.current = targetX;

    const lerpStep = () => {
      if (isDraggingRef.current) return;
      const current = currentCameraXRef.current;
      const target = wheelTargetXRef.current ?? current;
      const diff = target - current;

      if (Math.abs(diff) < 0.4) {
        applyCameraTransform(target, false);
        wheelTargetXRef.current = null;
        wheelLerpRafRef.current = null;
        return;
      }

      const nextX = current + diff * 0.28;
      applyCameraTransform(nextX, false);
      wheelLerpRafRef.current = requestAnimationFrame(lerpStep);
    };

    if (!wheelLerpRafRef.current) {
      wheelLerpRafRef.current = requestAnimationFrame(lerpStep);
    }
  };

  // Interactive Mini-Map Click and Scrub Tracking
  const handleMiniMapPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopAllMotion();
    const bar = miniMapBarRef.current;
    if (!bar) return;

    const updateFromEvent = (evt: PointerEvent | React.PointerEvent) => {
      const rect = bar.getBoundingClientRect();
      const clickPercent = Math.max(0, Math.min(1, (evt.clientX - rect.left) / rect.width));
      const vw = viewportRef.current?.clientWidth || 1200;
      const maxScroll = Math.max(0, WORLD_WIDTH - vw);
      const targetX = Math.max(0, Math.min(maxScroll, clickPercent * WORLD_WIDTH - vw / 2));
      applyCameraTransform(targetX, false);
    };

    updateFromEvent(e);

    const onMMMove = (moveEvt: PointerEvent) => {
      updateFromEvent(moveEvt);
    };
    const onMMUp = () => {
      window.removeEventListener('pointermove', onMMMove);
      window.removeEventListener('pointerup', onMMUp);
      window.removeEventListener('pointercancel', onMMUp);
    };

    window.addEventListener('pointermove', onMMMove, { passive: true });
    window.addEventListener('pointerup', onMMUp, { passive: true });
    window.addEventListener('pointercancel', onMMUp, { passive: true });
  };

  const filteredLedgerChallenges = useMemo(() => {
    if (activeChallengeFilter === 'all') return challenges;
    return challenges.filter((c) => c.category === activeChallengeFilter);
  }, [challenges, activeChallengeFilter]);

  const completedCount = completedLessonIds.length;
  const completedChallengesCount = challenges.filter(isChallengeCompleted).length;

  return (
    <div className="mario-world-map-section" data-testid="mario-world-map-pathway">
      <div className="mario-map-canvas-frame">
        {/* ── 1. MAP HEADER & PATHWAY SELECTION ── */}
        <header className="mario-map-header-strip">
          <div className="mario-header-top-row">
            <div className="mario-map-title-wrap">
              <img src="/mario/Coin.png" alt="Coin" className="mario-map-title-icon" />
              <div>
                <span className="mario-map-title-text">SUPER QUALUTION BROS · CONTINUOUS OVERWORLD</span>
                <span className="mario-map-title-sub">Dynamic Parallax World · 12 Lessons + 19 Aligned Challenges</span>
              </div>
            </div>

            <div className="mario-view-mode-cluster" role="tablist">
              <button
                type="button"
                className={`mario-view-btn ${activeViewMode === 'map' ? 'active' : ''}`}
                onClick={() => {
                  setActiveViewMode('map');
                  playMapSFX('step');
                }}
                title="View 2D Overworld Game Map"
                data-testid="view-btn-map"
              >
                <span>🗺️ Map View</span>
              </button>
              <button
                type="button"
                className={`mario-view-btn ${activeViewMode === 'structured' ? 'active' : ''}`}
                onClick={() => {
                  setActiveViewMode('structured');
                  playMapSFX('coin');
                  setTimeout(() => {
                    document.getElementById('tracks-overview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 100);
                }}
                title="View Structured Tracks & Challenges Directory"
                data-testid="structured-view-toggle-btn"
              >
                <span>📋 Structured View</span>
              </button>
            </div>
          </div>

          <div className="mario-pathway-mode-row">
            <div className="mario-pathway-label-badge">
              <span>PATHWAY:</span>
            </div>

            <div className="mario-path-selector-cluster" role="tablist">
              <button
                type="button"
                className={`mario-path-pill-btn green ${pathMode === 'beginner' ? 'active' : ''}`}
                onClick={() => {
                  setPathMode('beginner');
                  handleJumpToWorld(1);
                  setActiveNodeId('lesson-1-bits-vs-qubits');
                }}
                title="World 1: Beginner Grassland Path (Green) · 15 Stages"
              >
                <span className="mario-path-pill-dot green"></span>
                <span>🟢 Beginner (Green)</span>
                <span className="mario-path-pill-tag">W1 Grassland (15 Stages)</span>
              </button>

              <button
                type="button"
                className={`mario-path-pill-btn yellow ${pathMode === 'intermediate' ? 'active' : ''} ${!isWorld1Complete ? 'gated' : ''}`}
                onClick={() => {
                  if (!isWorld1Complete && pathMode !== 'single-pathway') {
                    playMapSFX('lock');
                    setLockAlertModal({
                      open: true,
                      title: '🔒 INTERMEDIATE PATH LOCKED',
                      message: 'Intermediate Path (World 2) requires completing all World 1 (Beginner) lessons and challenges first, OR switch to "👑 Single Pathway" to travel freely.',
                      requiredWorld: 1,
                    });
                  } else {
                    setPathMode('intermediate');
                    handleJumpToWorld(2);
                    setActiveNodeId('lesson-5-gate-library');
                  }
                }}
                title="World 2: Intermediate Cavern Path (Yellow) · 8 Stages"
              >
                <span className="mario-path-pill-dot yellow"></span>
                <span>🟡 Intermediate (Yellow) {!isWorld1Complete ? '🔒' : '✓'}</span>
                <span className="mario-path-pill-tag">W2 Caverns (8 Stages)</span>
              </button>

              <button
                type="button"
                className={`mario-path-pill-btn red ${pathMode === 'advanced' ? 'active' : ''} ${!isWorld2Complete ? 'gated' : ''}`}
                onClick={() => {
                  if (!isWorld2Complete && pathMode !== 'single-pathway') {
                    playMapSFX('lock');
                    setLockAlertModal({
                      open: true,
                      title: '🔒 ADVANCED PATH LOCKED',
                      message: 'Advanced Path (World 3) requires completing all World 2 (Intermediate) lessons and challenges first, OR switch to "👑 Single Pathway" to travel freely.',
                      requiredWorld: 2,
                    });
                  } else {
                    setPathMode('advanced');
                    handleJumpToWorld(3);
                    setActiveNodeId('lesson-9-variational-circuits');
                  }
                }}
                title="World 3: Advanced Castle Path (Red) · 8 Stages"
              >
                <span className="mario-path-pill-dot red"></span>
                <span>🔴 Advanced (Red) {!isWorld2Complete ? '🔒' : '✓'}</span>
                <span className="mario-path-pill-tag">W3 Castle (8 Stages)</span>
              </button>

              <button
                type="button"
                className={`mario-path-pill-btn rainbow-special ${pathMode === 'single-pathway' ? 'active' : ''}`}
                onClick={() => {
                  setPathMode('single-pathway');
                  setSelectedWorld('all');
                  playMapSFX('coin');
                }}
                title="Continuous All-In-One Pathway: Traverse Green, Yellow, and Red without locks (31 Stages)"
              >
                <span className="mario-path-pill-icon">👑</span>
                <span>Single Pathway (All 3 Unlocked)</span>
                <span className="mario-path-pill-tag special">★ Complete 31-Stage Highway ★</span>
              </button>
            </div>
          </div>

          <div className="mario-header-bottom-row">
            <div className="mario-map-tabs" role="tablist">
              <button
                type="button"
                className={`mario-map-tab-btn ${activeFilterType === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilterType('all')}
                title="Show all 31 stages"
              >
                <span>⭐ All ({allMapNodes.length})</span>
              </button>
              <button
                type="button"
                className={`mario-map-tab-btn ${activeFilterType === 'curriculum' ? 'active' : ''}`}
                onClick={() => setActiveFilterType('curriculum')}
                title="Show 12 curriculum milestones"
              >
                <span>📜 Lessons ({QUANTUM_CURRICULUM.length})</span>
              </button>
              <button
                type="button"
                className={`mario-map-tab-btn ${activeFilterType === 'challenges' ? 'active' : ''}`}
                onClick={() => setActiveFilterType('challenges')}
                title="Show 19 lab challenges"
              >
                <span>⚡ Tasks ({challenges.length})</span>
              </button>
            </div>

            <div className="mario-map-tabs" role="tablist">
              <button
                type="button"
                className={`mario-map-tab-btn ${selectedWorld === 'all' ? 'active' : ''}`}
                onClick={() => handleJumpToWorld('all')}
              >
                <span>All Worlds</span>
              </button>
              <button
                type="button"
                className={`mario-map-tab-btn ${selectedWorld === 1 ? 'active' : ''}`}
                onClick={() => handleJumpToWorld(1)}
              >
                <span>🟢 W1: Grassland</span>
              </button>
              <button
                type="button"
                className={`mario-map-tab-btn ${selectedWorld === 2 ? 'active' : ''}`}
                onClick={() => handleJumpToWorld(2)}
              >
                <span>🟡 W2: Caverns</span>
              </button>
              <button
                type="button"
                className={`mario-map-tab-btn ${selectedWorld === 3 ? 'active' : ''}`}
                onClick={() => handleJumpToWorld(3)}
              >
                <span>🔴 W3: Castle</span>
              </button>
              <button
                type="button"
                className="mario-map-tab-btn focus-btn"
                onClick={() => {
                  centerCameraOnNode(activeNode, true);
                  playMapSFX('step');
                }}
                title="Center camera on Mario's active node"
              >
                <Compass size={12} color="#ffd700" />
                <span>Focus</span>
              </button>
            </div>

            <div className="mario-map-stats-strip">
              <div className="mario-map-stat-pill" title="Completed Modules & Challenges">
                <Trophy size={14} color="#ffd700" />
                <span>{completedCount}/12 Clear • {completedChallengesCount}/19 Tasks</span>
              </div>
              <div className="mario-map-stat-pill" title="Total XP">
                <img src="/mario/Coin.png" alt="Coin" />
                <span>{totalXP} XP</span>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className="mario-map-tab-btn"
                  onClick={() => handleMoveStep(-1)}
                  title="Move Mario to Previous Node"
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  type="button"
                  className="mario-map-tab-btn"
                  onClick={() => handleMoveStep(1)}
                  title="Move Mario to Next Node"
                >
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ── 2. THE DYNAMIC 2D OVERWORLD VIEWPORT (2800PX CONTINUOUS WORLD) ── */}
        <div
          className="mario-map-viewport"
          ref={viewportRef}
          onPointerDown={handlePointerDown}
          onWheel={handleWheel}
        >
          {/* ── PARALLAX LAYER 1: FAR SKY & MOUNTAIN SILHOUETTES (0.25x SPEED) ── */}
          <div className="mario-parallax-layer layer-far" ref={farLayerRef}>
            <div className="gandalf-sky-backdrop" />

            <img src="/gandalf/sun.png" alt="" className="gandalf-sun-element" />
            <img src="/gandalf/hot air balloon.png" alt="" className="gandalf-balloon-drift" />

            <img src="/gandalf/cloud6.png" alt="" className="gandalf-cloud c-1" />
            <img src="/gandalf/cloud2.png" alt="" className="gandalf-cloud c-2" />
            <img src="/gandalf/cloud1.png" alt="" className="gandalf-cloud c-3" />
            <img src="/gandalf/cloud3.png" alt="" className="gandalf-cloud c-4" />
            <img src="/gandalf/cloud6.png" alt="" className="gandalf-cloud c-5" />

            <img src="/gandalf/birds1.png" alt="" className="gandalf-birds b-1" />
            <img src="/gandalf/birds2.png" alt="" className="gandalf-birds b-2" />

            <div className="gandalf-mountains-ridge w1-mountains" />
            <img src="/gandalf/bg/w1_castle.png" alt="" className="gandalf-distant-castle c-w1" />
            <div className="gandalf-mountains-ridge w2-mountains" />
            <img src="/gandalf/bg/w2_autumn_castle.png" alt="" className="gandalf-distant-castle c-w2" />
            <div className="gandalf-mountains-ridge w3-mountains" />
            <img src="/gandalf/bg/w3_winter_castle.png" alt="" className="gandalf-distant-castle c-w3" />
          </div>

          {/* ── PARALLAX LAYER 2: MIDGROUND FOREST, HILLS & STALACTITES (0.55x SPEED) ── */}
          <div className="mario-parallax-layer layer-mid" ref={midLayerRef}>
            <div className="gandalf-forest-silhouette w1-forest" />
            <div className="gandalf-forest-silhouette w2-forest" />
            <div className="gandalf-forest-silhouette w3-forest" />

            <img src="/mario/Hill1.png" alt="" className="mario-hill-mid h-1" />
            <img src="/mario/Hill2.png" alt="" className="mario-hill-mid h-2" />
            <img src="/mario/Hill1.png" alt="" className="mario-hill-mid h-3" />

            <div className="cavern-stalactite-ceiling">
              <div className="cavern-stalactite s-1" />
              <div className="cavern-stalactite s-2" />
              <div className="cavern-stalactite s-3" />
              <div className="cavern-stalactite s-4" />
              <div className="cavern-stalactite s-5" />
              <div className="cavern-stalactite s-6" />
            </div>

            <div className="mid-crystal-cluster mc-1" />
            <div className="mid-crystal-cluster mc-2" />
            <div className="mid-crystal-cluster mc-3" />
          </div>

          {/* ── PARALLAX LAYER 3: FOREGROUND PLAYFIELD (1.0x SPEED — 2800PX CANVAS) ── */}
          <div className="mario-playfield-world" ref={playfieldRef}>
            <div className="gandalf-treeline-layer w1-treeline" />

            {/* Grassland Ground Base Strip */}
            <div className="mario-ground-base-strip w1-ground" />
            {/* Cavern Ground Base Strip */}
            <div className="mario-ground-base-strip w2-ground" />
            {/* Volcanic Magma Lake */}
            <div className="volcano-magma-lake">
              <div className="magma-ember" style={{ left: '12%', animationDelay: '0s' }} />
              <div className="magma-ember" style={{ left: '28%', animationDelay: '1.2s' }} />
              <div className="magma-ember" style={{ left: '46%', animationDelay: '0.4s' }} />
              <div className="magma-ember" style={{ left: '68%', animationDelay: '2.1s' }} />
              <div className="magma-ember" style={{ left: '88%', animationDelay: '0.9s' }} />
            </div>

            {/* Hand-Crafted Trees & Bushes */}
            <img src="/gandalf/bg/tree1.png" alt="" className="gandalf-fg-tree t-1" />
            <img src="/gandalf/bg/birch1.png" alt="" className="gandalf-fg-tree t-2" />
            <img src="/gandalf/Pine Trees.png" alt="" className="gandalf-fg-tree t-3" />
            <img src="/mario/Bush1.png" alt="" className="mario-fg-bush b-1" />
            <img src="/mario/Bush2.png" alt="" className="mario-fg-bush b-2" />
            <img src="/mario/Bush3.png" alt="" className="mario-fg-bush b-3" />

            {/* Territory Banners */}
            <div className="mario-territory-banner w1-banner" style={{ left: '160px', top: '16px' }}>
              <span className="banner-title green">🟢 WORLD 1 · BEGINNER</span>
              <span className="banner-sub">Grassland Kingdom · 15 Stages</span>
            </div>
            <div className="mario-territory-banner w2-banner" style={{ left: '1240px', top: '16px' }}>
              <span className="banner-title yellow">🟡 WORLD 2 · INTERMEDIATE</span>
              <span className="banner-sub">
                Crystal Caverns {!isWorld1Complete && pathMode !== 'single-pathway' ? '🔒 (Locked)' : '✓ (8 Stages)'}
              </span>
            </div>
            <div className="mario-territory-banner w3-banner" style={{ left: '2180px', top: '16px' }}>
              <span className="banner-title red">🔴 WORLD 3 · ADVANCED</span>
              <span className="banner-sub">
                Bowser's Quantum Keep {!isWorld2Complete && pathMode !== 'single-pathway' ? '🔒 (Locked)' : '✓ (8 Stages)'}
              </span>
            </div>

            {/* World 1 Capstone Fortress */}
            <div className="mario-grassland-fortress-wrap" style={{ left: '25.5%', top: '12%' }}>
              <img src="/mario/Castle.png" alt="Grassland Fortress" className="castle-landmark" style={{ width: 66 }} />
              <span className="mario-landmark-label">W1 FORTRESS</span>
            </div>

            {/* Interactive World 1 Warp Pipe */}
            <div
              className="mario-pipe-fixture"
              style={{ bottom: 22, left: '3.5%', width: 40 }}
              onClick={() => {
                playMapSFX('pipe');
                spawnFloatingScore('WARP! 🌀', 4.5, 82);
              }}
              title="Interactive Warp Pipe"
            >
              <div className="pipe-steam-cloud" />
              <img src="/mario/PipeTop.png" alt="Pipe" style={{ width: 40 }} />
              <img src="/mario/PipeBottom.png" alt="" style={{ width: 36, height: 18 }} />
            </div>

            {/* Mystery Blocks */}
            <div
              className={`mystery-floating-block ${hitBlocks['w1-block'] ? 'bumped' : ''}`}
              style={{ top: '61%', left: '14%' }}
              onClick={() => handleMysteryBlockClick('w1-block', 14, 61)}
              title="Interactive Mystery Block — Click to hit for +100 XP!"
            >
              <img src="/mario/MysteryBlock.png" alt="Mystery Block" style={{ width: '100%', height: '100%' }} />
              {hitBlocks['w1-block'] && (
                <img src="/mario/MagicMushroom.png" alt="Powerup" className="block-spawned-item" />
              )}
            </div>
            <div
              className={`mystery-floating-block ${hitBlocks['w2-block'] ? 'bumped' : ''}`}
              style={{ top: '48%', left: '50.5%' }}
              onClick={() => handleMysteryBlockClick('w2-block', 50.5, 48)}
              title="Interactive Mystery Block — Click to hit for +100 XP!"
            >
              <img src="/mario/MysteryBlock.png" alt="Mystery Block" style={{ width: '100%', height: '100%' }} />
              {hitBlocks['w2-block'] && (
                <img src="/mario/Starman.png" alt="Star" className="block-spawned-item" />
              )}
            </div>

            {/* Spinning Coins */}
            <img
              src="/mario/Coin.png"
              alt="Coin"
              className={`spinning-map-coin ${collectedCoins['coin-w1-a'] ? 'collected' : ''}`}
              style={{ top: '63%', left: '8.5%', width: 22 }}
              onClick={() => handleCoinClick('coin-w1-a', 8.5, 63)}
              title="Click to collect coin (+50 XP)!"
            />
            <img
              src="/mario/Coin.png"
              alt="Coin"
              className={`spinning-map-coin ${collectedCoins['coin-w1-b'] ? 'collected' : ''}`}
              style={{ top: '38%', left: '23%', width: 22 }}
              onClick={() => handleCoinClick('coin-w1-b', 23, 38)}
              title="Click to collect coin (+50 XP)!"
            />
            <img
              src="/mario/Coin.png"
              alt="Coin"
              className={`spinning-map-coin ${collectedCoins['coin-w1-c'] ? 'collected' : ''}`}
              style={{ top: '18%', left: '17%', width: 22 }}
              onClick={() => handleCoinClick('coin-w1-c', 17, 18)}
              title="Click to collect coin (+50 XP)!"
            />

            {/* Patrolling Goomba */}
            <div
              className="goomba-patroller goomba-w1"
              style={{ left: '17%', bottom: '26px' }}
              onClick={() => handleGoombaClick('goomba-w1', 17, 84)}
              title="Patrolling Goomba — Click to stomp!"
            >
              <img
                src={squishedGoombas['goomba-w1'] ? '/mario/Goomba_Flat.png' : '/mario/Goomba_Walk1.png'}
                alt="Goomba"
                className={squishedGoombas['goomba-w1'] ? 'goomba-squished-img' : 'goomba-animated-img'}
              />
            </div>

            {/* Portal 1 */}
            <div className="gandalf-portal-wrap" style={{ left: '36.2%', top: '39%' }}>
              <div className="gandalf-portal-anim" />
              <div className="portal-quantum-aura" />
            </div>

            {/* Gateway 1 Marker */}
            <div
              className={`mario-gateway-marker gate-1 ${isWorld1Complete || pathMode === 'single-pathway' ? 'unlocked' : 'locked'}`}
              style={{ left: '37.0%', top: '46.0%' }}
              onClick={() => {
                if (!isWorld1Complete && pathMode !== 'single-pathway') {
                  playMapSFX('lock');
                  setLockAlertModal({
                    open: true,
                    title: '🔒 WARP GATEWAY 1 LOCKED',
                    message: 'This Warp Gateway connects World 1 (Beginner) to World 2 (Intermediate). Complete all 4 lessons and 11 challenges in World 1 first, or switch to Single Pathway mode.',
                    requiredWorld: 1,
                  });
                } else {
                  playMapSFX('coin');
                  handleJumpToWorld(2);
                  setPathMode('intermediate');
                }
              }}
              title={isWorld1Complete || pathMode === 'single-pathway' ? 'Gateway 1: OPEN (W1 ➔ W2)' : 'Gateway 1: LOCKED (Complete World 1)'}
            >
              <div className="mario-gateway-icon-wrap">
                {isWorld1Complete || pathMode === 'single-pathway' ? (
                  <Unlock size={18} color="#22c55e" strokeWidth={2.5} />
                ) : (
                  <Lock size={18} color="#ef4444" strokeWidth={2.5} />
                )}
              </div>
              <span className="mario-gateway-tag">
                {isWorld1Complete || pathMode === 'single-pathway' ? 'GATE 1: OPEN' : 'GATE 1: LOCK'}
              </span>
            </div>

            {/* Crystal Ores & Geodes */}
            <img src="/gandalf/bg/ores.png" alt="" className="gandalf-crystal-ores o-1" style={{ top: '22%', left: '42%' }} />
            <img src="/gandalf/bg/ores.png" alt="" className="gandalf-crystal-ores o-2" style={{ top: '65%', left: '55%' }} />
            <img src="/gandalf/bg/ores.png" alt="" className="gandalf-crystal-ores o-3" style={{ top: '24%', left: '63%' }} />

            <div className="cavern-crystal-cluster" style={{ top: '20%', left: '43.5%' }}>
              <div className="quantum-crystal-shard cyan" />
              <div className="quantum-crystal-shard purple tall" />
              <div className="quantum-crystal-shard cyan" />
            </div>
            <div className="cavern-crystal-cluster" style={{ top: '68%', left: '51%' }}>
              <div className="quantum-crystal-shard purple" />
              <div className="quantum-crystal-shard cyan tall" />
            </div>
            <div className="cavern-crystal-cluster" style={{ top: '22%', left: '64%' }}>
              <div className="quantum-crystal-shard cyan tall" />
              <div className="quantum-crystal-shard purple" />
            </div>

            {/* Blue Coins */}
            <img
              src="/mario/Coin_Underground.png"
              alt="Underground Coin"
              className={`spinning-map-coin blue ${collectedCoins['coin-w2-a'] ? 'collected' : ''}`}
              style={{ top: '42%', left: '43%', width: 20 }}
              onClick={() => handleCoinClick('coin-w2-a', 43, 42)}
              title="Subterranean Blue Coin (+50 XP)!"
            />
            <img
              src="/mario/Coin_Underground.png"
              alt="Underground Coin"
              className={`spinning-map-coin blue ${collectedCoins['coin-w2-b'] ? 'collected' : ''}`}
              style={{ top: '64%', left: '55%', width: 20 }}
              onClick={() => handleCoinClick('coin-w2-b', 55, 64)}
              title="Subterranean Blue Coin (+50 XP)!"
            />
            <img
              src="/mario/Coin_Underground.png"
              alt="Underground Coin"
              className={`spinning-map-coin blue ${collectedCoins['coin-w2-c'] ? 'collected' : ''}`}
              style={{ top: '36%', left: '65.5%', width: 20 }}
              onClick={() => handleCoinClick('coin-w2-c', 65.5, 36)}
              title="Subterranean Blue Coin (+50 XP)!"
            />

            {/* Koopa Troopa */}
            <div
              className="koopa-patroller"
              style={{ left: '53%', bottom: '26px' }}
              onClick={() => handleKoopaClick('koopa-w2', 53, 79)}
              title="Patrolling Koopa Troopa"
            >
              <img
                src={koopaShells['koopa-w2'] ? '/mario/Koopa_Shell.png' : '/mario/Koopa_Walk1.png'}
                alt="Koopa"
                className={koopaShells['koopa-w2'] ? 'koopa-shell-img' : 'koopa-walk-img'}
              />
            </div>

            {/* Cavern Warp Pipe */}
            <div
              className="mario-pipe-fixture cavern-pipe"
              style={{ bottom: 22, left: '58%', width: 40 }}
              onClick={() => {
                playMapSFX('pipe');
                spawnFloatingScore('WARP! 🌀', 59, 82);
              }}
              title="Interactive Cavern Warp Pipe"
            >
              <div className="pipe-steam-cloud blue" />
              <img src="/mario/PipeTop.png" alt="Pipe" style={{ width: 40 }} />
              <img src="/mario/PipeBottom.png" alt="" style={{ width: 36, height: 18 }} />
            </div>

            {/* Portal 2 */}
            <div className="gandalf-portal-wrap" style={{ left: '69.7%', top: '39%' }}>
              <div className="gandalf-portal-anim" />
              <div className="portal-quantum-aura red" />
            </div>

            {/* Gateway 2 Marker */}
            <div
              className={`mario-gateway-marker gate-2 ${isWorld2Complete || pathMode === 'single-pathway' ? 'unlocked' : 'locked'}`}
              style={{ left: '70.5%', top: '46.0%' }}
              onClick={() => {
                if (!isWorld2Complete && pathMode !== 'single-pathway') {
                  playMapSFX('lock');
                  setLockAlertModal({
                    open: true,
                    title: '🔒 CASTLE GATEWAY 2 LOCKED',
                    message: 'This Castle Drawbridge connects World 2 (Intermediate) to World 3 (Advanced). Complete all 4 lessons and 4 challenges in World 2 first, or switch to Single Pathway mode.',
                    requiredWorld: 2,
                  });
                } else {
                  playMapSFX('coin');
                  handleJumpToWorld(3);
                  setPathMode('advanced');
                }
              }}
              title={isWorld2Complete || pathMode === 'single-pathway' ? 'Gateway 2: OPEN (W2 ➔ W3)' : 'Gateway 2: LOCKED (Complete World 2)'}
            >
              <div className="mario-gateway-icon-wrap">
                {isWorld2Complete || pathMode === 'single-pathway' ? (
                  <Unlock size={18} color="#eab308" strokeWidth={2.5} />
                ) : (
                  <Lock size={18} color="#ef4444" strokeWidth={2.5} />
                )}
              </div>
              <span className="mario-gateway-tag">
                {isWorld2Complete || pathMode === 'single-pathway' ? 'GATE 2: OPEN' : 'GATE 2: LOCK'}
              </span>
            </div>

            {/* Torches */}
            <div className="gandalf-torch-bracket" style={{ left: '74%', top: '56%' }}>
              <div className="gandalf-torch-anim" />
            </div>
            <div className="gandalf-torch-bracket" style={{ left: '83%', top: '44%' }}>
              <div className="gandalf-torch-anim" />
            </div>
            <div className="gandalf-torch-bracket" style={{ left: '91%', top: '50%' }}>
              <div className="gandalf-torch-anim" />
            </div>

            {/* Bowser Citadel Summit */}
            <div className="mario-bowser-citadel-wrap" style={{ top: '12%', left: '94.2%' }}>
              <img src="/mario/Castle.png" alt="Bowser Castle" className="bowser-castle" style={{ width: 72 }} />
              <span className="mario-landmark-label red">BOWSER KEEP</span>
            </div>

            {/* Flagpole */}
            <div className="mario-flagpole-rig" style={{ top: '18%', left: '98.0%' }}>
              <img src="/mario/FlagPole.png" alt="Flagpole" style={{ width: 14, height: 75 }} />
              <img src="/mario/Flag.png" alt="Flag" className="mario-flag-wave" />
            </div>

            {/* Guard Goomba */}
            <div
              className="goomba-patroller goomba-w3"
              style={{ left: '76%', bottom: '26px' }}
              onClick={() => handleGoombaClick('goomba-w3', 76, 84)}
              title="Castle Guard Goomba"
            >
              <img
                src={squishedGoombas['goomba-w3'] ? '/mario/Goomba_Flat.png' : '/mario/Goomba_Walk1.png'}
                alt="Guard Goomba"
                className={squishedGoombas['goomba-w3'] ? 'goomba-squished-img' : 'goomba-animated-img'}
              />
            </div>

            {/* Volcanic Coins */}
            <img
              src="/mario/Coin.png"
              alt="Coin"
              className={`spinning-map-coin ${collectedCoins['coin-w3-a'] ? 'collected' : ''}`}
              style={{ top: '44%', left: '79%', width: 22 }}
              onClick={() => handleCoinClick('coin-w3-a', 79, 44)}
              title="Volcanic Gold Coin (+50 XP)!"
            />
            <img
              src="/mario/Coin.png"
              alt="Coin"
              className={`spinning-map-coin ${collectedCoins['coin-w3-b'] ? 'collected' : ''}`}
              style={{ top: '44%', left: '91%', width: 22 }}
              onClick={() => handleCoinClick('coin-w3-b', 91, 44)}
              title="Volcanic Gold Coin (+50 XP)!"
            />

            {/* Super Star */}
            <img
              src="/mario/Starman.png"
              alt="Super Star"
              className="summit-star-floating"
              style={{ top: '16%', left: '87%', width: 28, cursor: 'pointer' }}
              onClick={() => {
                playMapSFX('powerup');
                spawnFloatingScore('★ SUPER STAR! +200', 87, 16);
              }}
              title="Summit Super Star — Click for star power!"
            />

            {/* SVG Connecting Rails */}
            <svg
              className="mario-map-svg-rails"
              viewBox="0 0 2800 600"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="singleHighwayGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="35%" stopColor="#22c55e" />
                  <stop offset="38%" stopColor="#eab308" />
                  <stop offset="68%" stopColor="#eab308" />
                  <stop offset="72%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
              </defs>

              {pathMode === 'single-pathway' ? (
                <>
                  <path d={singleUnifiedPathD} className="mario-path-underbed" />
                  <path d={singleUnifiedPathD} className="mario-path-pavers" />
                  <path d={singleUnifiedPathD} className="mario-path-line-border unified-rainbow" stroke="url(#singleHighwayGrad)" />
                  <path d={singleUnifiedPathD} className="mario-path-line-active" />
                </>
              ) : (
                <>
                  <path d={pathGreenD} className="mario-path-underbed w1" />
                  <path d={pathGreenD} className="mario-path-pavers" />
                  <path d={pathGreenD} className="mario-path-green-border" />
                  <path d={pathGreenD} className="mario-path-green-active" />

                  <path
                    d={gateway1BridgeD}
                    className={`mario-gateway-bridge ${isWorld1Complete ? 'unlocked' : 'locked'}`}
                  />

                  <path d={pathYellowD} className="mario-path-underbed w2" />
                  <path d={pathYellowD} className="mario-path-pavers" />
                  <path
                    d={pathYellowD}
                    className={`mario-path-yellow-border ${!isWorld1Complete ? 'locked-rail' : ''}`}
                  />
                  <path
                    d={pathYellowD}
                    className={`mario-path-yellow-active ${!isWorld1Complete ? 'locked-rail' : ''}`}
                  />

                  <path
                    d={gateway2BridgeD}
                    className={`mario-gateway-bridge ${isWorld2Complete ? 'unlocked' : 'locked'}`}
                  />

                  <path d={pathRedD} className="mario-path-underbed w3" />
                  <path d={pathRedD} className="mario-path-pavers" />
                  <path
                    d={pathRedD}
                    className={`mario-path-red-border ${!isWorld2Complete ? 'locked-rail' : ''}`}
                  />
                  <path
                    d={pathRedD}
                    className={`mario-path-red-active ${!isWorld2Complete ? 'locked-rail' : ''}`}
                  />
                </>
              )}
            </svg>

            {/* 31 Level & Challenge Nodes */}
            {visibleNodes.map((node) => {
              const completed = isNodeCompleted(node);
              const locked = isNodeLocked(node);
              const isCurrent = node.id === activeNodeId;
              const isBoss = node.nodeType === 'boss';
              const isPipe = node.nodeType === 'pipe';
              const isMystery = node.nodeType === 'mystery';
              const isStar = node.nodeType === 'star';

              const worldColorClass = node.worldNumber === 1 ? 'node-w1-green' : node.worldNumber === 2 ? 'node-w2-yellow' : 'node-w3-red';
              const stateClass = locked ? 'locked' : isCurrent ? 'current' : completed ? 'completed' : 'available';

              return (
                <div
                  key={node.id}
                  className={`mario-map-node ${node.isChallenge ? 'challenge-node' : 'curriculum-node'} ${worldColorClass} ${locked ? 'is-locked-node' : ''} ${isCurrent ? 'is-current-node' : ''}`}
                  style={{ left: `${node.xPercent}%`, top: `${node.yPercent}%` }}
                  onClick={() => handleSelectNode(node)}
                  title={`${locked ? '🔒 LOCKED - ' : ''}${node.isChallenge ? 'Challenge' : 'Lesson'} ${node.label}: ${node.title}`}
                  data-testid={`map-node-${node.id}`}
                >
                  <div className={`node-physical-platform world-${node.worldNumber}`} />

                  {completed && (
                    <div className="mario-node-stars">
                      <img src="/mario/Starman.png" alt="Star" className="mario-node-star-img s-1" />
                      <img src="/mario/Starman.png" alt="Star" className="mario-node-star-img s-2" />
                      <img src="/mario/Starman.png" alt="Star" className="mario-node-star-img s-3" />
                    </div>
                  )}

                  <div className={`mario-node-tile ${stateClass} ${node.nodeType} ${worldColorClass}`}>
                    {locked ? (
                      <Lock size={18} strokeWidth={2.5} color="#ef4444" />
                    ) : isBoss ? (
                      <img src="/mario/Castle.png" alt="Castle Boss" className="mario-node-icon" />
                    ) : isPipe ? (
                      <img src="/mario/PipeTop.png" alt="Warp Pipe" className="mario-node-icon" />
                    ) : isMystery ? (
                      <img src="/mario/MysteryBlock.png" alt="Mystery Block" className="mario-node-icon" />
                    ) : isStar ? (
                      <img src="/mario/Starman.png" alt="Star" className="mario-node-icon" />
                    ) : completed ? (
                      <Check size={18} strokeWidth={3} color="#000" />
                    ) : (
                      <span className="mario-node-badge-text">{node.label}</span>
                    )}
                  </div>

                  <span className={`mario-node-title-caption ${node.yPercent <= 30 ? 'caption-top' : node.yPercent >= 68 ? 'caption-bottom' : 'caption-mid'}`}>
                    {locked ? '🔒' : node.isChallenge ? '⚡' : '⭐'} {node.label} {node.shortTitle}
                  </span>
                </div>
              );
            })}

            {/* Mario Player Avatar */}
            {activeNode && (
              <div
                className={`mario-map-walker ${isMarioWalking ? 'walking' : ''} ${isMarioJumping ? 'jumping' : ''}`}
                style={{
                  left: `${activeNode.xPercent}%`,
                  top: `${activeNode.yPercent - 3.2}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarioAvatarClick();
                }}
                title="Click Mario to jump! (Click on any node to travel)"
              >
                <div className="mario-map-pointer-bubble">
                  {isMarioJumping ? 'YAHOO! ⭐' : `HERE! ${activeNode.label}`}
                </div>
                <img
                  src={
                    isMarioJumping
                      ? '/mario/Mario_Small_Jump.png'
                      : isMarioWalking
                      ? '/mario/Mario_Small_Run1.png'
                      : '/mario/Mario_Small_Idle.png'
                  }
                  alt="Mario"
                  className="mario-map-walker-img"
                />
              </div>
            )}

            {/* Floating Scores */}
            {floatingScores.map((s) => (
              <div
                key={s.id}
                className="mario-float-score"
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
              >
                {s.text}
              </div>
            ))}
          </div>

          {/* ── HUD: MINI-MAP RADAR TRACKER ── */}
          <div className="mario-minimap-bar-container">
            <div
              className="mario-minimap-bar"
              ref={miniMapBarRef}
              onPointerDown={handleMiniMapPointerDown}
              title="Mini-Map: Click or drag to jump camera anywhere!"
            >
              <div className="minimap-sector w1" style={{ width: '37%' }}>
                <span>W1</span>
              </div>
              <div className="minimap-sector w2" style={{ width: '34%' }}>
                <span>W2</span>
              </div>
              <div className="minimap-sector w3" style={{ width: '29%' }}>
                <span>W3</span>
              </div>

              {allMapNodes.map((n) => {
                const isDone = isNodeCompleted(n);
                const isCurrent = n.id === activeNodeId;
                return (
                  <div
                    key={n.id}
                    className={`minimap-node-dot ${isCurrent ? 'current' : isDone ? 'done' : 'pending'}`}
                    style={{ left: `${n.xPercent}%` }}
                  />
                );
              })}

              <div
                className="minimap-camera-window"
                ref={miniMapWindowRef}
                style={{
                  width: `${(viewportWidth / WORLD_WIDTH) * 100}%`,
                }}
              />
            </div>

            <div className="mario-drag-hint-pill">
              <MoveHorizontal size={11} />
              <span>DRAG MAP OR SCROLL WHEEL TO EXPLORE</span>
            </div>
          </div>

          {/* ── LEVEL PREVIEW MODAL ── */}
          {inspectingNode && !isNodeLocked(inspectingNode) && (
            <div className="mario-level-preview-modal" data-testid="mario-level-preview">
              <div className="mario-modal-top">
                <div className="mario-modal-badge-group">
                  <span className="mario-modal-num-badge">
                    {inspectingNode.isChallenge ? 'CHALLENGE TASK' : 'CURRICULUM LEVEL'} {inspectingNode.label}
                  </span>
                  <span className={`mario-modal-diff-badge diff-${inspectingNode.difficulty.toLowerCase()}`}>
                    {inspectingNode.difficulty}
                  </span>
                  <span
                    className="mario-modal-diff-badge"
                    style={{
                      background: inspectingNode.worldNumber === 1 ? '#15803d' : inspectingNode.worldNumber === 2 ? '#b45309' : '#b91c1c',
                      color: '#fff'
                    }}
                  >
                    World {inspectingNode.worldNumber} {inspectingNode.worldNumber === 1 ? 'Grass' : inspectingNode.worldNumber === 2 ? 'Cavern' : 'Castle'}
                  </span>
                </div>
                <button
                  type="button"
                  className="mario-modal-close-btn"
                  onClick={() => setInspectingNode(null)}
                  title="Close preview"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mario-modal-body">
                <h4 className="mario-modal-title">{inspectingNode.title}</h4>
                {inspectingNode.alignedLessonTitle && (
                  <div className="mario-aligned-lesson-tag">
                    <span>🔗 Aligned with {inspectingNode.alignedLessonTitle}</span>
                  </div>
                )}
                <p className="mario-modal-summary">{inspectingNode.description}</p>

                <div className="mario-modal-specs-grid">
                  {inspectingNode.targetState && (
                    <div className="mario-spec-item">
                      <span className="mario-spec-lbl">Target:</span>
                      <span className="mario-spec-val">{inspectingNode.targetState}</span>
                    </div>
                  )}
                  {inspectingNode.requiredGates && inspectingNode.requiredGates.length > 0 && (
                    <div className="mario-spec-item">
                      <span className="mario-spec-lbl">Gates:</span>
                      <div className="mario-spec-gates">
                        {inspectingNode.requiredGates.map((g, gi) => (
                          <span key={gi} className="mario-gate-chip">{g}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mario-modal-xp-gain">
                    <img src="/mario/Coin.png" alt="Coin" />
                    <span>+{inspectingNode.xpReward} XP</span>
                  </div>
                </div>

                {inspectingNode.formula && (
                  <div className="mario-modal-formula-box">
                    <span className="mario-modal-formula">{inspectingNode.formula}</span>
                  </div>
                )}
              </div>

              <div className="mario-modal-actions">
                <button
                  type="button"
                  className="mario-modal-launch-btn"
                  onClick={() => handleLaunchNodeAction(inspectingNode)}
                  data-testid={inspectingNode.isChallenge ? `launch-challenge-btn-${inspectingNode.id}` : `launch-assessment-btn-${inspectingNode.id}`}
                >
                  <Play size={13} fill="currentColor" />
                  <span>
                    {inspectingNode.id === 's1-hadamard-superposition'
                      ? 'Play Hadamard Lesson'
                      : inspectingNode.isChallenge
                      ? 'Start Task in Lab'
                      : 'Practice Lab'}
                  </span>
                </button>

                {inspectingNode.id === 'lesson-2-superposition-hadamard' && (
                  <button
                    type="button"
                    className="mario-modal-launch-btn"
                    onClick={() => onLaunchIDE(undefined, undefined, 's1-hadamard-superposition')}
                    title="Play Hadamard Practical Lesson with Live Cursor Demonstration"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                    }}
                    data-testid="mario-play-hadamard-lesson-btn"
                  >
                    <Sparkles size={13} />
                    <span>Play Hadamard Lesson</span>
                  </button>
                )}

                {!inspectingNode.isChallenge && inspectingNode.curriculumModule && (
                  <button
                    type="button"
                    className="mario-modal-theory-btn"
                    onClick={() => onOpenTheoryLesson(inspectingNode.id)}
                  >
                    <BookOpen size={13} />
                    <span>Theory Masterclass</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── LOCKED GATE MODAL ── */}
          {lockAlertModal && (
            <div className="mario-locked-gate-modal-backdrop" onClick={() => setLockAlertModal(null)}>
              <div className="mario-locked-gate-modal-card" onClick={e => e.stopPropagation()}>
                <div className="mario-lock-modal-top">
                  <div className="mario-lock-header-icon">
                    <Lock size={22} color="#ef4444" />
                    <span>{lockAlertModal.title}</span>
                  </div>
                  <button
                    type="button"
                    className="mario-modal-close-btn"
                    onClick={() => setLockAlertModal(null)}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mario-lock-modal-body">
                  <p className="mario-lock-desc">{lockAlertModal.message}</p>

                  <div className="mario-lock-req-box">
                    <span className="mario-lock-req-title">Prerequisites Required:</span>
                    {lockAlertModal.requiredWorld === 1 ? (
                      <ul className="mario-lock-req-list">
                        <li>Complete 4 World 1 Lessons (1-1 to 1-4)</li>
                        <li>Pass 11 Aligned Beginner Challenges (T-01 to T-11)</li>
                      </ul>
                    ) : (
                      <ul className="mario-lock-req-list">
                        <li>Complete 4 World 2 Lessons (2-1 to 2-4)</li>
                        <li>Pass 4 Aligned Intermediate Challenges (T-12 to T-15)</li>
                      </ul>
                    )}
                  </div>
                </div>

                <div className="mario-lock-modal-actions">
                  <button
                    type="button"
                    className="mario-lock-btn-secondary"
                    onClick={() => setLockAlertModal(null)}
                  >
                    Stay on Current Path
                  </button>
                  <button
                    type="button"
                    className="mario-lock-btn-primary rainbow-special"
                    onClick={() => {
                      setPathMode('single-pathway');
                      setSelectedWorld('all');
                      setLockAlertModal(null);
                      playMapSFX('coin');
                    }}
                  >
                    👑 Activate Single Pathway (Unlock All)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. STRUCTURED VIEW DIRECTORY ── */}
        <div
          className="mario-integrated-directory"
          style={{ display: activeViewMode === 'structured' ? 'block' : 'none' }}
          data-testid="mario-structured-directory"
        >
          <div className="mario-directory-header">
            <div className="mario-dir-title-row">
              <h3 className="mario-dir-title">Overworld Stage Directory &amp; Challenge Ledger</h3>
              <span className="mario-dir-subtitle">3 Progressive Tracks, 12 Curriculum Modules &amp; 19 Verification Tasks</span>
            </div>
            <button
              type="button"
              className="mario-dir-toggle-btn"
              onClick={() => {
                setActiveViewMode('map');
                playMapSFX('step');
              }}
              title="Return to 2D Map View"
            >
              🗺️ Return to 2D Map View
            </button>
          </div>

          <div className="mario-directory-content">
            <div id="tracks-overview" data-testid="tracks-overview" className="mario-curriculum-archive">
              <div className="mario-archive-title">
                <span>📜 3 Structured Curriculum Tracks (12 Interactive Modules)</span>
              </div>

              <div className="mario-tracks-grid">
                {tracks.map((track) => (
                  <div
                    key={track.id}
                    className="mario-track-card"
                    id={track.id}
                    data-testid={`track-card-${track.id}`}
                  >
                    <div className="mario-track-header">
                      <span className="mario-track-name">Track {track.trackNumber} — {track.title}</span>
                      <span className="mario-track-badge">{track.level}</span>
                    </div>

                    <div className="mario-modules-list">
                      {track.modules.map((mod) => {
                        const isDone = completedLessonIds.includes(mod.id) ||
                          (mod.id === 'lesson-1-bits-vs-qubits' && (completedLessonIds.includes('lesson-1-superposition') || completedLessonIds.includes('s1-hadamard-superposition'))) ||
                          (mod.id === 'lesson-1-superposition' && (completedLessonIds.includes('lesson-1-superposition') || completedLessonIds.includes('s1-hadamard-superposition')));
                        const isLesson1 = mod.id === 'lesson-1-bits-vs-qubits' || mod.id === 'lesson-1-superposition' || mod.lessonNumber === 1;
                        const quizAns = selectedQuizAnswers[mod.id];
                        const isAnswered = quizSubmitted[mod.id];

                        return (
                          <div
                            key={mod.id}
                            className={`mario-module-beat-card ${isDone ? 'completed' : ''}`}
                            id={`module-beat-${mod.id}`}
                            data-testid={`module-beat-${mod.id}`}
                          >
                            <div className="mario-beat-top">
                              <div className="mario-beat-badge">
                                <span className="mario-beat-num">0{mod.lessonNumber}. </span>
                                <h4 className="mario-beat-title-text">{mod.title}</h4>
                              </div>
                              <span className="mario-beat-xp">+{mod.xpReward} XP</span>
                              {isDone && (
                                <span
                                  className="lp-status-pill mastered"
                                  data-testid={isLesson1 ? 'status-completed-lesson-1-superposition' : `status-completed-${mod.id}`}
                                >
                                  Mastered
                                </span>
                              )}
                            </div>
                            <div className="mario-beat-details">
                              <div className="mario-beat-row">
                                <span className="mario-beat-k">Theory:</span>
                                <span className="mario-beat-v">{mod.theoryBeat}</span>
                              </div>
                              <div className="mario-beat-row">
                                <span className="mario-beat-k">Practical:</span>
                                <span className="mario-beat-v">{mod.practicalBeat}</span>
                              </div>
                              <div className="mario-beat-row">
                                <span className="mario-beat-k">Gate:</span>
                                <span className="mario-beat-v">{mod.assessmentGate}</span>
                              </div>
                            </div>

                            {isLesson1 && (
                              <div className="mario-beat-quiz">
                                <div className="mario-quiz-question">{mod.quiz.question}</div>
                                <div className="mario-quiz-options">
                                  {mod.quiz.options.map((opt, optIdx) => (
                                    <button
                                      key={optIdx}
                                      type="button"
                                      className={`mario-quiz-btn ${quizAns === optIdx ? 'selected' : ''}`}
                                      onClick={() => {
                                        setSelectedQuizAnswers(p => ({ ...p, [mod.id]: optIdx }));
                                        setQuizSubmitted(p => ({ ...p, [mod.id]: true }));
                                      }}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                                {isAnswered && (
                                  <div className="mario-quiz-feedback">
                                    {quizAns === mod.quiz.correctIndex ? 'Correct! ' : 'Incorrect. '}
                                    {mod.quiz.explanation}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mario-beat-actions">
                              <button
                                type="button"
                                className="mario-beat-lab-btn"
                                onClick={() => onLaunchAssessment(mod)}
                                data-testid={`launch-assessment-btn-${mod.id}`}
                              >
                                <Play size={12} fill="currentColor" />
                                <span>Practice Lab</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div id="challenges" data-testid="all-challenges-section" className="mario-challenges-archive">
              <div className="mario-archive-title">
                <span>⚡ 19 Algorithmic &amp; Guided Verification Tasks</span>
              </div>

              <div className="mario-ledger-filters" role="tablist">
                <button
                  type="button"
                  className={`mario-lfilter-btn ${activeChallengeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveChallengeFilter('all')}
                  data-testid="filter-all-challenges"
                >
                  All Tasks ({challenges.length})
                </button>
                <button
                  type="button"
                  className={`mario-lfilter-btn ${activeChallengeFilter === 'guided' ? 'active' : ''}`}
                  onClick={() => setActiveChallengeFilter('guided')}
                  data-testid="filter-guided-challenges"
                >
                  Single-Qubit Tasks (7)
                </button>
                <button
                  type="button"
                  className={`mario-lfilter-btn ${activeChallengeFilter === 'foundation' ? 'active' : ''}`}
                  onClick={() => setActiveChallengeFilter('foundation')}
                  data-testid="filter-foundation-challenges"
                >
                  Foundations (4)
                </button>
                <button
                  type="button"
                  className={`mario-lfilter-btn ${activeChallengeFilter === 'algorithm' ? 'active' : ''}`}
                  onClick={() => setActiveChallengeFilter('algorithm')}
                  data-testid="filter-algorithm-challenges"
                >
                  Algorithms &amp; Complexity (4)
                </button>
                <button
                  type="button"
                  className={`mario-lfilter-btn ${activeChallengeFilter === 'advanced' ? 'active' : ''}`}
                  onClick={() => setActiveChallengeFilter('advanced')}
                  data-testid="filter-advanced-challenges"
                >
                  Advanced &amp; Variational (4)
                </button>
              </div>

              <div className="mario-challenges-grid" data-testid="challenges-grid">
                {filteredLedgerChallenges.map((challenge) => {
                  const completed = isChallengeCompleted(challenge);
                  return (
                    <div
                      key={challenge.id}
                      className={`mario-ledger-card ${completed ? 'completed' : ''}`}
                      data-testid={`challenge-card-${challenge.id}`}
                    >
                      <div className="mario-lcard-top">
                        <span className="mario-lcard-num">TASK {challenge.challengeNumber}</span>
                        <span className="mario-lcard-cat">{challenge.categoryLabel}</span>
                        <span className={`mario-lcard-diff ${challenge.difficulty.toLowerCase()}`}>
                          {challenge.difficulty}
                        </span>
                      </div>

                      <div className="mario-lcard-body">
                        <h4 className="mario-lcard-title">{challenge.title}</h4>
                        <p className="mario-lcard-desc">{challenge.description}</p>
                        <div className="mario-lcard-summary">{challenge.criteriaSummary}</div>
                      </div>

                      <div className="mario-lcard-foot">
                        <div className="mario-lcard-meta">
                          <span><Clock size={12} /> {challenge.duration}</span>
                          <span style={{ color: '#ffd700' }}><Zap size={12} /> +{challenge.xpReward} XP</span>
                        </div>

                        <button
                          type="button"
                          className="mario-lcard-launch-btn"
                          onClick={() => onLaunchChallenge(challenge)}
                          data-testid={`launch-challenge-btn-${challenge.id}`}
                        >
                          <Play size={12} fill="currentColor" />
                          <span>{challenge.type === 'task' ? 'Start Task' : 'Launch Task'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuantumMarioWorldMap;
