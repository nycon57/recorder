import { describe, expect, it } from '@jest/globals';

import { buildLiveContextPack } from '../extension-live-context';

describe('buildLiveContextPack', () => {
  it('emits source refs that distinguish org and generic vendor guidance', () => {
    const pack = buildLiveContextPack({
      context: {
        app: 'hubspot',
        screen: 'billing-settings',
        appSignature: 'hubspot:billing-settings',
        url: 'https://app.hubspot.com/settings/billing',
        title: 'Billing settings',
        interactiveElements: [],
        knowledgeAvailability: {
          hasVendorDocs: true,
          hasOrgKnowledge: true,
          mode: 'org_backed',
          message: 'Guidance is available.',
        },
      },
      orgPages: [
        {
          id: 'org-billing',
          title: 'Billing approval policy',
          content: 'Team billing updates require manager approval.',
          kind: 'org',
        },
      ],
      vendorPages: [
        {
          id: 'vendor-billing',
          title: 'Billing settings',
          content: 'Vendor docs explain where billing settings live.',
          kind: 'vendor_generic',
        },
      ],
    });

    expect(pack.sources).toEqual([
      {
        id: 'org-billing',
        title: 'Billing approval policy',
        kind: 'org',
      },
      {
        id: 'vendor-billing',
        title: 'Billing settings',
        kind: 'vendor_generic',
      },
    ]);
    expect(pack.text).toContain('TEAM-SPECIFIC GUIDANCE');
    expect(pack.text).toContain('VENDOR GUIDANCE');
  });
});
