import { describe, expect, test } from '@jest/globals';

import {
  buildLegacyVendorSourceBackfill,
  buildVendorSourceFailurePatch,
  buildVendorSourceSuccessPatch,
  normalizeVendorSourceDraft,
} from '../vendor-source-registry';

describe('vendor-source-registry', () => {
  test('normalizeVendorSourceDraft normalizes an official vendor source and strips tracking params', () => {
    const normalized = normalizeVendorSourceDraft({
      app: '  HubSpot ',
      sourceKind: 'documentation',
      sourceUrl:
        'https://docs.hubspot.com/en/contacts/create?utm_source=ads#section-1',
      publisherHostname: 'hubspot.com',
      fetchStrategy: 'sanctioned_crawl',
      freshnessTarget: '3 days',
      versionBand: ['Enterprise', 'Pro', 'Enterprise'],
      planBand: ['Sales Hub', 'Sales Hub', 'Marketing Hub'],
    });

    expect(normalized).toEqual({
      app: 'hubspot',
      sourceKind: 'documentation',
      sourceUrl: 'https://docs.hubspot.com/en/contacts/create',
      publisherHostname: 'hubspot.com',
      officialSource: true,
      fetchStrategy: 'sanctioned_crawl',
      freshnessTarget: '3 days',
      versionBand: ['Enterprise', 'Pro'],
      planBand: ['Marketing Hub', 'Sales Hub'],
      applicability: {},
      termsReviewStatus: 'pending',
    });
  });

  test('normalizeVendorSourceDraft rejects community or mismatched publisher hosts', () => {
    expect(() =>
      normalizeVendorSourceDraft({
        app: 'Vercel',
        sourceKind: 'documentation',
        sourceUrl: 'https://docs.vercel.com/storage',
        fetchStrategy: 'sanctioned_crawl',
      } as any)
    ).toThrow(/publisher hostname/i);

    expect(() =>
      normalizeVendorSourceDraft({
        app: 'Vercel',
        sourceKind: 'documentation',
        sourceUrl: 'https://github.com/vercel/next.js/discussions/123',
        publisherHostname: 'vercel.com',
        fetchStrategy: 'sanctioned_crawl',
      })
    ).toThrow(/official vendor host/i);

    expect(() =>
      normalizeVendorSourceDraft({
        app: 'Vercel',
        sourceKind: 'documentation',
        sourceUrl: 'https://docs.vercel.com/docs-storage',
        publisherHostname: 'vercel.com',
        officialSource: false,
        fetchStrategy: 'sanctioned_crawl',
      })
    ).toThrow(/official-source-only/i);
  });

  test('buildLegacyVendorSourceBackfill keeps unresolved legacy pages out of the registry seed set', () => {
    const result = buildLegacyVendorSourceBackfill([
      {
        id: 'page-1',
        app: 'hubspot',
        screen: 'contacts-list',
        source_url:
          'https://knowledge.hubspot.com/contacts/view-and-filter-records',
        updated_at: '2026-04-12T02:46:34.699Z',
      },
      {
        id: 'page-2',
        app: 'hubspot',
        screen: 'deal-detail',
        source_url: null,
        updated_at: '2026-04-12T02:46:34.699Z',
      },
    ]);

    expect(result.candidates).toEqual([
      {
        app: 'hubspot',
        sourceKind: 'documentation',
        sourceUrl:
          'https://knowledge.hubspot.com/contacts/view-and-filter-records',
        publisherHostname: 'hubspot.com',
        officialSource: true,
        fetchStrategy: 'sanctioned_crawl',
        freshnessTarget: '7 days',
        versionBand: [],
        planBand: [],
        applicability: {
          legacyPageIds: ['page-1'],
          legacyScreens: ['contacts-list'],
        },
        termsReviewStatus: 'pending',
      },
    ]);

    expect(result.unresolvedLegacyPageIds).toEqual(['page-2']);
  });

  test('vendor source sync patches keep attempt, success, and failure state explicit', () => {
    const attemptedAt = '2026-04-19T21:00:00.000Z';
    const succeededAt = '2026-04-19T21:02:00.000Z';

    expect(
      buildVendorSourceSuccessPatch({
        attemptedAt,
        succeededAt,
        contentHash: 'sha256:abc123',
      })
    ).toEqual({
      last_attempt_at: attemptedAt,
      last_success_at: succeededAt,
      content_hash: 'sha256:abc123',
      last_error: null,
      updated_at: succeededAt,
    });

    expect(
      buildVendorSourceFailurePatch({
        attemptedAt,
        failedAt: succeededAt,
        errorMessage: 'crawler timed out',
      })
    ).toEqual({
      last_attempt_at: attemptedAt,
      last_error: 'crawler timed out',
      updated_at: succeededAt,
    });
  });
});
