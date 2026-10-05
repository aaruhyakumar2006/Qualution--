import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentSection } from './components/CommentSection';
import { CommentCard } from './components/CommentCard';
import * as commentsApi from './api/comments';
import { COMMENT_STRINGS } from '../../pages/teacher-portal/constants/portalConstants';

const MOCK_COMMENTS: commentsApi.PostComment[] = [
  {
    id: 'c-101',
    post_id: 'post-1',
    author_id: 'usr-researcher-1',
    body: 'Great preprint! Have you benchmarked the syndrome extraction fidelity on superconducting hardware vs neutral atoms?',
    status: 'published',
    created_at: '2026-10-01T10:00:00Z',
    updated_at: '2026-10-01T10:00:00Z',
    author: {
      id: 'usr-researcher-1',
      handle: 'dr_feynman',
      display_name: 'Dr. Richard Feynman',
      app_role: 'researcher',
      is_verified: true,
    },
  },
  {
    id: 'c-102',
    post_id: 'post-1',
    author_id: 'usr-student-2',
    body: 'For the Grover diffusion step, can we substitute an `H-X-CZ-X-H` sequence directly?',
    status: 'published',
    created_at: '2026-10-01T11:00:00Z',
    updated_at: '2026-10-01T11:00:00Z',
    author: {
      id: 'usr-student-2',
      handle: 'alice_q',
      display_name: 'Alice Student',
      app_role: 'student',
      is_verified: false,
    },
  },
];

