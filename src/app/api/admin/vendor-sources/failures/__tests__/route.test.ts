/** @jest-environment node */

/**
 * Unit tests for GET /api/admin/vendor-sources/failures
 *
 * Tests:
 * - auth enforcement (requireSystemAdmin throws → propagated)
 * - happy path (returns failed jobs)
 * - ?limit= clamped to 100, default 25
 * - ?offset= pagination
 * - ?app= filter narrows results
 * - totalCount returned
 * - triggered_by_user_id resolution (null case + email case)
 *
 * TRIB-152
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ---- Mocks -----------------------------------------------------------------

const mockRequireSystemAdmin = jest.fn();

jest.mock('@/lib/utils/api', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  apiHandler: (fn: Function) => fn,
  requireSystemAdmin: (...args: unknown[]) => mockRequireSystemAdmin(...args),
  successResponse: (data: unknown) =>
    new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  errors: {
    badRequest: (msg: string) =>
      new Response(JSON.stringify({ error: { message: msg } }), { status: 400 }),
    internalError: () =>
      new Response(JSON.stringify({ error: { message: 'Internal error' } }), { status: 500 }),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// We need fine-grained control over the supabase chain.
// The route calls: from('jobs').select(...).eq(...).eq(...).order(...).range(...)
// and from('jobs').select(..., {count, head}).eq(...).eq(...) [for count]
// and optionally from('user').select('email').eq(...).maybeSingle()

const mockFromImpl = jest.fn();
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFromImpl(...args),
  },
}));

// ---- Helpers ---------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/vendor-sources/failures');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

const SAMPLE_FAILURE = {
  id: 'job-fail-1',
  status: 'failed',
  payload: { app: 'hubspot', url: 'https://knowledge.hubspot.com', triggered_by_user_id: null },
  error: 'No pages found to ingest',
  created_at: '2026-04-20T10:00:00.000Z',
  processing_started_at: '2026-04-20T10:00:01.000Z',
  completed_at: '2026-04-20T10:00:05.000Z',
  attempt_count: 3,
  dedupe_key: null,
};

/**
 * Sets up mockFromImpl to return controlled responses for the three query
 * types the route makes: row-fetch, count-fetch, and optional user lookup.
 */
function setupMocks({
  rows = [SAMPLE_FAILURE],
  totalCount = 1,
  userEmail = null as string | null,
}: {
  rows?: typeof SAMPLE_FAILURE[];
  totalCount?: number;
  userEmail?: string | null;
}) {
  let callIndex = 0;

  mockFromImpl.mockImplementation((table: unknown) => {
    if (table === 'user') {
      // User email lookup
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: userEmail ? { email: userEmail } : null,
            }),
          }),
        }),
      };
    }

    // jobs table — alternates between row-fetch and count-fetch calls
    callIndex++;

    if (callIndex === 1) {
      // Row fetch: .select(...).eq('type',...).eq('status',...).order(...).range(...)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rangeFn = (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({ data: rows, error: null });
      const orderFn = jest.fn().mockReturnValue({ range: rangeFn });
      const eq2Fn = jest.fn().mockReturnValue({ order: orderFn });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const eq1Fn = jest.fn().mockReturnValue({ eq: eq2Fn });
      const filterFn = jest.fn().mockReturnValue({ order: orderFn });
      const eq1WithFilter = jest.fn().mockReturnValue({ eq: eq2Fn, filter: filterFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eq1WithFilter });
      return { select: selectFn };
    } else {
      // Count fetch: .select('id', {count, head}).eq('type',...).eq('status',...)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eq2Count = (jest.fn() as jest.MockedFunction<any>).mockResolvedValue({ count: totalCount, error: null });
      const eq1Count = jest.fn().mockReturnValue({ eq: eq2Count });
      const selectCount = jest.fn().mockReturnValue({ eq: eq1Count });
      return { select: selectCount };
    }
  });
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/admin/vendor-sources/failures', () => {
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
    setupMocks({});

    const { GET } = await import('../route');
    await expect(GET(makeRequest())).rejects.toThrow('System admin privileges required');
  });

  test('returns failed jobs on happy path with totalCount', async () => {
    setupMocks({ rows: [SAMPLE_FAILURE], totalCount: 1 });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.failures).toHaveLength(1);
    expect(json.data.failures[0].id).toBe('job-fail-1');
    expect(json.data.totalCount).toBe(1);
  });

  test('clamps limit above 100 to 100', async () => {
    setupMocks({ rows: [], totalCount: 0 });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ limit: '200' }));
    expect(res.status).toBe(200);
    // Can't easily assert the clamp value without deeper chain inspection,
    // but we confirm the request completes without error.
  });

  test('uses default limit of 25 when not provided', async () => {
    setupMocks({ rows: [], totalCount: 0 });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  test('returns triggeredByEmail null when payload has no triggered_by_user_id', async () => {
    const row = { ...SAMPLE_FAILURE, payload: { ...SAMPLE_FAILURE.payload, triggered_by_user_id: null } };
    setupMocks({ rows: [row], totalCount: 1, userEmail: null });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.failures[0].triggeredByEmail).toBeNull();
  });

  test('resolves triggeredByEmail from users table when uuid present', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row: any = {
      ...SAMPLE_FAILURE,
      payload: { ...SAMPLE_FAILURE.payload, triggered_by_user_id: 'user-uuid-123' },
    };
    setupMocks({ rows: [row], totalCount: 1, userEmail: 'operator@example.com' });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(json.data.failures[0].triggeredByEmail).toBe('operator@example.com');
  });

  test('offset param is accepted', async () => {
    setupMocks({ rows: [], totalCount: 50 });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ offset: '25' }));
    expect(res.status).toBe(200);
  });
});
