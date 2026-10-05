import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MarioHero } from './MarioHero';

describe('MarioHero Component — Super Mario Quantum', () => {
  const onLaunchIDE = vi.fn();
  const onScrollToCurriculum = vi.fn();
  const onAddXP = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderHero = () => {
    return render(
      <MarioHero
        currentXP={100}
        completedLessonsCount={3}
        totalModulesCount={12}
        onLaunchIDE={onLaunchIDE}
        onScrollToCurriculum={onScrollToCurriculum}
        onAddXP={onAddXP}
        playerName="TESTER"
      />
    );
  };

  it('renders hero title, arcade HUD, and ground elements', () => {
    renderHero();

    expect(screen.getByTestId('mario-hero-section')).toBeInTheDocument();
    expect(screen.getByText('TESTER')).toBeInTheDocument();
    expect(screen.getByText('WORLD Q-1 · QUANTUM GROVE', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Start World 1-1')).toBeInTheDocument();
    expect(screen.getByTestId('mario-warp-ide-btn')).toBeInTheDocument();
    expect(screen.getByText('Decoherence Enemy')).toBeInTheDocument();
    expect(screen.getByText('WARP TO LAB')).toBeInTheDocument();
  });

  it('triggers onLaunchIDE when clicking Warp to Quantum Lab in test mode', () => {
    renderHero();

    const warpBtn = screen.getByTestId('mario-warp-ide-btn');
    fireEvent.click(warpBtn);

    expect(onLaunchIDE).toHaveBeenCalledTimes(1);
  });

  it('scrolls to curriculum when clicking Start World 1-1', () => {
    renderHero();

    const startBtn = screen.getByText('Start World 1-1');
    fireEvent.click(startBtn);

    expect(onScrollToCurriculum).toHaveBeenCalledTimes(1);
  });

  it('interacts with quantum mystery blocks and awards XP', () => {
    renderHero();

    const hadamardBlock = screen.getByTitle(/Click to hit Hadamard Block/i);
    expect(hadamardBlock).toBeInTheDocument();

    fireEvent.click(hadamardBlock);
    expect(onAddXP).toHaveBeenCalledWith(100);
  });

  it('squashes Goomba and awards 50 XP when clicked', () => {
    renderHero();

    const goomba = screen.getByTitle('Click to squash Decoherence Noise!');
    fireEvent.click(goomba);

    expect(onAddXP).toHaveBeenCalledWith(50);
    expect(screen.getByText(/Decoherence Squashed!/i)).toBeInTheDocument();
  });
});
