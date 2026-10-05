/**
 * Portal Research Brief Export Service
 * Generates structured Markdown, JSON, BibTeX citations, and HTML Research Digests
 * for saved telemetry signals and research collections.
 */

export interface ExportableSignal {
  id: string;
  title: string;
  source: string;
  source_tier?: number;
  section?: string;
  published_at?: string;
  canonical_url: string;
  summary?: string;
  abstract?: string;
  level?: string;
  tags?: string[];
  curriculum_tags?: string[];
  enriched?: boolean;
  author_display_name?: string;
  author_role?: string;
  circuit_qasm?: string;
}

/**
 * Generates an academic Markdown Research Brief
 */
export function generateMarkdownBrief(collectionName: string, items: ExportableSignal[]): string {
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# QUALUTION Quantum Telemetry Research Brief\n\n`;
  md += `**Collection:** ${collectionName}  \n`;
  md += `**Generated:** ${dateStr} (${timestamp})  \n`;
  md += `**Signals Included:** ${items.length} signals  \n\n`;
  md += `---\n\n`;

  md += `## Executive Summary\n\n`;
  md += `This curated research brief aggregates real-time quantum telemetry signals, academic preprints, and hardware milestones compiled via the QUALUTION Telemetry Portal.\n\n`;

  md += `## Curated Signals & Papers\n\n`;

  items.forEach((item, index) => {
    const num = index + 1;
    const date = item.published_at ? item.published_at.substring(0, 10) : 'Recent';
    const authors = item.author_display_name ? `by **${item.author_display_name}**` : `via **${item.source}**`;
    const level = item.level ? ` \`[${item.level}]\`` : '';
    const section = item.section ? ` \`#${item.section.toUpperCase()}\`` : '';
    const summaryText = item.summary || item.abstract || 'No abstract available.';

    md += `### ${num}. ${item.title}\n\n`;
    md += `- **Source:** [${item.source}](${item.canonical_url}) ${authors}${level}${section}\n`;
    md += `- **Published:** ${date}\n`;
    if (item.tags && item.tags.length > 0) {
      md += `- **Tags:** ${item.tags.map(t => `\`${t}\``).join(', ')}\n`;
    }
    if (item.curriculum_tags && item.curriculum_tags.length > 0) {
      md += `- **Curriculum Alignments:** ${item.curriculum_tags.map(ct => `\`⚛ ${ct}\``).join(', ')}\n`;
    }

    md += `\n**Key Findings / Abstract:**\n\n>${summaryText.replace(/\n/g, '\n> ')}\n\n`;

    if (item.circuit_qasm) {
      md += `**OpenQASM 2.0 Circuit Specification:**\n\n\`\`\`qasm\n${item.circuit_qasm}\n\`\`\`\n\n`;
    }

    md += `---\n\n`;
  });

  md += `## References & Direct Citations\n\n`;
  items.forEach((item, idx) => {
    md += `${idx + 1}. ${item.author_display_name || item.source} (${item.published_at ? item.published_at.substring(0, 4) : '2026'}). *${item.title}*. Available at: <${item.canonical_url}>\n`;
  });

  md += `\n\n*QUALUTION Quantum Education & Telemetry Platform — SIH 2026*\n`;
  return md;
}

/**
 * Generates formatted BibTeX citations
 */
