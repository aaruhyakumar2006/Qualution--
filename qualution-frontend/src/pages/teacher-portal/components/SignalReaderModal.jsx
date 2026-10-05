import React from 'react';
import { 
  X, ExternalLink, Sparkles, Volume2, Heart, Bookmark, BookmarkCheck, 
  Clock, Play, Users, ShieldCheck, CheckCircle2, Globe, FileText, ArrowRight 
} from 'lucide-react';
import InteractiveCircuitEmbed from './InteractiveCircuitEmbed';
import { PORTAL_UI_TEXT } from '../constants/portalConstants';

export default function SignalReaderModal({
  signal,
  onClose,
  onSave,
  savedIds = new Set(),
  onLaunchWorkbench,
  onExplainWithMario,
  onJoinCollabRoom
}) {
  if (!signal) return null;

  const isSaved = savedIds.has(signal.id);
  const tier = signal.source_tier || 1;
  const tierLabel = tier === 1 
    ? PORTAL_UI_TEXT.SOURCE_TIER_1 
    : tier === 2 
      ? PORTAL_UI_TEXT.SOURCE_TIER_2 
      : PORTAL_UI_TEXT.SOURCE_TIER_3;

  const handleOpenExternal = () => {
    if (signal.canonical_url) {
      window.open(signal.canonical_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAudioSpeech = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const textToRead = `${signal.title}. Summary: ${signal.summary || signal.abstract || ''}`;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      className="tmt-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="tmt-modal-card"
        style={{
          background: '#FFFFFF',
          border: '2.5px solid #000000',
          boxShadow: '8px 8px 0px #000000',
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '4px',
          color: '#1F1F1F',
          padding: '1.75rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Badges & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', borderBottom: '2px solid #000000', paddingBottom: '0.85rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 900,
                  background: '#FFC83B',
                  color: '#1F1F1F',
                  border: '1.5px solid #000',
                  padding: '2px 7px',
                  boxShadow: '1.5px 1.5px 0 #000'
                }}
              >
                {(signal.section || 'NEWS').toUpperCase()}
              </span>

              <span
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 800,
                  background: '#C1F8FF',
                  color: '#1F1F1F',
                  border: '1.5px solid #000',
                  padding: '2px 7px',
                }}
              >
                {signal.source}
              </span>

              <span
                style={{
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 800,
                  background: '#B0EF9E',
                  color: '#1F1F1F',
                  border: '1.5px solid #000',
                  padding: '2px 7px',
                }}
              >
                Tier {tier} ({tierLabel})
              </span>
            </div>

            <h2 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.35rem', fontFamily: 'var(--font-heading, sans-serif)', fontWeight: 900, color: '#1F1F1F', lineHeight: 1.25 }}>
              {signal.title}
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#4B5563', marginTop: '0.4rem', fontFamily: 'var(--font-mono, monospace)' }}>
              <span>Published: {signal.published_at || 'Recent'}</span>
              {signal.author_display_name && (
                <span>By {signal.author_display_name}</span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#FFFDF0',
              border: '2px solid #000',
              boxShadow: '2px 2px 0 #000',
              color: '#1F1F1F',
              cursor: 'pointer',
              padding: '0.3rem 0.5rem',
              fontWeight: 900
            }}
            aria-label="Close reader"
          >
            <X size={18} />
          </button>
        </div>

        {/* AI Summary Block */}
        <div 
          style={{ 
            background: '#FFFDF0', 
            border: '2px solid #000000', 
            boxShadow: '4px 4px 0px #000000',
            padding: '1.1rem', 
            borderRadius: '4px',
            marginBottom: '1.25rem' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, color: '#1F1F1F', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFC83B', border: '1px solid #000', padding: '1px 6px' }}>
              <Sparkles size={12} /> AI CURATED SUMMARY & ANALYSIS
            </span>
            {signal.level && (
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, color: '#4B5563' }}>
                Level: {signal.level}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.92rem', color: '#1F1F1F', lineHeight: 1.55, margin: 0, fontWeight: 600 }}>
            {signal.summary || signal.abstract || 'No extended summary provided.'}
          </p>
        </div>

        {/* Abstract / Original Content Body */}
        {signal.abstract && signal.abstract !== signal.summary && (
          <div style={{ marginBottom: '1.25rem', background: '#FFFFFF', border: '1.5px solid #000', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, color: '#1F1F1F', textTransform: 'uppercase' }}>
              Original Abstract & Publication Excerpt
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, margin: 0 }}>
              {signal.abstract}
            </p>
          </div>
        )}

        {/* Key Competencies / Highlights */}
        {signal.highlights && signal.highlights.length > 0 && (
          <div style={{ marginBottom: '1.25rem', background: '#FFF9EE', border: '1.5px solid #000', padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.82rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, color: '#1F1F1F' }}>
              KEY SPECIFICATIONS & COMPETENCIES
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {signal.highlights.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', fontSize: '0.82rem', color: '#1F1F1F', fontWeight: 600 }}>
                  <CheckCircle2 size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Circuit Embed if attached */}
        {(signal.circuit_qasm || signal.circuit_data) && (
          <div style={{ marginBottom: '1.25rem' }}>
            <InteractiveCircuitEmbed
              qasm={signal.circuit_qasm}
              circuitData={signal.circuit_data}
              onLaunchWorkbench={onLaunchWorkbench}
            />
          </div>
        )}

        {/* Tags */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {(signal.tags || []).map((t, idx) => (
            <span key={idx} style={{ background: '#F3F4F6', border: '1px solid #000', padding: '2px 6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {t}
            </span>
          ))}
          {(signal.curriculum_tags || []).map((ct, idx) => (
            <span key={`c-${idx}`} style={{ background: '#E8F5E9', border: '1px solid #16A34A', color: '#16A34A', padding: '2px 6px', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
              ⚛ {ct}
            </span>
          ))}
        </div>

        {/* Action Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #000000', paddingTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleAudioSpeech}
              className="btn-neo btn-neo-sm"
              style={{ background: '#FFF', fontSize: '0.72rem' }}
              title="Listen to summary"
            >
              <Volume2 size={13} /> Listen
            </button>
            <button
              onClick={() => onSave && onSave(signal.id)}
              className="btn-neo btn-neo-sm"
              style={{ background: isSaved ? '#FE90E9' : '#FFF', fontSize: '0.72rem' }}
            >
              {isSaved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </button>
            {onExplainWithMario && (
              <button
                onClick={() => onExplainWithMario(signal)}
                className="btn-neo btn-neo-yellow btn-neo-sm"
                style={{ fontSize: '0.72rem' }}
              >
                🍄 Explain with Mario AI
              </button>
            )}
            {onJoinCollabRoom && (
              <button
                onClick={() => onJoinCollabRoom(signal)}
                className="btn-neo btn-neo-purple btn-neo-sm"
                style={{ fontSize: '0.72rem' }}
              >
                <Users size={13} /> Co-Annotate
              </button>
            )}
          </div>

          {signal.canonical_url && (
            <button
              onClick={handleOpenExternal}
              className="btn-neo btn-neo-cyan"
              style={{ fontSize: '0.78rem', fontWeight: 900 }}
            >
              <span>Visit External Source</span>
              <ExternalLink size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