describe('Phase 5: Interactive Discussion Threads & Peer Review Comments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Fetches and renders comments list with author roles and verified badges', async () => {
    vi.spyOn(commentsApi, 'fetchPostComments').mockResolvedValue(MOCK_COMMENTS);

    render(
      <CommentSection
        postId="post-1"
        currentUserId="usr-student-2"
        currentUserAppRole="student"
      />
    );

    // Header with comment count
    expect(await screen.findByText(COMMENT_STRINGS.COMMENTS_HEADING)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Verify first comment
    expect(screen.getByText('Dr. Richard Feynman')).toBeInTheDocument();
    expect(screen.getByText('@dr_feynman')).toBeInTheDocument();
    expect(screen.getByText('researcher')).toBeInTheDocument();
    expect(screen.getByText(/syndrome extraction fidelity/i)).toBeInTheDocument();

    // Verify second comment
    expect(screen.getByText('Alice Student')).toBeInTheDocument();
    expect(screen.getByText('@alice_q')).toBeInTheDocument();
    expect(screen.getByText('student')).toBeInTheDocument();
  });

  it('2. Submits a new comment and appends it to the discussion thread', async () => {
    vi.spyOn(commentsApi, 'fetchPostComments').mockResolvedValue(MOCK_COMMENTS);
    const newCommentMock: commentsApi.PostComment = {
      id: 'c-103',
      post_id: 'post-1',
      author_id: 'usr-student-2',
      body: 'Verified via Aer MPS simulator: 99.8% fidelity achieved!',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: 'usr-student-2',
        handle: 'alice_q',
        display_name: 'Alice Student',
        app_role: 'student',
        is_verified: false,
      },
    };
    vi.spyOn(commentsApi, 'createPostComment').mockResolvedValue(newCommentMock);

    render(
      <CommentSection
        postId="post-1"
        currentUserId="usr-student-2"
        currentUserAppRole="student"
      />
    );

    expect(await screen.findByText('Dr. Richard Feynman')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(COMMENT_STRINGS.WRITE_COMMENT_PLACEHOLDER);
    fireEvent.change(textarea, { target: { value: 'Verified via Aer MPS simulator: 99.8% fidelity achieved!' } });

    const submitBtn = screen.getByRole('button', { name: new RegExp(COMMENT_STRINGS.POST_COMMENT_BTN, 'i') });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(commentsApi.createPostComment).toHaveBeenCalledWith({
        postId: 'post-1',
        body: 'Verified via Aer MPS simulator: 99.8% fidelity achieved!',
        authorId: 'usr-student-2',
      });
      expect(screen.getByText('Verified via Aer MPS simulator: 99.8% fidelity achieved!')).toBeInTheDocument();
    });
  });

  it('3. Rejects empty or whitespace-only submissions with validation warning', async () => {
    vi.spyOn(commentsApi, 'fetchPostComments').mockResolvedValue([]);
    const createSpy = vi.spyOn(commentsApi, 'createPostComment');

    render(
      <CommentSection
        postId="post-1"
        currentUserId="usr-student-2"
        currentUserAppRole="student"
      />
    );

    expect(await screen.findByText(COMMENT_STRINGS.NO_COMMENTS_YET)).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(COMMENT_STRINGS.WRITE_COMMENT_PLACEHOLDER);
    fireEvent.change(textarea, { target: { value: '    ' } });

    const submitBtn = screen.getByRole('button', { name: new RegExp(COMMENT_STRINGS.POST_COMMENT_BTN, 'i') });
    fireEvent.click(submitBtn);

    expect(createSpy).not.toHaveBeenCalled();
  });

  it('4. Allows author to delete own comment and calls deletePostComment', async () => {
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);
    const onReportMock = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <CommentCard
        comment={MOCK_COMMENTS[1]} // author is usr-student-2
        currentUserId="usr-student-2"
        currentUserAppRole="student"
        onDelete={onDeleteMock}
        onReport={onReportMock}
      />
    );

    const deleteBtn = screen.getByLabelText(COMMENT_STRINGS.DELETE_COMMENT_TOOLTIP);
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(onDeleteMock).toHaveBeenCalledWith('c-102');
    });
  });

  it('5. Non-authors cannot delete comments, but can submit a moderation report', async () => {
    const onDeleteMock = vi.fn().mockResolvedValue(undefined);
    const onReportMock = vi.fn().mockResolvedValue(undefined);

    render(
      <CommentCard
        comment={MOCK_COMMENTS[0]} // author is usr-researcher-1
        currentUserId="usr-student-2" // reviewer is usr-student-2
        currentUserAppRole="student"
        onDelete={onDeleteMock}
        onReport={onReportMock}
      />
    );

    // Delete button should NOT be present for non-author
    expect(screen.queryByLabelText(COMMENT_STRINGS.DELETE_COMMENT_TOOLTIP)).not.toBeInTheDocument();

    // Report button should be present
    const reportBtn = screen.getByLabelText(COMMENT_STRINGS.REPORT_COMMENT_TOOLTIP);
    expect(reportBtn).toBeInTheDocument();

    fireEvent.click(reportBtn);

    const reasonInput = screen.getByPlaceholderText(/Reason for report/i);
    fireEvent.change(reasonInput, { target: { value: 'Misleading experimental claims.' } });

    const submitReportBtn = screen.getByRole('button', { name: /Submit Report/i });
    fireEvent.click(submitReportBtn);

    await waitFor(() => {
      expect(onReportMock).toHaveBeenCalledWith('c-101', 'Misleading experimental claims.');
      expect(screen.getByText(COMMENT_STRINGS.COMMENT_REPORTED_SUCCESS)).toBeInTheDocument();
    });
  });

  it('6. Displays sign-in prompt when unauthenticated user views comments', async () => {
    vi.spyOn(commentsApi, 'fetchPostComments').mockResolvedValue(MOCK_COMMENTS);
    const onRequireAuth = vi.fn();

    render(
      <CommentSection
        postId="post-1"
        currentUserId={null}
        currentUserAppRole={null}
        onRequireAuth={onRequireAuth}
      />
    );

    expect(await screen.findByText(COMMENT_STRINGS.SIGN_IN_TO_COMMENT)).toBeInTheDocument();

    const signInBtn = screen.getByRole('button', { name: /Sign In to Participate/i });
    fireEvent.click(signInBtn);

    expect(onRequireAuth).toHaveBeenCalledTimes(1);
  });
});