export function generateBibtexCitations(items: ExportableSignal[]): string {
  return items.map((item, idx) => {
    const year = item.published_at ? item.published_at.substring(0, 4) : '2026';
    const cleanKey = `qualution_${(item.source || 'signal').toLowerCase().replace(/[^a-z0-9]/g, '')}_${year}_${idx + 1}`;
    const author = item.author_display_name || (item.source ? `${item.source} Telemetry Network` : 'QUALUTION Consortium');
    const note = item.summary ? item.summary.replace(/[{}"\\]/g, '').substring(0, 200) + '...' : '';

    return `@misc{${cleanKey},
  title = {${item.title.replace(/[{}"\\]/g, '')}},
  author = {${author}},
  year = {${year}},
  howpublished = {\\url{${item.canonical_url}}},
  note = {${note}}
}`;
  }).join('\n\n');
}

/**
 * Generates a clean JSON telemetry dataset
 */
export function generateJsonBrief(collectionName: string, items: ExportableSignal[]): string {
  const payload = {
    brief_title: `QUALUTION Telemetry Brief: ${collectionName}`,
    exported_at: new Date().toISOString(),
    signal_count: items.length,
    signals: items.map(item => ({
      id: item.id,
      title: item.title,
      source: item.source,
      source_tier: item.source_tier,
      section: item.section,
      published_at: item.published_at,
      canonical_url: item.canonical_url,
      summary: item.summary || item.abstract,
      level: item.level,
      tags: item.tags || [],
      curriculum_tags: item.curriculum_tags || [],
      circuit_qasm: item.circuit_qasm || null,
      author: item.author_display_name || item.source,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Generates standalone printable HTML Digest
 */
export function generateHtmlDigest(collectionName: string, items: ExportableSignal[]): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const signalCardsHtml = items.map((item, idx) => {
    const date = item.published_at ? item.published_at.substring(0, 10) : 'Recent';
    const tagsHtml = (item.tags || []).map(t => `<span class="tag">${t}</span>`).join(' ');
    const curricHtml = (item.curriculum_tags || []).map(ct => `<span class="tag tag-curric">⚛ ${ct}</span>`).join(' ');

    return `
    <article class="card">
      <div class="card-meta">
        <span class="card-num">#${idx + 1}</span>
        <span class="card-section">${(item.section || 'NEWS').toUpperCase()}</span>
        <span class="card-source">${item.source}</span>
        <span class="card-date">${date}</span>
      </div>
      <h2 class="card-title">${item.title}</h2>
      <p class="card-summary">${item.summary || item.abstract || 'No summary available.'}</p>
      <div class="card-tags">
        ${tagsHtml}
        ${curricHtml}
      </div>
      <div class="card-footer">
        <a href="${item.canonical_url}" target="_blank" rel="noopener noreferrer">Source URL: ${item.canonical_url}</a>
      </div>
    </article>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QUALUTION Research Digest — ${collectionName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace, sans-serif;
      background: #FFFDF9;
      color: #1F1F1F;
      margin: 0;
      padding: 2rem;
      line-height: 1.5;
    }
    header {
      border-bottom: 3px solid #1F1F1F;
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    h1 {
      margin: 0 0 0.5rem 0;
      font-size: 1.8rem;
      font-weight: 900;
      text-transform: uppercase;
    }
    .meta-info {
      font-family: monospace;
      font-size: 0.85rem;
      color: #555;
    }
    .card {
      background: #FFF;
      border: 2px solid #1F1F1F;
      box-shadow: 4px 4px 0px #1F1F1F;
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: monospace;
      font-size: 0.75rem;
      font-weight: bold;
      margin-bottom: 0.5rem;
    }
    .card-num {
      background: #FFC83B;
      padding: 1px 6px;
      border: 1px solid #1F1F1F;
    }
    .card-section {
      background: #C1F8FF;
      padding: 1px 6px;
      border: 1px solid #1F1F1F;
    }
    .card-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.15rem;
      font-weight: 800;
    }
    .card-summary {
      font-size: 0.9rem;
      color: #333;
      margin-bottom: 0.75rem;
    }
    .card-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }
    .tag {
      font-family: monospace;
      font-size: 0.7rem;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .tag-curric {
      background: #E8FDE8;
      border-color: #86EFAC;
      color: #166534;
      font-weight: bold;
    }
    .card-footer a {
      font-family: monospace;
      font-size: 0.75rem;
      color: #0284C7;
      word-break: break-all;
    }
    @media print {
      body { padding: 0.5rem; }
      .card { box-shadow: none; border: 1px solid #333; }
    }
  </style>
</head>
<body>
  <header>
    <h1>QUALUTION Quantum Telemetry Digest</h1>
    <div class="meta-info">
      Collection: <strong>${collectionName}</strong> &bull; Date: ${dateStr} &bull; Total Signals: ${items.length}
    </div>
  </header>
  <main>
    ${signalCardsHtml}
  </main>
</body>
</html>`;
}

/**
 * Triggers a client-side file download
 */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
