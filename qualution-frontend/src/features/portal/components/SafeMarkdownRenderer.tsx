import React from 'react';
import ReactMarkdown from 'react-markdown';

interface SafeMarkdownRendererProps {
  content: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Validates that an href protocol is safely http or https.
 */
function isSafeUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return /^https?:\/\//i.test(url);
  }
}

/**
 * Safe markdown renderer:
 * - Sanitizes content and renders without dangerouslySetInnerHTML.
 * - Restricts hyperlinks to strictly http/https schemes.
 * - Forces target="_blank" and rel="noopener noreferrer".
 * - Scripts and raw HTML tags are treated as inert text.
 */
export const SafeMarkdownRenderer: React.FC<SafeMarkdownRendererProps> = ({
  content,
  className,
  style,
}) => {
  return (
    <div
      className={className}
      style={{
        lineHeight: 1.6,
        wordBreak: 'break-word',
        ...style,
      }}
      data-testid="safe-markdown-container"
    >
      <ReactMarkdown
        components={{
          // Disable image rendering: no <img> elements from user content
          img: ({ alt }) => (
            <span
              style={{
                color: '#64748b',
                fontSize: '0.875em',
                fontStyle: 'italic',
                display: 'inline-block',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              {alt ? `[Image: ${alt}]` : '[Image omitted]'}
            </span>
          ),
          // Render safe links
          a: ({ href, children, ...props }) => {
            if (isSafeUrl(href)) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'underline',
                    textUnderlineOffset: '3px',
                  }}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            // If unsafe protocol (e.g. javascript:), render text only
            return <span>{children}</span>;
          },
          // Format blockquotes nicely
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: '3px solid #38bdf8',
                paddingLeft: '1rem',
                margin: '1rem 0',
                color: '#94a3b8',
                fontStyle: 'italic',
              }}
            >
              {children}
            </blockquote>
          ),
          // Code blocks
          code: ({ children }) => (
            <code
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                color: '#38bdf8',
                padding: '0.15rem 0.35rem',
                borderRadius: '4px',
                fontSize: '0.875em',
                fontFamily: 'monospace',
              }}
            >
              {children}
            </code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
