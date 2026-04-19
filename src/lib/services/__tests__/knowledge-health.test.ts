import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveKnowledgeOperationalMetrics,
  summarizeReviewQueueKindCounts,
} from '../knowledge-health';
import { KNOWLEDGE_STATUS, type KnowledgeStatusSummary } from '../knowledge-status';

function buildStatusSummary(
  overrides: Partial<KnowledgeStatusSummary['counts']>,
): KnowledgeStatusSummary {
  const counts = {
    [KNOWLEDGE_STATUS.PROCESSING]: 0,
    [KNOWLEDGE_STATUS.NEEDS_ROUTING]: 0,
    [KNOWLEDGE_STATUS.LIVE]: 0,
    [KNOWLEDGE_STATUS.NEEDS_REVIEW]: 0,
    [KNOWLEDGE_STATUS.SUPERSEDED]: 0,
    [KNOWLEDGE_STATUS.VENDOR_ONLY]: 0,
    ...overrides,
  };

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { counts, total };
}

test('summarizeReviewQueueKindCounts tallies review queue kinds into stable buckets', () => {
  const counts = summarizeReviewQueueKindCounts([
    'routing',
    'routing',
    'contradiction',
    'manual-publication',
  ]);

  assert.deepEqual(counts, {
    contradiction: 1,
    routing: 2,
    'manual-publication': 1,
  });
});

test('deriveKnowledgeOperationalMetrics combines status and queue counts into bottleneck metrics', () => {
  const metrics = deriveKnowledgeOperationalMetrics({
    knowledgeStatus: buildStatusSummary({
      [KNOWLEDGE_STATUS.NEEDS_ROUTING]: 4,
      [KNOWLEDGE_STATUS.NEEDS_REVIEW]: 2,
      [KNOWLEDGE_STATUS.VENDOR_ONLY]: 6,
      [KNOWLEDGE_STATUS.PROCESSING]: 3,
      [KNOWLEDGE_STATUS.LIVE]: 12,
    }),
    reviewQueueCounts: {
      contradiction: 5,
      routing: 3,
      'manual-publication': 2,
    },
  });

  assert.equal(metrics.pendingReviewCount, 10);
  assert.equal(metrics.routingBacklog, 7);
  assert.equal(metrics.reviewBacklog, 7);
  assert.equal(metrics.publicationBacklog, 2);
  assert.equal(metrics.vendorGapCount, 6);
  assert.equal(metrics.processingCount, 3);
  assert.deepEqual(metrics.primaryBottleneck, {
    key: 'routing',
    label: 'Routing',
    count: 7,
  });
});

test('deriveKnowledgeOperationalMetrics returns null bottleneck when no queues or gaps exist', () => {
  const metrics = deriveKnowledgeOperationalMetrics({
    knowledgeStatus: buildStatusSummary({
      [KNOWLEDGE_STATUS.LIVE]: 9,
      [KNOWLEDGE_STATUS.SUPERSEDED]: 4,
    }),
    reviewQueueCounts: {
      contradiction: 0,
      routing: 0,
      'manual-publication': 0,
    },
  });

  assert.equal(metrics.pendingReviewCount, 0);
  assert.equal(metrics.routingBacklog, 0);
  assert.equal(metrics.reviewBacklog, 0);
  assert.equal(metrics.vendorGapCount, 0);
  assert.equal(metrics.primaryBottleneck, null);
});
