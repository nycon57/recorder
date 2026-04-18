import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildReviewQueueItems,
  splitReviewQueueItemsByKind,
  type ManualPublicationReviewCandidate,
  type RoutingReviewCandidate,
} from '../review-queue';
import type { PendingReviewPage } from '../wiki-review';

const contradictionPages: PendingReviewPage[] = [
  {
    page: {
      id: 'page-1',
      org_id: 'org-1',
      app: 'hubspot',
      screen: 'contact-record',
      topic: 'Update deal stage',
      content: 'Current page body',
      confidence: 0.82,
      valid_from: '2026-04-18T10:00:00.000Z',
      valid_until: null,
      supersedes_id: null,
      compilation_log: [],
      created_at: '2026-04-18T10:00:00.000Z',
      updated_at: '2026-04-18T10:30:00.000Z',
    },
    pendingEntries: [
      {
        entryIndex: 2,
        entry: {
          action: 'flagged',
          source_recording_id: 'content-1',
          detected_at: '2026-04-18T11:00:00.000Z',
          contradictions: [
            {
              old: 'Click Save',
              new: 'Click Submit',
              field: 'Primary action',
            },
          ],
          additions: ['A new confirmation toast appears'],
          merged_content: 'Resolved page body',
        },
      },
    ],
  },
];

const routingCandidates: RoutingReviewCandidate[] = [
  {
    pageId: 'page-2',
    topic: 'Assign owner',
    app: null,
    screen: 'record-view',
    createdAt: '2026-04-18T12:00:00.000Z',
    updatedAt: '2026-04-18T12:05:00.000Z',
    sourceLinks: [
      {
        sourceId: 'content-2',
        sourceType: 'recording',
        contributedAt: '2026-04-18T12:03:00.000Z',
        sourceTitle: 'Owner assignment walkthrough',
      },
    ],
  },
];

const manualPublicationCandidates: ManualPublicationReviewCandidate[] = [
  {
    contentId: 'content-3',
    documentId: 'document-3',
    title: null,
    createdAt: '2026-04-18T13:00:00.000Z',
    connectorCount: 2,
  },
];

test('buildReviewQueueItems maps contradiction, routing, and manual publication items', () => {
  const items = buildReviewQueueItems({
    contradictions: contradictionPages,
    routing: routingCandidates,
    manualPublications: manualPublicationCandidates,
  });

  assert.equal(items.length, 3);

  assert.equal(items[0]?.kind, 'manual-publication');
  if (items[0]?.kind === 'manual-publication') {
    assert.equal(items[0].title, 'Untitled document');
    assert.equal(items[0].primaryAction.label, 'Open publish flow');
    assert.equal(items[0].primaryAction.href, '/library/content-3');
    assert.match(items[0].summary, /2 connected destinations/i);
  }

  assert.equal(items[1]?.kind, 'routing');
  if (items[1]?.kind === 'routing') {
    assert.equal(items[1].pageId, 'page-2');
    assert.equal(items[1].primaryAction.label, 'Open source detail');
    assert.equal(items[1].primaryAction.href, '/library/content-2');
    assert.equal(items[1].secondaryAction?.href, '/knowledge/health');
    assert.match(items[1].summary, /missing an app or screen assignment/i);
  }

  assert.equal(items[2]?.kind, 'contradiction');
  if (items[2]?.kind === 'contradiction') {
    assert.equal(items[2].pageId, 'page-1');
    assert.equal(items[2].logEntryIndex, 2);
    assert.equal(items[2].sourceRecordingId, 'content-1');
    assert.equal(items[2].contradictions.length, 1);
  }
});

test('buildReviewQueueItems falls back to knowledge health when a routing item has no linked source', () => {
  const items = buildReviewQueueItems({
    contradictions: [],
    routing: [
      {
        pageId: 'page-4',
        topic: 'Create approval path',
        app: null,
        screen: null,
        createdAt: '2026-04-18T14:00:00.000Z',
        updatedAt: '2026-04-18T14:00:00.000Z',
        sourceLinks: [],
      },
    ],
    manualPublications: [],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, 'routing');
  if (items[0]?.kind === 'routing') {
    assert.equal(items[0].primaryAction.href, '/knowledge/health');
    assert.equal(items[0].secondaryAction, undefined);
  }
});

test('splitReviewQueueItemsByKind groups every item under its review kind', () => {
  const grouped = splitReviewQueueItemsByKind(
    buildReviewQueueItems({
      contradictions: contradictionPages,
      routing: routingCandidates,
      manualPublications: manualPublicationCandidates,
    })
  );

  assert.equal(grouped.contradiction.length, 1);
  assert.equal(grouped.routing.length, 1);
  assert.equal(grouped['manual-publication'].length, 1);
});
