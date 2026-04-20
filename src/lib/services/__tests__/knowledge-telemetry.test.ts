import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKnowledgeChatTelemetry,
  buildKnowledgeExtensionQueryTelemetry,
  buildKnowledgeReviewTelemetry,
  summarizeKnowledgeTelemetryEvents,
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
    sourceLayers: [],
    orgSourcesCount: 0,
    vendorTrainingSourcesCount: 0,
    vendorSourcesCount: 0,
    citationsCount: 0,
    citationsWithFreshnessCount: 0,
    staleCitationsCount: 0,
    staleVendorCitationsCount: 0,
    vendorSourceIds: [],
    vendorRetrievalMode: 'none',
    failureClass: 'none',
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

test('buildKnowledgeChatTelemetry captures shared vendor answer freshness and failure class', () => {
  const telemetry = buildKnowledgeChatTelemetry({
    orgId: 'org-123',
    userId: 'user-123',
    queryId: 'query-123',
    answerMode: 'compiled-memory',
    routeStrategy: null,
    selectedStrategy: 'compiled_memory',
    recordingsCount: 12,
    sourcesCount: 2,
    retrievalAttempts: 1,
    finalThreshold: null,
    averageSimilarity: 0,
    query: 'How do we handle domain changes?',
    queryLength: 31,
    queryWordCount: 6,
    totalTimeMs: 540,
    sourceLayers: ['vendor'],
    orgSourcesCount: 0,
    vendorTrainingSourcesCount: 0,
    vendorSourcesCount: 2,
    citationsCount: 2,
    citationsWithFreshnessCount: 2,
    staleCitationsCount: 1,
    staleVendorCitationsCount: 1,
    vendorSourceIds: ['source-1', 'source-2'],
    vendorRetrievalMode: 'hybrid',
  });

  assert.deepEqual(telemetry.sourceLayers, ['vendor']);
  assert.equal(telemetry.vendorRetrievalMode, 'hybrid');
  assert.equal(telemetry.staleVendorCitationsCount, 1);
  assert.equal(telemetry.failureClass, 'stale_vendor_answer');
});

test('summarizeKnowledgeTelemetryEvents aggregates retrieval modes and failure classes', () => {
  const summary = summarizeKnowledgeTelemetryEvents([
    {
      id: 'evt-1',
      type: 'knowledge.chat.outcome',
      createdAt: '2026-04-20T00:00:00.000Z',
      payload: {
        orgId: 'org-123',
        answerMode: 'compiled-memory',
        routingFailed: false,
        sourceLayers: ['vendor'],
        orgSourcesCount: 0,
        vendorTrainingSourcesCount: 0,
        vendorSourcesCount: 2,
        citationsCount: 2,
        citationsWithFreshnessCount: 2,
        staleCitationsCount: 1,
        staleVendorCitationsCount: 1,
        vendorSourceIds: ['source-1'],
        vendorRetrievalMode: 'hybrid',
        failureClass: 'stale_vendor_answer',
      },
    },
    {
      id: 'evt-2',
      type: 'knowledge.extension.query.outcome',
      createdAt: '2026-04-20T00:01:00.000Z',
      payload: {
        orgId: 'org-123',
        hadOrgKnowledge: false,
        hadVendorKnowledge: false,
        routingFailed: true,
        sourceLayers: [],
        orgSourcesCount: 0,
        vendorTrainingSourcesCount: 0,
        vendorSourcesCount: 0,
        citationsCount: 0,
        citationsWithFreshnessCount: 0,
        staleCitationsCount: 0,
        staleVendorCitationsCount: 0,
        vendorSourceIds: [],
        vendorRetrievalMode: 'none',
        failureClass: 'no_sources',
      },
    },
  ]);

  assert.equal(summary.byVendorRetrievalMode.hybrid, 1);
  assert.equal(summary.byVendorRetrievalMode.none, 1);
  assert.equal(summary.byFailureClass.stale_vendor_answer, 1);
  assert.equal(summary.byFailureClass.no_sources, 1);
  assert.equal(summary.sharedVendorStaleAnswers, 1);
});
