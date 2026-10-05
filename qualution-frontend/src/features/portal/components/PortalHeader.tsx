import React from 'react';

export interface PortalHeaderProps {
  title?: string;
  subtitle?: string;
  onNavigateHome?: () => void;
}

export const PortalHeader: React.FC<PortalHeaderProps> = ({
  title = 'Portal',
  subtitle = 'Community & Telemetry Portal',
  onNavigateHome,
}) => {
  return (
    <header
      style={{
        width: '100%',
        padding: '1.25rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
            {subtitle}
          </p>
        )}
      </div>
      {onNavigateHome && (
        <button
          onClick={onNavigateHome}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#e2e8f0',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background 0.2s',
          }}
        >
          Back to Hub
        </button>
      )}
    </header>
  );
};
