import React, { useState } from 'react';
import type { FeedPost } from '../api/posts';
import { updatePost } from '../api/posts';
import { postFormSchema, normalizeTags, isValidTag } from '../validation/postSchema';
import { X, Edit2, AlertCircle, Plus } from 'lucide-react';

export interface EditPostModalProps {
  post: FeedPost | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedPost: FeedPost) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  post,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !post) return null;

  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [linkUrl, setLinkUrl] = useState(post.link_url || '');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [paperUrl, setPaperUrl] = useState((post.meta as any)?.paper_url || '');
  const [abstract, setAbstract] = useState((post.meta as any)?.abstract || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleAddTag = () => {
    const raw = tagInput.trim().toLowerCase();
    if (!raw) return;

    if (!isValidTag(raw)) {
      setErrors((prev) => ({
        ...prev,
        tags: 'Tags must be 1-30 alphanumeric characters, hyphens or underscores.',
      }));
      return;
    }

    if (tags.length >= 5) {
      setErrors((prev) => ({
        ...prev,
        tags: 'Maximum 5 tags allowed.',
      }));
      return;
    }

    const updated = normalizeTags([...tags, raw]);
    setTags(updated);
    setTagInput('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.tags;
      return next;
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);

    const formData = {
      section: post.section,
      title: title.trim(),
      body: body.trim(),
      link_url: linkUrl.trim() || undefined,
      tags,
      meta:
        post.section === 'research'
          ? {
              paper_url: paperUrl.trim(),
              abstract: abstract.trim() || undefined,
            }
          : post.meta || {},
    };

    const validationResult = postFormSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        fieldErrors[issue.path.join('.')] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Intentionally does NOT submit author_id, status, or created_at
      const updated = await updatePost(post.id, {
        title: formData.title,
        body: formData.body,
        link_url: formData.link_url,
        tags: formData.tags,
        meta: formData.meta,
      });
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'Failed to update post.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-post-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#161b22',
          border: '1px solid rgba(48, 54, 61, 0.9)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(48, 54, 61, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Edit2 size={18} style={{ color: '#38bdf8' }} />
            <h2
              id="edit-post-modal-title"
              style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f0f6fc' }}
            >
              Edit Post
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              background: 'none',
              border: 'none',
              color: '#8b949e',
              cursor: 'pointer',
              padding: '0.35rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {serverError && (
            <div
              role="alert"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                color: '#fca5a5',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{serverError}</span>
            </div>
          )}

          {/* Section badge indicator (Read-only on edit) */}
          <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
            Section:{' '}
            <strong style={{ color: '#38bdf8', textTransform: 'capitalize' }}>{post.section}</strong>
          </div>

          {/* Title */}
          <div>
            <label
              htmlFor="edit-post-title"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              Title *
            </label>
            <input
              id="edit-post-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.7rem 0.85rem',
                borderRadius: '8px',
                background: '#0d1117',
                border: errors.title ? '1px solid #ef4444' : '1px solid rgba(48, 54, 61, 0.8)',
                color: '#f0f6fc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.title && (
              <span style={{ color: '#f87171', fontSize: '0.775rem', marginTop: '0.3rem', display: 'block' }}>
                {errors.title}
              </span>
            )}
          </div>

          {/* Research Fields if research */}
          {post.section === 'research' && (
            <div
              style={{
                background: 'rgba(167, 139, 250, 0.06)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.9rem',
              }}
            >
              <div>
                <label
                  htmlFor="edit-paper-url"
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.3rem' }}
                >
                  Paper URL *
                </label>
                <input
                  id="edit-paper-url"
                  type="url"
                  required
                  value={paperUrl}
                  onChange={(e) => setPaperUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: '#0d1117',
                    border: errors['meta.paper_url'] ? '1px solid #ef4444' : '1px solid rgba(48, 54, 61, 0.8)',
                    color: '#f0f6fc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-abstract"
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.3rem' }}
                >
                  Abstract (Optional)
                </label>
                <textarea
                  id="edit-abstract"
                  rows={3}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: '#0d1117',
                    border: '1px solid rgba(48, 54, 61, 0.8)',
                    color: '#f0f6fc',
                    fontSize: '0.875rem',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <label
              htmlFor="edit-post-body"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              Body *
            </label>
            <textarea
              id="edit-post-body"
              rows={6}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 0.85rem',
                borderRadius: '8px',
                background: '#0d1117',
                border: errors.body ? '1px solid #ef4444' : '1px solid rgba(48, 54, 61, 0.8)',
                color: '#f0f6fc',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            {errors.body && (
              <span style={{ color: '#f87171', fontSize: '0.775rem', marginTop: '0.3rem', display: 'block' }}>
                {errors.body}
              </span>
            )}
          </div>

          {/* Link URL */}
          <div>
            <label
              htmlFor="edit-link-url"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              External Link
            </label>
            <input
              id="edit-link-url"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#0d1117',
                border: '1px solid rgba(48, 54, 61, 0.8)',
                color: '#f0f6fc',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="edit-tag-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              Tags (Up to 5)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                id="edit-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag and press Enter..."
                style={{
                  flex: 1,
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  background: '#0d1117',
                  border: '1px solid rgba(48, 54, 61, 0.8)',
                  color: '#f0f6fc',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={tags.length >= 5 || !tagInput.trim()}
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '0.6rem 1rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: tags.length >= 5 || !tagInput.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <Plus size={16} /> Add
              </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {tags.map((t) => (
                <span
                  key={t}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                  }}
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              marginTop: '0.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid rgba(48, 54, 61, 0.8)',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#8b949e',
                padding: '0.65rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                border: 'none',
                color: '#ffffff',
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: isSubmitting ? 'wait' : 'pointer',
              }}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
