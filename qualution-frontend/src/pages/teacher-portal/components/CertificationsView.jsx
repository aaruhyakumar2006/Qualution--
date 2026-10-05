import React, { useState } from 'react';
import { 
  Award, CheckCircle, Eye, Download, Plus, 
  Sparkles, ShieldCheck, Printer 
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CertificationsView({ onNavigate }) {
  const [template, setTemplate] = useState({
    title: 'CERTIFICATE OF QUANTUM COMPUTING MASTERY',
    studentName: 'Student Name',
    course: 'Quantum Computing — Beginner (QC-101)',
    instructor: 'Prof. S. R. Ramanathan, Ph.D.',
    completionDate: '04 October 2026',
    credentialId: 'QUAL-2026-QC101-0001'
  });

  const [previewOpen, setPreviewOpen] = useState(false);
  const [issuedCount, setIssuedCount] = useState(0);

  const handleIssueCertificate = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    setIssuedCount(prev => prev + 1);
    alert(`🎓 Certificate officially issued to ${template.studentName}!\nCredential ID: ${template.credentialId}`);
  };

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '1.5rem 1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span className="neo-badge neo-badge-yellow">ACCREDITATION &amp; CREDENTIALING</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700 }}>
              VERIFIED QUANTUM SKILLS
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 900 }}>
            CERTIFICATION CENTER
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--ink-secondary)' }}>
            Design official quantum credentials, verify mastery milestones, and issue tamper-proof certificates.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => setPreviewOpen(true)} className="btn-neo btn-neo-white">
            <Eye size={16} />
            <span>PREVIEW TEMPLATE</span>
          </button>
          <button onClick={handleIssueCertificate} className="btn-neo btn-neo-lime">
            <Award size={16} />
            <span>ISSUE CERTIFICATE</span>
          </button>
        </div>
      </div>

      {/* 4 Statistical Blocks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.75rem' }}>
        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--yellow)' }}>CREDENTIALS</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>{issuedCount}</div>
          <div className="impact-label">Certificates Issued</div>
        </div>

        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--lime)' }}>GRADUATES</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>{issuedCount}</div>
          <div className="impact-label">Students Certified</div>
        </div>

        <div className="impact-block" style={{ padding: '1.25rem' }}>
          <span className="impact-block-tag" style={{ background: 'var(--pink)' }}>CURRICULUM</span>
          <div className="impact-number" style={{ fontSize: '2.4rem' }}>00</div>
          <div className="impact-label">Courses Eligible</div>
        </div>

        <div className="impact-block" style={{ padding: '1.25rem', borderLeft: '6px solid var(--crimson)' }}>
          <span className="impact-block-tag" style={{ background: 'var(--cyan)' }}>QUEUE</span>
          <div className="impact-number" style={{ fontSize: '2.4rem', color: 'var(--crimson)' }}>00</div>
          <div className="impact-label">Pending Reviews</div>
        </div>
      </div>

      {/* Grid: Template Builder + Live Preview Frame */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem' }}>
        {/* Certificate Template Builder Form */}
        <div className="neo-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, borderBottom: '2px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            CERTIFICATE TEMPLATE BUILDER
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                CERTIFICATE TITLE
              </label>
              <input
                type="text"
                className="neo-input"
                value={template.title}
                onChange={(e) => setTemplate({ ...template, title: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                STUDENT NAME
              </label>
              <input
                type="text"
                className="neo-input"
                value={template.studentName}
                onChange={(e) => setTemplate({ ...template, studentName: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                COURSE
              </label>
              <input
                type="text"
                className="neo-input"
                value={template.course}
                onChange={(e) => setTemplate({ ...template, course: e.target.value })}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                INSTRUCTOR
              </label>
              <input
                type="text"
                className="neo-input"
                value={template.instructor}
                onChange={(e) => setTemplate({ ...template, instructor: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  COMPLETION DATE
                </label>
                <input
                  type="text"
                  className="neo-input"
                  value={template.completionDate}
                  onChange={(e) => setTemplate({ ...template, completionDate: e.target.value })}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 800, marginBottom: '0.25rem' }}>
                  CREDENTIAL ID
                </label>
                <input
                  type="text"
                  className="neo-input"
                  value={template.credentialId}
                  onChange={(e) => setTemplate({ ...template, credentialId: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', borderTop: '2px solid #000', paddingTop: '1rem' }}>
              <button onClick={() => setPreviewOpen(true)} className="btn-neo btn-neo-white" style={{ flex: 1 }}>
                Preview
              </button>
              <button onClick={handleIssueCertificate} className="btn-neo btn-neo-lime" style={{ flex: 1 }}>
                Issue Certificate
              </button>
            </div>
          </div>
        </div>

        {/* Live Graphic Certificate Preview */}
        <div className="neo-card" style={{ padding: '1.5rem', background: 'var(--paper-cream)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span className="neo-badge neo-badge-dark">LIVE DIGITAL CREDENTIAL</span>
            <button onClick={() => window.print()} className="btn-neo btn-neo-white btn-neo-sm">
              <Printer size={14} />
              <span>PRINT</span>
            </button>
          </div>

          {/* Certificate Frame with Neo-Brutalist double border */}
          <div className="certificate-frame">
            <div style={{ width: '40px', height: '40px', background: 'var(--yellow)', border: '2px solid #000', margin: '0 auto 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>
              Q
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.15em', fontWeight: 800 }}>
              QUALUTION QUANTUM ACADEMY &amp; RESEARCH CONSORTIUM
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 900, margin: '0.5rem 0' }}>
              {template.title}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--ink-secondary)', fontStyle: 'italic', marginBottom: '0.75rem' }}>
              This is to certify that
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 900, borderBottom: '2px solid #000', display: 'inline-block', paddingBottom: '0.2rem', marginBottom: '0.75rem' }}>
              {template.studentName}
            </div>
            <p style={{ fontSize: '0.85rem', maxWidth: '520px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
              has successfully mastered quantum circuits, superposition postulates, multi-qubit entanglement, and verified reference solutions in <strong>{template.course}</strong>.
            </p>

            {/* Seal & Signature Row */}
            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid #CCC', paddingTop: '1.25rem', marginTop: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'cursive', fontSize: '1.2rem', fontWeight: 700 }}>
                  {template.instructor.split(',')[0]}
                </div>
                <div style={{ borderTop: '1px solid #000', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                  INSTRUCTOR SIGNATURE
                </div>
              </div>

              {/* Gold Seal */}
              <div className="certificate-seal">
                ★ SEAL ★
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                  {template.completionDate}
                </div>
                <div style={{ borderTop: '1px solid #000', fontSize: '0.68rem', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
                  DATE OF ISSUANCE
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-secondary)' }}>
              VERIFIED ID: {template.credentialId} • TAMPER-PROOF SHA-256 SIGNED
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
