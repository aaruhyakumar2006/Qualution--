import React from 'react';
import type { FeedPost } from '../api/posts';
import { formatRelativeTime, extractDomain } from '../utils/formatTime';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import {
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  FileText,
  Calendar,
  Sparkles,
  BookOpen,
  Newspaper,
  MessageSquare,
  Edit2,
  Trash2,
} from 'lucide-react';
import { CommentSection } from './CommentSection';

export interface PostDetailViewProps {
  post: FeedPost;
  currentUserId?: string | null;
  currentUserAppRole?: string | null;
  onBack: () => void;
  onSelectTag?: (tag: string) => void;
  onSelectAuthor?: (handle: string) => void;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (postId: string) => void;
  onRequireAuth?: () => void;
}

const SECTION_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  courses: {
    label: 'Course',
    icon: <BookOpen size={14} />,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.1)',
    border: 'rgba(56, 189, 248, 0.25)',
  },
  news: {
    label: 'News',
    icon: <Newspaper size={14} />,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.25)',
  },
  research: {
    label: 'Research Publication',
    icon: <FileText size={14} />,
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.1)',
    border: 'rgba(167, 139, 250, 0.25)',
  },
  events: {
    label: 'Community Event',
    icon: <Calendar size={14} />,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.25)',
  },
  qualution: {
    label: 'Qualution Official',
    icon: <Sparkles size={14} />,
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.1)',
    border: 'rgba(236, 72, 153, 0.25)',
  },
};

export const PostDetailView: React.FC<PostDetailViewProps> = ({
  post,
  currentUserId,
  currentUserAppRole,
  onBack,
  onSelectTag,
  onSelectAuthor,
  onEditPost,
  onDeletePost,
  onRequireAuth,
}) => {
  const sectionConfig = SECTION_CONFIG[post.section] || SECTION_CONFIG.news;
  const domain = extractDomain(post.link_url);
  const isAuthor = currentUserId && currentUserId === post.author_id;
  const isModerator = currentUserAppRole === 'moderator' || currentUserAppRole === 'admin';
  const canModify = isAuthor || isModerator;

  const researchMeta = post.section === 'research' && post.meta ? (post.meta as any) : null;

  return (
    <div
      data-testid="post-detail-view"
      style={{
        width: '100%',
        maxWidth: '820px',
        margin: '0 auto',
        padding: '1.5rem 1rem 3rem 1rem',
      }}
    >
      {/* Navigation Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f0f6fc',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
        >
          <ArrowLeft size={16} /> Back to Feed
        </button>

        {canModify && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onEditPost && (
              <button
                type="button"
                onClick={() => onEditPost(post)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Edit2 size={14} /> Edit
              </button>
            )}
            {onDeletePost && (
              <button
                type="button"
                onClick={() => onDeletePost(post.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Post Article Card */}
      <article
        style={{
          background: 'rgba(22, 27, 34, 0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(48, 54, 61, 0.8)',
          borderRadius: '16px',
          padding: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          marginBottom: '2rem',
        }}
      >
        {/* Section Badge & Timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.3rem 0.75rem',
              borderRadius: '9999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: sectionConfig.bg,
              color: sectionConfig.color,
              border: `1px solid ${sectionConfig.border}`,
            }}
          >
            {sectionConfig.icon}
            {sectionConfig.label}
          </span>
          <span style={{ fontSize: '0.825rem', color: '#8b949e' }}>
            Posted {formatRelativeTime(post.created_at)}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            lineHeight: 1.3,
            color: '#f0f6fc',
            margin: '0 0 1.5rem 0',
            letterSpacing: '-0.02em',
          }}
        >
          {post.title}
        </h1>

        {/* Author Bio Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'rgba(13, 17, 23, 0.6)',
            border: '1px solid rgba(48, 54, 61, 0.6)',
            borderRadius: '10px',
            marginBottom: '1.75rem',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '1.1rem',
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            {post.author_avatar_url ? (
              <img
                src={post.author_avatar_url}
                alt={post.author_display_name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              post.author_display_name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                type="button"
                onClick={() => onSelectAuthor?.(post.author_handle)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#f0f6fc',
                  fontWeight: 600,
                  fontSize: '1rem',
                  cursor: 'pointer',
                }}
              >
                {post.author_display_name}
              </button>
              {post.author_is_verified && (
                <CheckCircle size={15} fill="#38bdf8" color="#0d1117" />
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#8b949e' }}>
              @{post.author_handle} • {post.author_role.charAt(0).toUpperCase() + post.author_role.slice(1)}
            </div>
          </div>
        </div>

        {/* Research Publication Box */}
        {researchMeta && researchMeta.paper_url && (
          <div
            style={{
              background: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.25)',
              borderRadius: '10px',
              padding: '1.25rem',
              marginBottom: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#c4b5fd', fontWeight: 700 }}>
                <FileText size={18} />
                <span>Primary Preprint / Paper</span>
              </div>
              <a
                href={researchMeta.paper_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
                  color: '#ffffff',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.825rem',
                  textDecoration: 'none',
                }}
              >
                Read Paper <ExternalLink size={14} />
              </a>
            </div>
            {researchMeta.abstract && (
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Abstract
                </span>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#e2e8f0', lineHeight: 1.6 }}>
                  {researchMeta.abstract}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Full Post Body */}
        <div style={{ color: '#e6edf3', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          <SafeMarkdownRenderer content={post.body} />
        </div>

        {/* Attached Link Button */}
        {post.link_url && (
          <div style={{ marginBottom: '1.5rem' }}>
            <a
              href={post.link_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span>Visit Link: {domain || post.link_url}</span>
              <ExternalLink size={16} />
            </a>
          </div>
        )}

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(48, 54, 61, 0.6)' }}>
            {post.tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSelectTag?.(t)}
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '6px',
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </article>

      {/* Discussion & Peer Review Comments */}
      <CommentSection
        postId={post.id}
        currentUserId={currentUserId}
        currentUserAppRole={currentUserAppRole}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
};
