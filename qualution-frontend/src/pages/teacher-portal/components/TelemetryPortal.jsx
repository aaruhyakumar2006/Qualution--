import React, { useState, useEffect, useRef, useMemo } from 'react';
import '../styles/telemetry.css';
import {
  Search, Bell, Bookmark, ChevronLeft, ChevronRight,
  ArrowUpRight, X, Filter, Clock, Star, Zap,
  BookOpen, Globe, FlaskConical, Calendar, Trophy, Cpu,
  Eye, Heart, Share2, BookmarkCheck, Volume2, ExternalLink,
  Layers, AlertTriangle, RefreshCw, Play, FileText, ShieldCheck, Upload, Sparkles, Users
} from 'lucide-react';
import InventeScrollBook3D from './InventeScrollBook3D';
import {
  PORTAL_BRAND,
  PORTAL_UI_TEXT,
  BOOK_3D_STRINGS,
  DEFAULT_TICKER_ITEMS,
  PORTAL_CONFIG,
  SUBMIT_SIGNAL_STRINGS,
  MODERATION_STRINGS,
  STREAM_STRINGS,
  MARIO_EXPLAINER_STRINGS,
  IMPORT_STRINGS,
  COLLAB_ROOM_STRINGS,
  PULSE_VISUALIZER_STRINGS
} from '../constants/portalConstants';
import {
  fetchPortalSections,
  fetchPortalItems,
  fetchCurriculumTags,
  resolveLessonIdForTags,
  reportPortalItem,
  subscribeToPortalStream
} from '../api/portalApi';
import { savePortalItemsToCache } from '../../../services/db/portalDexieDb';
import SubmitSignalModal from './SubmitSignalModal';
import MySubmissionsModal from './MySubmissionsModal';
import ModerationQueueModal from './ModerationQueueModal';
import InteractiveCircuitEmbed from './InteractiveCircuitEmbed';
import HardwareStatusBanner from './HardwareStatusBanner';
import HardwareTelemetryModal from './HardwareTelemetryModal';
import SavedCollectionsModal from './SavedCollectionsModal';
import QuantumBenchmarkModal from './QuantumBenchmarkModal';
import PortalAnalyticsModal from './PortalAnalyticsModal';
import MarioPaperExplainerModal from './MarioPaperExplainerModal';
import BatchImportSignalsModal from './BatchImportSignalsModal';
import QuantumCoAnnotationRoomModal from './QuantumCoAnnotationRoomModal';
import PulseCalibrationVisualizerModal from './PulseCalibrationVisualizerModal';
import SignalReaderModal from './SignalReaderModal';
import { supabase } from '../../../lib/supabase';

// Icon resolver for dynamic section keys
const SECTION_ICONS = {
  all: Zap,
  courses: BookOpen,
  news: Globe,
  research: FlaskConical,
  events: Calendar,
  opportunities: Trophy,
  qualution: Cpu,
};

