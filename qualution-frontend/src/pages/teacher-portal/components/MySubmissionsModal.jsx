import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, XCircle, Trash2, ExternalLink, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { SUBMIT_SIGNAL_STRINGS } from '../constants/portalConstants';
import { fetchMySubmissions, deletePortalSubmission } from '../api/portalApi';
import { supabase } from '../../../lib/supabase';

export default function MySubmissionsModal({ isOpen, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadSubmissions = async () => {
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
        token = localStorage.getItem('token') || 'usr-student-local';
      }

      const res = await fetchMySubmissions(token);
      setItems(res || []);
    } catch (err) {
      console.error('Failed to load my submissions:', err);
      setErrorMsg(err.message || 'Failed to load your submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSubmissions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (itemId) => {
    if (!window.confirm(SUBMIT_SIGNAL_STRINGS.DELETE_CONFIRM)) return;
    setDeletingId(itemId);
    try {
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      } catch (authErr) {
        console.warn('Could not read Supabase session:', authErr);
      }
      if (!token) {
        token = localStorage.getItem('token') || 'usr-student-local';
      }

      await deletePortalSubmission(itemId, token);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      alert(err.message || 'Failed to delete submission');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(57, 211, 83, 0.15)', color: '#39D353', border: '1px solid #39D353', padding: '2px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 800 }}>
            <CheckCircle2 size={12} />
            {SUBMIT_SIGNAL_STRINGS.STATUS_APPROVED}
          </span>
        );
      case 'rejected':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 77, 77, 0.15)', color: '#FF4D4D', border: '1px solid #FF4D4D', padding: '2px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 800 }}>
            <XCircle size={12} />
            {SUBMIT_SIGNAL_STRINGS.STATUS_REJECTED}
          </span>
        );
      case 'removed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(150, 150, 150, 0.15)', color: '#999', border: '1px solid #666', padding: '2px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 800 }}>
            {SUBMIT_SIGNAL_STRINGS.STATUS_REMOVED}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 200, 59, 0.15)', color: '#FFC83B', border: '1px solid #FFC83B', padding: '2px 8px', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 800 }}>
            <Clock size={12} />
            {SUBMIT_SIGNAL_STRINGS.STATUS_PENDING}
          </span>
        );
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
          maxWidth: '680px',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: '4px',
          color: '#1F1F1F',
          padding: '1.5rem',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '2px solid #000000', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, color: '#1F1F1F' }}>
              MY SUBMITTED SIGNALS
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#4B5563' }}>
              Track the moderation and publication status of your quantum submissions.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={loadSubmissions}
              disabled={loading}
              title="Refresh"
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

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem 0', color: '#888', fontSize: '0.85rem' }}>
            Loading your submitted signals...
          </div>
        ) : errorMsg ? (
          <div style={{ color: '#FF8888', padding: '1rem', background: 'rgba(255, 77, 77, 0.1)', borderLeft: '3px solid #FF4D4D', fontSize: '0.8rem' }}>
            {errorMsg}
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 0', color: '#777', fontSize: '0.85rem' }}>
            You haven't submitted any signals yet. Click "Submit a Signal" to contribute!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  background: '#14171D',
                  border: '1px solid #282C34',
                  borderRadius: '4px',
                  padding: '1rem',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 800, background: '#222', color: '#00B8D9', padding: '1px 6px', borderRadius: '2px' }}>
                      {(item.submission_type || 'NEWS').toUpperCase()}
                    </span>
                    {getStatusBadge(item.status)}
                    <span style={{ fontSize: '0.7rem', color: '#777' }}>
                      {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deletingId === item.id}
                    title="Delete submission"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#FF6B6B',
                      cursor: deletingId === item.id ? 'not-allowed' : 'pointer',
                      padding: '2px',
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                <h3 style={{ margin: '0.25rem 0 0.4rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#FFF' }}>
                  {item.title}
                </h3>

                {item.note && (
                  <p style={{ margin: '0.3rem 0', fontSize: '0.8rem', color: '#BBB', lineHeight: 1.4 }}>
                    {item.note}
                  </p>
                )}

                {item.canonical_url && !item.canonical_url.includes('qualution.org/community') && (
                  <a
                    href={item.canonical_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: '#00B8D9',
                      textDecoration: 'none',
                      marginTop: '0.25rem',
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>{item.canonical_url}</span>
                  </a>
                )}

                {/* Rejection / Reviewer Feedback */}
                {item.status === 'rejected' && item.review_reason && (
                  <div
                    style={{
                      marginTop: '0.6rem',
                      background: 'rgba(255, 77, 77, 0.1)',
                      borderLeft: '3px solid #FF4D4D',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.75rem',
                      color: '#FFAAAA',
                    }}
                  >
                    <strong>Feedback from Reviewer:</strong> {item.review_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
