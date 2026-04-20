import { describe, expect, test } from '@jest/globals';

import {
  DEFAULT_TIER1_VENDOR_ALLOWLIST,
  getTier1VendorAllowlist,
  getVendorSourcePriorityRank,
  resolveVendorSourceAdapter,
} from '../vendor-source-adapters';
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

describe('vendor-source-adapters', () => {
  test('falls back to the default tier-1 allowlist when no env override is provided', () => {
    expect(getTier1VendorAllowlist()).toEqual(DEFAULT_TIER1_VENDOR_ALLOWLIST);
  });

  test('parses a tier-1 allowlist override and normalizes values', () => {
    expect(getTier1VendorAllowlist(' Vercel, hubspot,vercel ,SUPABASE ')).toEqual([
      'hubspot',
      'supabase',
      'vercel',
    ]);
  });

  test('encodes the documented fetch-strategy priority order', () => {
    expect(getVendorSourcePriorityRank('markdown_export')).toBeLessThan(
      getVendorSourcePriorityRank('sanctioned_crawl'),
    );
    expect(getVendorSourcePriorityRank('static_site')).toBeLessThan(
      getVendorSourcePriorityRank('official_mcp_snapshot'),
    );
  });

  test('builds a registry-backed sync payload for supported HTML crawl sources', () => {
    const adapter = resolveVendorSourceAdapter(makeSource());

    expect(adapter.supported).toBe(true);
    expect(adapter.buildPayload('scheduled')).toEqual({
      url: 'https://knowledge.hubspot.com/contacts/view-and-filter-records',
      app: 'hubspot',
      maxPages: 80,
      sourceId: 'source-1',
      syncType: 'scheduled',
    });
  });

  test('surfaces unsupported adapter strategies without pretending they can sync', () => {
    const adapter = resolveVendorSourceAdapter(
      makeSource({
        app: 'vercel',
        fetch_strategy: 'markdown_export',
        source_url: 'https://vercel.com/llms.txt',
      }),
    );

    expect(adapter.supported).toBe(false);
    expect(adapter.reason).toMatch(/not yet supported/i);
  });
});
