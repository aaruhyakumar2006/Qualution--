import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InteractiveCircuitEmbed from './InteractiveCircuitEmbed';
import { CIRCUIT_EMBED_STRINGS } from '../constants/portalConstants';

describe('InteractiveCircuitEmbed Component', () => {
  const bellQasm = `OPENQASM 2.0;
include "qelib1.inc";
qreg q[2];
h q[0];
cx q[0], q[1];`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders null when neither qasm nor circuitData is provided', () => {
    const { container } = render(<InteractiveCircuitEmbed />);
    expect(container.firstChild).toBeNull();
  });

  it('parses OpenQASM and renders qubits, gates, and circuit badge', async () => {
    render(<InteractiveCircuitEmbed qasm={bellQasm} />);

    expect(screen.getByText(CIRCUIT_EMBED_STRINGS.BADGE)).toBeDefined();
    // 2 qubits
    expect(screen.getByText('q[0]')).toBeDefined();
    expect(screen.getByText('q[1]')).toBeDefined();
    // Gates H and CX
    expect(screen.getByText('H')).toBeDefined();
    expect(screen.getByText('CX')).toBeDefined();
  });

  it('toggles between visual wire view and code view', () => {
    render(<InteractiveCircuitEmbed qasm={bellQasm} />);

    // Default is visual view
    expect(screen.getByText('q[0]')).toBeDefined();

    // Click code tab
    const codeTabBtn = screen.getByText(CIRCUIT_EMBED_STRINGS.VIEW_CODE);
    fireEvent.click(codeTabBtn);

    expect(screen.getByText((content) => content.includes('OPENQASM 2.0'))).toBeDefined();

    // Switch back to visual tab
    const visualTabBtn = screen.getByText(CIRCUIT_EMBED_STRINGS.VIEW_CIRCUIT);
    fireEvent.click(visualTabBtn);
    expect(screen.getByText('q[0]')).toBeDefined();
  });

  it('calls onLaunchWorkbench when Simulate / Launch button is clicked', () => {
    const handleLaunch = vi.fn();
    render(
      <InteractiveCircuitEmbed
        qasm={bellQasm}
        onLaunchWorkbench={handleLaunch}
        lessonId="lesson-bell-state"
      />
    );

    const launchBtn = screen.getByText(CIRCUIT_EMBED_STRINGS.SIMULATE_BTN);
    fireEvent.click(launchBtn);

    expect(handleLaunch).toHaveBeenCalledTimes(1);
    const [passedCircuit, passedLessonId] = handleLaunch.mock.calls[0];
    expect(passedCircuit.qubits).toBe(2);
    expect(passedLessonId).toBe('lesson-bell-state');
  });

  it('handles copy code to clipboard', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<InteractiveCircuitEmbed qasm={bellQasm} />);

    const copyBtn = screen.getByTitle(CIRCUIT_EMBED_STRINGS.COPY_CODE);
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(bellQasm);
  });
});
