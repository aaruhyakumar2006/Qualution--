import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Flame,
  Terminal,
  Cpu,
  Zap,
  ArrowRight,
  Play,
  Globe,
  BarChart3,
  Sparkles,
  Users,
  Shield,
  Activity,
  Layers,
  BookOpen,
  FlaskConical,
  Network,
  Volume2,
  VolumeX,
  Compass,
  Star,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import './CodedexLanding.css';

export interface CodedexLandingProps {
  onLaunchIDE: () => void;
  onOpenLogin: () => void;
  onOpenSignUp: () => void;
  onNavigateLearn: () => void;
  onNavigateTeacherPortal?: () => void;
  onNavigateStudentPortal?: () => void;
  onNavigateCollab?: () => void;
}

interface FloatingCoin {
  id: number;
  x: number;
  y: number;
  amount: number;
  text?: string;
}

interface QuantumWorldStation {
  id: string;
  worldNumber: string;
  title: string;
  badge: string;
  tag: string;
  concept: string;
  formula: string;
  color: string;
  description: string;
}

const QUANTUM_STATIONS: QuantumWorldStation[] = [
  {
    id: 'world-1',
    worldNumber: 'WORLD 1',
    title: 'Quantum Foundations',
    badge: 'BEGINNER',
    tag: 'QUBITS & GATES',
    concept: 'Superposition & Phase',
    formula: '|Ψ⟩ = α|0⟩ + β|1⟩',
    color: '#ffc700',
    description: 'Ground state preparation, Pauli bit-flips, and Hadamard superpositions on deterministic registers.',
  },
  {
    id: 'world-2',
    worldNumber: 'WORLD 2',
    title: 'Algorithm Arena',
    badge: 'INTERMEDIATE',
    tag: 'ENTANGLEMENT',
    concept: 'Grover & Bell States',
    formula: '|Φ⁺⟩ = (|00⟩ + |11⟩) / √2',
    color: '#38bdf8',
    description: 'Two-qubit entanglement, phase inversion oracles, and quadratic speedup search algorithms.',
  },
  {
    id: 'world-3',
    worldNumber: 'WORLD 3',
    title: 'Variational Empire',
    badge: 'ADVANCED',
    tag: 'QPU & CLOUD',
    concept: 'VQE & Optimization',
    formula: 'min ⟨Ψ(θ)| H |Ψ(θ)⟩',
    color: '#c084fc',
    description: 'Parameterized ansatz circuits, noise mitigation, and quantum-classical hybrid variational solvers.',
  },
];

const MARIO_DIALOGUES = [
  "It's-a me, Mario — your Quantum Arcade Guide! 🍄",
  "Select any World Station above to inspect the quantum questline! 🗺️",
  "Hit the Mystery Block to collect power-ups and bonus XP! ⭐",
  "Our Circuit Analyzer automatically routes your circuit to Gottesman or QPU! ⚡",
  "Let's-a go! Jump straight into the Quantum Workbench! 🔮",
];

const LIVE_TICKERS = [
  "🔥 @Alex ran a 42-qubit Grover circuit in 158ms!",
  "🏆 @Sam's circuit auto-routed to Gottesman Stabilizer!",
  "⚡ @Taylor's MPS simulation completed in 0.3s!",
  "🚀 @Jordan's AI verification passed with 99.8% fidelity!",
  "✨ @Morgan joined the Quantum Community Dev channel!",
];

