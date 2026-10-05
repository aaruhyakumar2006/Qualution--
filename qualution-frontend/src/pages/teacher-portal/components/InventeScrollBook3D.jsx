import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, BookOpen, ArrowUpRight, 
  Sparkles, CheckCircle2, Layers, Cpu, Compass, Play,
  Zap, Globe, Trophy, ExternalLink
} from 'lucide-react';
import { BOOK_3D_STRINGS } from '../constants/portalConstants';

export function isWebGLAvailable() {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch (e) {
    return false;
  }
}

export default function InventeScrollBook3D({
  theme = 'courses',
  badgeText = BOOK_3D_STRINGS.BADGE_TEXT,
  bookTitle = BOOK_3D_STRINGS.BOOK_TITLE,
  bookSubtitle = BOOK_3D_STRINGS.BOOK_SUBTITLE,
  spreads = [],
  onSelectAction,
  onWebGLUnavailable
}) {
  const containerRef = useRef(null);
  const [scrollProgress, setScrollProgress] = useState(0); // 0 to 1
  const [activeTab, setActiveTab] = useState(0); // 0: Cover/Spread1, 1: Spread2, 2: Spread3
  const [isOpen, setIsOpen] = useState(true);

  // Check WebGL availability on mount
  useEffect(() => {
    try {
      if (!isWebGLAvailable() && typeof onWebGLUnavailable === 'function') {
        onWebGLUnavailable();
      }
    } catch (err) {
      if (typeof onWebGLUnavailable === 'function') {
        onWebGLUnavailable();
      }
    }
  }, [onWebGLUnavailable]);

  // Track scroll position through the section to automatically drive the book opening
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      const totalScrollable = rect.height - windowHeight;
      if (totalScrollable <= 0) return;
      
      const currentScroll = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScroll / totalScrollable));
      setScrollProgress(progress);
      
      if (progress < 0.33) {
        setActiveTab(0);
      } else if (progress < 0.66) {
        setActiveTab(1);
      } else {
        setActiveTab(2);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTabClick = (index) => {
    setActiveTab(index);
    if (!isOpen) setIsOpen(true);
  };

  const handleToggleCover = () => {
    setIsOpen(!isOpen);
  };

  // Build active spreads dynamically from props
  const activeSpreads = spreads.length > 0 ? spreads : [
    {
      tabLabel: "1. Global Signals",
      tabColor: "#C1F8FF",
      tabShort: "SIGNALS",
      title: "EDITORIAL ARCHIVE & BREAKING DISCOVERIES",
      code: "SIGNAL-01 / BREAKING",
      tag: "EDITORIAL TELEMETRY",
      summary: "Real-time dispatch from leading quantum research laboratories and verified peer-reviewed publications.",
      highlights: [
        "Live quantum error correction & threshold metrics",
        "Empirical advantage demonstrations on graph optimization",
        "Hardware benchmark updates across multi-chip architectures"
      ],
      actionLabel: BOOK_3D_STRINGS.EXPLORE_SIGNALS,
      stats: { modules: "LIVE", hours: "FEED", students: "ARCHIVE" }
    }
  ];

  return (
    <div 
      ref={containerRef}
      className="invente-book-outer-section"
      style={{
        position: 'relative',
        width: '100%',
        margin: '1.5rem 0 2.5rem 0',
      }}
    >
      <style>{`
        /* ── INVENTE '26 BOOK SYSTEM STYLES ── */
        .invente-book-outer-section {
          --book-border: 2.5px solid #1F1F1F;
          --book-ink: #1F1F1F;
          --book-cyan: #C1F8FF;
          --book-yellow: #FFC83B;
          --book-pink: #FE90E9;
          --book-lime: #B0EF9E;
          --book-paper: #FFFDF9;
          --book-paper-shadow: #E8E0D2;
        }

        .invente-book-container {
          background: #FFF9EE;
          border: var(--book-border);
          box-shadow: 6px 6px 0px #1F1F1F;
          padding: 1.5rem;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        /* Top Control Bar */
        .invente-book-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #1F1F1F;
          padding-bottom: 1rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .invente-shelf-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #1F1F1F;
          color: #FFF;
          padding: 0.35rem 0.75rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .invente-tab-triggers {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .invente-tab-btn {
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.4rem 0.9rem;
          border: 2px solid #1F1F1F;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
          box-shadow: 2px 2px 0px #1F1F1F;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .invente-tab-btn:hover {
          transform: translate(-1px, -1px);
          box-shadow: 3px 3px 0px #1F1F1F;
        }

        .invente-tab-btn.active {
          transform: translate(1px, 1px);
          box-shadow: 0px 0px 0px #1F1F1F;
          outline: 2px solid #1F1F1F;
        }

        /* 3D BOOK STAGE */
        .invente-book-stage {
          perspective: 1600px;
          perspective-origin: 50% 48%;
          width: 100%;
          min-height: 480px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 0.5rem;
          position: relative;
        }

        /* The Open Book Rig */
        .invente-book-rig {
          position: relative;
          width: min(940px, 94vw);
          height: 460px;
          transform-style: preserve-3d;
          display: flex;
          filter: drop-shadow(0 20px 30px rgba(0,0,0,0.18));
          transition: transform 0.6s cubic-bezier(0.25, 1, 0.5, 1);
        }

        /* Left Half of Book */
        .invente-book-page-left {
          flex: 1;
          height: 100%;
          background: var(--book-paper);
          border: var(--book-border);
          border-right: none;
          border-radius: 4px 0 0 4px;
          position: relative;
          padding: 1.8rem 1.8rem 1.5rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background-image: 
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(to right, transparent, rgba(0,0,0,0.12) 98%, rgba(0,0,0,0.3) 100%);
          background-size: 16px 16px, 16px 16px, 100% 100%;
        }

        /* Center Spine Binding Gutter */
        .invente-book-spine-line {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 8px;
          background: linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.45));
          border-left: 1px solid rgba(0,0,0,0.3);
          z-index: 10;
        }

        /* Right Half of Book */
        .invente-book-page-right {
          flex: 1;
          height: 100%;
          background: var(--book-paper);
          border: var(--book-border);
          border-left: none;
          border-radius: 0 4px 4px 0;
          position: relative;
          padding: 1.8rem 2.2rem 1.5rem 1.8rem;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background-image: 
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(to left, transparent, rgba(0,0,0,0.12) 98%, rgba(0,0,0,0.3) 100%);
          background-size: 16px 16px, 16px 16px, 100% 100%;
        }

        /* Realistic Page Thickness Bottom Edges */
        .invente-page-edge-left {
          position: absolute;
          bottom: -6px;
          left: 4px;
          right: 0;
          height: 6px;
          background: repeating-linear-gradient(
            to bottom,
            #e4decb 0px,
            #e4decb 1px,
            #c8beaa 1px,
            #c8beaa 2px
          );
          border: 1px solid #1F1F1F;
          border-top: none;
          transform: skewX(-45deg);
          transform-origin: top left;
        }

        .invente-page-edge-right {
          position: absolute;
          bottom: -6px;
          left: 0;
          right: 4px;
          height: 6px;
          background: repeating-linear-gradient(
            to bottom,
            #e4decb 0px,
            #e4decb 1px,
            #c8beaa 1px,
            #c8beaa 2px
          );
          border: 1px solid #1F1F1F;
          border-top: none;
          transform: skewX(45deg);
          transform-origin: top right;
        }

        /* Protruding Colored Index Bookmark Tabs (Signature INVENTE '26 feature) */
        .invente-tabs-stack-right {
          position: absolute;
          right: -32px;
          top: 36px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          z-index: 25;
        }

        .invente-bookmark-tab {
          width: 32px;
          height: 74px;
          border: 2px solid #1F1F1F;
          border-left: none;
          border-radius: 0 6px 6px 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          writing-mode: vertical-rl;
          text-orientation: mixed;
          font-family: var(--font-mono, monospace);
          font-size: 0.62rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: #1F1F1F;
          transition: all 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 3px 3px 0px rgba(0,0,0,0.3);
          user-select: none;
        }

        .invente-bookmark-tab:hover {
          width: 40px;
          box-shadow: 4px 4px 0px rgba(0,0,0,0.5);
        }

        .invente-bookmark-tab.active-tab {
          width: 44px;
          font-weight: 900;
          outline: 2px solid #1F1F1F;
          box-shadow: 4px 4px 0px #1F1F1F;
        }

        /* 3D FLIPPING PAGE MECHANIC */
        .invente-flipping-page {
          position: absolute;
          top: 0;
          right: 0;
          width: 50%;
          height: 100%;
          transform-origin: left center;
          transform-style: preserve-3d;
          transition: transform 0.85s cubic-bezier(0.4, 0.0, 0.2, 1);
          z-index: 20;
          pointer-events: none;
        }

        .invente-flipping-page.flipped {
          transform: rotateY(-180deg);
        }

        .invente-flip-face {
          position: absolute;
          inset: 0;
          background: var(--book-paper);
          border: var(--book-border);
          padding: 1.8rem;
          box-sizing: border-box;
          backface-visibility: hidden;
        }

        .invente-flip-back {
          transform: rotateY(180deg);
          border-right: none;
        }

        /* Content elements inside pages */
        .invente-page-num {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          font-weight: 800;
          color: #777;
        }

        .invente-page-tag {
          font-family: var(--font-mono, monospace);
          font-size: 0.65rem;
          font-weight: 900;
          padding: 2px 6px;
          border: 1.5px solid #1F1F1F;
          display: inline-block;
          letter-spacing: 0.05em;
        }

        .invente-course-title {
          font-family: var(--font-display, 'Space Grotesk', sans-serif);
          font-size: 1.4rem;
          font-weight: 900;
          line-height: 1.2;
          color: #1F1F1F;
          margin: 0.6rem 0;
        }

        .invente-highlight-list {
          list-style: none;
          padding: 0;
          margin: 1rem 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .invente-highlight-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.82rem;
          font-weight: 600;
          color: #333;
          line-height: 1.35;
        }

        /* Animated Atomic / Quantum Emblem for Inside Left Cover */
        .invente-quantum-orb {
          width: 90px;
          height: 90px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .invente-nucleus {
          width: 18px;
          height: 18px;
          background: #1F1F1F;
          border-radius: 50%;
          border: 2px solid var(--book-yellow);
          box-shadow: 0 0 12px rgba(255, 200, 59, 0.6);
          z-index: 5;
        }

        .invente-ring {
          position: absolute;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 1.5px dashed rgba(31,31,31,0.6);
          animation: inventeOrbit 4s linear infinite;
        }
        .invente-ring-1 { transform: rotateX(70deg) rotateZ(0deg); }
        .invente-ring-2 { transform: rotateX(70deg) rotateZ(60deg); animation-duration: 3.2s; }
        .invente-ring-3 { transform: rotateX(70deg) rotateZ(120deg); animation-duration: 5s; }

        @keyframes inventeOrbit {
          from { transform: rotateX(70deg) rotateZ(0deg); }
          to { transform: rotateX(70deg) rotateZ(360deg); }
        }

        /* Scrubber progress strip */
        .invente-scroll-scrubber {
          margin-top: 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1F1F1F;
          color: #FFF;
          padding: 0.6rem 1rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.72rem;
          font-weight: 700;
        }

        .invente-scrub-bar {
          flex: 1;
          height: 6px;
          background: #333;
          margin: 0 1rem;
          position: relative;
          border-radius: 3px;
          overflow: hidden;
          cursor: pointer;
        }

        .invente-scrub-fill {
          height: 100%;
          background: var(--book-yellow);
          transition: width 0.25s ease;
        }

        @media (max-width: 820px) {
          .invente-book-rig {
            flex-direction: column;
            height: auto;
          }
          .invente-book-page-left, .invente-book-page-right {
            border: var(--book-border);
            border-radius: 4px;
            width: 100%;
            height: auto;
            min-height: 280px;
          }
          .invente-tabs-stack-right {
            position: static;
            flex-direction: row;
            width: 100%;
            margin-bottom: 0.5rem;
          }
          .invente-bookmark-tab {
            writing-mode: horizontal-tb;
            width: auto;
            height: 36px;
            padding: 0.2rem 0.6rem;
            border-left: 2px solid #1F1F1F;
          }
        }
      `}</style>

      <div className="invente-book-container">
        {/* Top Header / Sub-Nav with exact SSN-SNUC Invente '26 Badging */}
        <div className="invente-book-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span className="invente-shelf-badge">
              <BookOpen size={14} color="#FFC83B" />
              <span>{badgeText}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 800 }}>
              {BOOK_3D_STRINGS.HEADER_SUBTITLE}
            </span>
          </div>

          {/* Three Tab Selectors matching Cyan / Yellow / Pink tabs */}
          <div className="invente-tab-triggers">
            {activeSpreads.map((spread, i) => (
              <button
                key={i}
                onClick={() => handleTabClick(i)}
                className={`invente-tab-btn ${activeTab === i ? 'active' : ''}`}
                style={{
                  background: spread.tabColor,
                  color: '#1F1F1F'
                }}
              >
                <span>{spread.tabLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3D BOOK PRESENTATION STAGE */}
        <div className="invente-book-stage">
          <div className="invente-book-rig">

            {/* ── LEFT PAGE: Architectural context & overview ── */}
            <div className="invente-book-page-left">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="invente-page-num">{BOOK_3D_STRINGS.FOLIO_PREFIX} {activeTab * 2 + 1} / 06</span>
                  <span 
                    className="invente-page-tag" 
                    style={{ background: activeSpreads[activeTab].tabColor }}
                  >
                    {activeSpreads[activeTab].code}
                  </span>
                </div>

                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 800, color: '#888' }}>
                    {BOOK_3D_STRINGS.ARCHITECTURE_HEADER}
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 900, margin: '0.35rem 0' }}>
                    {bookTitle}
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#555', lineHeight: 1.4 }}>
                    {activeSpreads[activeTab].summary}
                  </p>
                </div>
              </div>

              {/* Hot Breaking News & Live Telemetry Dispatches Widget */}
              <div 
                style={{ 
                  margin: '0.85rem 0',
                  padding: '0.75rem 0.85rem', 
                  background: '#FFFDF0', 
                  border: '2px solid #1F1F1F',
                  boxShadow: '3px 3px 0px #1F1F1F',
                  borderRadius: '4px',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ 
                    background: '#FFC83B', 
                    color: '#1F1F1F',
                    border: '1.5px solid #000', 
                    padding: '2px 7px', 
                    fontSize: '0.65rem', 
                    fontFamily: 'var(--font-mono, monospace)', 
                    fontWeight: 900,
                    letterSpacing: '0.05em',
                    boxShadow: '1.5px 1.5px 0 #000',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Zap size={11} color="#000" /> 🔥 HOT BREAKING NEWS
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: '0.6rem', fontWeight: 900, color: '#E03131', background: '#FFE3E3', padding: '1px 5px', border: '1px solid #E03131', borderRadius: '2px' }}>
                    LIVE DISPATCH
                  </span>
                </div>

                <div 
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectAction && onSelectAction(activeSpreads[activeTab])}
                >
                  <h4 style={{ fontFamily: 'var(--font-heading, sans-serif)', fontSize: '0.86rem', fontWeight: 900, color: '#1F1F1F', lineHeight: 1.3, margin: '0 0 0.35rem 0' }}>
                    {activeTab === 0 && "⚡ Google Quantum AI Willow Achieves 1,000-Qubit Error Suppression"}
                    {activeTab === 1 && "🚀 IBM Unveils Condor 2 Architecture with Modular Quantum Couplers"}
                    {activeTab === 2 && "🏆 Unitary Fund Announces 2026 Open Source Quantum Fellowships"}
                  </h4>
                  <p style={{ fontSize: '0.72rem', color: '#4B5563', lineHeight: 1.35, margin: 0, fontWeight: 600 }}>
                    {activeTab === 0 && "Physical qubit scaling demonstrates exponential error reduction across 2D surface codes."}
                    {activeTab === 1 && "High-speed optical quantum interconnects double multi-chip fidelity on Q-System Two."}
                    {activeTab === 2 && "Equity-free grants & cloud hardware access for open-source quantum algorithm developers."}
                  </p>
                </div>

                <div style={{ marginTop: '0.55rem', paddingTop: '0.45rem', borderTop: '1px dashed #1F1F1F', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800 }}>
                  <span style={{ color: '#16A34A', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                    Fidelity: 99.82%
                  </span>
                  <button
                    onClick={() => onSelectAction && onSelectAction(activeSpreads[activeTab])}
                    style={{
                      background: '#C1F8FF',
                      color: '#1F1F1F',
                      border: '1.5px solid #000',
                      padding: '2px 7px',
                      fontSize: '0.62rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 900,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      boxShadow: '1px 1px 0 #000'
                    }}
                  >
                    READ SIGNAL <ArrowUpRight size={10} />
                  </button>
                </div>
              </div>

              {/* Left Page Footer Stats */}
              <div style={{ borderTop: '1.5px solid #1F1F1F', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                <span>MODULES: {activeSpreads[activeTab].stats?.modules || 12}</span>
                <span>EST: {activeSpreads[activeTab].stats?.hours || '24h'}</span>
                <span>COHORT: {activeSpreads[activeTab].stats?.students || 140}</span>
              </div>

              <div className="invente-book-spine-line" />
              <div className="invente-page-edge-left" />
            </div>

            {/* ── RIGHT PAGE: Deep curriculum/signal specifications & direct action ── */}
            <div className="invente-book-page-right">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span 
                    className="invente-page-tag"
                    style={{ background: '#1F1F1F', color: '#FFF' }}
                  >
                    {activeSpreads[activeTab].tag}
                  </span>
                  <span className="invente-page-num">{BOOK_3D_STRINGS.FOLIO_PREFIX} {activeTab * 2 + 2} / 06</span>
                </div>

                <h2 className="invente-course-title">
                  {activeSpreads[activeTab].title}
                </h2>

                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 800, color: '#777', marginBottom: '0.5rem' }}>
                  {BOOK_3D_STRINGS.KEY_SPECS}
                </div>

                <ul className="invente-highlight-list">
                  {activeSpreads[activeTab].highlights.map((item, idx) => (
                    <li key={idx} className="invente-highlight-item">
                      <CheckCircle2 size={15} color="#1F1F1F" style={{ flexShrink: 0, marginTop: '1px' }} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right Page Action Button */}
              <div style={{ borderTop: '1.5px solid #1F1F1F', paddingTop: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: '#666', display: 'block' }}>
                    {BOOK_3D_STRINGS.CURRICULUM_ACTION}
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                    ACTIVE SPREAD {activeTab + 1} OF 3
                  </span>
                </div>

                <button
                  onClick={() => onSelectAction && onSelectAction(activeSpreads[activeTab])}
                  className="btn-neo btn-neo-sm"
                  style={{
                    background: activeSpreads[activeTab].tabColor,
                    color: '#1F1F1F',
                    fontWeight: 900
                  }}
                >
                  <Play size={13} />
                  <span>{activeSpreads[activeTab].actionLabel || "SELECT SPREAD →"}</span>
                </button>
              </div>

              <div className="invente-page-edge-right" />
            </div>

            {/* ── 3 INVENTE RIGHT-EDGE PROTRUDING TABS ── */}
            <div className="invente-tabs-stack-right">
              {activeSpreads.map((sp, idx) => (
                <div
                  key={idx}
                  onClick={() => handleTabClick(idx)}
                  className={`invente-bookmark-tab ${activeTab === idx ? 'active-tab' : ''}`}
                  style={{
                    background: sp.tabColor,
                  }}
                  title={sp.tabLabel}
                >
                  {sp.tabShort || `TAB 0${idx + 1}`}
                </div>
              ))}
            </div>

          </div>
        </div>

        {/* Bottom Interactive Scrubber with exact scroll indicator */}
        <div className="invente-scroll-scrubber">
          <span>{BOOK_3D_STRINGS.SCROLL_PROGRESS_LABEL} {Math.round(scrollProgress * 100)}%</span>
          
          <div 
            className="invente-scrub-bar"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = clickX / rect.width;
              if (ratio < 0.33) handleTabClick(0);
              else if (ratio < 0.66) handleTabClick(1);
              else handleTabClick(2);
            }}
          >
            <div 
              className="invente-scrub-fill"
              style={{ width: `${Math.max(10, ((activeTab + 1) / 3) * 100)}%` }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => handleTabClick(Math.max(0, activeTab - 1))}
              disabled={activeTab === 0}
              className="btn-neo btn-neo-white btn-neo-sm"
              style={{ padding: '0.2rem 0.5rem', opacity: activeTab === 0 ? 0.4 : 1 }}
              aria-label="Previous Folio"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => handleTabClick(Math.min(2, activeTab + 1))}
              disabled={activeTab === 2}
              className="btn-neo btn-neo-white btn-neo-sm"
              style={{ padding: '0.2rem 0.5rem', opacity: activeTab === 2 ? 0.4 : 1 }}
              aria-label="Next Folio"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
