import React, { useState, useEffect } from 'react';
import {
  X, Bookmark, BookmarkCheck, Download, Copy, Plus, Trash2,
  FileText, Code2, BookOpen, Share2, Check, ExternalLink, FolderPlus
} from 'lucide-react';
import { COLLECTION_STRINGS, EXPORT_STRINGS } from '../constants/portalConstants';
import {
  generateMarkdownBrief,
  generateJsonBrief,
  generateBibtexCitations,
  generateHtmlDigest,
  downloadBlob,
} from '../../../services/portalExportService';

const STORAGE_KEY_COLLECTIONS = 'qualution_portal_collections_v1';

export default function SavedCollectionsModal({
  isOpen,
  onClose,
  savedIds,
  onUnsave,
  allItems = [],
  onOpenFeed,
}) {
  const [collections, setCollections] = useState([]);
  const [activeCollectionId, setActiveCollectionId] = useState('all');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Load custom collections from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
      if (saved) {
        setCollections(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('[SavedCollections] Error loading custom collections:', e);
    }
  }, []);

  // Save custom collections to localStorage
  const persistCollections = (nextCollections) => {
    setCollections(nextCollections);
    try {
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(nextCollections));
    } catch (e) {
      console.warn('[SavedCollections] Error persisting collections:', e);
    }
  };

  if (!isOpen) return null;

  // Filter all items saved in savedIds
  const allSavedItems = allItems.filter(i => savedIds.has(i.id));

  // Determine items in active view
  let displayedItems = allSavedItems;
  let activeCollectionName = COLLECTION_STRINGS.DEFAULT_COLLECTION_NAME;

  if (activeCollectionId !== 'all') {
    const col = collections.find(c => c.id === activeCollectionId);
    if (col) {
      activeCollectionName = col.name;
      displayedItems = allSavedItems.filter(i => (col.itemIds || []).includes(i.id));
    }
  }

  const handleCreateCollection = (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const newCol = {
      id: `col-${Date.now()}`,
      name: newCollectionName.trim(),
      itemIds: Array.from(savedIds), // pre-seed with currently saved items or empty
      createdAt: new Date().toISOString(),
    };
    persistCollections([...collections, newCol]);
    setActiveCollectionId(newCol.id);
    setNewCollectionName('');
    setIsCreatingCollection(false);
  };

  const handleDeleteCollection = (collectionId, e) => {
    e.stopPropagation();
    if (window.confirm(COLLECTION_STRINGS.DELETE_COLLECTION_CONFIRM)) {
      const next = collections.filter(c => c.id !== collectionId);
      persistCollections(next);
      if (activeCollectionId === collectionId) {
        setActiveCollectionId('all');
      }
    }
  };

  const handleToggleItemInCollection = (itemId, collectionId) => {
    const next = collections.map(c => {
      if (c.id === collectionId) {
        const itemIds = c.itemIds || [];
        const nextIds = itemIds.includes(itemId)
          ? itemIds.filter(id => id !== itemId)
          : [...itemIds, itemId];
        return { ...c, itemIds: nextIds };
      }
      return c;
    });
    persistCollections(next);
  };

  // Export Handlers
  const handleExportMarkdown = () => {
    const md = generateMarkdownBrief(activeCollectionName, displayedItems);
    downloadBlob(md, `qualution-brief-${activeCollectionName.toLowerCase().replace(/\s+/g, '-')}.md`, 'text/markdown');
    setShowExportMenu(false);
  };

  const handleExportJson = () => {
    const json = generateJsonBrief(activeCollectionName, displayedItems);
    downloadBlob(json, `qualution-brief-${activeCollectionName.toLowerCase().replace(/\s+/g, '-')}.json`, 'application/json');
    setShowExportMenu(false);
  };

  const handleExportBibtex = () => {
    const bib = generateBibtexCitations(displayedItems);
    downloadBlob(bib, `qualution-citations-${activeCollectionName.toLowerCase().replace(/\s+/g, '-')}.bib`, 'text/plain');
    setShowExportMenu(false);
  };

  const handleExportHtml = () => {
    const html = generateHtmlDigest(activeCollectionName, displayedItems);
    downloadBlob(html, `qualution-digest-${activeCollectionName.toLowerCase().replace(/\s+/g, '-')}.html`, 'text/html');
    setShowExportMenu(false);
  };

  const handleCopyBibtex = () => {
    const bib = generateBibtexCitations(displayedItems);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(bib).then(() => {
        setCopiedNotification(true);
        setTimeout(() => setCopiedNotification(false), 3000);
      });
    }
  };

  return (
    <div
      className="tmt-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="tmt-modal-card"
        data-testid="saved-collections-modal"
        style={{
          background: '#0B0D10',
          border: '2px solid #FE90E9',
          boxShadow: '6px 6px 0px #FE90E9',
          borderRadius: '8px',
          width: '100%',
          maxWidth: '920px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          color: '#F8FAFC',
          fontFamily: 'var(--font-mono, monospace)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1.5px solid #FE90E9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(254, 144, 233, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <BookmarkCheck size={20} color="#FE90E9" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 900, margin: 0, letterSpacing: '0.02em' }}>
              {COLLECTION_STRINGS.PANEL_TITLE}
            </h2>
            <span
              style={{
                fontSize: '0.65rem',
                background: '#FE90E9',
                color: '#1F1F1F',
                fontWeight: 900,
                padding: '1px 6px',
                borderRadius: '3px',
              }}
            >
              {displayedItems.length} {COLLECTION_STRINGS.SIGNALS_COUNT_SUFFIX}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
            {/* Quick Export Dropdown */}
            {displayedItems.length > 0 && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-neo btn-neo-sm"
                  style={{
                    background: '#FE90E9',
                    color: '#1F1F1F',
                    fontWeight: 900,
                    fontSize: '0.72rem',
                    padding: '0.3rem 0.65rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Download size={13} />
                  <span>{EXPORT_STRINGS.EXPORT_BTN}</span>
                </button>

                {showExportMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      background: '#131822',
                      border: '1.5px solid #FE90E9',
                      borderRadius: '4px',
                      boxShadow: '4px 4px 0px #FE90E9',
                      zIndex: 100,
                      minWidth: '220px',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <button
                      onClick={handleExportMarkdown}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #1E293B',
                        color: '#F8FAFC',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <FileText size={13} color="#38BDF8" />
                      <span>{EXPORT_STRINGS.EXPORT_MARKDOWN}</span>
                    </button>
                    <button
                      onClick={handleExportHtml}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #1E293B',
                        color: '#F8FAFC',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <BookOpen size={13} color="#FFC83B" />
                      <span>{EXPORT_STRINGS.EXPORT_HTML}</span>
                    </button>
                    <button
                      onClick={handleExportJson}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #1E293B',
                        color: '#F8FAFC',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Code2 size={13} color="#B0EF9E" />
                      <span>{EXPORT_STRINGS.EXPORT_JSON}</span>
                    </button>
                    <button
                      onClick={handleExportBibtex}
                      style={{
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#F8FAFC',
                        fontSize: '0.75rem',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Share2 size={13} color="#FE90E9" />
                      <span>{EXPORT_STRINGS.EXPORT_BIBTEX}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Copy BibTeX Citations */}
            {displayedItems.length > 0 && (
              <button
                onClick={handleCopyBibtex}
                className="btn-neo btn-neo-sm"
                title="Copy BibTeX citations to clipboard"
                style={{
                  background: copiedNotification ? '#B0EF9E' : '#1E293B',
                  color: copiedNotification ? '#1F1F1F' : '#F8FAFC',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  padding: '0.3rem 0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                {copiedNotification ? <Check size={13} /> : <Copy size={13} />}
                <span>{copiedNotification ? 'Copied!' : 'Copy BibTeX'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Collections Tabs Navigation */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            borderBottom: '1px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            background: '#0F131A',
          }}
        >
          {/* All Saved */}
          <button
            onClick={() => setActiveCollectionId('all')}
            style={{
              background: activeCollectionId === 'all' ? '#FE90E9' : '#1E293B',
              color: activeCollectionId === 'all' ? '#1F1F1F' : '#CBD5E1',
              border: '1px solid #FE90E9',
              borderRadius: '4px',
              padding: '0.3rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {COLLECTION_STRINGS.ALL_SAVED_TAB} ({allSavedItems.length})
          </button>

          {/* Custom Collections */}
          {collections.map(col => {
            const count = allSavedItems.filter(i => (col.itemIds || []).includes(i.id)).length;
            const isActive = activeCollectionId === col.id;
            return (
              <div
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                  border: '1px solid #FE90E9',
                  background: isActive ? '#FE90E9' : '#1E293B',
                  overflow: 'hidden',
                }}
              >
                <button
                  onClick={() => setActiveCollectionId(col.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: isActive ? '#1F1F1F' : '#CBD5E1',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {col.name} ({count})
                </button>
                <button
                  onClick={(e) => handleDeleteCollection(col.id, e)}
                  title="Delete collection"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderLeft: `1px solid ${isActive ? '#1F1F1F' : '#FE90E9'}`,
                    color: isActive ? '#1F1F1F' : '#EF4444',
                    padding: '0.3rem 0.4rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}

          {/* Inline Create Collection Input / Trigger */}
          {isCreatingCollection ? (
            <form onSubmit={handleCreateCollection} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="text"
                value={newCollectionName}
                onChange={e => setNewCollectionName(e.target.value)}
                placeholder={COLLECTION_STRINGS.COLLECTION_NAME_PLACEHOLDER}
                autoFocus
                style={{
                  background: '#0B0D10',
                  border: '1px solid #FE90E9',
                  borderRadius: '3px',
                  color: '#FFF',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#FE90E9',
                  color: '#1F1F1F',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 8px',
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingCollection(false)}
                style={{
                  background: 'transparent',
                  color: '#94A3B8',
                  border: 'none',
                  padding: '3px',
                  cursor: 'pointer',
                }}
              >
                <X size={13} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingCollection(true)}
              style={{
                background: 'transparent',
                border: '1px dashed #FE90E9',
                borderRadius: '4px',
                color: '#FE90E9',
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <Plus size={12} />
              <span>{COLLECTION_STRINGS.CREATE_COLLECTION_BTN}</span>
            </button>
          )}
        </div>

        {/* Signals List Body */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94A3B8' }}>
              <Bookmark size={32} opacity={0.3} style={{ margin: '0 auto 0.5rem auto', display: 'block' }} />
              <div>{COLLECTION_STRINGS.EMPTY_SAVED_SIGNALS}</div>
            </div>
          ) : (
            displayedItems.map(item => (
              <div
                key={item.id}
                style={{
                  background: '#131822',
                  border: '1.5px solid #1E293B',
                  borderRadius: '6px',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 900,
                        padding: '1px 5px',
                        background: '#FE90E9',
                        color: '#1F1F1F',
                        borderRadius: '2px',
                      }}
                    >
                      {(item.section || 'NEWS').toUpperCase()}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#94A3B8' }}>{item.source}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {/* Collection tagging dropdown / selector if custom collections exist */}
                    {collections.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {collections.map(col => {
                          const isInCol = (col.itemIds || []).includes(item.id);
                          return (
                            <button
                              key={col.id}
                              onClick={() => handleToggleItemInCollection(item.id, col.id)}
                              title={isInCol ? `Remove from ${col.name}` : `Add to ${col.name}`}
                              style={{
                                fontSize: '0.62rem',
                                padding: '1px 5px',
                                borderRadius: '2px',
                                border: '1px solid #FE90E9',
                                background: isInCol ? '#FE90E9' : 'transparent',
                                color: isInCol ? '#1F1F1F' : '#FE90E9',
                                cursor: 'pointer',
                                fontWeight: 700,
                              }}
                            >
                              {isInCol ? `✓ ${col.name}` : `+ ${col.name}`}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => onUnsave(item.id)}
                      title="Remove bookmark"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                  {item.title}
                </h3>

                <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0, lineHeight: 1.35 }}>
                  {item.summary || item.abstract || 'No summary available.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '0.68rem', color: '#64748B' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(item.curriculum_tags || []).map((ct, idx) => (
                      <span key={idx} style={{ color: '#B0EF9E' }}>⚛ {ct}</span>
                    ))}
                  </div>
                  <a
                    href={item.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '3px', textDecoration: 'none' }}
                  >
                    <span>Source</span>
                    <ExternalLink size={10} />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
