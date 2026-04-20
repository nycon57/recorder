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
    source_url: 'https://knowledge.hubspot.com/contacts/view-and-filter-records',
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
          status: 'processing',
          dedupe_key: 'ingest_vendor_docs:source:source-5',
        },
      ],
    });

    expect(snapshot.summary).toEqual({
      totalSources: 5,
      appsCovered: 5,
      healthySources: 1,
      syncingSources: 1,
      staleSources: 1,
      failingSources: 1,
      neverSyncedSources: 1,
      restrictedSources: 1,
    });

    expect(snapshot.sources.map((source) => [source.id, source.status])).toEqual([
      ['source-4', 'failing'],
      ['source-2', 'stale'],
      ['source-3', 'never_synced'],
      ['source-5', 'syncing'],
      ['source-1', 'healthy'],
    ]);

    expect(snapshot.sources.find((source) => source.id === 'source-1')).toMatchObject({
      corpusPageCount: 2,
      legacyPageCount: 1,
      isDueForSync: false,
      termsReviewStatus: 'approved',
    });

    expect(snapshot.sources.find((source) => source.id === 'source-5')).toMatchObject({
      activeJobStatus: 'processing',
      corpusPageCount: 1,
      legacyPageCount: 1,
      isDueForSync: true,
    });
  });
});
