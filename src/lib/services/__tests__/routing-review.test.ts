import { expect, test } from '@jest/globals';

const assert = {
  deepEqual: (actual: unknown, expected: unknown) => expect(actual).toEqual(expected),
  equal: (actual: unknown, expected: unknown) => expect(actual).toBe(expected),
  ok(actual: unknown): asserts actual {
    expect(actual).toBeTruthy();
  },
};

import {
  buildRoutingCompileWikiDedupeKey,
  determineRoutingReviewDecisionAction,
  getApprovedRoutingOverride,
  parseRoutingReviewProposedAction,
  parseRoutingReviewState,
  requiresRoutingReview,
  writeRoutingReviewState,
} from '../routing-review';

test('requiresRoutingReview flags missing assignments and low-confidence routes', () => {
  assert.equal(
    requiresRoutingReview({
      topic: 'assign-owner',
      app: null,
      screen: 'contact-record',
      routeConfidence: 0.92,
    }),
    true
  );

  assert.equal(
    requiresRoutingReview({
      topic: 'assign-owner',
      app: 'hubspot',
      screen: 'contact-record',
      routeConfidence: 0.51,
    }),
    true
  );

  assert.equal(
    requiresRoutingReview({
      topic: 'assign-owner',
      app: 'hubspot',
      screen: 'contact-record',
      routeConfidence: 0.91,
    }),
    false
  );
});

test('writeRoutingReviewState round-trips approved overrides', () => {
  const metadata = writeRoutingReviewState(
    { existing: 'value' },
    {
      status: 'approved',
      approvalId: 'approval-1',
      requestedAt: '2026-04-19T04:00:00.000Z',
      reviewedAt: '2026-04-19T04:05:00.000Z',
      reviewedBy: 'user-1',
      rejectionReason: null,
      routeConfidence: 0.44,
      routeReason: 'The transcript mentions multiple queue views.',
      proposedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: null,
      },
      approvedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
      decisionVersion: 1,
      lastAction: 'reroute',
      history: [
        {
          version: 1,
          action: 'reroute',
          decidedAt: '2026-04-19T04:05:00.000Z',
          decidedBy: 'user-1',
          approvalId: 'approval-1',
          rejectionReason: null,
          routeConfidence: 0.44,
          routeReason: 'The transcript mentions multiple queue views.',
          proposedRoute: {
            topic: 'assign-owner',
            app: 'hubspot',
            screen: null,
          },
          approvedRoute: {
            topic: 'assign-owner',
            app: 'hubspot',
            screen: 'contact-record',
          },
        },
      ],
    }
  );

  const parsed = parseRoutingReviewState(metadata);
  if (!parsed) throw new Error('Expected routing review state');
  assert.equal(parsed.status, 'approved');
  assert.equal(parsed.decisionVersion, 1);
  assert.equal(parsed.lastAction, 'reroute');
  assert.equal(parsed.history.length, 1);
  assert.deepEqual(parsed.approvedRoute, {
    topic: 'assign-owner',
    app: 'hubspot',
    screen: 'contact-record',
  });
  assert.deepEqual(getApprovedRoutingOverride(metadata), {
    topic: 'assign-owner',
    app: 'hubspot',
    screen: 'contact-record',
  });
});

test('parseRoutingReviewProposedAction validates the approval payload shape', () => {
  const parsed = parseRoutingReviewProposedAction({
    kind: 'routing_review',
    contentId: 'content-1',
    contentTitle: 'Owner assignment walkthrough',
    routeConfidence: 0.42,
    routeReason: 'The app is clear but the screen is ambiguous.',
    proposedRoute: {
      topic: 'assign-owner',
      app: 'hubspot',
      screen: null,
    },
  });

  if (!parsed) throw new Error('Expected routing review proposed action');
  assert.equal(parsed.contentId, 'content-1');
  assert.equal(parsed.routeConfidence, 0.42);
  assert.deepEqual(parsed.proposedRoute, {
    topic: 'assign-owner',
    app: 'hubspot',
    screen: null,
  });
});

test('determineRoutingReviewDecisionAction distinguishes approve, reroute, and reject', () => {
  assert.equal(
    determineRoutingReviewDecisionAction({
      status: 'approved',
      proposedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
      approvedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
    }),
    'approve'
  );

  assert.equal(
    determineRoutingReviewDecisionAction({
      status: 'approved',
      proposedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
      approvedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'deal-record',
      },
    }),
    'reroute'
  );

  assert.equal(
    determineRoutingReviewDecisionAction({
      status: 'approved',
      proposedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
      approvedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'deal-record',
      },
      decisionHint: 'edit_and_approve',
    }),
    'edit_and_approve'
  );

  assert.equal(
    determineRoutingReviewDecisionAction({
      status: 'rejected',
      proposedRoute: {
        topic: 'assign-owner',
        app: 'hubspot',
        screen: 'contact-record',
      },
      approvedRoute: null,
    }),
    'reject'
  );
});

test('buildRoutingCompileWikiDedupeKey is approval-specific', () => {
  assert.equal(
    buildRoutingCompileWikiDedupeKey({
      recordingId: 'content-1',
      approvalId: 'approval-1',
    }),
    'compile_wiki:reroute:content-1:approval-1'
  );
});
