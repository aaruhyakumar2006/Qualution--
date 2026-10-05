import React from 'react';
import type { FeedPost } from '../api/posts';
import { formatRelativeTime, extractDomain } from '../utils/formatTime';
import { SafeMarkdownRenderer } from './SafeMarkdownRenderer';
import {
  ExternalLink,
  CheckCircle,
  FileText,
  Calendar,
  Sparkles,
  BookOpen,
  Newspaper,
  MoreVertical,
  Trash2,
  Edit2,
} from 'lucide-react';

export interface PostCardProps {
  post: FeedPost;
  currentUserId?: string | null;
  currentUserAppRole?: string | null;
  onSelectPost: (postId: string) => void;
  onSelectTag?: (tag: string) => void;
  onSelectAuthor?: (handle: string) => void;
  onEditPost?: (post: FeedPost) => void;
  onDeletePost?: (postId: string) => void;
}

const SECTION_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bg: string; border: string }
> = {
  courses: {
    label: 'Course',
    icon: <BookOpen size={13} />,
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.1)',
    border: 'rgba(56, 189, 248, 0.25)',
  },
  news: {
    label: 'News',
    icon: <Newspaper size={13} />,
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: 'rgba(251, 191, 36, 0.25)',
  },
  research: {
    label: 'Research',
    icon: <FileText size={13} />,
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.1)',
    border: 'rgba(167, 139, 250, 0.25)',
  },
  events: {
    label: 'Event',
    icon: <Calendar size={13} />,
    color: '#34d399',
    bg: 'rgba(52, 211, 153, 0.1)',
    border: 'rgba(52, 211, 153, 0.25)',
  },
  qualution: {
    label: 'Qualution',
    icon: <Sparkles size={13} />,
    color: '#ec4899',
    bg: 'rgba(236, 72, 153, 0.1)',
    border: 'rgba(236, 72, 153, 0.25)',
  },
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  currentUserAppRole,
  onSelectPost,
  onSelectTag,
  onSelectAuthor,
  onEditPost,
  onDeletePost,
}) => {
  const sectionConfig = SECTION_CONFIG[post.section] || SECTION_CONFIG.news;
  const domain = extractDomain(post.link_url);
  const isAuthor = currentUserId && currentUserId === post.author_id;
  const isModerator = currentUserAppRole === 'moderator' || currentUserAppRole === 'admin';
  const canModify = isAuthor || isModerator;

  // Make body preview short and clean
  const bodyPreview =
    post.body.length > 280 ? post.body.slice(0, 280) + '...' : post.body;

  return (
    <article
      data-testid={`post-card-${post.id}`}
      style={{
        background: 'rgba(22, 27, 34, 0.75)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(48, 54, 61, 0.8)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1rem',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
      className="portal-post-card"
    >
      {/* Header: Author Info + Section Badge + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {/* Avatar / Initial */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              fontWeight: 700,
              fontSize: '0.875rem',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => onSelectAuthor?.(post.author_handle)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#f0f6fc',
                  fontWeight: 600,
                  fontSize: '0.925rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {post.author_display_name}
              </button>
              {post.author_is_verified && (
                <span title="Verified Researcher/Teacher" style={{ display: 'flex', color: '#38bdf8' }}>
                  <CheckCircle size={14} fill="#38bdf8" color="#0d1117" />
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#8b949e' }}>
              <span
                onClick={() => onSelectAuthor?.(post.author_handle)}
                style={{ cursor: 'pointer', color: '#94a3b8' }}
              >
                @{post.author_handle}
              </span>
              <span>•</span>
              <time dateTime={post.created_at}>{formatRelativeTime(post.created_at)}</time>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Section Badge */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: sectionConfig.bg,
              color: sectionConfig.color,
              border: `1px solid ${sectionConfig.border}`,
            }}
          >
            {sectionConfig.icon}
            {sectionConfig.label}
          </span>

          {/* Edit / Delete actions for Author / Moderator */}
          {canModify && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {onEditPost && (
                <button
                  type="button"
                  onClick={() => onEditPost(post)}
                  title="Edit post"
                  aria-label="Edit post"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '0.3rem',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Edit2 size={13} />
                </button>
              )}
              {onDeletePost && (
                <button
                  type="button"
                  onClick={() => onDeletePost(post.id)}
                  title="Delete post"
                  aria-label="Delete post"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '6px',
                    padding: '0.3rem',
                    color: '#f87171',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Post Title */}
      <h2
        style={{
          margin: '0.25rem 0 0 0',
          fontSize: '1.2rem',
          fontWeight: 700,
          lineHeight: 1.35,
          color: '#f0f6fc',
          cursor: 'pointer',
        }}
        onClick={() => onSelectPost(post.id)}
      >
        {post.title}
      </h2>

      {/* Research Paper Preview Callout */}
      {post.section === 'research' && post.meta && (post.meta as any).paper_url && (
        <div
          style={{
            background: 'rgba(167, 139, 250, 0.08)',
            borderLeft: '3px solid #a78bfa',
            borderRadius: '4px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.8rem',
            color: '#c4b5fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', overflow: 'hidden' }}>
            <FileText size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>Publication:</span>
            <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {(post.meta as any).paper_url}
            </span>
          </div>
          <a
            href={(post.meta as any).paper_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              color: '#a78bfa',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontWeight: 600,
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            PDF <ExternalLink size={12} />
          </a>
        </div>
      )}

      {/* Body Preview */}
      <div
        style={{
          color: '#c9d1d9',
          fontSize: '0.9rem',
          lineHeight: 1.55,
          cursor: 'pointer',
        }}
        onClick={() => onSelectPost(post.id)}
      >
        <SafeMarkdownRenderer content={bodyPreview} />
      </div>

      {/* Footer: Tags & External Domain Link */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginTop: '0.25rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(48, 54, 61, 0.5)',
        }}
      >
        {/* Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {post.tags &&
            post.tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectTag?.(t);
                }}
                style={{
                  background: 'rgba(56, 189, 248, 0.08)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '4px',
                  padding: '0.15rem 0.45rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'background 0.15s ease',
                }}
              >
                #{t}
              </button>
            ))}
        </div>

        {/* External Link Domain */}
        {domain && post.link_url && (
          <a
            href={post.link_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: '#8b949e',
              fontSize: '0.775rem',
              textDecoration: 'none',
              padding: '0.2rem 0.45rem',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <span>{domain}</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  );
};
