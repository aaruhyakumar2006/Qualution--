import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortalAnalyticsModal from './PortalAnalyticsModal';
import HardwareStatusBanner from './HardwareStatusBanner';
import * as portalApi from '../api/portalApi';
import { ANALYTICS_STRINGS, HARDWARE_STRINGS } from '../constants/portalConstants';

const mockOverviewData: portalApi.AnalyticsOverviewData = {
  total_signals: 42,
  verified_signals: 38,
  active_discussions: 18,
  total_peer_reviews: 35,
  avg_fidelity_score: 0.968,
  weekly_velocity_signals: 12,
  top_curriculum_tags: [
    { tag: 'c_grovers_search', count: 15, category: 'curriculum' },
    { tag: 'c_superposition', count: 12, category: 'curriculum' },
    { tag: 'c_bell_state', count: 10, category: 'curriculum' }
  ],
  section_breakdown: [
    { section_id: 'papers', section_name: 'Peer-Reviewed Papers', count: 18, percentage: 42.9 },
    { section_id: 'preprints', section_name: 'arXiv Preprints', count: 14, percentage: 33.3 },
    { section_id: 'hardware', section_name: 'Hardware Telemetry', count: 10, percentage: 23.8 }
  ],
  last_updated_iso: '2026-10-04T12:00:00Z'
};

const mockClustersData: portalApi.TopicClustersData = {
  clusters: [
    {
      id: 'cluster_qec',
      label: 'Fault-Tolerant Quantum Error Correction & Surface Codes',
      signal_count: 14,
      avg_relevance: 0.94,
      representative_keywords: ['surface code', 'syndrome', 'fault-tolerant'],
      sample_signal_ids: ['sig-1', 'sig-2']
    },
    {
      id: 'cluster_neutral_atoms',
      label: 'Neutral Atom & Optical Tweezer Architectures',
      signal_count: 9,
      avg_relevance: 0.91,
      representative_keywords: ['neutral atom', 'rydberg', 'optical tweezer'],
      sample_signal_ids: ['sig-3', 'sig-4']
    }
  ],
  edges: [
    {
      source: 'cluster_qec',
      target: 'cluster_neutral_atoms',
      weight: 0.72,
      shared_keywords: ['fidelity', 'coherence']
    }
  ],
  total_clustered_signals: 35,
  coverage_percentage: 83.3,
  computed_at_iso: '2026-10-04T12:00:00Z'
};

const mockHardwareStatus: portalApi.HardwareStatusSummary = {
  online_count: 4,
  total_count: 4,
  best_2q_fidelity: 99.85,
  lowest_queue_provider: 'NVIDIA cuQuantum',
  systems: []
};

describe('Portal Analytics & Research Topic Clustering (Phase 9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(portalApi, 'fetchPortalAnalyticsOverview').mockResolvedValue(mockOverviewData);
    vi.spyOn(portalApi, 'fetchTopicClusters').mockResolvedValue(mockClustersData);
    vi.spyOn(portalApi, 'fetchHardwareStatus').mockResolvedValue(mockHardwareStatus);
  });

  describe('HardwareStatusBanner Analytics Action', () => {
    it('triggers onOpenAnalyticsModal when Portal Analytics button is clicked', async () => {
      const handleOpenAnalytics = vi.fn();
      const handleOpenTelemetry = vi.fn();

      render(
        <HardwareStatusBanner
          onOpenTelemetryModal={handleOpenTelemetry}
          onOpenAnalyticsModal={handleOpenAnalytics}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Portal Analytics')).toBeInTheDocument();
      });

      const analyticsBtn = screen.getByTestId('open-analytics-btn');
      fireEvent.click(analyticsBtn);
      expect(handleOpenAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  describe('PortalAnalyticsModal Component', () => {
    it('renders null if isOpen is false', () => {
      const { container } = render(
        <PortalAnalyticsModal
          isOpen={false}
          onClose={vi.fn()}
          onSelectClusterTag={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });

    it('fetches overview data and displays live KPI metrics and tag distribution', async () => {
      render(
        <PortalAnalyticsModal
          isOpen={true}
          onClose={vi.fn()}
          onSelectClusterTag={vi.fn()}
        />
      );

      expect(screen.getByText(ANALYTICS_STRINGS.MODAL_TITLE)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId('metric-total-signals')).toHaveTextContent('42');
        expect(screen.getByTestId('metric-verified-signals')).toHaveTextContent('38');
        expect(screen.getByTestId('metric-discussions')).toHaveTextContent('18');
        expect(screen.getByTestId('metric-peer-reviews')).toHaveTextContent('35');
        expect(screen.getByTestId('metric-avg-fidelity')).toHaveTextContent('96.8%');
        expect(screen.getByTestId('metric-weekly-velocity')).toHaveTextContent('+12');
      });

      // Check curriculum tag and section items
      expect(screen.getByText('#c_grovers_search')).toBeInTheDocument();
      expect(screen.getByText('Peer-Reviewed Papers')).toBeInTheDocument();
      expect(screen.getByText('42.9%')).toBeInTheDocument();
    });

    it('switches to clusters tab, renders topic cluster cards and filters on click', async () => {
      const handleSelectTag = vi.fn();
      const handleClose = vi.fn();

      render(
        <PortalAnalyticsModal
          isOpen={true}
          onClose={handleClose}
          onSelectClusterTag={handleSelectTag}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('tab-analytics-clusters')).toBeInTheDocument();
      });

      // Switch to Clusters Tab
      fireEvent.click(screen.getByTestId('tab-analytics-clusters'));

      await waitFor(() => {
        expect(screen.getByText('Fault-Tolerant Quantum Error Correction & Surface Codes')).toBeInTheDocument();
        expect(screen.getByText('Neutral Atom & Optical Tweezer Architectures')).toBeInTheDocument();
        expect(screen.getByText('83.3%')).toBeInTheDocument();
      });

      // Click filter cluster button
      const filterBtn = screen.getByTestId('filter-cluster-btn-cluster_qec');
      fireEvent.click(filterBtn);

      expect(handleSelectTag).toHaveBeenCalledWith('surface code');
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when close button is clicked', async () => {
      const handleClose = vi.fn();

      render(
        <PortalAnalyticsModal
          isOpen={true}
          onClose={handleClose}
          onSelectClusterTag={vi.fn()}
        />
      );

      const closeBtn = screen.getByTestId('close-analytics-modal');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
