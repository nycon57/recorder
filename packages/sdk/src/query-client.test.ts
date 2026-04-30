/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { QueryClient } from './query-client';

describe('QueryClient', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    }) as typeof fetch;
  });

  it('posts SDK queries to the API-key extension query route', async () => {
    const client = new QueryClient({
      apiKey: 'sk_live_test',
      apiUrl: 'https://app.tribora.test',
      customerOrgId: 'customer_org',
    });
    const onError = jest.fn();

    client.query(
      'How do I save?',
      {
        app: 'salesforce',
        screen: 'lead-detail',
        url: 'https://example.com/leads/1',
        title: 'Lead',
        interactiveElements: [],
      },
      { onError },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://app.tribora.test/api/extension/query',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_live_test',
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining('"customerOrgId":"customer_org"'),
      }),
    );
    expect(onError).toHaveBeenCalledWith('Query failed (401): Unauthorized');
  });

  it('sends the customer org selector during SDK init when configured', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        branding: {},
        voiceConfig: {},
        knowledgeScope: null,
      }),
    }) as typeof fetch;
    const client = new QueryClient({
      apiKey: 'sk_live_test',
      apiUrl: 'https://app.tribora.test',
      customerOrgId: 'customer_org',
    });

    await client.fetchInitConfig();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://app.tribora.test/api/sdk/init',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk_live_test',
          'X-Tribora-Customer-Org-Id': 'customer_org',
        }),
      }),
    );
  });
});
