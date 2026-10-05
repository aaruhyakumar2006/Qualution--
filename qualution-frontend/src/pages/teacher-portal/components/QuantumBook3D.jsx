import React, { useEffect, useRef } from 'react';

/**
 * QuantumBook3D
 * Pure-CSS 3D book matching the Invente hero book effect.
 * Features: floating idle animation, mouse parallax tilt,
 * layered geometry (cover / spine / pages), quantum-atom orbits on cover.
 */
export default function QuantumBook3D({ onClick }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const handleMove = (e) => {
      const rect = wrap.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width;
      const dy = (e.clientY - cy) / rect.height;
      wrap.style.setProperty('--mx', `${dx * 12}deg`);
      wrap.style.setProperty('--my', `${-dy * 10}deg`);
    };

    const handleLeave = () => {
      wrap.style.setProperty('--mx', '0deg');
      wrap.style.setProperty('--my', '0deg');
    };

    const scene = wrap.closest('.book-scene');
    scene?.addEventListener('mousemove', handleMove);
    scene?.addEventListener('mouseleave', handleLeave);
    return () => {
      scene?.removeEventListener('mousemove', handleMove);
      scene?.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <>
      <style>{`
        .book-scene {
          perspective: 900px;
          perspective-origin: 50% 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2rem 4rem;
          cursor: pointer;
          user-select: none;
        }

        @keyframes book-float {
          0%   { transform: translateY(0px)   rotateY(-28deg) rotateX(4deg); }
          50%  { transform: translateY(-18px) rotateY(-22deg) rotateX(2deg); }
          100% { transform: translateY(0px)   rotateY(-28deg) rotateX(4deg); }
        }

        .book-wrap {
          --mx: 0deg;
          --my: 0deg;
          position: relative;
          width: 210px;
          height: 280px;
          transform-style: preserve-3d;
          animation: book-float 4s ease-in-out infinite;
          filter: drop-shadow(8px 16px 32px rgba(0,0,0,0.32));
        }

        .book-scene:hover .book-wrap {
          animation-play-state: paused;
          transform:
            rotateY(calc(-28deg + var(--mx)))
            rotateX(calc(4deg + var(--my)))
            translateY(-10px);
          transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          filter: drop-shadow(12px 24px 40px rgba(0,0,0,0.44));
        }

        /* ── FRONT COVER ── */
        .book-front {
          position: absolute;
          inset: 0;
          background: #FFC83B;
          border: 3px solid #1F1F1F;
          border-radius: 2px 6px 6px 2px;
          transform: translateZ(18px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 18px 14px 16px;
          box-sizing: border-box;
        }

        .book-front::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(31,31,31,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31,31,31,0.07) 1px, transparent 1px);
          background-size: 16px 16px;
          pointer-events: none;
          z-index: 0;
        }

        .book-cover-badge {
          background: #1F1F1F;
          color: #FFC83B;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.48rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 3px 7px;
          border: 1.5px solid #FFC83B;
          text-transform: uppercase;
          z-index: 1;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .book-qubit-atom {
          width: 76px;
          height: 76px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          z-index: 1;
        }

        .book-qubit-nucleus {
          width: 14px;
          height: 14px;
          background: #1F1F1F;
          border-radius: 50%;
          border: 2.5px solid #FFC83B;
          z-index: 2;
          box-shadow: 0 0 8px rgba(255,200,59,0.6);
        }

        @keyframes orbit1 { from { transform: rotateZ(0deg)   rotateX(70deg); } to { transform: rotateZ(360deg)  rotateX(70deg); } }
        @keyframes orbit2 { from { transform: rotateZ(60deg)  rotateX(70deg); } to { transform: rotateZ(420deg)  rotateX(70deg); } }
        @keyframes orbit3 { from { transform: rotateZ(120deg) rotateX(70deg); } to { transform: rotateZ(480deg)  rotateX(70deg); } }

        .book-orbit {
          position: absolute;
          width: 70px;
          height: 70px;
          border-radius: 50%;
          border: 1.5px solid rgba(31,31,31,0.5);
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        .book-orbit-1 { animation: orbit1 3.2s linear infinite; }
        .book-orbit-2 { animation: orbit2 2.6s linear infinite; }
        .book-orbit-3 { animation: orbit3 4.0s linear infinite; }

        .book-cover-stripe {
          width: 100%;
          height: 5px;
          background: #1F1F1F;
          border-radius: 1px;
          flex-shrink: 0;
          z-index: 1;
        }

        .book-cover-title {
          font-family: 'Space Grotesk', 'Outfit', sans-serif;
          font-size: 1.05rem;
          font-weight: 900;
          letter-spacing: -0.02em;
          color: #1F1F1F;
          text-align: center;
          line-height: 1.15;
          z-index: 1;
        }

        .book-cover-subtitle {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.47rem;
          font-weight: 600;
          color: rgba(31,31,31,0.6);
          text-align: center;
          letter-spacing: 0.06em;
          z-index: 1;
        }

        /* ── SPINE ── */
        .book-spine {
          position: absolute;
          top: 0;
          left: 0;
          width: 36px;
          height: 100%;
          background: #d4940a;
          border: 3px solid #1F1F1F;
          border-right: none;
          border-radius: 2px 0 0 2px;
          transform: rotateY(-90deg) translateX(-18px) translateZ(0);
          transform-origin: left center;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .book-spine-text {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 0.52rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: #1F1F1F;
          writing-mode: vertical-lr;
          text-orientation: mixed;
          transform: rotate(180deg);
        }

        /* ── BACK COVER ── */
        .book-back {
          position: absolute;
          inset: 0;
          background: #1F1F1F;
          border: 3px solid #1F1F1F;
          border-radius: 2px 6px 6px 2px;
          transform: translateZ(-18px);
        }

        /* ── PAGE STACK edge ── */
        .book-pages {
          position: absolute;
          top: 4px;
          right: -10px;
          width: 10px;
          height: calc(100% - 8px);
          background: repeating-linear-gradient(
            to bottom,
            #f8f3e6 0px,
            #f8f3e6 2px,
            #ddd5bb 2px,
            #ddd5bb 3px
          );
          border: 1px solid #c2b49e;
          border-left: none;
          border-radius: 0 2px 2px 0;
          transform: rotateY(90deg) translateZ(-192px);
          transform-origin: left center;
        }

        /* ── GROUND SHADOW ── */
        .book-ground-shadow {
          position: absolute;
          bottom: -36px;
          left: 50%;
          transform: translateX(-50%);
          width: 160px;
          height: 36px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.22) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── OPEN LABEL ── */
        .book-open-label {
          position: absolute;
          bottom: -58px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: var(--ink-secondary, #666);
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.22s;
          pointer-events: none;
        }

        .book-open-label::before,
        .book-open-label::after {
          content: '';
          display: block;
          width: 16px;
          height: 1.5px;
          background: currentColor;
          opacity: 0.45;
        }

        .book-scene:hover .book-open-label {
          opacity: 1;
        }
      `}</style>

      <div className="book-scene" onClick={onClick} role="button" aria-label="Open Courses">
        <div className="book-wrap" ref={wrapRef}>

          {/* Back cover */}
          <div className="book-back" />

          {/* Page edges */}
          <div className="book-pages" />

          {/* Spine */}
          <div className="book-spine">
            <span className="book-spine-text">QUALUTION</span>
          </div>

          {/* Front cover */}
          <div className="book-front">
            <div className="book-cover-badge">QUALUTION · EDUCATOR EDITION</div>

            <div className="book-qubit-atom">
              <div className="book-orbit book-orbit-1" />
              <div className="book-orbit book-orbit-2" />
              <div className="book-orbit book-orbit-3" />
              <div className="book-qubit-nucleus" />
            </div>

            <div className="book-cover-stripe" />

            <div className="book-cover-title">
              QUANTUM<br />LEARNING<br />PORTAL
            </div>

            <div className="book-cover-subtitle">
              TEACHER &amp; RESEARCHER EDITION
            </div>
          </div>

          {/* Ground shadow */}
          <div className="book-ground-shadow" />

          {/* Hover label */}
          <div className="book-open-label">OPEN COURSES</div>
        </div>
      </div>
    </>
  );
}
