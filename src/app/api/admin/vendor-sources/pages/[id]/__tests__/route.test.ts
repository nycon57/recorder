/** @jest-environment node */

/**
 * Unit tests for GET /api/admin/vendor-sources/pages/[id]
 *
 * Tests auth enforcement (non-system-admin → thrown error),
 * happy path (row exists → 200), and not-found (404).
 *
 * TRIB-149
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ---- Mocks (hoisted) -------------------------------------------------------

const mockRequireSystemAdmin = jest.fn();

// Supabase chain builder — returns a fluent mock chain
const mockSingle = jest.fn();
const buildChain = (singleResult: unknown) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockSingle as any).mockResolvedValue(singleResult);
  const single = mockSingle;
  const eq = jest.fn().mockReturnValue({ single });
  const select = jest.fn().mockReturnValue({ eq });
  return { select };
};

const mockFrom = jest.fn();

jest.mock('@/lib/utils/api', () => ({
  apiHandler: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  requireSystemAdmin: (...args: unknown[]) => mockRequireSystemAdmin(...args),
  successResponse: (data: unknown) =>
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  errors: {
    badRequest: (msg: string) =>
      new Response(JSON.stringify({ error: { message: msg } }), { status: 400 }),
    notFound: (entity: string) =>
      new Response(JSON.stringify({ error: { message: `${entity} not found` } }), { status: 404 }),
    internalError: () =>
      new Response(JSON.stringify({ error: { message: 'Internal error' } }), { status: 500 }),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

// ---- Helpers ---------------------------------------------------------------

function makeRequest(id: string): [NextRequest, { params: Promise<{ id: string }> }] {
  return [
    new NextRequest(`http://localhost/api/admin/vendor-sources/pages/${id}`),
    { params: Promise.resolve({ id }) },
  ];
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/admin/vendor-sources/pages/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockRequireSystemAdmin as any).mockResolvedValue({
      userId: 'admin-user-id',
      email: 'admin@test.com',
      isSystemAdmin: true,
    });
  });

  test('propagates error when requireSystemAdmin throws', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockRequireSystemAdmin as any).mockRejectedValue(
      new Error('System admin privileges required'),
    );

    const { GET } = await import('../route');
    const [req, ctx] = makeRequest('some-page-id');

    await expect(GET(req, ctx)).rejects.toThrow('System admin privileges required');
  });

  test('returns 200 with page data when row exists', async () => {
    const mockPage = {
      id: 'page-uuid-1',
      app: 'hubspot',
      screen: 'contacts/view-and-filter',
      source_url: 'https://knowledge.hubspot.com/contacts/view-and-filter',
      content_hash: 'sha256:abc123',
      created_at: '2026-04-20T10:00:00.000Z',
      updated_at: '2026-04-20T11:00:00.000Z',
      vendor_source_id: null,
      curated_by: null,
      ingest_job_id: null,
    };

    const chain = buildChain({ data: mockPage, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFrom as any).mockReturnValue(chain);

    const { GET } = await import('../route');
    const [req, ctx] = makeRequest('page-uuid-1');

    const res = await GET(req, ctx);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.page.id).toBe('page-uuid-1');
    expect(json.data.page.app).toBe('hubspot');
    expect(json.data.parentSource).toBeNull();
  });

  test('returns 404 when page does not exist', async () => {
    const chain = buildChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockFrom as any).mockReturnValue(chain);

    const { GET } = await import('../route');
    const [req, ctx] = makeRequest('nonexistent-id');

    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });
});
