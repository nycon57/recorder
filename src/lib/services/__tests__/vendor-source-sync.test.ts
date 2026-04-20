import { describe, expect, test } from '@jest/globals';

import {
  FAILED_SOURCE_RETRY_MS,
  buildVendorSourceSyncDedupeKey,
  buildVendorSourceSyncJobInsert,
  isVendorSourceDueForSync,
  parseFreshnessTargetMs,
} from '../vendor-source-sync';
import type { VendorSourceRow } from '../vendor-source-registry';
import { resolveVendorSourceAdapter } from '../vendor-source-adapters';

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
    last_success_at: null,
    last_attempt_at: null,
    last_error: null,
    content_hash: null,
    freshness_target: '7 days',
    version_band: [],
    plan_band: [],
    applicability: {},
    terms_review_status: 'pending',
    created_at: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('vendor-source-sync', () => {
  test('parses Postgres-style freshness targets into milliseconds', () => {
    expect(parseFreshnessTargetMs('7 days 12 hours 30 minutes')).toBe(
      (((7 * 24) + 12) * 60 + 30) * 60 * 1000,
    );
  });

  test('treats never-synced sources as due immediately', () => {
    expect(
      isVendorSourceDueForSync(
        makeSource(),
        new Date('2026-04-20T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  test('treats fresh sources without errors as not due', () => {
    expect(
      isVendorSourceDueForSync(
        makeSource({
          last_success_at: '2026-04-20T11:30:00.000Z',
          freshness_target: '2 hours',
        }),
        new Date('2026-04-20T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  test('treats stale sources as due once they cross the freshness target', () => {
    expect(
      isVendorSourceDueForSync(
        makeSource({
          last_success_at: '2026-04-19T08:00:00.000Z',
          freshness_target: '12 hours',
        }),
        new Date('2026-04-20T12:00:00.000Z'),
      ),
    ).toBe(true);
  });

  test('backs off failed sources until the retry window has elapsed', () => {
    const now = new Date('2026-04-20T12:00:00.000Z');

    expect(
      isVendorSourceDueForSync(
        makeSource({
          last_error: 'timeout',
          last_attempt_at: '2026-04-20T11:45:00.000Z',
        }),
        now,
        FAILED_SOURCE_RETRY_MS,
      ),
    ).toBe(false);

    expect(
      isVendorSourceDueForSync(
        makeSource({
          last_error: 'timeout',
          last_attempt_at: '2026-04-20T10:00:00.000Z',
        }),
        now,
        FAILED_SOURCE_RETRY_MS,
      ),
    ).toBe(true);
  });

  test('builds a stable dedupe key and job insert for source-backed sync jobs', () => {
    const source = makeSource();
    const adapter = resolveVendorSourceAdapter(source);

    if (!adapter.supported) {
      throw new Error('expected sanctioned_crawl adapter to be supported');
    }

    expect(buildVendorSourceSyncDedupeKey(source.id)).toBe(
      'ingest_vendor_docs:source:source-1',
    );

    expect(
      buildVendorSourceSyncJobInsert(source, adapter.buildPayload('manual')),
    ).toMatchObject({
      type: 'ingest_vendor_docs',
      status: 'pending',
      priority: 2,
      dedupe_key: 'ingest_vendor_docs:source:source-1',
      payload: {
        app: 'hubspot',
        sourceId: 'source-1',
        syncType: 'manual',
      },
    });
  });
});
