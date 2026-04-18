import { describe, expect, it } from '@jest/globals';

import {
  resolveWikiCompilationSettings,
  shouldAutoApplyWikiContradiction,
} from '../agent-config';

describe('agent-config wiki compilation settings', () => {
  it('derives hybrid contradiction routing from metadata-backed policy', () => {
    const settings = resolveWikiCompilationSettings({
      wiki_auto_publish: true,
      wiki_stale_threshold_days: 45,
      metadata: {
        wiki_compilation_review_policy: {
          hybrid_auto_publish_enabled: true,
          hybrid_max_contradictions_for_auto_publish: 2,
          hybrid_min_confidence_delta_for_auto_publish: 0.05,
        },
      },
    });

    expect(settings).toEqual({
      wikiAutoPublish: true,
      wikiStaleThresholdDays: 45,
      contradictionReviewMode: 'hybrid',
      hybridAutoPublish: {
        enabled: true,
        maxContradictionsForAutoPublish: 2,
        minConfidenceDeltaForAutoPublish: 0.05,
      },
    });
  });

  it('keeps manual review authoritative when legacy auto-publish is off', () => {
    const settings = resolveWikiCompilationSettings({
      wiki_auto_publish: false,
      wiki_stale_threshold_days: 90,
      metadata: {
        wiki_compilation_review_policy: {
          hybrid_auto_publish_enabled: true,
          hybrid_max_contradictions_for_auto_publish: 3,
          hybrid_min_confidence_delta_for_auto_publish: 0.02,
        },
      },
    });

    expect(settings.contradictionReviewMode).toBe('manual');
    expect(settings.hybridAutoPublish.enabled).toBe(false);
  });

  it('falls back to legacy auto mode when hybrid policy is absent', () => {
    const settings = resolveWikiCompilationSettings({
      wiki_auto_publish: true,
      wiki_stale_threshold_days: 90,
      metadata: {},
    });

    expect(settings.contradictionReviewMode).toBe('auto');
    expect(settings.hybridAutoPublish).toEqual({
      enabled: false,
      maxContradictionsForAutoPublish: 1,
      minConfidenceDeltaForAutoPublish: 0,
    });
  });

  it('applies hybrid thresholds only when both contradiction count and confidence delta pass', () => {
    const hybridSettings = resolveWikiCompilationSettings({
      wiki_auto_publish: true,
      wiki_stale_threshold_days: 90,
      metadata: {
        wiki_compilation_review_policy: {
          hybrid_auto_publish_enabled: true,
          hybrid_max_contradictions_for_auto_publish: 2,
          hybrid_min_confidence_delta_for_auto_publish: 0.05,
        },
      },
    });

    expect(
      shouldAutoApplyWikiContradiction(hybridSettings, {
        contradictionCount: 2,
        confidenceDelta: 0.06,
      }),
    ).toBe(true);

    expect(
      shouldAutoApplyWikiContradiction(hybridSettings, {
        contradictionCount: 3,
        confidenceDelta: 0.06,
      }),
    ).toBe(false);

    expect(
      shouldAutoApplyWikiContradiction(hybridSettings, {
        contradictionCount: 2,
        confidenceDelta: 0.01,
      }),
    ).toBe(false);

    expect(
      shouldAutoApplyWikiContradiction(hybridSettings, {
        contradictionCount: 0,
        confidenceDelta: 0.06,
      }),
    ).toBe(false);
  });
});
