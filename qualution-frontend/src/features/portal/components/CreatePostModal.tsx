import React, { useState } from 'react';
import type { PostSection } from '../types';
import { createPost, type FeedPost } from '../api/posts';
import { postFormSchema, normalizeTags, isValidTag } from '../validation/postSchema';
import { X, Sparkles, AlertCircle, Plus, BookOpen, Newspaper, FileText, Calendar } from 'lucide-react';

export interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPost: FeedPost) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [section, setSection] = useState<PostSection>('news');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [paperUrl, setPaperUrl] = useState('');
  const [abstract, setAbstract] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!isOpen) return null;

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
      section,
      title: title.trim(),
      body: body.trim(),
      link_url: linkUrl.trim() || undefined,
      tags,
      meta:
        section === 'research'
          ? {
              paper_url: paperUrl.trim(),
              abstract: abstract.trim() || undefined,
            }
          : {},
    };

    // Client-side validation with Zod
    const validationResult = postFormSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const key = issue.path.join('.');
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const newPost = await createPost(formData);
      onSuccess(newPost);
      onClose();
    } catch (err: any) {
      setServerError(err.message || 'Failed to publish post. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-modal-title"
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
        {/* Header */}
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
            <Sparkles size={18} style={{ color: '#38bdf8' }} />
            <h2
              id="create-post-modal-title"
              style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f0f6fc' }}
            >
              Create Community Post
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
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
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
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{serverError}</span>
            </div>
          )}

          {/* Section Picker */}
          <div>
            <label
              htmlFor="post-section-select"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              Section *
            </label>
            <select
              id="post-section-select"
              value={section}
              onChange={(e) => setSection(e.target.value as PostSection)}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#0d1117',
                border: '1px solid rgba(48, 54, 61, 0.8)',
                color: '#f0f6fc',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="courses">Course / Tutorial</option>
              <option value="news">News & Insights</option>
              <option value="research">Research Publication / Preprint</option>
              <option value="events">Event / Hackathon</option>
              <option value="qualution">Qualution Official</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label
                htmlFor="post-title-input"
                style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9' }}
              >
                Title *
              </label>
              <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{title.length}/300</span>
            </div>
            <input
              id="post-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your post a concise, descriptive title..."
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

          {/* Research Section Specific Meta Fields */}
          {section === 'research' && (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c4b5fd', fontSize: '0.9rem', fontWeight: 700 }}>
                <FileText size={16} /> Research Paper Details (Required)
              </div>

              <div>
                <label
                  htmlFor="research-paper-url"
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.3rem' }}
                >
                  Paper URL (arXiv, DOI, or PDF) *
                </label>
                <input
                  id="research-paper-url"
                  type="url"
                  required
                  value={paperUrl}
                  onChange={(e) => setPaperUrl(e.target.value)}
                  placeholder="https://arxiv.org/abs/..."
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
                {errors['meta.paper_url'] && (
                  <span style={{ color: '#f87171', fontSize: '0.775rem', marginTop: '0.25rem', display: 'block' }}>
                    {errors['meta.paper_url']}
                  </span>
                )}
              </div>

              <div>
                <label
                  htmlFor="research-abstract"
                  style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.3rem' }}
                >
                  Abstract (Optional)
                </label>
                <textarea
                  id="research-abstract"
                  rows={3}
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="Provide a concise abstract of findings..."
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <label
                htmlFor="post-body-input"
                style={{ fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9' }}
              >
                Body *
              </label>
              <span style={{ fontSize: '0.75rem', color: '#8b949e' }}>{body.length}/50000</span>
            </div>
            <textarea
              id="post-body-input"
              rows={6}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share insights, circuit code, questions, or announcements..."
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

          {/* Optional External Link */}
          <div>
            <label
              htmlFor="post-link-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              External Link (Optional)
            </label>
            <input
              id="post-link-input"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com/resource"
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: '#0d1117',
                border: errors.link_url ? '1px solid #ef4444' : '1px solid rgba(48, 54, 61, 0.8)',
                color: '#f0f6fc',
                fontSize: '0.9rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {errors.link_url && (
              <span style={{ color: '#f87171', fontSize: '0.775rem', marginTop: '0.3rem', display: 'block' }}>
                {errors.link_url}
              </span>
            )}
          </div>

          {/* Tags */}
          <div>
            <label
              htmlFor="post-tag-input"
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#c9d1d9', marginBottom: '0.4rem' }}
            >
              Tags (Up to 5)
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                id="post-tag-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="e.g. algorithms, grover, hardware..."
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

            {/* Tag Pills */}
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
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
            {errors.tags && (
              <span style={{ color: '#f87171', fontSize: '0.775rem', marginTop: '0.3rem', display: 'block' }}>
                {errors.tags}
              </span>
            )}
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
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? 'Publishing...' : 'Publish Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
