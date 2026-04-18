import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KNOWLEDGE_STATUS,
  getKnowledgeStatusMeta,
  resolveKnowledgeStatusForSource,
  resolveSourceWikiPageStatus,
  resolveKnowledgeStatusForWikiPage,
  summarizeKnowledgeStatusCounts,
} from '../knowledge-status';

test('resolveKnowledgeStatusForWikiPage prefers superseded over other active signals', () => {
  const status = resolveKnowledgeStatusForWikiPage({
    validUntil: '2026-04-18T20:00:00.000Z',
    app: null,
    screen: null,
    hasPendingReview: true,
  });

  assert.equal(status, KNOWLEDGE_STATUS.SUPERSEDED);
});

test('resolveKnowledgeStatusForWikiPage marks flagged active pages as needs review', () => {
  const status = resolveKnowledgeStatusForWikiPage({
    validUntil: null,
    app: 'hubspot',
    screen: 'contact-record',
    hasPendingReview: true,
  });

  assert.equal(status, KNOWLEDGE_STATUS.NEEDS_REVIEW);
});

test('resolveKnowledgeStatusForWikiPage marks unrouted active pages as needs routing', () => {
  const status = resolveKnowledgeStatusForWikiPage({
    validUntil: null,
    app: null,
    screen: 'contact-record',
    hasPendingReview: false,
  });

  assert.equal(status, KNOWLEDGE_STATUS.NEEDS_ROUTING);
});

test('resolveKnowledgeStatusForWikiPage marks fully active pages as live', () => {
  const status = resolveKnowledgeStatusForWikiPage({
    validUntil: null,
    app: 'hubspot',
    screen: 'contact-record',
    hasPendingReview: false,
  });

  assert.equal(status, KNOWLEDGE_STATUS.LIVE);
});

test('resolveKnowledgeStatusForSource bridges in-flight source lifecycle to processing', () => {
  const status = resolveKnowledgeStatusForSource({
    sourceStatus: 'transcribing',
    wikiPageStatus: null,
  });

  assert.equal(status, KNOWLEDGE_STATUS.PROCESSING);
});

test('resolveKnowledgeStatusForSource treats queued uploaded sources as processing knowledge', () => {
  const status = resolveKnowledgeStatusForSource({
    sourceStatus: 'uploaded',
    wikiPageStatus: null,
  });

  assert.equal(status, KNOWLEDGE_STATUS.PROCESSING);
});

test('resolveKnowledgeStatusForSource reuses wiki-page routing state after processing completes', () => {
  const status = resolveKnowledgeStatusForSource({
    sourceStatus: 'completed',
    wikiPageStatus: KNOWLEDGE_STATUS.NEEDS_ROUTING,
  });

  assert.equal(status, KNOWLEDGE_STATUS.NEEDS_ROUTING);
});

test('resolveSourceWikiPageStatus prefers actionable active page states over live or superseded pages', () => {
  const status = resolveSourceWikiPageStatus([
    KNOWLEDGE_STATUS.LIVE,
    KNOWLEDGE_STATUS.SUPERSEDED,
    KNOWLEDGE_STATUS.NEEDS_REVIEW,
  ]);

  assert.equal(status, KNOWLEDGE_STATUS.NEEDS_REVIEW);
});

test('getKnowledgeStatusMeta returns consistent labels for UI surfaces', () => {
  assert.deepEqual(getKnowledgeStatusMeta(KNOWLEDGE_STATUS.VENDOR_ONLY), {
    label: 'Vendor Only',
    shortLabel: 'Vendor Only',
    badgeVariant: 'outline',
    badgeClassName: 'bg-sky-500/10 text-sky-700 border-sky-200',
    description: 'Vendor knowledge exists, but your organization has no live page for it yet.',
  });
});

test('summarizeKnowledgeStatusCounts tallies source, wiki, and vendor-only statuses together', () => {
  const summary = summarizeKnowledgeStatusCounts({
    processingSources: 3,
    wikiPageStatuses: [
      KNOWLEDGE_STATUS.LIVE,
      KNOWLEDGE_STATUS.LIVE,
      KNOWLEDGE_STATUS.NEEDS_REVIEW,
      KNOWLEDGE_STATUS.NEEDS_ROUTING,
      KNOWLEDGE_STATUS.SUPERSEDED,
    ],
    vendorOnlyCount: 2,
  });

  assert.deepEqual(summary, {
    processing: 3,
    needs_routing: 1,
    live: 2,
    needs_review: 1,
    superseded: 1,
    vendor_only: 2,
  });
});
