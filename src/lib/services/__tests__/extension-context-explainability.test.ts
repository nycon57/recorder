import { describe, expect, it } from '@jest/globals';

import { buildExtensionContextTelemetry } from '../extension-context-telemetry';
import {
  buildKnowledgeMatchExplainability,
  rankKnowledgeRowsByPageRelevance,
} from '../extension-context';

describe('extension context explainability', () => {
  it('buildKnowledgeMatchExplainability describes exact vendor baseline matches', () => {
    const explanation = buildKnowledgeMatchExplainability({
      surface: 'vendor',
      basis: 'exact',
      url: 'https://acme.salesforce.com/lightning/r/Lead/123/view',
      requestedApp: 'salesforce',
      requestedScreen: 'lead-detail',
      matchedApp: 'salesforce',
      matchedScreen: 'lead-detail',
      matchedLabel: 'salesforce - lead-detail',
    });

    expect(explanation).toEqual({
      basisCategory: 'exact',
      basisLabel: 'Exact match',
      basisExplanation:
        'Matched the vendor baseline because the detected app "salesforce" and screen "lead-detail" exactly matched "salesforce - lead-detail".',
    });
  });

  it('buildKnowledgeMatchExplainability describes exact org topic matches', () => {
    const explanation = buildKnowledgeMatchExplainability({
      surface: 'org',
      basis: 'exact',
      url: 'https://workspace.example.com/records/123',
      requestedApp: 'workspace',
      requestedScreen: 'record-view',
      matchedApp: null,
      matchedScreen: null,
      matchedLabel: 'Contact record workflow',
    });

    expect(explanation).toEqual({
      basisCategory: 'exact',
      basisLabel: 'Exact match',
      basisExplanation:
        'Matched the org overlay because the detected context exactly matched the saved knowledge label "Contact record workflow".',
    });
  });

  it('buildKnowledgeMatchExplainability describes alias-based screen fallback', () => {
    const explanation = buildKnowledgeMatchExplainability({
      surface: 'org',
      basis: 'screen_alias',
      url: 'https://app.hubspot.com/contacts/123',
      requestedApp: 'hubspot',
      requestedScreen: 'contact-record',
      matchedApp: 'hubspot',
      matchedScreen: 'record',
      matchedLabel: 'Contact record workflow',
    });

    expect(explanation.basisCategory).toBe('alias');
    expect(explanation.basisLabel).toBe('Alias match');
    expect(explanation.basisExplanation).toMatch(/screen alias/i);
    expect(explanation.basisExplanation).toMatch(/"contact-record".*"record"/i);
  });

  it('buildKnowledgeMatchExplainability describes domain-based vendor matching', () => {
    const explanation = buildKnowledgeMatchExplainability({
      surface: 'vendor',
      basis: 'domain_alias',
      url: 'https://workspace.my.salesforce.com/lightning/page/home',
      requestedApp: 'unknown',
      requestedScreen: 'home',
      matchedApp: 'salesforce',
      matchedScreen: null,
      matchedLabel: 'salesforce',
    });

    expect(explanation).toEqual({
      basisCategory: 'domain',
      basisLabel: 'Domain match',
      basisExplanation:
        'Matched the vendor baseline by domain because the detected host "workspace.my.salesforce.com" maps to "salesforce", so Tribora mapped the page into that app\'s knowledge family.',
    });
  });

  it('buildKnowledgeMatchExplainability describes app-level matches', () => {
    const explanation = buildKnowledgeMatchExplainability({
      surface: 'vendor',
      basis: 'app_only',
      url: 'https://workspace.salesforce.com/lightning/page/home',
      requestedApp: 'salesforce',
      requestedScreen: 'home',
      matchedApp: 'salesforce',
      matchedScreen: null,
      matchedLabel: 'salesforce',
    });

    expect(explanation).toEqual({
      basisCategory: 'app',
      basisLabel: 'App-level match',
      basisExplanation:
        'Matched the vendor baseline at the app level because "salesforce" was recognized, but there was no exact screen baseline for "home".',
    });
  });

  it('buildExtensionContextTelemetry carries explainability for vendor and org matches', () => {
    const telemetry = buildExtensionContextTelemetry({
      context: {
        app: 'hubspot',
        screen: 'contact-record',
        appSignature: 'hubspot:contact-record',
        url: 'https://app.hubspot.com/contacts/123',
        title: 'Contact record',
        interactiveElements: [],
        vendorKnowledgeMatch: {
          matched: true,
          basis: 'domain_alias',
          confidence: 0.48,
          app: 'hubspot',
          screen: null,
          pageIds: ['vendor-1'],
          basisCategory: 'domain',
          basisLabel: 'Domain match',
          basisExplanation:
            'Matched the vendor baseline by domain because the detected host "app.hubspot.com" maps to "hubspot", so Tribora fell back to that vendor baseline.',
        },
        orgKnowledgeMatch: {
          matched: true,
          basis: 'exact',
          confidence: 0.91,
          app: 'hubspot',
          screen: 'contact-record',
          pageIds: ['org-1'],
          basisCategory: 'exact',
          basisLabel: 'Exact match',
          basisExplanation:
            'Matched the org overlay because the detected app "hubspot" and screen "contact-record" exactly matched "Contact record workflow".',
        },
        knowledgeAvailability: {
          hasVendorDocs: true,
          hasOrgKnowledge: true,
          mode: 'org_backed',
          message:
            'Vendor documentation and team-specific guidance are available for this page.',
        },
      },
      latencyMs: 42,
      authMethod: 'session',
      orgId: 'org-123',
      actorId: 'user-123',
    });

    expect(telemetry.vendorMatchLabel).toBe('Domain match');
    expect(telemetry.vendorMatchCategory).toBe('domain');
    expect(telemetry.vendorMatchExplanation ?? '').toMatch(/vendor baseline/i);
    expect(telemetry.orgMatchLabel).toBe('Exact match');
    expect(telemetry.orgMatchCategory).toBe('exact');
    expect(telemetry.orgMatchExplanation ?? '').toMatch(/org overlay/i);
  });

  it('rankKnowledgeRowsByPageRelevance promotes app-only pages that match the current screen and URL', () => {
    const ranked = rankKnowledgeRowsByPageRelevance(
      [
        {
          id: 'generic',
          screen: 'overview',
          topic: 'General account overview',
          element_selectors: ['[data-test="home"]'],
        },
        {
          id: 'settings',
          screen: 'billing-settings',
          topic: 'Billing settings workflow',
          element_selectors: ['[data-test="billing"]'],
        },
        {
          id: 'contacts',
          screen: 'contact-record',
          topic: 'Contact profile',
          element_selectors: ['[data-test="contact-email"]'],
        },
      ],
      {
        screen: 'billing-settings',
        url: 'https://app.example.com/admin/billing/settings',
      },
    );

    expect(ranked.map((row) => row.id)).toEqual([
      'settings',
      'contacts',
      'generic',
    ]);
  });

  it('rankKnowledgeRowsByPageRelevance uses deterministic tie-breaking for broad app matches', () => {
    const ranked = rankKnowledgeRowsByPageRelevance(
      [
        { id: 'z-page', screen: 'overview', topic: 'Overview' },
        { id: 'a-page', screen: 'overview', topic: 'Overview' },
      ],
      {
        screen: 'home',
        url: 'https://app.example.com/home',
      },
    );

    expect(ranked.map((row) => row.id)).toEqual(['a-page', 'z-page']);
  });
});
