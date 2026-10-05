import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { App } from '../../App';

// Mock circuit API readiness to avoid unhandled rejections during test
vi.mock('../../api/circuitApi', async () => {
  const actual = await vi.importActual<any>('../../api/circuitApi');
  return {
    ...actual,
    checkReadiness: vi.fn().mockResolvedValue({ status: 'ok', backends: ['qiskit_aer'] }),
  };
});

describe('Portal Route Integration', () => {
  it('renders the Portal page when navigating to /portal', async () => {
    await act(async () => {
      render(<App initialRoute="/portal" />);
    });

    const portalPage = screen.getByTestId('portal-page');
    expect(portalPage).toBeInTheDocument();

    const portalTitle = screen.getByTestId('portal-title');
    expect(portalTitle).toBeInTheDocument();
    expect(portalTitle).toHaveTextContent('Portal');
  });

  it('renders the Portal page when navigating to #portal', async () => {
    await act(async () => {
      render(<App initialRoute="#portal" />);
    });

    expect(screen.getByTestId('portal-page')).toBeInTheDocument();
    expect(screen.getByTestId('portal-title')).toHaveTextContent('Portal');
  });
});
