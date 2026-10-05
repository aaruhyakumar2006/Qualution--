import React, { useEffect, useState } from 'react';

/**
 * CourseBookShelf — exact Invente hero-stack book effect
 *
 * DOM mirrors ssnsnucinvente.com:
 *   .cbs-stage  = perspective container  (scroll-stage / hero-shell)
 *   .cbs-stack  = horizontal grid        (.hero-stack)
 *   .cbs-slot   = individual card slot   (.hero-tape / .hero-book-slot)
 *   .cbs-card   = visible book cover face (.hero-book__art img)
 *   .cbs-baseline = bottom rule          (.hero-baseline)
 *
 * Animation: transform-origin bottom center.
 * Mount  → scaleY(0.08) rotateX(55deg) → scaleY(1) rotateX(0), staggered.
 * Hover  → translateY(-9%) scale(1.04), static tilt preserved.
 */

const COURSES = [
  { code: 'QC-101', title: 'Quantum\nFoundations',   color: '#FFC83B', accent: '#1F1F1F', rotate: '-3deg',   tag: 'BEGINNER',     icon: '⚛'  },
  { code: 'QC-201', title: 'Quantum\nCircuits',       color: '#B0EF9E', accent: '#1F1F1F', rotate: '1.5deg',  tag: 'INTERMEDIATE', icon: '⊕'  },
  { code: 'QC-301', title: 'VQE &\nOptimisation',    color: '#C1F8FF', accent: '#1F1F1F', rotate: '-1deg',   tag: 'ADVANCED',     icon: '≋'  },
  { code: 'QC-401', title: 'Quantum\nError Corr.',   color: '#FE90E9', accent: '#1F1F1F', rotate: '2.5deg',  tag: 'ADVANCED',     icon: '⟂'  },
  { code: 'QC-501', title: 'Tensor\nNetworks',       color: '#fffdf6', accent: '#1F1F1F', rotate: '-2deg',   tag: 'RESEARCH',     icon: '⊗'  },
  { code: 'QC-601', title: 'Quantum\nCryptography',  color: '#1F1F1F', accent: '#FFC83B', rotate: '1deg',    tag: 'GRADUATE',     icon: '🔐' },
  { code: 'QC-701', title: 'NISQ\nAlgorithms',       color: '#FFDA58', accent: '#1F1F1F', rotate: '-1.5deg', tag: 'RESEARCH',     icon: '⟩'  },
];

export default function CourseBookShelf({ onSelectCourse }) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <style>{`
        .cbs-stage {
          width: 100%;
          perspective: 1100px;
          perspective-origin: 50% 115%;
          overflow: visible;
          padding-bottom: 4px;
          box-sizing: border-box;
          margin-bottom: 0.5rem;
        }

        .cbs-stack {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 5px;
          height: clamp(190px, 24vw, 320px);
          align-items: end;
          padding: 0 2px;
        }

        /* Individual slot — transform-origin: bottom center like .hero-tape */
        .cbs-slot {
          position: relative;
          transform-origin: bottom center;
          will-change: transform, filter;
          cursor: pointer;
          transition:
            transform 0.62s cubic-bezier(0.34, 1.56, 0.64, 1),
            filter 0.28s ease;
        }

        .cbs-card {
          width: 100%;
          height: 100%;
          border: 2.5px solid #1F1F1F;
          border-radius: 4px 4px 2px 2px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 11px 7px 9px;
          box-sizing: border-box;
          overflow: hidden;
          position: relative;
          box-shadow: 3px 3px 0 0 #1F1F1F;
          transition: box-shadow 0.18s;
          user-select: none;
        }

        .cbs-slot:hover .cbs-card {
          box-shadow: 5px 5px 0 0 #1F1F1F;
        }

        /* Grid overlay */
        .cbs-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0,0,0,0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.055) 1px, transparent 1px);
          background-size: 13px 13px;
          pointer-events: none;
          z-index: 0;
        }

        .cbs-tag {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.42rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          padding: 2px 4px;
          border: 1.5px solid currentColor;
          text-transform: uppercase;
          z-index: 1;
          white-space: nowrap;
          line-height: 1.4;
        }

        .cbs-icon {
          font-size: clamp(1.4rem, 2.4vw, 2rem);
          z-index: 1;
          line-height: 1;
        }

        .cbs-divider {
          width: 100%;
          height: 3px;
          border-radius: 1px;
          z-index: 1;
          flex-shrink: 0;
        }

        .cbs-title {
          font-family: 'Space Grotesk', 'Outfit', sans-serif;
          font-size: clamp(0.52rem, 1vw, 0.72rem);
          font-weight: 900;
          letter-spacing: -0.01em;
          text-align: center;
          line-height: 1.2;
          z-index: 1;
          white-space: pre-line;
        }

        .cbs-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.4rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          opacity: 0.5;
          z-index: 1;
        }

        /* Bottom baseline like .hero-baseline */
        .cbs-baseline {
          width: 100%;
          height: 5px;
          background: #1F1F1F;
          border-radius: 2px;
          margin-top: 3px;
        }

        /* SELECT hint like .hero-book-reveal */
        .cbs-reveal {
          position: absolute;
          bottom: -28px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #1F1F1F;
          opacity: 0;
          transition: opacity 0.16s, bottom 0.16s;
          pointer-events: none;
          z-index: 30;
          text-transform: uppercase;
        }

        .cbs-slot:hover .cbs-reveal {
          opacity: 1;
          bottom: -22px;
        }

        @media (max-width: 640px) {
          .cbs-stack {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .cbs-stack .cbs-slot:nth-child(n+5) { display: none; }
        }
      `}</style>

      <div className="cbs-stage">
        <div className="cbs-stack">
          {COURSES.map((c, i) => {
            const isHov = hovered === i;
            const baseRotate = `rotate(${c.rotate})`;
            const risen  = isHov
              ? `scaleY(1) rotateX(0deg) translateY(-9%) scale(1.04) ${baseRotate}`
              : `scaleY(1) rotateX(0deg) ${baseRotate}`;
            const collapsed = `scaleY(0.08) rotateX(55deg) ${baseRotate}`;

            return (
              <div
                key={c.code}
                className="cbs-slot"
                style={{
                  transform: mounted ? risen : collapsed,
                  filter: mounted ? 'brightness(1)' : 'brightness(0.45)',
                  transitionDelay: mounted ? `${i * 52}ms` : '0ms',
                  transitionDuration: isHov ? '0.2s' : '0.62s',
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectCourse?.(c)}
                role="button"
                aria-label={`Open ${c.title.replace('\n', ' ')}`}
              >
                <div className="cbs-card" style={{ background: c.color, color: c.accent }}>
                  <span className="cbs-tag" style={{ color: c.accent, borderColor: `${c.accent}90` }}>
                    {c.tag}
                  </span>
                  <div className="cbs-icon">{c.icon}</div>
                  <div className="cbs-divider" style={{ background: c.accent, opacity: 0.7 }} />
                  <div className="cbs-title">{c.title}</div>
                  <div className="cbs-code">{c.code}</div>
                </div>
                <div className="cbs-reveal">SELECT →</div>
              </div>
            );
          })}
        </div>
        <div className="cbs-baseline" />
      </div>
    </>
  );
}

