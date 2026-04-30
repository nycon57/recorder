/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const validateApiKey = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const resolveCustomerOrgForVendor =
  jest.fn<(...args: unknown[]) => Promise<unknown>>();
const fromMock = jest.fn();

jest.mock('@/lib/services/vendor-api-keys', () => ({
  validateApiKey: (...args: unknown[]) => validateApiKey(...args),
}));

jest.mock('@/lib/services/vendor-customers', () => ({
  resolveCustomerOrgForVendor: (...args: unknown[]) =>
    resolveCustomerOrgForVendor(...args),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

jest.mock('@/lib/utils/cors', () => ({
  CORS_HEADERS: {},
  corsPreflightResponse: () => new Response(null, { status: 204 }),
}));

function buildRequest(headers: Record<string, string> = {}): NextRequest {
  return {
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

function configLookupResponse() {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data: {
        branding: { product_name: 'Tribora' },
        voice_config: {},
        knowledge_scope: ['salesforce'],
      },
      error: null,
    })),
  };
  return query;
}

describe('GET /api/sdk/init', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReset();
    validateApiKey.mockResolvedValue({
      vendorOrgId: 'vendor_org',
      configId: 'config_1',
      scopes: ['query'],
      rateLimitRpm: 60,
      keyId: 'key_1',
    });
    resolveCustomerOrgForVendor.mockResolvedValue({
      id: 'customer_org',
      name: 'Customer Org',
      slug: 'customer-org',
      plan: 'pro',
      created_at: '2026-04-29T00:00:00.000Z',
    });
    fromMock.mockReturnValue(configLookupResponse());
  });

  it('validates configured customer org selectors before returning SDK config', async () => {
    const { GET } = await import('../route');

    const response = await GET(
      buildRequest({
        authorization: 'Bearer sk_live_test',
        'x-tribora-customer-org-id': 'customer_org',
      }),
    );

    expect(response.status).toBe(200);
    expect(resolveCustomerOrgForVendor).toHaveBeenCalledWith(
      'vendor_org',
      'customer_org',
    );
  });

  it('rejects forged customer org selectors', async () => {
    resolveCustomerOrgForVendor.mockResolvedValueOnce(null);
    const { GET } = await import('../route');

    const response = await GET(
      buildRequest({
        authorization: 'Bearer sk_live_test',
        'x-tribora-customer-org-id': 'other_customer_org',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Customer organization is not linked to this vendor',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });
});