const PLATFORM_FEATURES = [
  {
    icon: <Terminal size={26} />,
    title: 'Quantum Workbench',
    desc: 'A full-featured IDE with drag-and-drop circuit builder, real-time simulation, and multi-backend execution. Build, run, and iterate at quantum speed.',
    color: '#ffc700',
    tag: 'CORE',
  },
  {
    icon: <Sparkles size={26} />,
    title: 'Erwin AI Tutor',
    desc: 'Erwin detects misconceptions in real time as you build circuits. It corrects faulty mental models before they solidify — not just answering questions, but teaching correctly.',
    color: '#c084fc',
    tag: 'AI',
  },
  {
    icon: <BookOpen size={26} />,
    title: 'JSON-Driven Live Teaching',
    desc: 'Every lesson in the Workbench is powered by a structured JSON curriculum engine. Scenes, narration, animations, and checkpoints are all declarative — live and editable.',
    color: '#38bdf8',
    tag: 'CURRICULUM',
  },
  {
    icon: <Activity size={26} />,
    title: 'Telemetry Portal',
    desc: 'Live updates on circuit execution, simulation performance, and learner progress. The telemetry portal streams real-time quantum community development metrics.',
    color: '#34d399',
    tag: 'LIVE',
  },
  {
    icon: <Shield size={26} />,
    title: 'AI-Verifiable System',
    desc: 'Every circuit result is cross-verified by our AI validation layer. Fidelity scores, gate error bounds, and output distributions are cryptographically attestable.',
    color: '#fb7185',
    tag: 'TRUST',
  },
  {
    icon: <Cpu size={26} />,
    title: 'Smart Circuit Analyzer',
    desc: 'Automatically routes your circuit to the optimal simulator: Gottesman–Knill Stabilizer for Clifford circuits, MPS for low-entanglement, and cloud QPUs for high-depth.',
    color: '#f97316',
    tag: 'ENGINE',
  },
  {
    icon: <Layers size={26} />,
    title: 'Multi-Framework Backend',
    desc: 'Run circuits on Qiskit, PennyLane, Cirq, or Braket from a single interface. The backend abstraction layer handles transpilation, optimization, and result normalization.',
    color: '#e879f9',
    tag: 'INFRA',
  },
  {
    icon: <Users size={26} />,
    title: 'Quantum Community Dev',
    desc: 'Collaborate on circuits, share experiments, and contribute to open quantum curricula. The community portal tracks contributions, forks, and live co-simulation sessions.',
    color: '#38bdf8',
    tag: 'COMMUNITY',
  },
];

const CIRCUIT_BACKENDS = [
  { name: 'Gottesman–Knill Stabilizer', use: 'Clifford-only circuits', speed: '< 1ms', qubits: '1000+', color: '#ffc700' },
  { name: 'Matrix Product State (MPS)', use: 'Low entanglement circuits', speed: '< 50ms', qubits: '200+', color: '#38bdf8' },
  { name: 'Statevector (exact)', use: 'General small circuits', speed: '< 500ms', qubits: '30', color: '#34d399' },
  { name: 'Cloud QPU (IBM / Braket)', use: 'Real hardware execution', speed: 'Queue-based', qubits: '127+', color: '#c084fc' },
];

const TESTIMONIALS = [
  {
    name: 'Priya S.',
    role: 'CS Student · IIT Delhi',
    text: 'Erwin caught my misconception about superposition on day one. The JSON lesson engine made every concept click instantly.',
    avatar: '🎓',
    stars: 5,
  },
  {
    name: 'Marcus T.',
    role: 'Physics grad · MIT',
    text: 'The circuit analyzer auto-routed my 80-qubit Clifford circuit to the stabilizer backend. Zero config, instant results.',
    avatar: '⚛️',
    stars: 5,
  },
  {
    name: 'Yuki R.',
    role: 'High School Senior',
    text: 'The telemetry portal showed me exactly where my circuit was slow. I fixed it in minutes with Erwin guiding me.',
    avatar: '🌸',
    stars: 5,
  },
  {
    name: 'Dr. Chen L.',
    role: 'Professor · Quantum Lab',
    text: 'The AI-verifiable output system gives my students confidence their results are real. The multi-framework backend is a game changer.',
    avatar: '🔬',
    stars: 5,
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: <FlaskConical size={26} />,
    title: 'Build in the Workbench',
    desc: 'Drag gates onto the circuit grid. The smart analyzer instantly selects the best simulation backend for your circuit structure.',
    color: '#ffc700',
  },
  {
    step: '02',
    icon: <Sparkles size={26} />,
    title: 'Learn with Erwin',
    desc: 'Erwin monitors your circuit in real time, corrects misconceptions, and delivers JSON-driven lessons directly inside the Workbench.',
    color: '#c084fc',
  },
  {
    step: '03',
    icon: <Network size={26} />,
    title: 'Verify & Share',
    desc: 'AI-verifiable results with fidelity scores. Share circuits with the community, stream telemetry, and collaborate live.',
    color: '#34d399',
  },
];

