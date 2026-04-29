/* global describe, expect, it */

import type { PageContext } from '@tribora/shared';
import { buildKnowledgeResolvedFor } from '@tribora/shared';

import {
  mergePageContextWithPreviousKnowledge,
  pageContextKnowledgeIdentityChanged,
} from '../utils/context-knowledge';

function baseContext(overrides: Partial<PageContext> = {}): PageContext {
  const context: PageContext = {
    app: 'hubspot',
    screen: 'contact-record',
    appSignature: 'hubspot:contact-record',
    url: 'https://app.hubspot.com/contacts/123?token=secret#notes',
    title: 'Contact record',
    interactiveElements: [],
    ...overrides,
  };

  return context;
}

describe('extension context knowledge provenance', () => {
  it('preserves resolved knowledge across same-page updates', () => {
    const previous = baseContext({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: ['vendor-contact'],
      },
      orgKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.91,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: ['org-contact'],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: true,
        mode: 'org_backed',
        message: 'Team guidance is available.',
      },
      relevantWikiPages: ['vendor-contact', 'org-contact'],
    });
    previous.knowledgeResolvedFor = buildKnowledgeResolvedFor(previous);

    const next = baseContext({
      url: 'https://app.hubspot.com/contacts/123?different=query#activity',
      title: 'Contact record - Activity',
    });

    const merged = mergePageContextWithPreviousKnowledge(previous, next);

    expect(pageContextKnowledgeIdentityChanged(previous, next)).toBe(false);
    expect(merged.vendorKnowledgeMatch?.pageIds).toEqual(['vendor-contact']);
    expect(merged.orgKnowledgeMatch?.pageIds).toEqual(['org-contact']);
    expect(merged.knowledgeAvailability?.mode).toBe('org_backed');
    expect(merged.relevantWikiPages).toEqual(['vendor-contact', 'org-contact']);
    expect(merged.knowledgeResolvedFor).toEqual(previous.knowledgeResolvedFor);
  });

  it('drops prior knowledge and reports identity change on cross-page updates', () => {
    const previous = baseContext({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: ['vendor-contact'],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: false,
        mode: 'vendor_backed',
        message: 'Vendor docs are available.',
      },
    });
    previous.knowledgeResolvedFor = buildKnowledgeResolvedFor(previous);

    const next = baseContext({
      screen: 'deal-record',
      appSignature: 'hubspot:deal-record',
      url: 'https://app.hubspot.com/deals/987',
      title: 'Deal record',
    });

    const merged = mergePageContextWithPreviousKnowledge(previous, next);

    expect(pageContextKnowledgeIdentityChanged(previous, next)).toBe(true);
    expect(merged.vendorKnowledgeMatch).toBeNull();
    expect(merged.orgKnowledgeMatch).toBeNull();
    expect(merged.knowledgeAvailability).toBeUndefined();
    expect(merged.knowledgeResolvedFor).toBeUndefined();
  });

  it('accepts client-supplied knowledge only when provenance matches the raw context', () => {
    const previous = baseContext({
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'contact-record',
        pageIds: ['vendor-contact'],
      },
    });
    previous.knowledgeResolvedFor = buildKnowledgeResolvedFor(previous);

    const next = baseContext({
      screen: 'deal-record',
      appSignature: 'hubspot:deal-record',
      url: 'https://app.hubspot.com/deals/987',
      vendorKnowledgeMatch: {
        matched: true,
        basis: 'exact',
        confidence: 0.95,
        app: 'hubspot',
        screen: 'deal-record',
        pageIds: ['vendor-deal'],
      },
      knowledgeAvailability: {
        hasVendorDocs: true,
        hasOrgKnowledge: false,
        mode: 'vendor_backed',
        message: 'Deal docs are available.',
      },
    });
    next.knowledgeResolvedFor = buildKnowledgeResolvedFor(next);

    const merged = mergePageContextWithPreviousKnowledge(previous, next);

    expect(merged.vendorKnowledgeMatch?.pageIds).toEqual(['vendor-deal']);
    expect(merged.knowledgeAvailability?.mode).toBe('vendor_backed');
    expect(merged.knowledgeResolvedFor).toEqual(next.knowledgeResolvedFor);
  });
});
