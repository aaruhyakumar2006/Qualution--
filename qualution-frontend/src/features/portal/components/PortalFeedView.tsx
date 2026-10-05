import React, { useState, useEffect, useCallback } from 'react';
import type { PostSection } from '../types';
import { fetchPostsFeed, deletePost, type FeedPost } from '../api/posts';
import { PostCard } from './PostCard';
import { CreatePostModal } from './CreatePostModal';
import { EditPostModal } from './EditPostModal';
import { supabase } from '../../../lib/supabase';
import {
  Sparkles,
  Plus,
  RefreshCw,
  X,
  BookOpen,
  Newspaper,
  FileText,
  Calendar,
  AlertCircle,
  Inbox,
} from 'lucide-react';

export interface PortalFeedViewProps {
  onSelectPost: (postId: string) => void;
  onSelectAuthor?: (handle: string) => void;
  onOpenLogin?: () => void;
}

const TABS: { id: PostSection | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Feeds', icon: <Sparkles size={14} /> },
  { id: 'courses', label: 'Courses', icon: <BookOpen size={14} /> },
  { id: 'news', label: 'News', icon: <Newspaper size={14} /> },
  { id: 'research', label: 'Research', icon: <FileText size={14} /> },
  { id: 'events', label: 'Events', icon: <Calendar size={14} /> },
  { id: 'qualution', label: 'Qualution', icon: <Sparkles size={14} /> },
];

export const PortalFeedView: React.FC<PortalFeedViewProps> = ({
  onSelectPost,
  onSelectAuthor,
  onOpenLogin,
}) => {
  const [selectedSection, setSelectedSection] = useState<PostSection | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // Current session state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAppRole, setCurrentUserAppRole] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);

  // Check auth on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUserId(data.user.id);
        supabase
          .from('profiles')
          .select('app_role')
          .eq('id', data.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (profile) setCurrentUserAppRole(profile.app_role);
          });
      } else {
        setCurrentUserId(null);
        setCurrentUserAppRole(null);
      }
    });
  }, []);

  // Fetch initial posts feed
  const loadInitialFeed = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await fetchPostsFeed({
        section: selectedSection === 'all' ? null : selectedSection,
        tag: selectedTag,
        limit: 10,
      });
      setPosts(result.posts);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load feed. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSection, selectedTag]);

  useEffect(() => {
    loadInitialFeed();
  }, [loadInitialFeed]);

  // Load more via keyset cursor
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const result = await fetchPostsFeed({
        section: selectedSection === 'all' ? null : selectedSection,
        tag: selectedTag,
        cursorCreatedAt: nextCursor.createdAt,
        cursorId: nextCursor.id,
        limit: 10,
      });
      setPosts((prev) => [...prev, ...result.posts]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load additional posts.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete post.');
    }
  };

  const handlePostCreated = (newPost: FeedPost) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const handlePostUpdated = (updatedPost: FeedPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  };

  const handleOpenCreate = () => {
    if (!currentUserId) {
      if (onOpenLogin) {
        onOpenLogin();
      } else {
        alert('Please sign in or create an account to publish community posts.');
      }
      return;
    }
    setIsCreateOpen(true);
  };

  return (
    <div
      data-testid="portal-feed-view"
      style={{
        width: '100%',
        maxWidth: '920px',
        margin: '0 auto',
        padding: '1.5rem 1rem 3rem 1rem',
      }}
    >
      {/* Top Banner: Feed Action Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              margin: '0 0 0.25rem 0',
              fontSize: '1.75rem',
              fontWeight: 800,
              color: '#f0f6fc',
              letterSpacing: '-0.02em',
            }}
          >
            Community Hub
          </h1>
          <p style={{ margin: 0, color: '#8b949e', fontSize: '0.875rem' }}>
            Quantum preprints, tutorial discussions, announcements, and circuit highlights.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          data-testid="create-post-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
            color: '#ffffff',
            border: 'none',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(56, 189, 248, 0.3)',
            transition: 'transform 0.15s ease',
          }}
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      {/* Section Navigation Tabs */}
      <div
        role="tablist"
        aria-label="Community Sections"
        style={{
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
          paddingBottom: '0.5rem',
          marginBottom: '1.25rem',
          borderBottom: '1px solid rgba(48, 54, 61, 0.6)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = selectedSection === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => {
                setSelectedSection(tab.id);
                setSelectedTag(null);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                color: isActive ? '#38bdf8' : '#8b949e',
                border: isActive ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tag Filter Indicator */}
      {selectedTag && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            padding: '0.3rem 0.75rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
          }}
        >
          <span>Filtering by #{selectedTag}</span>
          <button
            type="button"
            onClick={() => setSelectedTag(null)}
            aria-label="Clear tag filter"
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Error Banner with Retry */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '1rem',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={loadInitialFeed}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#f0f6fc',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div data-testid="feed-skeleton-loader" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                background: 'rgba(22, 27, 34, 0.6)',
                border: '1px solid rgba(48, 54, 61, 0.5)',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                animation: 'pulse 1.5s infinite',
              }}
            >
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)' }} />
                <div style={{ width: '120px', height: '14px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.05)' }} />
              </div>
              <div style={{ width: '60%', height: '20px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)' }} />
              <div style={{ width: '90%', height: '40px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.04)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && posts.length === 0 && !errorMessage && (
        <div
          data-testid="feed-empty-state"
          style={{
            background: 'rgba(22, 27, 34, 0.5)',
            border: '1px dashed rgba(48, 54, 61, 0.8)',
            borderRadius: '12px',
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
          }}
        >
          <Inbox size={40} style={{ color: '#8b949e', marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#f0f6fc', fontSize: '1.2rem', fontWeight: 600 }}>
            No posts found in this section
          </h3>
          <p style={{ margin: '0 0 1.5rem 0', color: '#8b949e', fontSize: '0.9rem', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
            {selectedTag
              ? `There are no posts tagged with #${selectedTag} yet.`
              : 'Be the first pioneer to publish research, questions, or updates in this section.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
              border: 'none',
              color: '#ffffff',
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Create Post
          </button>
        </div>
      )}

      {/* Posts List */}
      {!isLoading && posts.length > 0 && (
        <div data-testid="feed-posts-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              currentUserAppRole={currentUserAppRole}
              onSelectPost={onSelectPost}
              onSelectTag={(t) => setSelectedTag(t)}
              onSelectAuthor={onSelectAuthor}
              onEditPost={(p) => setEditingPost(p)}
              onDeletePost={handleDeletePost}
            />
          ))}

          {/* Load More Button (Keyset pagination) */}
          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                data-testid="load-more-btn"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f0f6fc',
                  padding: '0.75rem 2rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: isLoadingMore ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'background 0.15s ease',
                }}
              >
                {isLoadingMore ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Loading more posts...
                  </>
                ) : (
                  'Load More Posts'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <CreatePostModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handlePostCreated}
      />

      {/* Edit Modal */}
      <EditPostModal
        post={editingPost}
        isOpen={!!editingPost}
        onClose={() => setEditingPost(null)}
        onSuccess={handlePostUpdated}
      />
    </div>
  );
};
