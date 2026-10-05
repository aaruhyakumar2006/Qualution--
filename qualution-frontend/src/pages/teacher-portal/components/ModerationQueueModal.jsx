import React, { useState, useEffect } from 'react';
import { X, Check, Ban, Trash2, ShieldAlert, ShieldCheck, AlertCircle, RefreshCw, ExternalLink, User, Flag, MessageSquare, Play, Bot, Radio } from 'lucide-react';
import { MODERATION_STRINGS, CRAWLER_STRINGS } from '../constants/portalConstants';
import { fetchModerationQueue, approveSubmission, rejectSubmission, removeSubmission, fetchIngestionStatus, triggerIngestionCycle } from '../api/portalApi';
import { supabase } from '../../../lib/supabase';

export default function ModerationQueueModal({ isOpen, onClose, onActionTaken }) {
  const [activeFilter, setActiveFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);

  // Live Crawler Engine state
  const [crawlerStatus, setCrawlerStatus] = useState(null);
  const [crawlerLoading, setCrawlerLoading] = useState(false);
  const [crawlerMsg, setCrawlerMsg] = useState(null);

  const loadQueue = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      } catch (authErr) {
        console.warn('Could not read Supabase session:', authErr);
      }
      if (!token) {
        token = localStorage.getItem('token') || 'usr-teacher-local';
      }

      const res = await fetchModerationQueue(activeFilter, token);
      setItems(res || []);

      // Load crawler status
      try {
        const cStatus = await fetchIngestionStatus(token);
        setCrawlerStatus(cStatus);
      } catch (cErr) {
        console.debug('Could not load crawler status:', cErr);
      }
    } catch (err) {
      console.error('Failed to load moderation queue:', err);
      setErrorMsg(err.message || 'Failed to load moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCrawler = async () => {
    setCrawlerLoading(true);
    setCrawlerMsg(null);
    try {
      const token = await getToken();
      const res = await triggerIngestionCycle(token);
      setCrawlerMsg(CRAWLER_STRINGS.TRIGGER_SUCCESS);
      const cStatus = await fetchIngestionStatus(token);
      setCrawlerStatus(cStatus);
      loadQueue();
      if (typeof onActionTaken === 'function') onActionTaken();
    } catch (err) {
      setCrawlerMsg(err.message || 'Failed to trigger crawler.');
    } finally {
      setCrawlerLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen, activeFilter]);

  if (!isOpen) return null;

  const getToken = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) return data.session.access_token;
    } catch (authErr) {
      console.warn('Could not read Supabase session:', authErr);
    }
    return localStorage.getItem('token') || 'usr-teacher-local';
  };

  const handleApprove = async (item) => {
    if (!window.confirm(`Approve "${item.title}" for public release?`)) return;
    setActionInProgress(item.id);
    try {
      const token = await getToken();
      await approveSubmission(item.id, token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (typeof onActionTaken === 'function') onActionTaken();
    } catch (err) {
      alert(err.message || 'Failed to approve submission');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (item) => {
    const reason = window.prompt(MODERATION_STRINGS.REASON_PROMPT, 'Content does not meet quantum curriculum relevance criteria.');
    if (!reason || !reason.trim()) return;

    setActionInProgress(item.id);
    try {
      const token = await getToken();
      await rejectSubmission(item.id, reason.trim(), token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (typeof onActionTaken === 'function') onActionTaken();
    } catch (err) {
      alert(err.message || 'Failed to reject submission');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemove = async (item) => {
    const reason = window.prompt('Reason for removing this item from public view:', 'Removed by moderator.');
    if (reason === null) return;

    setActionInProgress(item.id);
    try {
      const token = await getToken();
      await removeSubmission(item.id, reason.trim(), token);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (typeof onActionTaken === 'function') onActionTaken();
    } catch (err) {
      alert(err.message || 'Failed to remove item');
    } finally {
      setActionInProgress(null);
    }
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
          boxShadow: '6px 6px 0px #000000',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '4px',
          color: '#1F1F1F',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '2px solid #000000', paddingBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={20} color="#000000" />
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, color: '#1F1F1F' }}>
                {MODERATION_STRINGS.QUEUE_TITLE}
              </h2>
            </div>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#4B5563' }}>
              {MODERATION_STRINGS.QUEUE_SUBTITLE}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={loadQueue}
              disabled={loading}
              title="Refresh Queue"
              style={{ background: 'transparent', border: 'none', color: '#AAA', cursor: 'pointer', padding: '0.3rem' }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#AAA', cursor: 'pointer', padding: '0.3rem' }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Live Crawler Control Panel */}
        <div
          style={{
            background: '#12161D',
            border: '1.5px solid #282C34',
            borderRadius: '4px',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                background: '#FFC83B',
                color: '#1F1F1F',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
              }}
            >
              <Bot size={16} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#FFF' }}>
                  {CRAWLER_STRINGS.TITLE}
                </span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: crawlerStatus?.scheduler_running ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255, 100, 100, 0.15)',
                    color: crawlerStatus?.scheduler_running ? '#4ADE80' : '#FF8888',
                    border: `1px solid ${crawlerStatus?.scheduler_running ? '#4ADE80' : '#FF8888'}`,
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono, monospace)',
                  }}
                >
                  {crawlerStatus?.scheduler_running ? CRAWLER_STRINGS.SCHEDULER_ACTIVE : CRAWLER_STRINGS.SCHEDULER_STOPPED}
                </span>
                {crawlerStatus?.interval_minutes && (
                  <span style={{ fontSize: '0.65rem', color: '#888', fontFamily: 'var(--font-mono, monospace)' }}>
                    ({CRAWLER_STRINGS.INTERVAL_LABEL} {crawlerStatus.interval_minutes}m)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#888', marginTop: '2px', fontFamily: 'var(--font-mono, monospace)' }}>
                {crawlerStatus?.last_run_at
                  ? `${CRAWLER_STRINGS.LAST_RUN_LABEL} ${new Date(crawlerStatus.last_run_at).toLocaleTimeString()}`
                  : CRAWLER_STRINGS.NEVER_RUN}
                {crawlerStatus?.last_stats && (
                  <span style={{ marginLeft: '0.5rem', color: '#00B8D9' }}>
                    · {CRAWLER_STRINGS.ITEMS_DISCOVERED} {crawlerStatus.last_stats.items_discovered} · {CRAWLER_STRINGS.ITEMS_ENRICHED} {crawlerStatus.last_stats.items_enriched}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {crawlerMsg && (
              <span style={{ fontSize: '0.7rem', color: '#FFC83B', fontFamily: 'var(--font-mono, monospace)' }}>
                {crawlerMsg}
              </span>
            )}
            <button
              onClick={handleTriggerCrawler}
              disabled={crawlerLoading || crawlerStatus?.cycle_in_progress}
              className="btn-neo btn-neo-sm"
              style={{
                background: '#FFC83B',
                color: '#1F1F1F',
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, monospace)',
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                padding: '0.35rem 0.75rem',
                cursor: (crawlerLoading || crawlerStatus?.cycle_in_progress) ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={12} className={crawlerLoading ? 'animate-spin' : ''} />
              <span>{crawlerLoading ? CRAWLER_STRINGS.TRIGGERING : CRAWLER_STRINGS.TRIGGER_BTN}</span>
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { id: 'pending', label: MODERATION_STRINGS.FILTER_PENDING },
            { id: 'reported', label: MODERATION_STRINGS.FILTER_REPORTED },
            { id: 'rejected', label: MODERATION_STRINGS.FILTER_REJECTED },
            { id: 'all', label: MODERATION_STRINGS.FILTER_ALL },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                background: activeFilter === tab.id ? '#FFC83B' : '#16191E',
                color: activeFilter === tab.id ? '#1F1F1F' : '#BBB',
                border: '1.5px solid #282C34',
                padding: '0.35rem 0.8rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                fontFamily: 'var(--font-mono, monospace)',
                cursor: 'pointer',
                borderRadius: '3px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#888', fontSize: '0.85rem' }}>
            Fetching items for review...
          </div>
        ) : errorMsg ? (
          <div style={{ color: '#FF8888', padding: '1rem', background: 'rgba(255, 77, 77, 0.1)', borderLeft: '3px solid #FF4D4D', fontSize: '0.8rem' }}>
            {errorMsg}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#777', fontSize: '0.85rem' }}>
            {MODERATION_STRINGS.NO_ITEMS}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {items.map((item) => {
              const screening = item.screening || {};
              const spamLikelihood = screening.spam_likelihood ?? 0.0;
              const relevanceScore = screening.relevance_score ?? 1.0;
              const flags = screening.flags || [];

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#14171D',
                    border: '1.5px solid #282C34',
                    borderRadius: '4px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, background: '#222', color: '#00B8D9', padding: '2px 6px', borderRadius: '2px' }}>
                        {(item.submission_type || 'NEWS').toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#AAA', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <User size={12} />
                        {item.author_display_name} ({item.author_role})
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#777' }}>
                        {item.submitted_at ? new Date(item.submitted_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>

                    {/* Screening Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '2px',
                          background: spamLikelihood > 0.5 ? 'rgba(255, 77, 77, 0.2)' : 'rgba(57, 211, 83, 0.2)',
                          color: spamLikelihood > 0.5 ? '#FF6B6B' : '#39D353',
                          border: `1px solid ${spamLikelihood > 0.5 ? '#FF4D4D' : '#39D353'}`,
                        }}
                      >
                        Spam: {Math.round(spamLikelihood * 100)}% | Rel: {Math.round(relevanceScore * 100)}%
                      </span>
                    </div>
                  </div>

                  <h3 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1rem', fontWeight: 800, color: '#FFF' }}>
                    {item.title}
                  </h3>

                  {item.note && (
                    <div style={{ background: '#1A1E24', padding: '0.6rem 0.8rem', borderRadius: '3px', fontSize: '0.8rem', color: '#CCC', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                      <strong>Author Note:</strong> {item.note}
                    </div>
                  )}

                  {item.canonical_url && !item.canonical_url.includes('qualution.org/community') && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <a
                        href={item.canonical_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#00B8D9', textDecoration: 'none' }}
                      >
                        <ExternalLink size={12} />
                        <span>{item.canonical_url}</span>
                      </a>
                    </div>
                  )}

                  {/* Screening Flags and Reason */}
                  {screening.reason && (
                    <div style={{ fontSize: '0.72rem', color: '#999', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <ShieldAlert size={13} color="#FFC83B" />
                      <span>{screening.reason}</span>
                      {flags.length > 0 && (
                        <span style={{ color: '#FF8888', fontWeight: 700 }}>
                          [{flags.join(', ')}]
                        </span>
                      )}
                    </div>
                  )}

                  {/* Review Action Buttons */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem', borderTop: '1px solid #222', paddingTop: '0.65rem' }}>
                    <button
                      onClick={() => handleRemove(item)}
                      disabled={actionInProgress === item.id}
                      style={{
                        background: 'transparent',
                        border: '1px solid #555',
                        color: '#AAA',
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>{MODERATION_STRINGS.REMOVE_BTN}</span>
                    </button>

                    <button
                      onClick={() => handleReject(item)}
                      disabled={actionInProgress === item.id}
                      style={{
                        background: 'rgba(255, 77, 77, 0.15)',
                        border: '1px solid #FF4D4D',
                        color: '#FF8888',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Ban size={13} />
                      <span>{MODERATION_STRINGS.REJECT_BTN}</span>
                    </button>

                    <button
                      onClick={() => handleApprove(item)}
                      disabled={actionInProgress === item.id}
                      style={{
                        background: '#39D353',
                        border: '1.5px solid #1F1F1F',
                        color: '#1F1F1F',
                        padding: '0.35rem 1rem',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        borderRadius: '3px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '2px 2px 0px #FFF',
                      }}
                    >
                      <Check size={14} />
                      <span>{MODERATION_STRINGS.APPROVE_BTN}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
