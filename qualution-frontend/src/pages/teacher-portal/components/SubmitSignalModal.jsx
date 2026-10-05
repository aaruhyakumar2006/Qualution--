import React, { useState, useEffect } from 'react';
import { X, Send, AlertCircle, CheckCircle, ShieldAlert, Sparkles, Link as LinkIcon, FileText } from 'lucide-react';
import { SUBMIT_SIGNAL_STRINGS } from '../constants/portalConstants';
import { submitPortalSignal } from '../api/portalApi';
import { supabase } from '../../../lib/supabase';

const SUBMISSION_TYPES = [
  { id: 'news', label: 'News & Announcements' },
  { id: 'research', label: 'Research Paper / arXiv' },
  { id: 'resource', label: 'Learning Resource / Tutorial' },
  { id: 'events', label: 'Event / Conference / Hackathon' },
  { id: 'opportunity', label: 'Internship / Grant / Fellowship' },
  { id: 'project', label: 'Open Source Quantum Project' },
];

export default function SubmitSignalModal({ isOpen, onClose, onSuccess, userRole = 'student' }) {
  const [title, setTitle] = useState('');
  const [submissionType, setSubmissionType] = useState('news');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [circuitQasm, setCircuitQasm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setSubmissionType('news');
      setUrl('');
      setNote('');
      setCircuitQasm('');
      setErrorMsg(null);
      setSuccessInfo(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isEducator = userRole === 'teacher' || userRole === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Please provide a signal title.');
      return;
    }
    if (cleanTitle.length > 120) {
      setErrorMsg('Title exceeds maximum length of 120 characters.');
      return;
    }
    if (note && note.length > 1000) {
      setErrorMsg('Note exceeds maximum length of 1000 characters.');
      return;
    }
    if (url) {
      const cleanUrl = url.trim().toLowerCase();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        setErrorMsg('URL must start with http:// or https://');
        return;
      }
    }

    setSubmitting(true);
    try {
      // Extract session token
      let token = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = data?.session?.access_token;
      } catch (authErr) {
        console.warn('Could not read Supabase session:', authErr);
      }
      if (!token) {
        token = localStorage.getItem('token') || (isEducator ? 'usr-teacher-local' : 'usr-student-local');
      }

      const res = await submitPortalSignal(
        {
          title: cleanTitle,
          submission_type: submissionType,
          url: url.trim() || undefined,
          note: note.trim() || undefined,
        },
        token
      );

      setSuccessInfo(res);
      if (typeof onSuccess === 'function') {
        onSuccess(res);
      }
    } catch (err) {
      console.error('Submission error:', err);
      setErrorMsg(err.message || 'Failed to submit signal. Please try again.');
    } finally {
      setSubmitting(false);
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
          maxWidth: '560px',
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
              <Sparkles size={18} color="#000000" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontFamily: 'var(--font-mono, monospace)', fontWeight: 900, letterSpacing: '0.04em', color: '#1F1F1F' }}>
                {SUBMIT_SIGNAL_STRINGS.MODAL_TITLE}
              </h2>
            </div>
            <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: '#4B5563', lineHeight: 1.4 }}>
              {SUBMIT_SIGNAL_STRINGS.MODAL_SUBTITLE}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', padding: '0.2rem' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {successInfo ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <CheckCircle size={48} color="#39D353" style={{ margin: '0 auto 1rem auto' }} />
            <h3 style={{ fontSize: '1.15rem', color: '#FFF', margin: '0 0 0.5rem 0', fontWeight: 800 }}>
              {SUBMIT_SIGNAL_STRINGS.SUCCESS_TITLE}
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#AAA', maxWidth: '420px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
              {successInfo.status === 'approved'
                ? SUBMIT_SIGNAL_STRINGS.SUCCESS_APPROVED
                : SUBMIT_SIGNAL_STRINGS.SUCCESS_PENDING}
            </p>
            <button
              onClick={onClose}
              className="btn-neo"
              style={{
                background: '#FFC83B',
                color: '#1F1F1F',
                border: '2px solid #1F1F1F',
                padding: '0.5rem 1.5rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              {SUBMIT_SIGNAL_STRINGS.CLOSE_BTN}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Notice Banner */}
            <div
              style={{
                background: isEducator ? 'rgba(255, 200, 59, 0.1)' : 'rgba(0, 184, 217, 0.1)',
                borderLeft: `4px solid ${isEducator ? '#FFC83B' : '#00B8D9'}`,
                padding: '0.65rem 0.85rem',
                fontSize: '0.75rem',
                lineHeight: 1.4,
                marginBottom: '1.25rem',
                color: '#DDD',
              }}
            >
              {isEducator ? SUBMIT_SIGNAL_STRINGS.EDUCATOR_NOTICE : SUBMIT_SIGNAL_STRINGS.STUDENT_NOTICE}
            </div>

            {errorMsg && (
              <div
                style={{
                  background: 'rgba(255, 77, 77, 0.15)',
                  borderLeft: '4px solid #FF4D4D',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.75rem',
                  color: '#FF8888',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Title */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#DDD' }}>
                  {SUBMIT_SIGNAL_STRINGS.TITLE_LABEL}
                </label>
                <span style={{ fontSize: '0.65rem', color: title.length > 120 ? '#FF4D4D' : '#777' }}>
                  {title.length}/120
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={SUBMIT_SIGNAL_STRINGS.TITLE_PLACEHOLDER}
                maxLength={120}
                required
                style={{
                  width: '100%',
                  background: '#FFFDF9',
                  border: '2px solid #000000',
                  borderRadius: '3px',
                  color: '#1F1F1F',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Type */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1F1F1F', marginBottom: '0.35rem' }}>
                {SUBMIT_SIGNAL_STRINGS.TYPE_LABEL}
              </label>
              <select
                value={submissionType}
                onChange={(e) => setSubmissionType(e.target.value)}
                style={{
                  width: '100%',
                  background: '#FFFDF9',
                  border: '2px solid #000000',
                  borderRadius: '3px',
                  color: '#1F1F1F',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              >
                {SUBMISSION_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* URL */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1F1F1F', marginBottom: '0.35rem' }}>
                <LinkIcon size={12} />
                {SUBMIT_SIGNAL_STRINGS.URL_LABEL}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={SUBMIT_SIGNAL_STRINGS.URL_PLACEHOLDER}
                style={{
                  width: '100%',
                  background: '#FFFDF9',
                  border: '2px solid #000000',
                  borderRadius: '3px',
                  color: '#1F1F1F',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Note */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1F1F1F' }}>
                  <FileText size={12} />
                  {SUBMIT_SIGNAL_STRINGS.NOTE_LABEL}
                </label>
                <span style={{ fontSize: '0.65rem', color: note.length > 1000 ? '#FF4D4D' : '#666' }}>
                  {note.length}/1000
                </span>
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={SUBMIT_SIGNAL_STRINGS.NOTE_PLACEHOLDER}
                rows={2}
                maxLength={1000}
                style={{
                  width: '100%',
                  background: '#FFFDF9',
                  border: '2px solid #000000',
                  borderRadius: '3px',
                  color: '#1F1F1F',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Optional Attached Quantum Circuit (OpenQASM) */}
            <div style={{ marginBottom: '1.25rem', background: '#FFF9EE', border: '2px solid #000000', borderRadius: '4px', padding: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, fontFamily: 'var(--font-mono, monospace)', color: '#1F1F1F', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>⚛ Attach Quantum Circuit (OpenQASM)</span>
                </label>
                {circuitQasm && (
                  <button
                    type="button"
                    onClick={() => setCircuitQasm('')}
                    style={{ background: 'transparent', border: 'none', color: '#666', fontSize: '0.65rem', cursor: 'pointer' }}
                  >
                    Clear Circuit
                  </button>
                )}
              </div>

              {/* Template shortcuts */}
              <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Bell State', code: 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\ncreg c[2];\nh q[0];\ncx q[0], q[1];\nmeasure q -> c;' },
                  { label: 'GHZ 3-Qubit', code: 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[3];\ncreg c[3];\nh q[0];\ncx q[0], q[1];\ncx q[1], q[2];\nmeasure q -> c;' },
                  { label: 'Superposition', code: 'OPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[1];\ncreg c[1];\nh q[0];\nmeasure q[0] -> c[0];' },
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCircuitQasm(tmpl.code)}
                    style={{
                      background: '#C1F8FF',
                      color: '#1F1F1F',
                      border: '1.5px solid #000',
                      borderRadius: '3px',
                      padding: '2px 6px',
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + {tmpl.label}
                  </button>
                ))}
              </div>

              <textarea
                value={circuitQasm}
                onChange={(e) => setCircuitQasm(e.target.value)}
                placeholder={'// Enter OpenQASM code here\nOPENQASM 2.0;\ninclude "qelib1.inc";\nqreg q[2];\nh q[0];\ncx q[0], q[1];'}
                rows={3}
                style={{
                  width: '100%',
                  background: '#FFFFFF',
                  border: '1.5px solid #000000',
                  borderRadius: '3px',
                  color: '#1F1F1F',
                  padding: '0.5rem',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  background: '#FFFFFF',
                  color: '#1F1F1F',
                  border: '2px solid #000000',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  borderRadius: '3px',
                  boxShadow: '2px 2px 0px #000000',
                }}
              >
                {SUBMIT_SIGNAL_STRINGS.CLOSE_BTN}
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  background: submitting ? '#CCC' : '#FFC83B',
                  color: '#1F1F1F',
                  border: '2px solid #000000',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 900,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  borderRadius: '3px',
                  boxShadow: submitting ? 'none' : '3px 3px 0px #000000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Send size={14} />
                <span>{submitting ? SUBMIT_SIGNAL_STRINGS.SUBMITTING_BTN : SUBMIT_SIGNAL_STRINGS.SUBMIT_BTN}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
