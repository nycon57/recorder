import { describe, expect, test } from '@jest/globals';

import { buildVendorSourceOpsSnapshot } from '../vendor-source-ops';
import type { VendorSourceRow } from '../vendor-source-registry';

function makeSource(
  overrides: Partial<VendorSourceRow> = {},
): VendorSourceRow {
  return {
    id: 'source-1',
    app: 'hubspot',
    source_kind: 'documentation',
    source_url:
      'https://knowledge.hubspot.com/contacts/view-and-filter-records?utm_source=ops#gated',
    publisher_hostname: 'hubspot.com',
    official_source: true,
    fetch_strategy: 'sanctioned_crawl',
    last_success_at: '2026-04-20T11:30:00.000Z',
    last_attempt_at: '2026-04-20T11:00:00.000Z',
    last_error: null,
    content_hash: 'sha256:source-1',
    freshness_target: '2 hours',
    version_band: [],
    plan_band: [],
    applicability: {},
    terms_review_status: 'approved',
    lifecycle: 'active',
    legal_reviewed_at: null,
    legal_reviewed_by: null,
    legal_review_reference_url: null,
    legal_review_notes: null,
    retired_at: null,
    retired_by: null,
    retirement_reason: null,
    replacement_source_id: null,
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T11:30:00.000Z',
    ...overrides,
  };
}

describe('vendor-source-ops', () => {
  test('buildVendorSourceOpsSnapshot classifies source health and aggregates counts', () => {
    const snapshot = buildVendorSourceOpsSnapshot({
      now: new Date('2026-04-20T12:00:00.000Z'),
      generatedAt: '2026-04-20T12:00:00.000Z',
      sources: [
        makeSource(),
        makeSource({
          id: 'source-2',
          app: 'vercel',
          last_success_at: '2026-04-19T05:00:00.000Z',
          freshness_target: '12 hours',
          terms_review_status: 'restricted',
        }),
        makeSource({
          id: 'source-3',
          app: 'stripe',
          last_success_at: null,
          last_attempt_at: null,
          content_hash: null,
        }),
        makeSource({
          id: 'source-4',
          app: 'linear',
          last_error: 'crawler timed out',
          last_attempt_at: '2026-04-20T11:45:00.000Z',
          last_success_at: '2026-04-19T09:00:00.000Z',
          freshness_target: '7 days',
        }),
        makeSource({
          id: 'source-5',
          app: 'notion',
          last_success_at: '2026-04-20T08:00:00.000Z',
          freshness_target: '1 hour',
        }),
      ],
      corpusPages: [
        { vendor_source_id: 'source-1', page_count: 2 },
        { vendor_source_id: 'source-2', page_count: 1 },
        { vendor_source_id: 'source-5', page_count: 1 },
      ],
      legacyPages: [
        { vendor_source_id: 'source-1', page_count: 1 },
        { vendor_source_id: 'source-3', page_count: 1 },
        { vendor_source_id: 'source-5', page_count: 1 },
        { vendor_source_id: null, page_count: 99 },
      ],
      activeJobs: [
        {
          id: 'job-source-3',
          status: 'pending',
          dedupe_key: 'ingest_vendor_docs:source:source-3',
          created_at: '2026-04-20T11:58:00.000Z',
          completed_at: null,
        },
        {
          id: 'job-source-4',
          status: 'processing',
          dedupe_key: 'ingest_vendor_docs:source:source-4',
          created_at: '2026-04-20T11:57:00.000Z',
          completed_at: null,
        },
        {
          id: 'job-source-1',
          status: 'completed',
          dedupe_key: 'ingest_vendor_docs:source:source-1',
          created_at: '2026-04-20T11:00:00.000Z',
          completed_at: '2026-04-20T11:30:00.000Z',
        },
        {
          id: 'job-source-5',
          status: 'processing',
          dedupe_key: 'ingest_vendor_docs:source:source-5',
          created_at: '2026-04-20T11:55:00.000Z',
          completed_at: null,
        },
      ],
    });

    expect(snapshot.summary).toEqual({
      totalSources: 5,
      appsCovered: 5,
      healthySources: 1,
      syncingSources: 3,
      staleSources: 0,
      failingSources: 0,
      blockedSources: 1,
      neverSyncedSources: 0,
      restrictedSources: 1,
      pausedSources: 0,
      retiredSources: 0,
    });

    expect(snapshot.sources.map((source) => [source.id, source.status])).toEqual([
      ['source-2', 'blocked'],
      ['source-4', 'syncing'],
      ['source-5', 'syncing'],
      ['source-3', 'syncing'],
      ['source-1', 'healthy'],
    ]);

    expect(snapshot.sources.find((source) => source.id === 'source-1')).toMatchObject({
      corpusPageCount: 2,
      legacyPageCount: 1,
      normalizedSourceUrl: 'https://knowledge.hubspot.com/contacts/view-and-filter-records',
      sourceUrl:
        'https://knowledge.hubspot.com/contacts/view-and-filter-records?utm_source=ops#gated',
      latestSyncJobId: 'job-source-1',
      latestSyncJobStatus: 'completed',
      latestSyncJobCreatedAt: '2026-04-20T11:00:00.000Z',
      latestSyncJobCompletedAt: '2026-04-20T11:30:00.000Z',
      isDueForSync: false,
      termsReviewStatus: 'approved',
      lifecycle: 'active',
      syncBlockReason: null,
    });

    expect(snapshot.sources.find((source) => source.id === 'source-5')).toMatchObject({
      activeJobStatus: 'processing',
      latestSyncJobId: 'job-source-5',
      latestSyncJobStatus: 'processing',
      corpusPageCount: 1,
      legacyPageCount: 1,
      isDueForSync: true,
      status: 'syncing',
    });

    expect(snapshot.sources.find((source) => source.id === 'source-3')).toMatchObject({
      activeJobStatus: 'pending',
      latestSyncJobId: 'job-source-3',
      status: 'syncing',
    });

    expect(snapshot.sources.find((source) => source.id === 'source-4')).toMatchObject({
      activeJobStatus: 'processing',
      latestSyncJobId: 'job-source-4',
      lastError: 'crawler timed out',
      status: 'syncing',
    });
  });
});
