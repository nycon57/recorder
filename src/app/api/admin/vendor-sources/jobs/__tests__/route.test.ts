/** @jest-environment node */

/**
 * Unit tests for GET /api/admin/vendor-sources/jobs
 *
 * Tests:
 * - auth enforcement (requireSystemAdmin throws → propagated)
 * - happy path (returns sorted jobs array)
 * - ?limit= clamped to 50
 * - ?status= filter — valid values pass, invalid value → 400
 *
 * TRIB-149
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

// ---- Mocks -----------------------------------------------------------------

const mockRequireSystemAdmin = jest.fn();
const mockQueryResult = jest.fn();
const mockFrom = jest.fn();

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
      new Response(JSON.stringify({ error: { message: msg } }), {
        status: 400,
      }),
    internalError: () =>
      new Response(JSON.stringify({ error: { message: 'Internal error' } }), {
        status: 500,
      }),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// ---- Helpers ---------------------------------------------------------------

/** Build a URL with optional query params */
function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/admin/vendor-sources/jobs');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

/**
 * The jobs route builds a query chain:
 * .from('jobs').select(...).eq('type', ...).order(...).limit(n)
 * and optionally adds .eq('status', ...) before .limit.
 *
 * We build a simple chainable mock that resolves at the end with mockQueryResult.
 */
function buildQueryChain(result: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockQueryResult as any).mockResolvedValue(result);

  // The limit() call at the end resolves the query
  const limitFn = mockQueryResult;

  // The query chain in the route:
  //   .from('jobs')
  //   .select(...)
  //   .eq('type', 'ingest_vendor_docs')
  //   .order('created_at', { ascending: false })
  //   .limit(n)               <-- default path (no status filter)
  // OR:
  //   .limit(n).eq('status', statusParam)  -- NO, the route mutates query:
  //
  // Actual route code:
  //   let query = supabaseAdmin.from('jobs').select(...).eq(...).order(...).limit(limit);
  //   if (statusParam) query = query.eq('status', statusParam);
  //   const result = await query;
  //
  // So `query` after .limit() must also be awaitable AND have .eq().
  // We make limitFn return an object that has .eq AND is a thenable.

  const statusFilterResult = {
    then: (resolve: (v: unknown) => unknown) => resolve(result),
    catch: (reject: (e: unknown) => unknown) => {
      void reject;
      return statusFilterResult;
    },
  };

  const eqStatus = jest.fn().mockReturnValue(statusFilterResult);

  const limitResult = {
    then: (resolve: (v: unknown) => unknown) => resolve(result),
    catch: (reject: (e: unknown) => unknown) => {
      void reject;
      return limitResult;
    },
    eq: eqStatus,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (limitFn as any).mockReturnValue(limitResult);

  // order(...) chains to { limit }
  const orderFn = jest.fn().mockReturnValue({ limit: limitFn });

  // eq('type', ...) chains to { order }
  const eqType = jest.fn().mockReturnValue({ order: orderFn });

  // select(...) chains to { eq }
  const selectFn = jest.fn().mockReturnValue({ eq: eqType });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockFrom as any).mockReturnValue({ select: selectFn });

  return { limitFn };
}

// ---- Tests -----------------------------------------------------------------

describe('GET /api/admin/vendor-sources/jobs', () => {
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
    buildQueryChain({ data: [], error: null });

    const { GET } = await import('../route');
    await expect(GET(makeRequest())).rejects.toThrow(
      'System admin privileges required',
    );
  });

  test('returns jobs on happy path', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        status: 'completed',
        payload: {
          app: 'hubspot',
          url: 'https://knowledge.hubspot.com',
          triggered_by_user_id: 'user-1',
        },
        error: null,
        created_at: '2026-04-20T12:00:00.000Z',
        processing_started_at: '2026-04-20T12:00:05.000Z',
        completed_at: '2026-04-20T12:01:00.000Z',
        attempt_count: 1,
        dedupe_key: 'ingest_vendor_docs:source:src-1',
      },
    ];

    buildQueryChain({ data: mockJobs, error: null });

    const { GET } = await import('../route');
    const res = await GET(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.jobs).toHaveLength(1);
    expect(json.data.jobs[0].id).toBe('job-1');
  });

  test('defaults to limit=10 when no param given', async () => {
    const { limitFn } = buildQueryChain({ data: [], error: null });

    const { GET } = await import('../route');
    await GET(makeRequest());

    expect(limitFn).toHaveBeenCalledWith(10);
  });

  test('clamps limit to 50 when param is 100', async () => {
    const { limitFn } = buildQueryChain({ data: [], error: null });

    const { GET } = await import('../route');
    await GET(makeRequest({ limit: '100' }));

    expect(limitFn).toHaveBeenCalledWith(50);
  });

  test('returns 400 for invalid status filter', async () => {
    buildQueryChain({ data: [], error: null });

    const { GET } = await import('../route');
    const res = await GET(makeRequest({ status: 'running' }));

    expect(res.status).toBe(400);
  });

  test('accepts all valid status filter values', async () => {
    const validStatuses = ['pending', 'processing', 'completed', 'failed'];

    await Promise.all(
      Array.from(validStatuses).map(async (status) => {
        buildQueryChain({ data: [], error: null });
        const { GET } = await import('../route');
        const res = await GET(makeRequest({ status }));
        expect(res.status).toBe(200);
      }),
    );
  });
});
