import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BatchImportSignalsModal from './BatchImportSignalsModal';
import * as portalApi from '../api/portalApi';
import { IMPORT_STRINGS } from '../constants/portalConstants';

const mockImportResponse: portalApi.BatchImportResponse = {
  total_received: 2,
  imported_count: 2,
  skipped_count: 0,
  results: [
    {
      index: 0,
      title: 'Quantum Volume 512 on Heavy-Hex Superconducting Architecture',
      status: 'imported',
      id: 'sig-import-1'
    },
    {
      index: 1,
      title: 'Scalable Surface Code Synergies with Neutral Atom Traps',
      status: 'imported',
      id: 'sig-import-2'
    }
  ]
};

describe('BatchImportSignalsModal Component', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <BatchImportSignalsModal
        isOpen={false}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );
    expect(screen.queryByTestId('batch-import-modal')).toBeNull();
  });

  it('renders modal structure with title and default paste tab when isOpen is true', () => {
    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('batch-import-modal')).toBeInTheDocument();
    expect(screen.getByText(IMPORT_STRINGS.MODAL_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId('tab-import-paste')).toBeInTheDocument();
    expect(screen.getByTestId('tab-import-file')).toBeInTheDocument();
    expect(screen.getByTestId('tab-import-syndication')).toBeInTheDocument();
    expect(screen.getByTestId('raw-bibtex-input')).toBeInTheDocument();
  });

  it('switches between Paste, File Upload, and Syndication Feeds tabs', () => {
    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    // Switch to File Upload Tab
    fireEvent.click(screen.getByTestId('tab-import-file'));
    expect(screen.getByText(IMPORT_STRINGS.DRAG_DROP_PROMPT)).toBeInTheDocument();
    expect(screen.queryByTestId('raw-bibtex-input')).toBeNull();

    // Switch to Syndication Feeds Tab
    fireEvent.click(screen.getByTestId('tab-import-syndication'));
    expect(screen.getByText(IMPORT_STRINGS.RSS_FEED_TITLE)).toBeInTheDocument();
    expect(screen.getByText(IMPORT_STRINGS.BIBTEX_FEED_TITLE)).toBeInTheDocument();

    // Switch back to Paste Tab
    fireEvent.click(screen.getByTestId('tab-import-paste'));
    expect(screen.getByTestId('raw-bibtex-input')).toBeInTheDocument();
  });

  it('submits raw BibTeX string and renders success KPI summary', async () => {
    const batchImportSpy = vi
      .spyOn(portalApi, 'batchImportSignals')
      .mockResolvedValue(mockImportResponse);

    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByTestId('raw-bibtex-input');
    const sampleBibtex = `@article{quantum2026, title={Quantum Volume 512}, author={Smith, Alice}, year={2026}}`;

    fireEvent.change(textarea, { target: { value: sampleBibtex } });
    const submitBtn = screen.getByTestId('submit-batch-import-btn');
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(batchImportSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          raw_bibtex: sampleBibtex,
          format: 'bibtex',
          default_section: 'papers'
        }),
        expect.any(String)
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('import-results-summary')).toBeInTheDocument();
      expect(screen.getByText(IMPORT_STRINGS.IMPORT_SUCCESS)).toBeInTheDocument();
      expect(screen.getByTestId('imported-count-result')).toHaveTextContent('2');
      expect(mockOnSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('handles and displays error message when API call fails', async () => {
    vi.spyOn(portalApi, 'batchImportSignals').mockRejectedValue(
      new Error('Invalid BibTeX syntax on line 4')
    );

    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const textarea = screen.getByTestId('raw-bibtex-input');
    fireEvent.change(textarea, { target: { value: 'invalid syntax data' } });
    fireEvent.click(screen.getByTestId('submit-batch-import-btn'));

    await waitFor(() => {
      expect(screen.getByText('Invalid BibTeX syntax on line 4')).toBeInTheDocument();
    });
  });

  it('allows copying RSS and BibTeX syndication URLs to clipboard', async () => {
    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('tab-import-syndication'));

    const copyButtons = screen.getAllByText(IMPORT_STRINGS.COPY_FEED_URL);
    expect(copyButtons.length).toBe(2);

    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('triggers onClose when close button is clicked', () => {
    render(
      <BatchImportSignalsModal
        isOpen={true}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    fireEvent.click(screen.getByTestId('close-import-modal'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
