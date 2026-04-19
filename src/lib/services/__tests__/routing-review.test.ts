import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRoutingCompileWikiDedupeKey,
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
    }
  );

  const parsed = parseRoutingReviewState(metadata);
  assert.ok(parsed);
  assert.equal(parsed.status, 'approved');
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

  assert.ok(parsed);
  assert.equal(parsed.contentId, 'content-1');
  assert.equal(parsed.routeConfidence, 0.42);
  assert.deepEqual(parsed.proposedRoute, {
    topic: 'assign-owner',
    app: 'hubspot',
    screen: null,
  });
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
