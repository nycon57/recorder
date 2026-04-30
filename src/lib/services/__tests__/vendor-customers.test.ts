/** @jest-environment node */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const fromMock = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: fromMock,
  },
}));

function organizationLookupResponse(data: unknown) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({ data, error: null })),
  };
  return query;
}

describe('resolveCustomerOrgForVendor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockReset();
  });

  it('returns linked customer organizations for the vendor', async () => {
    const { resolveCustomerOrgForVendor } = await import('../vendor-customers');
    fromMock.mockReturnValueOnce(
      organizationLookupResponse({
        id: 'customer_org',
        name: 'Customer Org',
        slug: 'customer-org',
        plan: 'pro',
        created_at: '2026-04-29T00:00:00.000Z',
        vendor_org_id: 'vendor_org',
        deleted_at: null,
      }),
    );

    await expect(
      resolveCustomerOrgForVendor('vendor_org', 'customer_org'),
    ).resolves.toEqual({
      id: 'customer_org',
      name: 'Customer Org',
      slug: 'customer-org',
      plan: 'pro',
      created_at: '2026-04-29T00:00:00.000Z',
    });
  });

  it('rejects self-targeting vendor orgs without querying', async () => {
    const { resolveCustomerOrgForVendor } = await import('../vendor-customers');

    await expect(
      resolveCustomerOrgForVendor('vendor_org', 'vendor_org'),
    ).resolves.toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('rejects unlinked customer organizations', async () => {
    const { resolveCustomerOrgForVendor } = await import('../vendor-customers');
    fromMock.mockReturnValueOnce(
      organizationLookupResponse({
        id: 'customer_org',
        name: 'Customer Org',
        slug: 'customer-org',
        plan: 'pro',
        created_at: '2026-04-29T00:00:00.000Z',
        vendor_org_id: 'other_vendor_org',
        deleted_at: null,
      }),
    );

    await expect(
      resolveCustomerOrgForVendor('vendor_org', 'customer_org'),
    ).resolves.toBeNull();
  });

  it('rejects deleted customer organizations', async () => {
    const { resolveCustomerOrgForVendor } = await import('../vendor-customers');
    fromMock.mockReturnValueOnce(
      organizationLookupResponse({
        id: 'customer_org',
        name: 'Customer Org',
        slug: 'customer-org',
        plan: 'pro',
        created_at: '2026-04-29T00:00:00.000Z',
        vendor_org_id: 'vendor_org',
        deleted_at: '2026-04-30T00:00:00.000Z',
      }),
    );

    await expect(
      resolveCustomerOrgForVendor('vendor_org', 'customer_org'),
    ).resolves.toBeNull();
  });
});
