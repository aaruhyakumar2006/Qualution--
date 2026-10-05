import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuantumCoAnnotationRoomModal from './QuantumCoAnnotationRoomModal';
import * as portalApi from '../api/portalApi';
import { COLLAB_ROOM_STRINGS } from '../constants/portalConstants';

const mockSignalItem = {
  id: 'paper-surface-code-123',
  title: 'Fault-Tolerant Surface Codes on Heavy-Hex Architectures',
  summary: 'Syndrome extraction below fault-tolerant physical threshold.',
  tags: ['QEC', 'Surface Code']
};

const mockRoomResponse: portalApi.JoinRoomResponse = {
  room_id: 'room-paper-surface-code-123',
  item_id: 'paper-surface-code-123',
  paper_title: 'Interactive Quantum Review Room',
  active_participants: [
    {
      user_id: 'usr-teacher-prof-ram',
      user_name: 'Prof. Ram',
      role: 'educator',
      avatar_color: '#10B981',
      joined_at: '2026-10-04T10:00:00Z'
    },
    {
      user_id: 'usr-researcher-alice',
      user_name: 'Dr. Alice Chen',
      role: 'qpu_engineer',
      avatar_color: '#6366F1',
      joined_at: '2026-10-04T10:05:00Z'
    }
  ],
  annotations: [
    {
      id: 'ann-seed-1',
      item_id: 'paper-surface-code-123',
      user_id: 'usr-teacher-prof-ram',
      user_name: 'Prof. Ram',
      user_role: 'educator',
      selected_text: 'Syndrome extraction circuits operate with < 0.12% 2-qubit gate error rates',
      paragraph_ref: 'Section 3.2 Physical Threshold Bounds',
      comment: 'Critical experimental breakthrough: heavy-hex is below physical threshold.',
      tag: 'breakthrough',
      color: '#10B981',
      created_at: '2026-10-04T10:00:00Z',
      likes_count: 14
    }
  ],
  recent_messages: [
    {
      id: 'msg-seed-1',
      item_id: 'paper-surface-code-123',
      user_id: 'usr-teacher-prof-ram',
      user_name: 'Prof. Ram',
      user_role: 'educator',
      message: 'Welcome everyone to the collaborative review room!',
      timestamp: '2026-10-04T10:00:00Z'
    }
  ]
};

describe('QuantumCoAnnotationRoomModal Component (Phase 12)', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(portalApi, 'joinCollaborationRoom').mockResolvedValue(mockRoomResponse);
  });

  it('does not render when isOpen is false', () => {
    render(
      <QuantumCoAnnotationRoomModal
        isOpen={false}
        onClose={mockOnClose}
        item={mockSignalItem}
      />
    );
    expect(screen.queryByTestId('collab-room-modal')).toBeNull();
  });

  it('joins collaborative room and renders active participants, annotations, and paper title', async () => {
    render(
      <QuantumCoAnnotationRoomModal
        isOpen={true}
        onClose={mockOnClose}
        item={mockSignalItem}
      />
    );

    expect(screen.getByTestId('collab-room-modal')).toBeInTheDocument();
    expect(screen.getByText(COLLAB_ROOM_STRINGS.MODAL_TITLE)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText('Prof. Ram').length).toBeGreaterThan(0);
      expect(screen.getByText('Dr. Alice Chen')).toBeInTheDocument();
      expect(screen.getByText('Section 3.2 Physical Threshold Bounds')).toBeInTheDocument();
      expect(screen.getByText('Critical experimental breakthrough: heavy-hex is below physical threshold.')).toBeInTheDocument();
    });
  });

  it('toggles new annotation form and submits co-annotation', async () => {
    const createSpy = vi.spyOn(portalApi, 'createRoomAnnotation').mockResolvedValue({
      id: 'ann-new-99',
      item_id: 'paper-surface-code-123',
      user_id: 'usr-teacher-prof-ram',
      user_name: 'Prof. Ram',
      user_role: 'educator',
      selected_text: 'DRAG parameter beta = 0.34 cancels state leakage',
      paragraph_ref: 'Section 4 Pulse Calibration',
      comment: 'Excellent derivation of non-computational transmon dynamics.',
      tag: 'hardware',
      color: '#6366F1',
      created_at: '2026-10-04T10:10:00Z',
      likes_count: 0
    });

    render(
      <QuantumCoAnnotationRoomModal
        isOpen={true}
        onClose={mockOnClose}
        item={mockSignalItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('toggle-add-annotation-btn')).toBeInTheDocument();
    });

    // Toggle add annotation form
    fireEvent.click(screen.getByTestId('toggle-add-annotation-btn'));
    expect(screen.getByTestId('add-annotation-form')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('input-selected-text'), {
      target: { value: 'DRAG parameter beta = 0.34 cancels state leakage' }
    });
    fireEvent.change(screen.getByTestId('input-annotation-comment'), {
      target: { value: 'Excellent derivation of non-computational transmon dynamics.' }
    });

    fireEvent.click(screen.getByTestId('submit-annotation-btn'));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        'paper-surface-code-123',
        expect.objectContaining({
          selected_text: 'DRAG parameter beta = 0.34 cancels state leakage',
          comment: 'Excellent derivation of non-computational transmon dynamics.'
        }),
        expect.any(String)
      );
    });
  });

  it('switches to Live Chat stream and submits chat message', async () => {
    const postChatSpy = vi.spyOn(portalApi, 'postRoomChatMessage').mockResolvedValue({
      id: 'msg-new-101',
      item_id: 'paper-surface-code-123',
      user_id: 'usr-teacher-prof-ram',
      user_name: 'Prof. Ram',
      user_role: 'educator',
      message: 'Let us check the Hamiltonian simulation in QUALUTION Workbench.',
      timestamp: '2026-10-04T10:12:00Z'
    });

    render(
      <QuantumCoAnnotationRoomModal
        isOpen={true}
        onClose={mockOnClose}
        item={mockSignalItem}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('tab-chat')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('tab-chat'));
    expect(screen.getByText('Welcome everyone to the collaborative review room!')).toBeInTheDocument();

    const chatInput = screen.getByTestId('input-chat-message');
    fireEvent.change(chatInput, {
      target: { value: 'Let us check the Hamiltonian simulation in QUALUTION Workbench.' }
    });

    fireEvent.click(screen.getByTestId('send-chat-btn'));

    await waitFor(() => {
      expect(postChatSpy).toHaveBeenCalledWith(
        'paper-surface-code-123',
        'Let us check the Hamiltonian simulation in QUALUTION Workbench.',
        expect.any(String)
      );
    });
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <QuantumCoAnnotationRoomModal
        isOpen={true}
        onClose={mockOnClose}
        item={mockSignalItem}
      />
    );

    fireEvent.click(screen.getByTestId('close-collab-room-modal'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
