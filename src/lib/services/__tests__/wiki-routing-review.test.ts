import { describe, expect, it } from '@jest/globals';

import {
  approveWikiRoutingOverrideMetadata,
  buildCompileWikiDedupeKey,
  markWikiRoutingCompileCompletedMetadata,
  queueWikiRoutingReviewMetadata,
  readApprovedWikiRoutingOverride,
  readWikiRoutingReviewState,
  resolveWikiRouteForCompile,
  shouldQueueWikiRoutingReview,
  type WikiRoutingClassification,
} from '../wiki-routing-review';

const lowConfidenceClassification: WikiRoutingClassification = {
  app: null,
  screen: 'deal-router',
  topic: 'route-enterprise-leads',
  routingConfidence: 0.42,
  routingRationale: 'The transcript references multiple ownership flows.',
  ambiguous: true,
  ambiguityReasons: ['multiple routing outcomes described'],
};

describe('wiki-routing-review', () => {
  it('queues low-confidence or incomplete routing decisions before publish', () => {
    const decision = shouldQueueWikiRoutingReview(lowConfidenceClassification);

    expect(decision.requiresReview).toBe(true);
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        'low-confidence',
        'missing-app',
        'ambiguous-routing',
      ])
    );
  });

  it('persists a pending routing payload in content metadata', () => {
    const nextMetadata = queueWikiRoutingReviewMetadata(
      { existing: 'value' },
      {
        approvalId: 'approval-1',
        requestedAt: '2026-04-19T09:00:00.000Z',
        classification: lowConfidenceClassification,
        reviewReasons: ['low-confidence', 'missing-app'],
      }
    );

    const state = readWikiRoutingReviewState(nextMetadata);

    expect((nextMetadata as Record<string, unknown>).existing).toBe('value');
    expect(state.pendingReview).toMatchObject({
      approvalId: 'approval-1',
      status: 'pending',
      proposedRoute: {
        app: null,
        screen: 'deal-router',
        topic: 'route-enterprise-leads',
      },
      confidence: 0.42,
      rationale: 'The transcript references multiple ownership flows.',
      reviewReasons: ['low-confidence', 'missing-app'],
    });
    expect(state.auditLog.at(-1)).toMatchObject({
      kind: 'queued',
      approvalId: 'approval-1',
      route: {
        app: null,
        screen: 'deal-router',
        topic: 'route-enterprise-leads',
      },
    });
  });

  it('stores approved routing overrides for later compile runs', () => {
    const queuedMetadata = queueWikiRoutingReviewMetadata(
      {},
      {
        approvalId: 'approval-2',
        requestedAt: '2026-04-19T09:00:00.000Z',
        classification: lowConfidenceClassification,
        reviewReasons: ['low-confidence'],
      }
    );

    const approvedMetadata = approveWikiRoutingOverrideMetadata(queuedMetadata, {
      approvalId: 'approval-2',
      approvedAt: '2026-04-19T09:05:00.000Z',
      reviewedBy: 'user-1',
      route: {
        app: 'hubspot',
        screen: 'deal-record',
        topic: 'route-enterprise-leads',
      },
      note: 'Reviewer selected the canonical HubSpot deal screen.',
    });

    const state = readWikiRoutingReviewState(approvedMetadata);

    expect(state.pendingReview).toBeNull();
    expect(readApprovedWikiRoutingOverride(approvedMetadata)).toEqual({
      approvalId: 'approval-2',
      approvedAt: '2026-04-19T09:05:00.000Z',
      reviewedBy: 'user-1',
      note: 'Reviewer selected the canonical HubSpot deal screen.',
      route: {
        app: 'hubspot',
        screen: 'deal-record',
        topic: 'route-enterprise-leads',
      },
    });

    const resolved = resolveWikiRouteForCompile({
      metadata: approvedMetadata,
      classification: {
        ...lowConfidenceClassification,
        app: 'salesforce',
        screen: 'lead-queue',
        topic: 'route-enterprise-leads',
        routingConfidence: 0.91,
        ambiguous: false,
        ambiguityReasons: [],
      },
    });

    expect(resolved.source).toBe('approved-override');
    expect(resolved.route).toEqual({
      app: 'hubspot',
      screen: 'deal-record',
      topic: 'route-enterprise-leads',
    });
  });

  it('records the compiled route without discarding the approved override', () => {
    const approvedMetadata = approveWikiRoutingOverrideMetadata({}, {
      approvalId: 'approval-3',
      approvedAt: '2026-04-19T09:05:00.000Z',
      reviewedBy: 'user-2',
      route: {
        app: 'hubspot',
        screen: 'deal-record',
        topic: 'route-enterprise-leads',
      },
    });

    const compiledMetadata = markWikiRoutingCompileCompletedMetadata(
      approvedMetadata,
      {
        compiledAt: '2026-04-19T09:06:00.000Z',
        route: {
          app: 'hubspot',
          screen: 'deal-record',
          topic: 'route-enterprise-leads',
        },
        source: 'approved-override',
      }
    );

    const state = readWikiRoutingReviewState(compiledMetadata);

    expect(state.lastCompiledRoute).toMatchObject({
      source: 'approved-override',
      route: {
        app: 'hubspot',
        screen: 'deal-record',
        topic: 'route-enterprise-leads',
      },
    });
    expect(readApprovedWikiRoutingOverride(compiledMetadata)).not.toBeNull();
    expect(state.auditLog.at(-1)).toMatchObject({
      kind: 'compiled',
      source: 'approved-override',
    });
  });

  it('builds a reroute-safe compile dedupe key that differs from the initial enqueue path', () => {
    const initialKey = buildCompileWikiDedupeKey({
      recordingId: 'content-1',
    });

    const rerouteKey = buildCompileWikiDedupeKey({
      recordingId: 'content-1',
      reason: 'routing-review',
      enqueueToken: 'approval-4',
      route: {
        app: 'hubspot',
        screen: 'deal-record',
        topic: 'route-enterprise-leads',
      },
    });

    expect(initialKey).toBe('compile_wiki:content-1');
    expect(rerouteKey).toContain('compile_wiki:content-1:routing-review:approval-4');
    expect(rerouteKey).not.toBe(initialKey);
  });
});
