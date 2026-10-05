import React, { useState, useEffect } from 'react';
import { PortalHeader } from '../components/PortalHeader';
import { PortalFeedView } from '../components/PortalFeedView';
import { PostDetailView } from '../components/PostDetailView';
import { fetchPostById, type FeedPost } from '../api/posts';

export interface PortalPageProps {
  onNavigateHome?: () => void;
  onOpenLogin?: () => void;
}

export const PortalPage: React.FC<PortalPageProps> = ({ onNavigateHome, onOpenLogin }) => {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const match = path.match(/\/portal\/post\/([a-zA-Z0-9_-]+)/) || hash.match(/portal-post=([a-zA-Z0-9_-]+)/);
      return match ? match[1] : null;
    }
    return null;
  });

  const [activePost, setActivePost] = useState<FeedPost | null>(null);
  const [isLoadingPost, setIsLoadingPost] = useState<boolean>(false);

  // Load active post if selectedPostId changes
  useEffect(() => {
    if (!selectedPostId) {
      setActivePost(null);
      return;
    }

    let isMounted = true;
    setIsLoadingPost(true);
    fetchPostById(selectedPostId)
      .then((post) => {
        if (isMounted) setActivePost(post);
      })
      .catch((err) => {
        console.error('Failed to load post:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPost(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPostId]);

  const handleSelectPost = (postId: string) => {
    setSelectedPostId(postId);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/portal/post/${postId}`);
    }
  };

  const handleBackToFeed = () => {
    setSelectedPostId(null);
    setActivePost(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/portal');
    }
  };

  return (
    <div
      data-testid="portal-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: '#0d1117',
        color: '#f0f6fc',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <PortalHeader onNavigateHome={onNavigateHome} />

      {/* Visually-hidden / Accessible Header element for test and a11y compatibility */}
      <h1
        data-testid="portal-title"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Portal
      </h1>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedPostId ? (
          isLoadingPost ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#8b949e' }}>
              Loading publication details...
            </div>
          ) : activePost ? (
            <PostDetailView
              post={activePost}
              onBack={handleBackToFeed}
              onDeletePost={() => handleBackToFeed()}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#f87171' }}>
              Post not found or has been removed by moderation.
              <div style={{ marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleBackToFeed}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    color: '#f0f6fc',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                  }}
                >
                  Return to Feed
                </button>
              </div>
            </div>
          )
        ) : (
          <PortalFeedView
            onSelectPost={handleSelectPost}
            onOpenLogin={onOpenLogin}
          />
        )}
      </main>
    </div>
  );
};
