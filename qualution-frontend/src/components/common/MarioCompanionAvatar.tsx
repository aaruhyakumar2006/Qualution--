import React, { useState, useEffect } from 'react';
import type { ErwinState } from './ErwinAvatar';
import './MarioCompanionAvatar.css';

export interface MarioCompanionAvatarProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  state?: ErwinState;
  className?: string;
  style?: React.CSSProperties;
  'data-testid'?: string;
}

function normalizeState(state: ErwinState): 'idle' | 'correct' | 'incorrect' | 'thinking' {
  if (state === 'success') return 'correct';
  if (state === 'warning') return 'incorrect';
  return state;
}

export const MarioCompanionAvatar: React.FC<MarioCompanionAvatarProps> = ({
  size = 64,
  state = 'idle',
  className = '',
  style,
  'data-testid': testId = 'global-erwin-avatar',
  ...props
}) => {
  const numSize = typeof size === 'number' ? size : parseInt(String(size), 10) || 64;
  const canonical = normalizeState(state);

  // Active running & hopping animation state (so Mario is actively moving, never static idle)
  const [animFrame, setAnimFrame] = useState<number>(0);

  useEffect(() => {
    // In unit testing environment, keep frame stable
    const isTest = typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test';
    if (isTest) return;

    // Active 8-bit cadence: rapid running footsteps + periodic mini hops
    const timer = setInterval(() => {
      setAnimFrame((prev) => (prev + 1) % 8);
    }, 125);
    return () => clearInterval(timer);
  }, []);

  const getActiveSprite = () => {
    if (canonical === 'correct') {
      return (animFrame % 4 < 2) ? '/mario/Mario_Small_Jump.png' : '/mario/Mario_Small_Run1.png';
    }
    if (canonical === 'thinking') {
      return (animFrame % 4 < 2) ? '/mario/Mario_Small_Run2.png' : '/mario/Mario_Small_Run3.png';
    }
    if (canonical === 'incorrect') {
      return '/mario/Mario_Small_Slide.png';
    }

    // Active running cycle with intermittent jump
    switch (animFrame) {
      case 0: return '/mario/Mario_Small_Run1.png';
      case 1: return '/mario/Mario_Small_Run2.png';
      case 2: return '/mario/Mario_Small_Run3.png';
      case 3: return '/mario/Mario_Small_Run2.png';
      case 4: return '/mario/Mario_Small_Run1.png';
      case 5: return '/mario/Mario_Small_Run2.png';
      case 6: return '/mario/Mario_Small_Jump.png'; // Energetic mini hop
      case 7: return '/mario/Mario_Small_Jump.png';
      default: return '/mario/Mario_Small_Run1.png';
    }
  };

  const isJumping = (canonical === 'idle' && (animFrame === 6 || animFrame === 7)) || canonical === 'correct';
  const showDust = !isJumping && (animFrame === 1 || animFrame === 3 || animFrame === 5);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={numSize}
      height={numSize}
      role="img"
      aria-label={`Mario Active Companion (${state})`}
      className={`erwin-avatar erwin--${canonical} mario-companion-avatar mario-companion-avatar--${state} ${isJumping ? 'mario-hopping' : 'mario-running'} ${className}`.trim()}
      data-testid={testId}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        overflow: 'visible',
        imageRendering: 'pixelated',
        ...style,
      }}
      {...props}
    >
      {/* Soft ground contact shadow under Mario's shoes */}
      <ellipse
        cx="50"
        cy="92"
        rx={isJumping ? 14 : 22}
        ry={isJumping ? 3 : 5}
        fill="rgba(0, 0, 0, 0.38)"
      />

      {/* Running dust puffs kicked up by Mario's boots */}
      {showDust && (
        <g className="mario-dust-cloud">
          <circle cx="24" cy="88" r="3.5" fill="#ffffff" opacity="0.75" />
          <circle cx="17" cy="85" r="2.2" fill="#ffffff" opacity="0.5" />
          <circle cx="12" cy="87" r="1.5" fill="#ffffff" opacity="0.3" />
        </g>
      )}

      {/* Pure full-body pixel Mario character (NO coin / disc wrapper) */}
      <image
        href={getActiveSprite()}
        x="12"
        y={isJumping ? 4 : 14}
        width="76"
        height="76"
        preserveAspectRatio="xMidYMid meet"
        className="mario-active-character-sprite"
      />

      {/* State Indicators: Star for success or Question for thinking */}
      {canonical === 'correct' && (
        <image href="/mario/Starman.png" x="68" y="4" width="28" height="28" />
      )}
      {canonical === 'thinking' && (
        <g>
          <circle cx="78" cy="18" r="11" fill="#000000" stroke="#ffd700" strokeWidth="2" />
          <text x="78" y="23" textAnchor="middle" fill="#ffd700" fontSize="13" fontFamily="monospace" fontWeight="bold">?</text>
        </g>
      )}
    </svg>
  );
};

export default MarioCompanionAvatar;
