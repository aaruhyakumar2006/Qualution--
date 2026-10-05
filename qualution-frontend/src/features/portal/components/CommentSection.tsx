import React, { useState, useEffect } from 'react';
import type { PostComment } from '../api/comments';
import {
  fetchPostComments,
  createPostComment,
  deletePostComment,
  reportPostComment,
} from '../api/comments';
import { CommentCard } from './CommentCard';
import { COMMENT_STRINGS } from '../../../pages/teacher-portal/constants/portalConstants';
import { MessageSquare, Send, AlertCircle, Sparkles } from 'lucide-react';

export interface CommentSectionProps {
  postId: string;
  currentUserId?: string | null;
  currentUserAppRole?: string | null;
  onRequireAuth?: () => void;
}

const MAX_COMMENT_LENGTH = 5000;

export const CommentSection: React.FC<CommentSectionProps> = ({
  postId,
  currentUserId,
  currentUserAppRole,
  onRequireAuth,
}) => {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPostComments(postId);
      setComments(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      onRequireAuth?.();
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setValidationError('Please enter a comment before submitting.');
      return;
    }
    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setValidationError(`Comment exceeds ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setValidationError(null);
    try {
      setSubmitting(true);
      const newComment = await createPostComment({
        postId,
        body: trimmed,
        authorId: currentUserId,
      });
      setComments((prev) => [...prev, newComment]);
      setCommentText('');
    } catch (err: any) {
      setValidationError(err.message || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    await deletePostComment(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  const handleReport = async (commentId: string, reason: string) => {
    if (!currentUserId) return;
    await reportPostComment(commentId, currentUserId, reason);
  };

  const charsLeft = MAX_COMMENT_LENGTH - commentText.length;

  return (
    <section
      data-testid="comment-section"
      style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: 'rgba(22, 27, 34, 0.65)',
        border: '1px solid rgba(48, 54, 61, 0.8)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <MessageSquare size={18} style={{ color: '#38bdf8' }} />
          <h3 style={{ margin: 0, color: '#f0f6fc', fontSize: '1.1rem', fontWeight: 700 }}>
            {COMMENT_STRINGS.COMMENTS_HEADING}
          </h3>
          <span
            style={{
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 800,
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              padding: '2px 8px',
              borderRadius: '10px',
            }}
          >
            {comments.length}
          </span>
        </div>
      </div>

      {/* Comment Form Composer */}
      {currentUserId ? (
        <form
          onSubmit={handleSubmit}
          style={{
            background: '#0d1117',
            border: '1.5px solid rgba(48, 54, 61, 0.9)',
            borderRadius: '8px',
            padding: '0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
          }}
        >
          <textarea
            value={commentText}
            onChange={(e) => {
              setCommentText(e.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder={COMMENT_STRINGS.WRITE_COMMENT_PLACEHOLDER}
            rows={3}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#e6edf3',
              fontSize: '0.9rem',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />

          {validationError && (
            <div style={{ color: '#f85149', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <AlertCircle size={14} />
              <span>{validationError}</span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(48, 54, 61, 0.5)', paddingTop: '0.65rem' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, monospace)',
                color: charsLeft < 100 ? '#f85149' : '#8b949e',
              }}
            >
              {charsLeft} {COMMENT_STRINGS.CHARACTERS_REMAINING}
            </span>

            <button
              type="submit"
              disabled={submitting || !commentText.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: '#38bdf8',
                color: '#0d1117',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '0.4rem 0.9rem',
                borderRadius: '6px',
                cursor: 'pointer',
                opacity: submitting || !commentText.trim() ? 0.6 : 1,
              }}
            >
              <Send size={13} />
              <span>{submitting ? COMMENT_STRINGS.POSTING_COMMENT_BTN : COMMENT_STRINGS.POST_COMMENT_BTN}</span>
            </button>
          </div>
        </form>
      ) : (
        <div
          style={{
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '8px',
            padding: '1rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <p style={{ margin: 0, color: '#c9d1d9', fontSize: '0.88rem' }}>
            {COMMENT_STRINGS.SIGN_IN_TO_COMMENT}
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            style={{
              background: '#38bdf8',
              color: '#0d1117',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.8rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Sign In to Participate
          </button>
        </div>
      )}

      {/* Comments List */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ color: '#8b949e', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
            Loading discussion comments...
          </div>
        ) : error ? (
          <div style={{ color: '#f85149', fontSize: '0.85rem', textAlign: 'center', padding: '1rem 0' }}>
            {error}
          </div>
        ) : comments.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: '#8b949e',
              fontSize: '0.88rem',
            }}
          >
            <Sparkles size={24} style={{ color: '#38bdf8', opacity: 0.5, marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600, color: '#c9d1d9' }}>{COMMENT_STRINGS.NO_COMMENTS_YET}</div>
            <div style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>{COMMENT_STRINGS.BE_THE_FIRST}</div>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              currentUserId={currentUserId}
              currentUserAppRole={currentUserAppRole}
              onDelete={handleDelete}
              onReport={handleReport}
            />
          ))
        )}
      </div>
    </section>
  );
};
