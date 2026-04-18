import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKnowledgeChatTelemetry,
  buildKnowledgeExtensionQueryTelemetry,
  buildKnowledgeReviewTelemetry,
} from '../knowledge-telemetry';

test('buildKnowledgeChatTelemetry marks discovery requests with no sources as routing failures', () => {
  const telemetry = buildKnowledgeChatTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    queryId: 'query-123',
    answerMode: 'discovery',
    routeStrategy: 'standard_search',
    selectedStrategy: 'standard_search:discovery',
    recordingsCount: 8,
    sourcesCount: 0,
    retrievalAttempts: 3,
    finalThreshold: 0.7,
    averageSimilarity: 0,
    query: 'how do we route leads?',
    queryLength: 23,
    queryWordCount: 5,
    totalTimeMs: 1280,
  });

  assert.equal(telemetry.answerMode, 'discovery');
  assert.equal(telemetry.routingFailed, true);
  assert.equal(telemetry.routingFailureReason, 'no_sources');
  assert.equal(telemetry.sourcesCount, 0);
  assert.equal(telemetry.retrievalAttempts, 3);
});

test('buildKnowledgeChatTelemetry does not mark tool discovery as a routing failure', () => {
  const telemetry = buildKnowledgeChatTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    queryId: 'query-123',
    answerMode: 'tool-discovery',
    routeStrategy: 'direct_listing',
    selectedStrategy: 'direct_listing',
    recordingsCount: 8,
    sourcesCount: 0,
    retrievalAttempts: 1,
    finalThreshold: null,
    averageSimilarity: 0,
    query: 'what recordings do we have about onboarding?',
    queryLength: 40,
    queryWordCount: 7,
    totalTimeMs: 310,
    routingFailed: false,
    routingFailureReason: null,
  });

  assert.equal(telemetry.answerMode, 'tool-discovery');
  assert.equal(telemetry.routingFailed, false);
  assert.equal(telemetry.routingFailureReason, null);
});

test('buildKnowledgeChatTelemetry preserves an explicit false routingFailed value', () => {
  const telemetry = buildKnowledgeChatTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    queryId: 'query-123',
    answerMode: 'discovery',
    routeStrategy: 'standard_search',
    selectedStrategy: 'standard_search:discovery',
    recordingsCount: 8,
    sourcesCount: 0,
    retrievalAttempts: 3,
    finalThreshold: 0.7,
    averageSimilarity: 0,
    query: 'how do we route leads?',
    queryLength: 23,
    queryWordCount: 5,
    totalTimeMs: 1280,
    routingFailed: false,
    routingFailureReason: 'manual_override',
  });

  assert.equal(telemetry.routingFailed, false);
  assert.equal(telemetry.routingFailureReason, null);
});

test('buildKnowledgeExtensionQueryTelemetry captures org and vendor knowledge availability', () => {
  const telemetry = buildKnowledgeExtensionQueryTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    app: 'hubspot',
    screen: 'contact-record',
    hadOrgKnowledge: true,
    hadVendorKnowledge: false,
    knowledgeMode: 'org_backed',
    responseLatencyMs: 245,
    asOf: '2026-04-18T12:00:00.000Z',
  });

  assert.deepEqual(telemetry, {
    orgId: 'org-123',
    userId: 'user-123',
    app: 'hubspot',
    screen: 'contact-record',
    hadOrgKnowledge: true,
    hadVendorKnowledge: false,
    knowledgeMode: 'org_backed',
    routingFailed: false,
    responseLatencyMs: 245,
    asOf: '2026-04-18T12:00:00.000Z',
  });
});

test('buildKnowledgeReviewTelemetry records the resolved review outcome', () => {
  const telemetry = buildKnowledgeReviewTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    pageId: 'page-1',
    logEntryIndex: 2,
    action: 'rejectContradiction',
    outcome: 'rejected',
  });

  assert.deepEqual(telemetry, {
    orgId: 'org-123',
    userId: 'user-123',
    pageId: 'page-1',
    logEntryIndex: 2,
    action: 'rejectContradiction',
    outcome: 'rejected',
    contentLength: null,
    errorMessage: null,
  });
});

test('buildKnowledgeReviewTelemetry trims error messages', () => {
  const telemetry = buildKnowledgeReviewTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    pageId: 'page-1',
    logEntryIndex: 2,
    action: 'rejectContradiction',
    outcome: 'error',
    errorMessage: '  failed to parse contradiction  ',
  });

  assert.equal(telemetry.errorMessage, 'failed to parse contradiction');
});