// ─── TICKER TAPE ─────────────────────────────────────────────────────────────
function TickerTape({ items }) {
  const tickerList = items && items.length > 0 ? items : DEFAULT_TICKER_ITEMS;
  const repeated = [...tickerList, ...tickerList];
  return (
    <div className="tmt-ticker-wrap" aria-hidden="true">
      <div className="tmt-ticker-inner">
        <div className="tmt-ticker-track">
          {repeated.map((item, i) => (
            <span key={i} className="tmt-ticker-item">
              <span className="tmt-ticker-dot">⚛</span>
              {typeof item === 'string' ? item : item.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BOOK CARD ───────────────────────────────────────────────────────────────
function BookCard({ book, onClick }) {
  const Icon = SECTION_ICONS[book.id] || Zap;
  const [hovered, setHovered] = useState(false);
  const unreadCount = book.item_count || 0;

  return (
    <article
      className={`tmt-book-card ${hovered ? 'hovered' : ''}`}
      style={{
        '--book-accent': book.accent || '#C1F8FF',
        '--book-accent-dark': book.accentDark || '#00B8D9',
        '--book-bg': '#FFFFFF'
      }}
      onClick={() => onClick(book.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      tabIndex={0}
      role="button"
      aria-label={`Open ${book.title} feed`}
      onKeyDown={e => e.key === 'Enter' && onClick(book.id)}
    >
      <span className="tmt-book-num" aria-hidden="true">{book.num}</span>
      <div className="tmt-book-icon-wrap">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <div className="tmt-book-text">
        <h2 className="tmt-book-title">{book.title}</h2>
        <p className="tmt-book-subtitle">{book.subtitle}</p>
      </div>
      <div className="tmt-book-arrow">
        <ArrowUpRight size={20} strokeWidth={2} />
      </div>
      {unreadCount > 0 && (
        <span className="tmt-book-unread-dot" aria-label={`${unreadCount} items`}>
          {unreadCount}
        </span>
      )}
      <div className="tmt-book-shimmer" aria-hidden="true" />
    </article>
  );
}

// ─── SIGNAL CARD ─────────────────────────────────────────────────────────────
function SignalCard({ item, onSave, savedIds, onLaunchWorkbench, onExplainWithMario, onJoinCollabRoom, onSelectSignal }) {
  const [liked, setLiked] = useState(false);
  const [isReadingAudio, setIsReadingAudio] = useState(false);
  const isSaved = savedIds.has(item.id);

  const lessonId = resolveLessonIdForTags(item.curriculum_tags);
  const tier = item.source_tier || 1;
  const tierLabel = tier === 1 
    ? PORTAL_UI_TEXT.SOURCE_TIER_1 
    : tier === 2 
      ? PORTAL_UI_TEXT.SOURCE_TIER_2 
      : PORTAL_UI_TEXT.SOURCE_TIER_3;

  const handleAudioSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isReadingAudio) {
      window.speechSynthesis.cancel();
      setIsReadingAudio(false);
      return;
    }
    window.speechSynthesis.cancel();
    const textToRead = `${item.title}. Summary: ${item.summary || item.abstract || ''}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1.0;
    utterance.onend = () => setIsReadingAudio(false);
    utterance.onerror = () => setIsReadingAudio(false);
    setIsReadingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  const formattedDate = useMemo(() => {
    if (!item.published_at) return 'Recent';
    try {
      const d = new Date(item.published_at);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return item.published_at;
    }
  }, [item.published_at]);

  const handleReportAction = async () => {
    const reason = window.prompt('Reason for reporting this signal:');
    if (!reason || !reason.trim()) return;
    try {
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      } catch (e) {}
      if (!token) token = localStorage.getItem('token') || 'usr-student-local';
      await reportPortalItem(item.id, reason.trim(), token);
      alert('Report submitted for educator review. Thank you!');
    } catch (err) {
      alert(err.message || 'Failed to submit report');
    }
  };

  const handleCardClick = () => {
    if (onSelectSignal) {
      onSelectSignal(item);
    } else if (item.canonical_url) {
      window.open(item.canonical_url, '_blank', 'noopener,noreferrer');
    }
  };

  const isCommunityItem = item.source === 'Community' || !!item.author_role;
  const isEducatorPost = item.author_role === 'teacher' || item.author_role === 'admin';

  return (
    <article className="tmt-signal-card">
      <header className="tmt-signal-header">
        <div className="tmt-signal-meta" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
          {item.enriched && (
            <span className="tmt-unread-pip" title="AI Enriched" aria-label="AI Enriched" />
          )}
          <span className="tmt-signal-cat">{(item.section || 'NEWS').toUpperCase()}</span>
          <span className="tmt-signal-source">{item.source}</span>
          
          {/* Community / Educator Badge */}
          {isCommunityItem && (
            <span
              style={{
                fontSize: '0.62rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                padding: '1px 6px',
                borderRadius: '3px',
                background: isEducatorPost ? '#FFC83B' : '#00B8D9',
                color: '#1F1F1F',
                letterSpacing: '0.04em',
              }}
              title={isEducatorPost ? 'Posted by an Educator' : 'Submitted by Community Member'}
            >
              {isEducatorPost ? PORTAL_UI_TEXT.EDUCATOR_BADGE : PORTAL_UI_TEXT.COMMUNITY_BADGE}
            </span>
          )}

          {item.author_display_name && (
            <span style={{ fontSize: '0.65rem', color: '#888', fontStyle: 'italic' }}>
              by {item.author_display_name}
            </span>
          )}

          <span 
            className="tmt-tier-badge"
            title={tierLabel}
            style={{
              fontSize: '0.62rem',
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '3px',
              border: '1px solid currentColor',
              opacity: 0.85
            }}
          >
            {PORTAL_UI_TEXT.TIER_BADGE_PREFIX} {tier}
          </span>
        </div>
        <div className="tmt-signal-actions">
          <button
            className={`tmt-signal-action-btn ${isReadingAudio ? 'active' : ''}`}
            onClick={handleAudioSpeech}
            aria-label={isReadingAudio ? 'Stop audio' : 'Listen to audio summary'}
            title="Read summary aloud"
          >
            <Volume2 size={14} color={isReadingAudio ? '#FFC83B' : 'currentColor'} />
          </button>
          <button
            className={`tmt-signal-action-btn ${liked ? 'active' : ''}`}
            onClick={() => setLiked(l => !l)}
            aria-label={liked ? 'Unlike' : 'Like'}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          </button>
          <button
            className={`tmt-signal-action-btn ${isSaved ? 'active' : ''}`}
            onClick={() => onSave(item.id)}
            aria-label={isSaved ? 'Unsave' : 'Save'}
          >
            {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
          </button>
          <button
            className="tmt-signal-action-btn"
            onClick={handleReportAction}
            aria-label="Report signal"
            title="Report inappropriate content"
          >
            <AlertTriangle size={14} />
          </button>
        </div>
      </header>

      <h3 
        className="tmt-signal-title" 
        style={{ cursor: 'pointer', transition: 'color 0.15s ease' }}
        onClick={handleCardClick}
        title="Click to read full content in-page"
      >
        {item.title}
      </h3>

      {/* AI Summary vs Original Abstract Section with Strict Attribution */}
      <div className="tmt-ai-summary-block" style={{ margin: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
          <span 
            title={item.enriched ? (item.prompt_version ? `Prompt: ${item.prompt_version}` : 'AI Generated Summary') : (item.source ? `Source: ${item.source}` : 'Original Abstract')}
            style={{
              fontSize: '0.62rem',
              fontFamily: 'var(--font-mono, monospace)',
              fontWeight: 900,
              padding: '1px 5px',
              background: item.enriched ? '#FFC83B' : '#E2E8F0',
              color: '#1F1F1F',
              borderRadius: '2px',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            {item.enriched ? PORTAL_UI_TEXT.AI_SUMMARY_LABEL : PORTAL_UI_TEXT.ORIGINAL_ABSTRACT_LABEL}
            {item.enriched && item.prompt_version && (
              <span style={{ fontSize: '0.55rem', opacity: 0.75, fontWeight: 'normal' }}>
                ({item.prompt_version})
              </span>
            )}
          </span>
          {item.level && (
            <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', opacity: 0.7 }}>
              {item.level}
            </span>
          )}
          <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono, monospace)', opacity: 0.6, marginLeft: 'auto' }}>
            via {item.source}
          </span>
        </div>
        <p 
          className="tmt-signal-excerpt"
          style={{ cursor: 'pointer' }}
          onClick={handleCardClick}
        >
          {item.summary || item.abstract || 'No summary available.'}
        </p>
      </div>

      {/* Interactive Circuit Embed if QASM / circuit_data is attached */}
      {(item.circuit_qasm || item.circuit_data) && (
        <InteractiveCircuitEmbed
          qasm={item.circuit_qasm}
          circuitData={item.circuit_data}
          onLaunchWorkbench={onLaunchWorkbench}
          lessonId={lessonId}
        />
      )}

      {/* Tags and Curriculum tags */}
      <div className="tmt-signal-tags">
        {(item.tags || []).map((t, idx) => (
          <span key={idx} className="tmt-signal-tag">{t}</span>
        ))}
        {(item.curriculum_tags || []).map((ct, idx) => (
          <span 
            key={`curric-${idx}`} 
            className="tmt-signal-tag"
            style={{ borderColor: '#B0EF9E', color: '#B0EF9E' }}
          >
            ⚛ {ct}
          </span>
        ))}
      </div>

      <footer className="tmt-signal-footer" style={{ flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
        <div className="tmt-signal-date">
          <Clock size={11} />
          <span>{formattedDate}</span>
          <span className="tmt-signal-sep">·</span>
          {item.canonical_url ? (
            <a
              href={item.canonical_url}
              target="_blank"
              rel="noopener noreferrer"
              className="tmt-original-link"
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.canonical_url, '_blank', 'noopener,noreferrer');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'inherit', textDecoration: 'underline' }}
            >
              <span>{PORTAL_UI_TEXT.ORIGINAL_SOURCE}</span>
              <ExternalLink size={10} />
            </a>
          ) : (
            <span 
              onClick={handleCardClick}
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              View Detail
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleCardClick}
            className="btn-neo btn-neo-sm"
            style={{
              background: '#C1F8FF',
              color: '#1F1F1F',
              fontSize: '0.68rem',
              fontWeight: 900,
              padding: '0.2rem 0.6rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              cursor: 'pointer',
            }}
            title={`Read full content in-page: ${item.title}`}
          >
            <Eye size={11} color="#000" />
            <span>Read Article</span>
          </button>

          {onJoinCollabRoom && (
            <button
              onClick={() => onJoinCollabRoom(item)}
              className="btn-neo btn-neo-sm"
              data-testid={`collab-room-btn-${item.id}`}
              style={{
                background: '#DDD6FE',
                color: '#1F1F1F',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '0.2rem 0.6rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
              title={`Join Live Co-Annotation Room: ${item.title}`}
            >
              <Users size={11} color="#6366F1" />
              <span>Live Room</span>
            </button>
          )}

          {onExplainWithMario && (
            <button
              onClick={() => onExplainWithMario(item)}
              className="btn-neo btn-neo-sm"
              data-testid={`explain-mario-btn-${item.id}`}
              style={{
                background: '#FEF08A',
                color: '#1F1F1F',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '0.2rem 0.6rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                cursor: 'pointer',
              }}
              title={`Explain with Mario Quantum AI: ${item.title}`}
            >
              <Sparkles size={11} color="#D97706" />
              <span>{MARIO_EXPLAINER_STRINGS.EXPLAIN_WITH_MARIO}</span>
            </button>
          )}

          {lessonId && (
            <button
              onClick={() => onLaunchWorkbench && onLaunchWorkbench(lessonId)}
              className="btn-neo btn-neo-sm"
              style={{
                background: '#B0EF9E',
                color: '#1F1F1F',
                fontSize: '0.68rem',
                fontWeight: 900,
                padding: '0.2rem 0.6rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
              title={`Launch Workbench practical: ${lessonId}`}
            >
              <Play size={11} />
              <span>{PORTAL_UI_TEXT.TRY_IN_WORKBENCH}</span>
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

// ─── FEED VIEW ───────────────────────────────────────────────────────────────
function FeedView({
  bookId,
  sections,
  onBack,
  savedIds,
  onSave,
  onLaunchWorkbench,
  onExplainWithMario,
  onJoinCollabRoom,
  onSelectSignal
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  const book = sections.find(b => b.id === bookId) || {
    id: bookId,
    num: '01',
    title: bookId.toUpperCase(),
    subtitle: 'Dynamic Quantum Feed',
    accent: '#C1F8FF',
    accentDark: '#00B8D9'
  };
  const Icon = SECTION_ICONS[bookId] || Zap;

  const loadItems = async () => {
    setIsLoading(true);
    const res = await fetchPortalItems({
      section: bookId,
      level: filterLevel === 'ALL' ? null : filterLevel,
      q: searchQuery.length >= PORTAL_CONFIG.SEARCH_MIN_CHARS ? searchQuery : null,
      limit: 20
    });
    setItems(res.items || []);
    setIsOffline(Boolean(res.isOffline));
    setIsLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, [bookId, filterLevel, searchQuery]);

  const levels = ['ALL', 'Beginner', 'Intermediate', 'Advanced'];

  return (
    <div
      className="tmt-feed-view"
      style={{
        '--book-accent': book.accent || '#C1F8FF',
        '--book-accent-dark': book.accentDark || '#00B8D9'
      }}
    >
      <div className="tmt-feed-header">
        <div className="tmt-feed-header-top">
          <button className="tmt-back-btn" onClick={onBack} aria-label="Back">
            <ChevronLeft size={16} />
            <span>{PORTAL_BRAND.SUBTITLE}</span>
          </button>
          <div className="tmt-feed-title-block">
            <span className="tmt-feed-num">{book.num}</span>
            <div className="tmt-feed-icon-circle">
              <Icon size={18} strokeWidth={1.5} />
            </div>
            <h1 className="tmt-feed-heading">{book.title}</h1>
            {items.length > 0 && (
              <span className="tmt-feed-unread-badge">{items.length} SIGNALS</span>
            )}
          </div>
        </div>

        {isOffline && (
          <div className="tmt-offline-banner" style={{ background: '#332b00', color: '#FFC83B', padding: '0.4rem 0.8rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono)', border: '1px solid #FFC83B', borderRadius: '4px', margin: '0.5rem 0' }}>
            ⚡ {PORTAL_UI_TEXT.OFFLINE_MODE} — {PORTAL_UI_TEXT.OFFLINE_NOTICE}
          </div>
        )}

        <div className="tmt-feed-controls">
          <div className="tmt-search-wrap">
            <Search size={14} className="tmt-search-icon" />
            <input
              className="tmt-search-input"
              placeholder={`Search ${book.title.toLowerCase()}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="tmt-search-clear" onClick={() => setSearchQuery('')} aria-label="Clear">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="tmt-filter-tags">
            <Filter size={12} className="tmt-filter-icon" />
            {levels.map(lvl => (
              <button
                key={lvl}
                className={`tmt-filter-chip ${filterLevel === lvl ? 'active' : ''}`}
                onClick={() => setFilterLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
        <p className="tmt-feed-subtitle">{book.subtitle}</p>
      </div>

      {isLoading ? (
        <div className="tmt-empty-state">
          <RefreshCw size={28} className="animate-spin" />
          <span>Synchronizing quantum telemetry signals...</span>
        </div>
      ) : items.length === 0 ? (
        <div className="tmt-empty-state">
          <Zap size={32} opacity={0.3} />
          <span>{PORTAL_UI_TEXT.NO_SIGNALS_MATCH}</span>
        </div>
      ) : (
        <div className="tmt-signals-grid">
          {items.map(item => (
            <SignalCard
              key={item.id}
              item={item}
              onSave={onSave}
              savedIds={savedIds}
              onLaunchWorkbench={onLaunchWorkbench}
              onExplainWithMario={onExplainWithMario}
              onJoinCollabRoom={onJoinCollabRoom}
              onSelectSignal={onSelectSignal}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SAVED PANEL ─────────────────────────────────────────────────────────────
function SavedPanel({ savedIds, onClose, onUnsave, items }) {
  const savedItems = items.filter(i => savedIds.has(i.id));

  return (
    <div className="tmt-saved-panel">
      <div className="tmt-panel-header">
        <div className="tmt-panel-title">
          <BookmarkCheck size={16} />
          <span>{PORTAL_UI_TEXT.SAVED_SIGNALS}</span>
          {savedItems.length > 0 && <span className="tmt-notif-count">{savedItems.length}</span>}
        </div>
        <button className="tmt-panel-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="tmt-saved-list">
        {savedItems.length === 0 ? (
          <p className="tmt-panel-empty">{PORTAL_UI_TEXT.NO_SAVED_ITEMS}</p>
        ) : savedItems.map(item => (
          <div key={item.id} className="tmt-saved-item">
            <div className="tmt-saved-item-inner">
              <span className="tmt-saved-cat">{item.section}</span>
              <p className="tmt-saved-title">{item.title}</p>
            </div>
            <button className="tmt-saved-remove" onClick={() => onUnsave(item.id)} aria-label="Remove">
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── NOTIFICATIONS PANEL ──────────────────────────────────────────────────────
function NotificationsPanel({ items, onClose, onOpenItem }) {
  const notifs = (items || []).slice(0, 5);
  return (
    <div className="tmt-saved-panel tmt-notif-panel">
      <div className="tmt-panel-header">
        <div className="tmt-panel-title">
          <Bell size={16} />
          <span>{PORTAL_UI_TEXT.NOTIFICATIONS}</span>
          <span className="tmt-notif-count">{notifs.length}</span>
        </div>
        <button className="tmt-panel-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>
      <div className="tmt-saved-list">
        {notifs.map(n => (
          <div 
            key={n.id} 
            className="tmt-saved-item unread"
            style={{ cursor: 'pointer' }}
            onClick={() => { onOpenItem(n.section); onClose(); }}
          >
            <span className="tmt-unread-pip" />
            <div className="tmt-saved-item-inner">
              <p className="tmt-saved-title">{n.title}</p>
              <span className="tmt-saved-cat">{n.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN TELEMETRY PORTAL COMPONENT ──────────────────────────────────────────
export default function TelemetryPortal({ onNavigate, onLaunchIDE, userRole = 'teacher' }) {
  const [sections, setSections] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [activeFeed, setActiveFeed] = useState(null);
  const [savedIds, setSavedIds] = useState(new Set());
  const [showSaved, setShowSaved] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showSubmitSignal, setShowSubmitSignal] = useState(false);
  const [showMySubmissions, setShowMySubmissions] = useState(false);
  const [showModerationQueue, setShowModerationQueue] = useState(false);
  const [showHardwareModal, setShowHardwareModal] = useState(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [showPulseVisualizerModal, setShowPulseVisualizerModal] = useState(false);
  const [collabRoomItem, setCollabRoomItem] = useState(null);
  const [marioExplainingItem, setMarioExplainingItem] = useState(null);
  const [selectedSignalForReader, setSelectedSignalForReader] = useState(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [webglUnavailableNotice, setWebglUnavailableNotice] = useState(false);
  const [streamStatus, setStreamStatus] = useState('connecting'); // 'connected' | 'connecting' | 'disconnected'
  const [liveToast, setLiveToast] = useState(null); // { title: string, section: string } | null
  
  // Feature flag & view preference for 3D book vs plain list view
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enable3DFlag = import.meta.env.VITE_ENABLE_3D_BOOK !== 'false';
  const [is3DMode, setIs3DMode] = useState(!prefersReducedMotion && enable3DFlag);

  const handleRefreshItems = async () => {
    const itemsData = await fetchPortalItems({ limit: 50 });
    setAllItems(itemsData.items || []);
    const secData = await fetchPortalSections();
    setSections(secData.sections || []);
  };

  // Subscribe to real-time live telemetry stream
  useEffect(() => {
    const unsubscribe = subscribeToPortalStream(
      (newSignal) => {
        if (!newSignal || !newSignal.id) return;
        setLiveToast({ title: newSignal.title, section: newSignal.section || 'news' });
        setAllItems((prev) => {
          if (prev.some((item) => item.id === newSignal.id)) return prev;
          return [newSignal, ...prev];
        });
        try {
          savePortalItemsToCache([newSignal]).catch(() => {});
        } catch {}
      },
      (status) => {
        setStreamStatus(status);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-dismiss live signal toast after 6 seconds
  useEffect(() => {
    if (!liveToast) return;
    const timer = setTimeout(() => {
      setLiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [liveToast]);

  // Load dynamic sections and top items at mount
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      fetchCurriculumTags();
      const secData = await fetchPortalSections();
      if (!isMounted) return;
      setSections(secData.sections || []);
      if (secData.isOffline) setIsOffline(true);

      const itemsData = await fetchPortalItems({ limit: 50 });
      if (!isMounted) return;
      setAllItems(itemsData.items || []);
      if (itemsData.isOffline) setIsOffline(true);
    }
    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  const totalSignals = allItems.length;
  const savedCount = savedIds.size;

  const handleOpenBook = (bookId) => {
    setTransitioning(true);
    setTimeout(() => {
      setActiveFeed(bookId);
      setTransitioning(false);
    }, PORTAL_CONFIG.TRANSITION_DELAY_MS);
  };

  const handleBack = () => {
    setTransitioning(true);
    setTimeout(() => {
      setActiveFeed(null);
      setTransitioning(false);
    }, PORTAL_CONFIG.TRANSITION_DELAY_MS);
  };

  const handleSave = (id) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleWorkbenchAction = (parsedCircuitOrLessonId, maybeLessonId) => {
    if (typeof onLaunchIDE === 'function') {
      if (typeof parsedCircuitOrLessonId === 'object' && parsedCircuitOrLessonId !== null) {
        onLaunchIDE(undefined, parsedCircuitOrLessonId, maybeLessonId);
      } else {
        onLaunchIDE(undefined, undefined, parsedCircuitOrLessonId);
      }
    } else if (typeof onNavigate === 'function') {
      onNavigate('workbench', {
        circuit: typeof parsedCircuitOrLessonId === 'object' ? parsedCircuitOrLessonId : undefined,
        lessonId: typeof parsedCircuitOrLessonId === 'string' ? parsedCircuitOrLessonId : maybeLessonId
      });
    }
  };

  // Build dynamic 3D spreads from the highest-tier live items
  const dynamicSpreads = useMemo(() => {
    const categories = ['news', 'courses', 'opportunities'];
    const tabColors = ['#C1F8FF', '#FFC83B', '#FE90E9'];
    const tabShorts = ['SIGNALS', 'COURSES', 'GRANTS'];

    return categories.map((cat, idx) => {
      const catItems = allItems.filter(i => (i.section || '').toLowerCase() === cat);
      const topItem = catItems[0];
      const highlights = catItems.slice(0, 4).map(i => i.title);

      return {
        tabLabel: `${idx + 1}. ${cat.toUpperCase()}`,
        tabColor: tabColors[idx] || '#C1F8FF',
        tabShort: tabShorts[idx] || cat.toUpperCase(),
        title: topItem ? topItem.title : `${cat.toUpperCase()} DISPATCHES`,
        code: `SIGNAL-0${idx + 1} / ${cat.toUpperCase()}`,
        tag: `EDITORIAL ${cat.toUpperCase()}`,
        summary: topItem ? (topItem.summary || topItem.abstract) : `Real-time dispatches from ${cat} across the quantum ecosystem.`,
        highlights: highlights.length > 0 ? highlights : ['Live quantum telemetry updates available.'],
        actionLabel: `EXPLORE ${cat.toUpperCase()} →`,
        stats: {
          modules: `${catItems.length}`,
          hours: 'LIVE',
          students: `${cat.toUpperCase()}`
        },
        category: cat
      };
    });
  }, [allItems]);

  // Global search autocomplete filter
  const globalResults = globalSearch.length >= PORTAL_CONFIG.SEARCH_MIN_CHARS
    ? allItems.filter(i =>
        i.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
        (i.source && i.source.toLowerCase().includes(globalSearch.toLowerCase())) ||
        (i.tags && i.tags.some(t => t.toLowerCase().includes(globalSearch.toLowerCase())))
      ).slice(0, PORTAL_CONFIG.MAX_DROPDOWN_RESULTS)
    : [];

  return (
    <div className="tmt-root">
      {/* Executive Quantum Navigation Header */}
      <header className="tmt-nav">
        <div className="tmt-nav-inner">
          <button className="tmt-nav-back" onClick={() => onNavigate && onNavigate('dashboard')}>
            <ChevronLeft size={14} />
            <span>TEACHER DASHBOARD</span>
          </button>
          
          <div className="tmt-nav-brand" onClick={() => setActiveFeed(null)}>
            <div className="tmt-brand-badge">
              <Zap size={18} />
            </div>
            <div>
              <div className="tmt-brand-title">{PORTAL_BRAND.TITLE}</div>
              <div className="tmt-brand-sub">{PORTAL_BRAND.SUBTITLE}</div>
            </div>
          </div>

          <div className="tmt-nav-actions">
            {/* View Mode Switcher */}
            <button
              onClick={() => setIs3DMode(prev => !prev)}
              className="tmt-nav-action-btn"
              title="Toggle 3D Presentation vs Compact Grid View"
            >
              <Layers size={14} />
              <span>{is3DMode ? 'GRID VIEW' : '3D STAGE'}</span>
            </button>

            {/* Global Search Input */}
            <div className={`tmt-global-search ${searchFocused ? 'focused' : ''}`}>
              <Search size={14} />
              <input
                placeholder={PORTAL_UI_TEXT.SEARCH_SIGNALS}
                value={globalSearch}
                onChange={e => setGlobalSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              />
              {globalSearch && (
                <button onClick={() => setGlobalSearch('')} className="tmt-gs-clear"><X size={12} /></button>
              )}
              {globalResults.length > 0 && searchFocused && (
                <div className="tmt-gs-dropdown">
                  {globalResults.map(item => (
                    <button
                      key={item.id}
                      className="tmt-gs-result"
                      onMouseDown={() => { handleOpenBook((item.section || 'news').toLowerCase()); setGlobalSearch(''); }}
                    >
                      <span className="tmt-gs-result-cat">{item.section}</span>
                      <span className="tmt-gs-result-title">{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Submit a Signal Button */}
            <button
              onClick={() => setShowSubmitSignal(true)}
              className="btn-neo-quantum"
              title="Submit a community signal or paper"
            >
              <Zap size={14} />
              <span>{PORTAL_UI_TEXT.SUBMIT_SIGNAL_BTN}</span>
            </button>

            {/* My Submissions Button */}
            <button
              onClick={() => setShowMySubmissions(true)}
              className="tmt-nav-action-btn"
              title="View your submitted signals & moderation status"
            >
              <FileText size={14} />
              <span>MY SIGNALS</span>
            </button>

            {/* Moderation Queue Button (Educator / Admin) */}
            {(userRole === 'teacher' || userRole === 'admin') && (
              <button
                onClick={() => setShowModerationQueue(true)}
                className="tmt-nav-action-btn"
                style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: 'var(--tmt-rose)' }}
                title="Review pending community submissions"
              >
                <ShieldCheck size={14} />
                <span>MODERATION</span>
              </button>
            )}

            {/* Batch Import & Feed Syndication Modal Trigger */}
            <button
              onClick={() => setShowBatchImportModal(true)}
              className="tmt-nav-action-btn"
              data-testid="open-batch-import-btn"
              title="Batch import BibTeX / JSON signals or view RSS syndication feeds"
            >
              <Upload size={14} />
              <span>IMPORT / RSS</span>
            </button>

            {/* Saved Items Button */}
            <button
              className={`tmt-nav-action-btn ${showSaved ? 'active' : ''}`}
              onClick={() => { setShowSaved(s => !s); setShowNotif(false); }}
              aria-label="Saved items"
            >
              <Bookmark size={15} />
              {savedCount > 0 && <span className="tmt-action-badge">{savedCount}</span>}
            </button>

            {/* Notifications Button */}
            <button
              className={`tmt-nav-action-btn ${showNotif ? 'active' : ''}`}
              onClick={() => { setShowNotif(s => !s); setShowSaved(false); }}
              aria-label="Notifications"
            >
              <Bell size={15} />
              {totalSignals > 0 && <span className="tmt-action-badge tmt-action-badge--notif">{totalSignals}</span>}
            </button>
          </div>
        </div>
      </header>

      {/* Dynamic Ticker Tape */}
      <TickerTape items={allItems.slice(0, 8)} />

      {/* Slideout Panels & Modals */}
      <SavedCollectionsModal
        isOpen={showSaved}
        onClose={() => setShowSaved(false)}
        savedIds={savedIds}
        onUnsave={handleSave}
        allItems={allItems}
        onOpenFeed={handleOpenBook}
      />
      {showNotif && <NotificationsPanel items={allItems} onClose={() => setShowNotif(false)} onOpenItem={handleOpenBook} />}

      <SubmitSignalModal
        isOpen={showSubmitSignal}
        onClose={() => setShowSubmitSignal(false)}
        onSuccess={() => {
          handleRefreshItems();
        }}
        userRole={userRole}
      />

      <MySubmissionsModal
        isOpen={showMySubmissions}
        onClose={() => setShowMySubmissions(false)}
      />

      <SignalReaderModal
        signal={selectedSignalForReader}
        onClose={() => setSelectedSignalForReader(null)}
        onSave={handleSave}
        savedIds={savedIds}
        onLaunchWorkbench={handleWorkbenchAction}
        onExplainWithMario={(item) => {
          setSelectedSignalForReader(null);
          setMarioExplainingItem(item);
        }}
        onJoinCollabRoom={(item) => {
          setSelectedSignalForReader(null);
          setCollabRoomItem(item);
        }}
      />

      <ModerationQueueModal
        isOpen={showModerationQueue}
        onClose={() => setShowModerationQueue(false)}
        onActionTaken={() => {
          handleRefreshItems();
        }}
      />

      <HardwareTelemetryModal
        isOpen={showHardwareModal}
        onClose={() => setShowHardwareModal(false)}
      />

      <QuantumBenchmarkModal
        isOpen={showBenchmarkModal}
        onClose={() => setShowBenchmarkModal(false)}
        onLaunchWorkbench={(launchData) => {
          setShowBenchmarkModal(false);
          if (launchData && launchData.qasm) {
            handleWorkbenchAction(launchData.qasm);
          }
        }}
      />

      <PortalAnalyticsModal
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
        onSelectClusterTag={(tag) => {
          setGlobalSearch(tag);
        }}
      />

      <MarioPaperExplainerModal
        isOpen={Boolean(marioExplainingItem)}
        onClose={() => setMarioExplainingItem(null)}
        signalItem={marioExplainingItem}
        onLaunchWorkbench={(qasmCode) => {
          setMarioExplainingItem(null);
          handleWorkbenchAction(qasmCode);
        }}
      />

      <BatchImportSignalsModal
        isOpen={showBatchImportModal}
        onClose={() => setShowBatchImportModal(false)}
        onSuccess={() => {
          handleRefreshItems();
        }}
      />

      <QuantumCoAnnotationRoomModal
        isOpen={Boolean(collabRoomItem)}
        onClose={() => setCollabRoomItem(null)}
        item={collabRoomItem}
      />

      <PulseCalibrationVisualizerModal
        isOpen={showPulseVisualizerModal}
        onClose={() => setShowPulseVisualizerModal(false)}
        onLaunchWorkbench={(presetId) => {
          setShowPulseVisualizerModal(false);
          handleWorkbenchAction(presetId);
        }}
      />

      <main className={`tmt-main ${transitioning ? 'tmt-transitioning' : ''}`}>
        {activeFeed === null ? (
          <div className="tmt-landing">
            {/* Live Hardware Status Banner */}
            <div style={{ padding: '0 1rem' }}>
              <HardwareStatusBanner
                onOpenTelemetryModal={() => setShowHardwareModal(true)}
                onOpenBenchmarkModal={() => setShowBenchmarkModal(true)}
                onOpenAnalyticsModal={() => setShowAnalyticsModal(true)}
                onOpenPulseVisualizerModal={() => setShowPulseVisualizerModal(true)}
              />
            </div>

            {/* Hero Section */}
            <section className="tmt-hero">
              <div className="tmt-hero-inner">
                <div className="tmt-hero-eyebrow" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <Volume2 size={12} />
                  <span>{PORTAL_UI_TEXT.LIVE_FEED}</span>
                  <span className="tmt-hero-dot" />
                  <span>{totalSignals} {PORTAL_UI_TEXT.UNREAD_SIGNALS}</span>

                  {/* Real-time SSE live stream status badge */}
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 900,
                      padding: '1px 6px',
                      borderRadius: '3px',
                      border: '1px solid #1F1F1F',
                      background: streamStatus === 'connected' ? '#B0EF9E' : streamStatus === 'connecting' ? '#FFC83B' : '#E2E8F0',
                      color: '#1F1F1F',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                    title={`Real-Time Telemetry Stream: ${streamStatus}`}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: streamStatus === 'connected' ? '#16A34A' : streamStatus === 'connecting' ? '#D97706' : '#6B7280',
                        display: 'inline-block',
                      }}
                    />
                    {streamStatus === 'connected'
                      ? STREAM_STRINGS.LIVE_STREAM_BADGE
                      : streamStatus === 'connecting'
                        ? STREAM_STRINGS.CONNECTING_BADGE
                        : STREAM_STRINGS.OFFLINE_BADGE}
                  </span>

                  {isOffline && (
                    <span style={{ color: '#FFC83B', marginLeft: '0.5rem', fontWeight: 800 }}>
                      [OFFLINE]
                    </span>
                  )}
                </div>
                <h1 className="tmt-hero-title">
                  <span className="tmt-hero-line">THE QUANTUM</span>
                  <span className="tmt-hero-line tmt-hero-accent">WORLD,</span>
                  <span className="tmt-hero-line">IN MOTION.</span>
                </h1>
                <p className="tmt-hero-tagline">
                  {PORTAL_BRAND.HERO_DESC}
                </p>
              </div>

              {/* Latest signals preview strip */}
              <div className="tmt-latest-strip">
                <div className="tmt-latest-label">{PORTAL_UI_TEXT.LATEST_SIGNALS}</div>
                <div className="tmt-latest-items">
                  {allItems.slice(0, 4).map(item => (
                    <button
                      key={item.id}
                      className="tmt-latest-item"
                      onClick={() => setSelectedSignalForReader(item)}
                      title={`Read ${item.title}`}
                    >
                      <span className="tmt-latest-cat">{item.section}</span>
                      <span className="tmt-latest-title">{item.title}</span>
                      <ArrowUpRight size={11} className="tmt-latest-arrow" />
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* WebGL Unavailable Friendly Notice Banner */}
            {webglUnavailableNotice && (
              <div
                role="status"
                className="tmt-webgl-notice"
                style={{
                  background: '#FFF3CD',
                  color: '#856404',
                  border: '2px solid #856404',
                  padding: '0.6rem 1rem',
                  margin: '0.5rem 1rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '3px 3px 0px #856404'
                }}
              >
                <span>⚠️ {PORTAL_UI_TEXT.WEBGL_UNAVAILABLE_NOTICE}</span>
                <button
                  onClick={() => setWebglUnavailableNotice(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 900, color: 'inherit' }}
                  aria-label="Dismiss notice"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 3D SCROLL BOOK PRESENTATION OR 2D LIST FALLBACK */}
            {is3DMode ? (
              <div style={{ padding: '0 1rem', marginBottom: '1.5rem' }}>
                <InventeScrollBook3D
                  theme="telemetry"
                  badgeText={BOOK_3D_STRINGS.BADGE_TEXT}
                  bookTitle={BOOK_3D_STRINGS.BOOK_TITLE}
                  bookSubtitle={BOOK_3D_STRINGS.BOOK_SUBTITLE}
                  spreads={dynamicSpreads}
                  onWebGLUnavailable={() => {
                    setIs3DMode(false);
                    setWebglUnavailableNotice(true);
                  }}
                  onSelectAction={(spread) => {
                    if (spread.category) {
                      handleOpenBook(spread.category);
                    }
                  }}
                />
              </div>
            ) : (
              /* Plain List-View Fallback for reduced motion / non-3D mode */
              <div className="tmt-list-fallback-section" style={{ padding: '1rem', background: '#FFF9EE', border: '2.5px solid #1F1F1F', margin: '1rem', boxShadow: '6px 6px 0px #1F1F1F' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1F1F1F', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.85rem' }}>
                    {PORTAL_UI_TEXT.FEATURED_FOLIOS_LIST}
                  </div>
                  <button 
                    onClick={() => setIs3DMode(true)}
                    className="btn-neo btn-neo-sm"
                    style={{ background: '#C1F8FF', fontSize: '0.7rem' }}
                  >
                    {PORTAL_UI_TEXT.SWITCH_TO_3D} →
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {dynamicSpreads.map((sp, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: '#FFFDF9', 
                        border: '2px solid #1F1F1F', 
                        padding: '1.2rem',
                        boxShadow: '3px 3px 0px #1F1F1F',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleOpenBook(sp.category)}
                    >
                      <span style={{ background: sp.tabColor, padding: '2px 6px', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', fontWeight: 900, border: '1px solid #1F1F1F' }}>
                        {sp.code}
                      </span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 900, margin: '0.5rem 0' }}>{sp.title}</h3>
                      <p style={{ fontSize: '0.78rem', color: '#555', lineHeight: 1.4 }}>{sp.summary}</p>
                      <button 
                        className="btn-neo btn-neo-sm" 
                        style={{ marginTop: '0.75rem', background: sp.tabColor, fontWeight: 800, fontSize: '0.7rem' }}
                      >
                        {sp.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Books Section Grid */}
            <section className="tmt-books-section">
              <div className="tmt-books-label">{PORTAL_UI_TEXT.EDITORIAL_INDEX}</div>
              <div className="tmt-books-grid">
                {sections.map(book => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onClick={handleOpenBook}
                  />
                ))}
              </div>
            </section>

            <footer className="tmt-landing-footer">
              <span className="tmt-lf-brand">{PORTAL_BRAND.FULL_NAME}</span>
              <span className="tmt-lf-sep">—</span>
              <span className="tmt-lf-copy">{PORTAL_BRAND.FOOTER_COPY}</span>
            </footer>
          </div>
        ) : (
          <FeedView
            bookId={activeFeed}
            sections={sections}
            onBack={handleBack}
            savedIds={savedIds}
            onSave={handleSave}
            onLaunchWorkbench={handleWorkbenchAction}
            onExplainWithMario={(item) => setMarioExplainingItem(item)}
            onJoinCollabRoom={(item) => setCollabRoomItem(item)}
          />
        )}
      </main>

      {/* Real-time incoming signal live toast */}
      {liveToast && (
        <aside
          aria-live="polite"
          className="tmt-live-toast"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            background: '#FFFFFF',
            border: '2.5px solid #000000',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            boxShadow: '4px 4px 0px #000000',
            maxWidth: '380px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            animation: 'slideIn 0.3s ease-out',
            color: '#1F1F1F',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          <Zap size={18} color="#FFC83B" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  padding: '1px 5px',
                  borderRadius: '2px',
                  background: '#FFC83B',
                  color: '#1F1F1F',
                }}
              >
                {(liveToast.section || 'NEWS').toUpperCase()}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#B0EF9E', fontWeight: 800 }}>
                {STREAM_STRINGS.NEW_SIGNAL_TOAST}
              </span>
            </div>
            <p
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                lineHeight: 1.3,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {liveToast.title}
            </p>
          </div>
          <button
            onClick={() => setLiveToast(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label={STREAM_STRINGS.DISMISS_TOAST}
          >
            <X size={14} />
          </button>
        </aside>
      )}
    </div>
  );
}

