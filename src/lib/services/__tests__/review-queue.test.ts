import { TextDecoder, TextEncoder } from 'node:util';

import { expect, jest, test } from '@jest/globals';

import type {
  ApprovalRoutingReviewCandidate,
  LegacyRoutingReviewCandidate,
  ManualPublicationReviewCandidate,
} from '../review-queue';
import type { PendingReviewPage } from '../wiki-review';

Object.assign(globalThis, {
  TextDecoder,
  TextEncoder,
});

jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const {
  buildReviewQueueItems,
  splitReviewQueueItemsByKind,
} = require('../review-queue') as typeof import('../review-queue');
/* eslint-enable @typescript-eslint/no-require-imports */

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
      cluster_id: null,
      embedding: null,
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

const routingCandidates: Array<
  ApprovalRoutingReviewCandidate | LegacyRoutingReviewCandidate
> = [
  {
    approvalId: 'approval-1',
    contentId: 'content-approval-1',
    title: 'Owner assignment walkthrough',
    createdAt: '2026-04-18T12:06:00.000Z',
    routeConfidence: 0.42,
    routeReason: 'The workflow clearly assigns owners, but the exact record view is ambiguous.',
    proposedRoute: {
      topic: 'assign-owner',
      app: 'hubspot',
      screen: null,
    },
  },
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

test('buildReviewQueueItems maps contradiction, routing approvals, legacy routing, and manual publication items', () => {
  const items = buildReviewQueueItems({
    contradictions: contradictionPages,
    routing: routingCandidates,
    manualPublications: manualPublicationCandidates,
  });

  expect(items.length).toBe(4);

  expect(items[0]?.kind).toBe('manual-publication');
  if (items[0]?.kind === 'manual-publication') {
    expect(items[0].title).toBe('Untitled document');
    expect(items[0].primaryAction.label).toBe('Open publish flow');
    expect(items[0].primaryAction.href).toBe('/library/content-3');
    expect(items[0].summary).toMatch(/2 connected destinations/i);
  }

  expect(items[1]?.kind).toBe('routing');
  if (items[1]?.kind === 'routing') {
    expect(items[1].routingKind).toBe('approval');
    if (items[1].routingKind === 'approval') {
      expect(items[1].approvalId).toBe('approval-1');
      expect(items[1].contentId).toBe('content-approval-1');
      expect(items[1].topic).toBe('assign-owner');
      expect(items[1].primaryAction.href).toBe('/library/content-approval-1');
      expect(items[1].summary).toMatch(/42% confidence/i);
    }
  }

  expect(items[2]?.kind).toBe('routing');
  if (items[2]?.kind === 'routing') {
    expect(items[2].routingKind).toBe('legacy');
    if (items[2].routingKind === 'legacy') {
      expect(items[2].pageId).toBe('page-2');
      expect(items[2].primaryAction.label).toBe('Open source detail');
      expect(items[2].primaryAction.href).toBe('/library/content-2');
      expect(items[2].secondaryAction?.href).toBe('/knowledge/health');
      expect(items[2].summary).toMatch(/missing an app or screen assignment/i);
    }
  }

  expect(items[3]?.kind).toBe('contradiction');
  if (items[3]?.kind === 'contradiction') {
    expect(items[3].pageId).toBe('page-1');
    expect(items[3].logEntryIndex).toBe(2);
    expect(items[3].sourceRecordingId).toBe('content-1');
    expect(items[3].contradictions.length).toBe(1);
  }
});

test('buildReviewQueueItems keeps legacy routing fallback when a routing item has no linked source', () => {
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

  expect(items.length).toBe(1);
  expect(items[0]?.kind).toBe('routing');
  if (items[0]?.kind === 'routing') {
    expect(items[0].routingKind).toBe('legacy');
    if (items[0].routingKind === 'legacy') {
      expect(items[0].primaryAction.href).toBe('/knowledge/health');
      expect(items[0].secondaryAction).toBe(undefined);
    }
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

  expect(grouped.contradiction.length).toBe(1);
  expect(grouped.routing.length).toBe(2);
  expect(grouped['manual-publication'].length).toBe(1);
});