export const CodedexLanding: React.FC<CodedexLandingProps> = ({
  onLaunchIDE,
  onOpenLogin,
  onOpenSignUp,
  onNavigateLearn,
  onNavigateTeacherPortal,
  onNavigateStudentPortal,
  onNavigateCollab,
}) => {
  const { isAuthenticated, logout } = useAuth();

  const [selectedStationIndex, setSelectedStationIndex] = useState<number>(0);
  const [tickerIndex, setTickerIndex] = useState<number>(0);
  const [tickerVisible, setTickerVisible] = useState<boolean>(true);
  const [floatingCoins, setFloatingCoins] = useState<FloatingCoin[]>([]);
  const [totalXp, setTotalXp] = useState<number>(450);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [dialogueIndex, setDialogueIndex] = useState<number>(0);
  const [mysteryBumped, setMysteryBumped] = useState<boolean>(false);
  const [powerupActive, setPowerupActive] = useState<boolean>(false);
  const [marioJumping, setMarioJumping] = useState<boolean>(false);

  const [counters, setCounters] = useState({ learners: 18400, circuits: 94200, backends: 4 });
  const statsRef = useRef<HTMLDivElement>(null);
  const countersDone = useRef(false);

  // Play retro 8-bit sound synth
  const playSound = (type: 'coin' | 'powerup' | 'station' | 'bump') => {
    if (!audioEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === 'coin') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(987.77, now);
        osc.frequency.setValueAtTime(1318.51, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'station') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(640, now + 0.12);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'bump') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'powerup') {
        const notes = [330, 392, 659, 523, 587, 784];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.09, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + (idx + 1) * 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + (idx + 1) * 0.06);
        });
      }
    } catch {
      // Audio fallback
    }
  };

  // Ticker fade-swap
  useEffect(() => {
    const id = setInterval(() => {
      setTickerVisible(false);
      setTimeout(() => {
        setTickerIndex(p => (p + 1) % LIVE_TICKERS.length);
        setTickerVisible(true);
      }, 350);
    }, 4800);
    return () => clearInterval(id);
  }, []);

  // Safe counter animation with Vitest headless fallback
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setCounters({ learners: 18400, circuits: 94200, backends: 4 });
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !countersDone.current) {
        countersDone.current = true;
        const targets = { learners: 18400, circuits: 94200, backends: 4 };
        const duration = 1600;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - t, 3);
          setCounters({
            learners: Math.round(targets.learners * ease),
            circuits: Math.round(targets.circuits * ease),
            backends: Math.round(targets.backends * ease),
          });
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.2 });

    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const handleStationSelect = (idx: number) => {
    setSelectedStationIndex(idx);
    playSound('station');
    setTotalXp(p => p + 20);
  };

  const handleMysteryBlockClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound('powerup');
    setMysteryBumped(true);
    setPowerupActive(true);
    setTimeout(() => setMysteryBumped(false), 240);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const coin: FloatingCoin = {
      id: Date.now(),
      x: rect.left + rect.width / 2,
      y: rect.top - 20,
      amount: 250,
      text: 'QUANTUM 1-UP! +250 XP ⭐',
    };
    setFloatingCoins(p => [...p, coin]);
    setTotalXp(p => p + 250);
    setTimeout(() => setFloatingCoins(p => p.filter(c => c.id !== coin.id)), 1600);
    setTimeout(() => setPowerupActive(false), 4000);
  };

  const handleMascotClick = (e: React.MouseEvent) => {
    playSound('coin');
    setMarioJumping(true);
    setTimeout(() => setMarioJumping(false), 450);
    setDialogueIndex(p => (p + 1) % MARIO_DIALOGUES.length);
    const coin: FloatingCoin = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY - 20,
      amount: 50,
    };
    setFloatingCoins(p => [...p, coin]);
    setTotalXp(p => p + 50);
    setTimeout(() => setFloatingCoins(p => p.filter(c => c.id !== coin.id)), 1400);
  };

  const currentStation = QUANTUM_STATIONS[selectedStationIndex];

  return (
    <div className={`cdx-retro-root qualution-arcade-root ${powerupActive ? 'quantum-star-mode' : ''}`}>
      {/* Laser Top Accent Line */}
      <div className="lp-laser-accent-line">
        <div className="lp-laser-track" />
        <div className="lp-laser-glow-pulse" />
      </div>

      {/* ── Super Mario White Overworld Backdrop with Floating Pixel Clouds & Horizon Hills ── */}
      <div className="lp-mario-white-backdrop" aria-hidden="true">
        <div className="lp-mario-clouds-container">
          <img src="/mario/Cloud1.png" alt="" className="lp-mario-cloud cloud-drift-1" />
          <img src="/mario/Cloud2.png" alt="" className="lp-mario-cloud cloud-drift-2" />
          <img src="/mario/Cloud1.png" alt="" className="lp-mario-cloud cloud-drift-3" />
          <img src="/mario/Cloud2.png" alt="" className="lp-mario-cloud cloud-drift-4" />
          <img src="/mario/Cloud1.png" alt="" className="lp-mario-cloud cloud-drift-5" />
        </div>
        <div className="lp-mario-hills-horizon">
          <img src="/mario/Hill1.png" alt="" className="lp-mario-bg-hill hill-left" />
          <img src="/mario/Bush1.png" alt="" className="lp-mario-bg-bush bush-left" />
          <img src="/mario/Hill1.png" alt="" className="lp-mario-bg-hill hill-right" />
          <img src="/mario/Bush1.png" alt="" className="lp-mario-bg-bush bush-right" />
        </div>
      </div>

      {/* ══════════════════ 1. TOP ACADEMY NAVIGATION ══════════════════ */}
      <header className="lp-academy-nav">
        <div className="lp-nav-container">
          {/* Brand */}
          <div className="lp-academy-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img src="/mario/Coin.png" alt="Coin" className="lp-nav-brand-coin" />
            <div className="lp-brand-copy">
              <span className="lp-brand-title">QUALUTION</span>
              <span className="lp-brand-badge">STUDIO</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="lp-nav-menu">
            <button onClick={onNavigateLearn} className="lp-nav-link active">
              <span>LEARN</span>
              <span className="lp-nav-badge">WORLD 1</span>
            </button>
            <button onClick={onLaunchIDE} className="lp-nav-link">
              <span>WORKBENCH</span>
            </button>
            {onNavigateStudentPortal && (
              <button onClick={onNavigateStudentPortal} className="lp-nav-link">
                <span>PORTAL</span>
              </button>
            )}
            {onNavigateCollab && (
              <button onClick={onNavigateCollab} className="lp-nav-link">
                <span>COLLAB</span>
              </button>
            )}
            <button onClick={onNavigateLearn} className="lp-nav-link">
              <span>CURRICULUM</span>
              <ChevronDown size={13} />
            </button>
          </nav>

          {/* Right Controls */}
          <div className="lp-nav-right">
            {/* XP Counter */}
            <div className="lp-nav-xp-pill" title="Collected Quantum XP">
              <img src="/mario/Coin.png" alt="Coin" className="lp-xp-icon" />
              <span>{totalXp} XP</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={() => setAudioEnabled(a => !a)}
              className="lp-nav-sound-btn"
              title={audioEnabled ? 'Mute 8-bit Audio' : 'Enable 8-bit Audio'}
            >
              {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>

            {/* Authentication Buttons (Matches Test Contract) */}
            {isAuthenticated ? (
              <button onClick={logout} className="lp-btn-outline-signout">
                Sign Out
              </button>
            ) : (
              <div className="lp-auth-buttons-group">
                <button onClick={onOpenLogin} className="lp-btn-login">
                  Sign In
                </button>
                <button onClick={onOpenSignUp} className="lp-btn-signup">
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════ 2. UNIQUE 16-BIT QUANTUM OVERWORLD HERO ══════════════════ */}
      <section className="unique-quantum-overworld-hero">
        <div className="overworld-pixel-vignette" />
        <div className="mario-scanlines" />

        <div className="overworld-hero-content">
          {/* Stage Quest Badge */}
          <div className="overworld-stage-badge">
            <span className="badge-spark">✦</span>
            <span>WORLD 1-1 // QUANTUM OVERWORLD GATEWAY</span>
            <span className="badge-spark">✦</span>
          </div>

          {/* H1 Main Heading (Satisfies Test Contract: LEARN QUANTUM COMPUTING) */}
          <h1 className="overworld-main-title">
            LEARN QUANTUM COMPUTING
          </h1>

          {/* Subtitle */}
          <p className="overworld-lead-text">
            Embark on an interactive quantum journey across 16-bit algorithmic realms.<br />
            Construct live circuits, conquer superposition, and unlock quantum mastery. ⋆˙⟡
          </p>

          {/* Action CTAs (Satisfies Test Contract: DISCOVER NOW as role="link") */}
          <div className="overworld-actions-row">
            <a
              role="link"
              onClick={onLaunchIDE}
              className="lp-pixel-btn-gold"
              tabIndex={0}
            >
              <img src="/mario/Coin.png" alt="" className="lp-btn-coin-img" />
              <span>DISCOVER NOW</span>
            </a>

            <button onClick={onLaunchIDE} className="lp-pixel-btn-pipe">
              <Play size={14} fill="#fff" />
              <span>TRY THE WORKBENCH</span>
            </button>

            <button onClick={onNavigateLearn} className="lp-pixel-btn-neon">
              <Compass size={15} />
              <span>EXPLORE WORLD MAP</span>
            </button>
          </div>

          {/* Live Ticker */}
          <div className="overworld-live-ticker">
            <Flame size={14} className="lp-ticker-flame" />
            <span className="lp-ticker-content" style={{ opacity: tickerVisible ? 1 : 0 }}>
              {LIVE_TICKERS[tickerIndex]}
            </span>
          </div>

          {/* ══════════════ 16-BIT QUANTUM OVERWORLD SHOWCASE ══════════════ */}
          <div className="overworld-showcase-frame">
            {/* Background 16-Bit Pixel Art Scenic Layer */}
            <div className="overworld-pixel-landscape" />

            {/* Showcase Overlay Window Frame */}
            <div className="overworld-glass-console">
              {/* Top Station Selector Tabs */}
              <div className="overworld-station-tabs">
                {QUANTUM_STATIONS.map((station, idx) => (
                  <button
                    key={station.id}
                    className={`station-tab-btn ${selectedStationIndex === idx ? 'active' : ''}`}
                    onClick={() => handleStationSelect(idx)}
                    style={{ '--station-color': station.color } as React.CSSProperties}
                  >
                    <span className="station-num">{station.worldNumber}</span>
                    <span className="station-title">{station.title}</span>
                    <span className="station-tag-pill">{station.badge}</span>
                  </button>
                ))}
              </div>

              {/* Station Deep Dive Panel */}
              <div className="overworld-station-details-grid">
                {/* Left Card: Quest Intel */}
                <div className="station-intel-card">
                  <div className="intel-header-row">
                    <span className="intel-realm-tag" style={{ color: currentStation.color, borderColor: currentStation.color }}>
                      {currentStation.tag}
                    </span>
                    <span className="intel-concept-tag">{currentStation.concept}</span>
                  </div>

                  <h3 className="intel-realm-name">{currentStation.title}</h3>
                  <p className="intel-realm-desc">{currentStation.description}</p>

                  <div className="intel-formula-box">
                    <span className="formula-lbl">GOVERNING EQUATION:</span>
                    <span className="formula-code" style={{ color: currentStation.color }}>{currentStation.formula}</span>
                  </div>

                  <div className="intel-footer-actions">
                    <button onClick={onLaunchIDE} className="station-launch-btn">
                      <span>LOAD IN WORKBENCH</span>
                      <ArrowRight size={13} />
                    </button>

                    {/* Interactive Mystery Block */}
                    <div
                      className={`mystery-reward-block ${mysteryBumped ? 'bumped' : ''}`}
                      onClick={handleMysteryBlockClick}
                      title="Hit the Mystery Block to collect XP powerup!"
                    >
                      <img src="/mario/MysteryBlock.png" alt="Mystery Block" className="mystery-block-sprite" />
                      <span className="mystery-hint">HIT ME!</span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Mario Companion Guide */}
                <div className="station-companion-card station-mario-companion-card" onClick={handleMascotClick} title="Click Mario to jump & hear advice!">
                  <div className="companion-header mario-card-header">
                    <span className="companion-status-badge mario-status-badge">● MARIO QUANTUM GUIDE</span>
                    <span className="companion-xp-pill mario-xp-reward">+50 XP 🪙</span>
                  </div>

                  <div className="companion-interaction-row mario-avatar-speech-wrap">
                    <div className={`companion-avatar-wrap mario-sprite-container ${marioJumping ? 'mario-jump-anim' : ''}`}>
                      <img
                        src={marioJumping ? '/mario/Mario_Big_Jump.png' : '/mario/Mario_Big_Idle.png'}
                        alt="Mario Quantum Guide"
                        className="mario-pixel-avatar mario-pixel-avatar-img"
                      />
                    </div>
                    <div className="mario-dialogue-bubble">
                      <p className="mario-dialogue-text">{MARIO_DIALOGUES[dialogueIndex]}</p>
                      <span className="mario-sub-prompt">Click Mario to jump & ask next advice 🪙</span>
                    </div>
                  </div>

                  <div className="mario-metrics-strip">
                    <div className="mario-stat-cell">
                      <span className="mario-stat-key">FIDELITY</span>
                      <span className="mario-stat-val text-emerald">99.9%</span>
                    </div>
                    <div className="mario-stat-cell">
                      <span className="mario-stat-key">ROUTING</span>
                      <span className="mario-stat-val text-amber">AUTO-QPU</span>
                    </div>
                    <div className="mario-stat-cell">
                      <span className="mario-stat-key">LATENCY</span>
                      <span className="mario-stat-val text-cyan">&lt; 0.3ms</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating XP Coins */}
        {floatingCoins.map(c => (
          <div
            key={c.id}
            className="cdx-floating-xp-coin"
            style={{ left: `${c.x}px`, top: `${c.y}px` }}
          >
            {c.text || `+${c.amount} XP 🪙`}
          </div>
        ))}
      </section>

      {/* ══════════════════ 3. HERO STATS HUD BAR ══════════════════ */}
      <section className="cdx-mario-stats-bar" ref={statsRef}>
        <div className="cdx-stats-inner">
          {[
            { value: `${counters.learners.toLocaleString()}+`, label: 'Active Learners', icon: '🍄' },
            { value: `${counters.circuits.toLocaleString()}+`, label: 'Circuits Simulated', icon: '⭐' },
            { value: `${counters.backends}`, label: 'Simulation Backends', icon: '⚡' },
            { value: '100%', label: 'Free to Start', icon: '🪙' },
          ].map((s, i) => (
            <div key={i} className="cdx-mario-stat-card">
              <span className="cdx-stat-icon">{s.icon}</span>
              <div className="cdx-stat-info">
                <span className="cdx-stat-val">{s.value}</span>
                <span className="cdx-stat-lbl">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════ 4. MARQUEE TECH RIBBON ══════════════════ */}
      <div className="cdx-mario-marquee-track">
        <div className="cdx-marquee-ribbon">
          {[
            'Qiskit', 'PennyLane', 'Cirq', 'Braket', 'IBM Quantum',
            'NVIDIA cuQuantum', 'OpenQASM', 'Q#', 'QuTiP', 'Gottesman–Knill',
            'MPS Simulator', 'Statevector', 'Qiskit', 'PennyLane', 'Cirq',
            'Braket', 'IBM Quantum', 'NVIDIA cuQuantum'
          ].map((tech, i) => (
            <span key={i} className="cdx-marquee-chip">
              <Zap size={13} className="cdx-marquee-zap" />
              <span>{tech}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ══════════════════ 5. HOW IT WORKS (STAGE 01) ══════════════════ */}
      <section className="cdx-mario-section cdx-mario-section-alt">
        <div className="cdx-section-container">
          <div className="cdx-stage-indicator">
            <span>[ STAGE 01 // HOW IT WORKS ]</span>
          </div>
          <h2 className="cdx-mario-section-heading">From Circuit To Insight In 3 Steps</h2>
          <p className="cdx-mario-section-sub">Build, learn, and verify — all inside one platform.</p>

          <div className="cdx-how-mario-grid">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="cdx-how-mario-card">
                <div className="cdx-how-header-row">
                  <span className="cdx-how-badge" style={{ borderColor: step.color, color: step.color }}>
                    WORLD 0{i + 1}
                  </span>
                  <div className="cdx-how-icon-box" style={{ background: `${step.color}20`, color: step.color }}>
                    {step.icon}
                  </div>
                </div>
                <h3 className="cdx-how-card-title">{step.title}</h3>
                <p className="cdx-how-card-desc">{step.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="cdx-how-connector-arrow">
                    <ArrowRight size={22} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ 6. THE PLATFORM (STAGE 02) ══════════════════ */}
      <section className="cdx-mario-section">
        <div className="cdx-section-container">
          <div className="cdx-stage-indicator">
            <span>[ STAGE 02 // THE PLATFORM ]</span>
          </div>
          <h2 className="cdx-mario-section-heading">Everything Inside Qualution</h2>
          <p className="cdx-mario-section-sub">
            Eight core systems working together — from circuit building to AI-verified results.
          </p>

          <div className="cdx-pf-mario-grid">
            {PLATFORM_FEATURES.map((f, i) => (
              <div
                key={i}
                className="cdx-pf-mario-card"
                style={{ '--accent-color': f.color } as React.CSSProperties}
              >
                <div className="cdx-pf-top-bar">
                  <span className="cdx-pf-tag" style={{ borderColor: f.color, color: f.color }}>
                    {f.tag}
                  </span>
                  <div className="cdx-pf-icon-wrap" style={{ color: f.color, background: `${f.color}18` }}>
                    {f.icon}
                  </div>
                </div>
                <h3 className="cdx-pf-mario-title">{f.title}</h3>
                <p className="cdx-pf-mario-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ 7. CIRCUIT ANALYZER (STAGE 03) ══════════════════ */}
      <section className="cdx-mario-section cdx-mario-section-alt">
        <div className="cdx-section-container">
          <div className="cdx-stage-indicator">
            <span>[ STAGE 03 // SMART ROUTING ]</span>
          </div>
          <h2 className="cdx-mario-section-heading">Circuit Analyzer Picks The Right Backend</h2>
          <p className="cdx-mario-section-sub">
            No manual config. The analyzer inspects your circuit structure and routes it automatically.
          </p>

          <div className="cdx-backends-mario-grid">
            {CIRCUIT_BACKENDS.map((b, i) => (
              <div
                key={i}
                className="cdx-backend-mario-card"
                style={{ '--bc-color': b.color } as React.CSSProperties}
              >
                <div className="cdx-backend-head">
                  <span className="cdx-backend-slot-badge">SLOT 0{i + 1}</span>
                  <div className="cdx-backend-title" style={{ color: b.color }}>{b.name}</div>
                </div>
                <div className="cdx-backend-usage">{b.use}</div>
                <div className="cdx-backend-metrics-row">
                  <div className="cdx-metric-item">
                    <BarChart3 size={13} style={{ color: b.color }} />
                    <span>{b.speed}</span>
                  </div>
                  <div className="cdx-metric-item">
                    <Cpu size={13} style={{ color: b.color }} />
                    <span>{b.qubits} Qubits</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ 8. TESTIMONIALS (STAGE 04) ══════════════════ */}
      <section className="cdx-mario-section">
        <div className="cdx-section-container">
          <div className="cdx-stage-indicator">
            <span>[ STAGE 04 // COMMUNITY REVIEWS ]</span>
          </div>
          <h2 className="cdx-mario-section-heading">What Builders Are Saying</h2>
          <p className="cdx-mario-section-sub">From students to professors — Qualution works at every level.</p>

          <div className="cdx-testi-mario-grid">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="cdx-testi-mario-card">
                <div className="cdx-testi-stars">
                  {'⭐'.repeat(t.stars)}
                </div>
                <p className="cdx-testi-quote">"{t.text}"</p>
                <div className="cdx-testi-author-row">
                  <div className="cdx-testi-avatar-box">{t.avatar}</div>
                  <div>
                    <div className="cdx-testi-name">{t.name}</div>
                    <div className="cdx-testi-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ 9. GOAL CASTLE / WARP CTA ══════════════════ */}
      <section className="cdx-mario-cta-castle">
        <div className="cdx-castle-inner">
          <div className="cdx-castle-icon-badge">
            <img src="/mario/Starman.png" alt="Star" className="cdx-castle-star" />
          </div>
          <h2 className="cdx-castle-title">
            Build Quantum. Verify With AI. Share With The World.
          </h2>
          <p className="cdx-castle-desc">
            Join 18,000+ learners and researchers already using Qualution. Free forever — no credit card needed.
          </p>
          <div className="cdx-castle-buttons">
            <button onClick={onOpenSignUp} className="mario-pixel-btn-gold cdx-castle-btn-lg">
              <span>GET STARTED FREE</span>
            </button>
            <button onClick={onLaunchIDE} className="mario-pixel-btn-pipe cdx-castle-btn-lg">
              <Globe size={16} />
              <span>OPEN WORKBENCH</span>
            </button>
          </div>
        </div>
      </section>

      {/* ══════════════════ 10. ARCADE FOOTER ══════════════════ */}
      <footer className="cdx-mario-footer">
        <div className="cdx-footer-inner-wrap">
          <div className="cdx-footer-col-main">
            <div className="cdx-footer-brand-title">
              <img src="/mario/Coin.png" alt="Coin" className="cdx-footer-coin" />
              <span>QUALUTION</span>
            </div>
            <p className="cdx-footer-tagline">
              The quantum platform that builds, teaches, verifies, and connects learners worldwide.
            </p>
            <div className="cdx-footer-social-row">
              {['Twitter', 'GitHub', 'Discord'].map(soc => (
                <button key={soc} className="cdx-footer-social-pill">{soc}</button>
              ))}
            </div>
          </div>

          <div className="cdx-footer-links-layout">
            {[
              { heading: 'Platform', links: ['Workbench', 'Circuit Analyzer', 'Telemetry Portal', 'AI Verifier'] },
              { heading: 'Learn', links: ['Qubits', 'Circuits', 'Algorithms', 'Quantum AI'] },
              { heading: 'Community', links: ['Discord', 'Forum', 'Showcase', 'Events'] },
              { heading: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
            ].map(col => (
              <div key={col.heading} className="cdx-footer-link-group">
                <div className="cdx-footer-group-heading">{col.heading}</div>
                {col.links.map(link => (
                  <button key={link} onClick={onLaunchIDE} className="cdx-footer-text-link">
                    {link}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="cdx-footer-legal-bar">
          <span>© 2026 QUALUTION PLATFORM. ALL RIGHTS RESERVED.</span>
          <div className="cdx-footer-legal-links">
            {['Privacy Policy', 'Terms of Service', 'Cookie Settings'].map(l => (
              <button key={l} className="cdx-footer-text-link">{l}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default CodedexLanding;
