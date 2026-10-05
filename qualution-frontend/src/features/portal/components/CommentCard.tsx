import React, { useState } from 'react';
import type { PostComment } from '../api/comments';
import { formatRelativeTime } from '../utils/formatTime';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import { COMMENT_STRINGS } from '../../../pages/teacher-portal/constants/portalConstants';
import { Trash2, Flag, CheckCircle, Shield, GraduationCap, Award, Check } from 'lucide-react';

export interface CommentCardProps {
  comment: PostComment;
  currentUserId?: string | null;
  currentUserAppRole?: string | null;
  onDelete: (commentId: string) => Promise<void>;
  onReport: (commentId: string, reason: string) => Promise<void>;
}

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  currentUserId,
  currentUserAppRole,
  onDelete,
  onReport,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReportInput, setShowReportInput] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  const isAuthor = Boolean(currentUserId && currentUserId === comment.author_id);
  const isModerator = currentUserAppRole === 'moderator' || currentUserAppRole === 'admin';
  const canDelete = isAuthor || isModerator;

  const handleDelete = async () => {
    if (window.confirm(COMMENT_STRINGS.DELETE_COMMENT_CONFIRM)) {
      try {
        setIsDeleting(true);
        await onDelete(comment.id);
      } catch (err) {
        console.error('Failed to delete comment:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    try {
      setIsReporting(true);
      await onReport(comment.id, reportReason.trim());
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportInput(false);
        setReportSuccess(false);
        setReportReason('');
      }, 2000);
    } catch (err) {
      console.error('Failed to report comment:', err);
    } finally {
      setIsReporting(false);
    }
  };

  const role = comment.author?.app_role || 'student';

  return (
    <article
      data-testid="comment-card"
      style={{
        background: 'rgba(13, 17, 23, 0.75)',
        border: '1px solid rgba(48, 54, 61, 0.8)',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '0.85rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Author & Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Avatar / Initial circle */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1f6feb 0%, #38bdf8 100%)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
            }}
          >
            {comment.author?.display_name ? comment.author.display_name.charAt(0) : 'Q'}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{ color: '#f0f6fc', fontWeight: 600, fontSize: '0.88rem' }}>
                {comment.author?.display_name || 'Scholar'}
              </span>
              <span style={{ color: '#8b949e', fontSize: '0.8rem' }}>
                @{comment.author?.handle || 'user'}
              </span>
              {comment.author?.is_verified && (
                <CheckCircle size={13} style={{ color: '#38bdf8' }} title="Verified Quantum Contributor" />
              )}
              {/* Role badge */}
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  background:
                    role === 'admin' || role === 'moderator'
                      ? 'rgba(236, 72, 153, 0.15)'
                      : role === 'teacher' || role === 'researcher'
                        ? 'rgba(167, 139, 250, 0.15)'
                        : 'rgba(56, 189, 248, 0.15)',
                  color:
                    role === 'admin' || role === 'moderator'
                      ? '#ec4899'
                      : role === 'teacher' || role === 'researcher'
                        ? '#a78bfa'
                        : '#38bdf8',
                  border: `1px solid ${
                    role === 'admin' || role === 'moderator'
                      ? 'rgba(236, 72, 153, 0.3)'
                      : role === 'teacher' || role === 'researcher'
                        ? 'rgba(167, 139, 250, 0.3)'
                        : 'rgba(56, 189, 248, 0.3)'
                  }`,
                }}
              >
                {role}
              </span>
            </div>
            <div style={{ color: '#8b949e', fontSize: '0.75rem', marginTop: '1px' }}>
              {formatRelativeTime(comment.created_at)}
            </div>
          </div>
        </div>

        {/* Actions (Delete / Report) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              aria-label={COMMENT_STRINGS.DELETE_COMMENT_TOOLTIP}
              title={COMMENT_STRINGS.DELETE_COMMENT_TOOLTIP}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f85149',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                opacity: isDeleting ? 0.5 : 0.8,
              }}
            >
              <Trash2 size={14} />
            </button>
          )}

          {!isAuthor && currentUserId && (
            <button
              type="button"
              onClick={() => setShowReportInput((prev) => !prev)}
              aria-label={COMMENT_STRINGS.REPORT_COMMENT_TOOLTIP}
              title={COMMENT_STRINGS.REPORT_COMMENT_TOOLTIP}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <Flag size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Comment Body Markdown */}
      <div style={{ color: '#e6edf3', fontSize: '0.92rem', lineHeight: 1.6 }}>
        <SafeMarkdownRenderer content={comment.body} />
      </div>

      {/* Inline Report Drawer */}
      {showReportInput && (
        <form
          onSubmit={handleReportSubmit}
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: 'rgba(22, 27, 34, 0.9)',
            border: '1px solid rgba(248, 81, 73, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {reportSuccess ? (
            <div style={{ color: '#3fb950', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Check size={14} />
              <span>{COMMENT_STRINGS.COMMENT_REPORTED_SUCCESS}</span>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Reason for report (e.g. offensive, spam, incorrect info)..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                style={{
                  width: '100%',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '4px',
                  color: '#c9d1d9',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setShowReportInput(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    borderRadius: '4px',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting || !reportReason.trim()}
                  style={{
                    background: '#f85149',
                    border: 'none',
                    color: '#FFF',
                    fontWeight: 600,
                    borderRadius: '4px',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    opacity: isReporting || !reportReason.trim() ? 0.6 : 1,
                  }}
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </article>
  );
};
