import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExtensionContextTelemetry } from '../extension-context-telemetry';
import { buildKnowledgeMatchExplainability } from '../extension-context';

test('buildKnowledgeMatchExplainability describes exact vendor baseline matches', () => {
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

  assert.deepEqual(explanation, {
    basisCategory: 'exact',
    basisLabel: 'Exact match',
    basisExplanation:
      'Matched the vendor baseline because the detected app "salesforce" and screen "lead-detail" exactly matched "salesforce - lead-detail".',
  });
});

test('buildKnowledgeMatchExplainability describes alias-based screen fallback', () => {
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

  assert.equal(explanation.basisCategory, 'alias');
  assert.equal(explanation.basisLabel, 'Alias match');
  assert.match(
    explanation.basisExplanation,
    /screen alias/i,
  );
  assert.match(
    explanation.basisExplanation,
    /"contact-record".*"record"/i,
  );
});

test('buildKnowledgeMatchExplainability describes domain-based vendor matching', () => {
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

  assert.deepEqual(explanation, {
    basisCategory: 'domain',
    basisLabel: 'Domain match',
    basisExplanation:
      'Matched the vendor baseline by domain because the detected host "workspace.my.salesforce.com" maps to "salesforce", so Tribora mapped the page into that app\'s knowledge family.',
  });
});

test('buildExtensionContextTelemetry carries explainability for vendor and org matches', () => {
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

  assert.equal(telemetry.vendorMatchLabel, 'Domain match');
  assert.equal(telemetry.vendorMatchCategory, 'domain');
  assert.match(telemetry.vendorMatchExplanation ?? '', /vendor baseline/i);
  assert.equal(telemetry.orgMatchLabel, 'Exact match');
  assert.equal(telemetry.orgMatchCategory, 'exact');
  assert.match(telemetry.orgMatchExplanation ?? '', /org overlay/i);
});
