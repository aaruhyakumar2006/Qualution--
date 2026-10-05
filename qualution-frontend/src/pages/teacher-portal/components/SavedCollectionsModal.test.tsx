import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavedCollectionsModal from './SavedCollectionsModal';
import { COLLECTION_STRINGS, EXPORT_STRINGS } from '../constants/portalConstants';
import * as exportService from '../../../services/portalExportService';

describe('SavedCollectionsModal Component (Phase 7)', () => {
  const mockItems = [
    {
      id: 'sig-01',
      title: 'Quantum Advantage with 100+ Qubits',
      source: 'Nature Quantum',
      section: 'research',
      published_at: '2026-09-01T00:00:00Z',
      canonical_url: 'https://nature.com/articles/q1',
      summary: 'Demonstrates quantum supremacy in random circuit sampling.',
      curriculum_tags: ['Superposition'],
    },
    {
      id: 'sig-02',
      title: 'Cryogenic CMOS Controller Breakthrough',
      source: 'IEEE Spectrum',
      section: 'hardware',
      published_at: '2026-08-15T00:00:00Z',
      canonical_url: 'https://ieee.org/cmos',
      summary: 'Low-power 4K controller chips reduce thermal load.',
      curriculum_tags: ['Hardware'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <SavedCollectionsModal
        isOpen={false}
        onClose={vi.fn()}
        savedIds={new Set(['sig-01'])}
        onUnsave={vi.fn()}
        allItems={mockItems}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all saved signals and tabs when open', () => {
    render(
      <SavedCollectionsModal
        isOpen={true}
        onClose={vi.fn()}
        savedIds={new Set(['sig-01', 'sig-02'])}
        onUnsave={vi.fn()}
        allItems={mockItems}
      />
    );

    expect(screen.getByText(COLLECTION_STRINGS.PANEL_TITLE)).toBeDefined();
    expect(screen.getByText('Quantum Advantage with 100+ Qubits')).toBeDefined();
    expect(screen.getByText('Cryogenic CMOS Controller Breakthrough')).toBeDefined();
    expect(screen.getByText(/All Bookmarks \(2\)/)).toBeDefined();
  });

  it('creates a new custom collection and switches active tab', async () => {
    render(
      <SavedCollectionsModal
        isOpen={true}
        onClose={vi.fn()}
        savedIds={new Set(['sig-01', 'sig-02'])}
        onUnsave={vi.fn()}
        allItems={mockItems}
      />
    );

    // Click new collection button
    const createBtn = screen.getByText(COLLECTION_STRINGS.CREATE_COLLECTION_BTN);
    fireEvent.click(createBtn);

    const input = screen.getByPlaceholderText(COLLECTION_STRINGS.COLLECTION_NAME_PLACEHOLDER);
    fireEvent.change(input, { target: { value: 'Hardware Benchmarks' } });

    const saveBtn = screen.getByText('Save');
    fireEvent.click(saveBtn);

    // Verify new tab exists
    expect(screen.getAllByText(/Hardware Benchmarks/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Hardware Benchmarks \(2\)/)).toBeDefined();
  });

  it('triggers downloadBlob when exporting Markdown brief', () => {
    const downloadSpy = vi.spyOn(exportService, 'downloadBlob').mockImplementation(() => {});

    render(
      <SavedCollectionsModal
        isOpen={true}
        onClose={vi.fn()}
        savedIds={new Set(['sig-01'])}
        onUnsave={vi.fn()}
        allItems={mockItems}
      />
    );

    const exportBtn = screen.getByText(EXPORT_STRINGS.EXPORT_BTN);
    fireEvent.click(exportBtn);

    const mdBtn = screen.getByText(EXPORT_STRINGS.EXPORT_MARKDOWN);
    fireEvent.click(mdBtn);

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    expect(downloadSpy.mock.calls[0][1]).toContain('.md');
  });

  it('calls onUnsave when remove bookmark button is clicked', () => {
    const handleUnsave = vi.fn();

    render(
      <SavedCollectionsModal
        isOpen={true}
        onClose={vi.fn()}
        savedIds={new Set(['sig-01'])}
        onUnsave={handleUnsave}
        allItems={mockItems}
      />
    );

    const removeBtn = screen.getByTitle('Remove bookmark');
    fireEvent.click(removeBtn);

    expect(handleUnsave).toHaveBeenCalledWith('sig-01');
  });
});
