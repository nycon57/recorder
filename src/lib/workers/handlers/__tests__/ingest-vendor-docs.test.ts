import { describe, expect, test } from '@jest/globals';

import { shouldSkipVendorWikiPageUpdate } from '../ingest-vendor-docs-skip';

describe('shouldSkipVendorWikiPageUpdate', () => {
  test('skips a true no-op vendor wiki row', () => {
    expect(
      shouldSkipVendorWikiPageUpdate({
        existingContentHash: 'sha256:page-1',
        nextContentHash: 'sha256:page-1',
        existingVendorSourceId: null,
        nextVendorSourceId: null,
      })
    ).toBe(true);
  });

  test('forces an update when an unchanged page still needs the shared source mapping', () => {
    expect(
      shouldSkipVendorWikiPageUpdate({
        existingContentHash: 'sha256:page-1',
        nextContentHash: 'sha256:page-1',
        existingVendorSourceId: null,
        nextVendorSourceId: 'source-123',
      })
    ).toBe(false);
  });

  test('skips when the unchanged page already points at the same shared source', () => {
    expect(
      shouldSkipVendorWikiPageUpdate({
        existingContentHash: 'sha256:page-1',
        nextContentHash: 'sha256:page-1',
        existingVendorSourceId: 'source-123',
        nextVendorSourceId: 'source-123',
      })
    ).toBe(true);
  });
});
