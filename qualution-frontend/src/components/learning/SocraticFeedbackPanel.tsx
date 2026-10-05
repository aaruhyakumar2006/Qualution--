import React, { useState, useRef, useEffect } from 'react';
import type { AssessmentEvaluationResult } from '../../features/learning/assessmentEngine';
import { fetchSocraticReply } from '../../services/marioEngineApi';

interface Props {
  result: AssessmentEvaluationResult;
  assessmentId?: string;
}

interface Msg { role: 'educator' | 'student'; text: string; provider?: string; }

export const SocraticFeedbackPanel: React.FC<Props> = ({ result, assessmentId }) => {
  const primaryHint = result.hints[0] ?? null;
  const secondaryHints = result.hints.slice(1);

  const [messages, setMessages] = useState<Msg[]>(() =>
    primaryHint ? [{ role: 'educator', text: primaryHint }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecondary, setShowSecondary] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastEducatorQ = useRef<string>(primaryHint ?? '');

  useEffect(() => {
    if (primaryHint) {
      setMessages([{ role: 'educator', text: primaryHint }]);
      lastEducatorQ.current = primaryHint;
      setInput('');
      setLoading(false);
      setShowSecondary(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.summary]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function submit() {
    const t = input.trim();
    if (!t || loading) return;
    const studentMsg: Msg = { role: 'student', text: t };
    setMessages(prev => [...prev, studentMsg]);
    setInput('');
    setLoading(true);

    const { reply, provider } = await fetchSocraticReply(
      lastEducatorQ.current,
      t,
      result.summary
    );

    const eduMsg: Msg = { role: 'educator', text: reply, provider };
    lastEducatorQ.current = reply;
    setMessages(prev => [...prev, eduMsg]);
    setLoading(false);
  }

  const isGrover = assessmentId?.toLowerCase().includes('grover');
  const accent = isGrover ? '#ff0055' : '#6366f1';
  const accentFaint = isGrover ? 'rgba(255,0,85,0.35)' : 'rgba(99,102,241,0.35)';

  const bubbleStyle = (role: 'educator' | 'student') => ({
    maxWidth: '82%',
    background: role === 'educator' ? 'rgba(99,102,241,0.08)' : 'rgba(51,65,85,0.45)',
    border: role === 'educator' ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(71,85,105,0.35)',
    borderRadius: role === 'educator' ? '2px 8px 8px 8px' : '8px 2px 8px 8px',
    padding: '8px 11px',
    fontSize: '12px',
    color: role === 'educator' ? '#c7d2fe' : '#cbd5e1',
    lineHeight: '1.65',
  });

  const avatarStyle = (role: 'educator' | 'student') => ({
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0 as const,
    background: role === 'educator'
      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
      : 'linear-gradient(135deg,#334155,#475569)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '9px', fontWeight: 800 as const, color: '#fff',
  });

  return (
    <div
      data-testid='socratic-feedback-panel'
      style={{
        background: 'rgba(4,12,28,0.97)',
        border: '1px solid ' + accentFaint,
        borderLeft: '3px solid ' + accent,
        borderRadius: '6px',
        padding: '14px 16px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '400px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.01em' }}>
          {result.title}
        </span>
        <span style={{
          fontSize: '10px', background: 'rgba(99,102,241,0.14)', color: '#a5b4fc',
          borderRadius: '4px', padding: '1px 7px', fontFamily: 'monospace',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>Guided Review</span>
        <span style={{
          marginLeft: 'auto', fontSize: '10px', color: '#34d399',
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '4px', padding: '2px 8px', fontFamily: 'monospace',
          fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
          NVIDIA NIM ACTIVE
        </span>
      </div>

      {/* Summary */}
      <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.55' }}>
        {result.summary}
      </p>

      {/* Dialogue thread */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{ display: 'flex', flexDirection: msg.role === 'educator' ? 'row' : 'row-reverse', gap: '8px', alignItems: 'flex-start' }}
          >
            <div style={avatarStyle(msg.role)}>{msg.role === 'educator' ? 'EDU' : 'YOU'}</div>
            <div style={bubbleStyle(msg.role)}>
              {msg.text}
              {msg.provider && msg.provider !== 'static' && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  marginTop: '6px', fontSize: '9.5px', color: '#818cf8',
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '3px', padding: '1px 6px', fontFamily: 'monospace', fontWeight: 600
                }}>
                  ⚡ VIA NVIDIA NIM
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={avatarStyle('educator')}>EDU</div>
            <div style={{ ...bubbleStyle('educator'), display: 'flex', gap: '4px', alignItems: 'center', padding: '12px 14px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: '#6366f1',
                  animation: 'socratic-pulse 1.2s ease-in-out infinite',
                  animationDelay: `${i * 0.2}s`,
                  opacity: 0.7,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Secondary hints */}
        {secondaryHints.length > 0 && !showSecondary && !loading && (
          <button
            onClick={() => setShowSecondary(true)}
            style={{
              alignSelf: 'flex-start', background: 'none', border: 'none',
              color: '#6366f1', fontSize: '11px', cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: '3px', padding: '2px 0',
            }}
          >
            Request an additional observation ({secondaryHints.length})
          </button>
        )}
        {showSecondary && secondaryHints.map((h, i) => (
          <div key={'s' + i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <div style={avatarStyle('educator')}>EDU</div>
            <div style={{
              ...bubbleStyle('educator'),
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.14)',
              color: '#a5b4fc',
            }}>{h}</div>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div style={{ borderTop: '1px solid rgba(99,102,241,0.15)', paddingTop: '10px', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          disabled={loading}
          placeholder={loading ? 'Waiting for response...' : 'Share your reasoning here. Press Enter to submit, Shift+Enter for a new line.'}
          rows={2}
          style={{
            flex: 1,
            background: 'rgba(15,23,42,0.85)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '6px',
            color: loading ? '#475569' : '#e2e8f0',
            fontSize: '12px',
            padding: '7px 10px',
            resize: 'none',
            outline: 'none',
            lineHeight: '1.5',
            fontFamily: 'inherit',
            cursor: loading ? 'not-allowed' : 'text',
          }}
        />
        <button
          onClick={submit}
          disabled={!input.trim() || loading}
          style={{
            background: (!input.trim() || loading) ? 'rgba(51,65,85,0.35)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            border: 'none', borderRadius: '6px',
            color: (!input.trim() || loading) ? '#475569' : '#fff',
            fontSize: '11px', fontWeight: 700,
            padding: '9px 16px',
            cursor: (!input.trim() || loading) ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap', letterSpacing: '0.04em',
          }}
        >{loading ? '...' : 'Submit'}</button>
      </div>

      <style>{`
        @keyframes socratic-pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
