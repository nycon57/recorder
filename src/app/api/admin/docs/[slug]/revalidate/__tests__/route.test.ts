/** @jest-environment node */

/**
 * Unit tests for POST /api/admin/docs/[slug]/revalidate
 *
 * Tests:
 * - non-system-admin → requireSystemAdmin throws, revalidateTag not called
 * - system-admin, valid slug → 200 + revalidateTag called with both tags
 * - slug with slash separators → correct per-slug tag
 * - missing slug → 400
 *
 * TRIB-154
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Module-scope mock fns (defined before jest.mock factories) ────────────────
// These are created in the test module scope using the `jest` from @jest/globals.
// The factories below close over these variables by reference — they're assigned
// by the time the factory is invoked (at first module require, after the imports
// and const declarations run).

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';

const mockRequireSystemAdmin = jest.fn();
const mockRevalidateTag = jest.fn();

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth/auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('@/lib/auth/permissions', () => ({
  ac: { newRole: jest.fn((p: unknown) => ({ permissions: p })) },
  owner: {},
  admin: {},
  member: {},
}));
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: { from: jest.fn() },
  createClient: jest.fn(),
}));
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));
jest.mock('@/lib/services/cache', () => ({
  UserCache: { get: jest.fn(), set: jest.fn() },
}));
jest.mock('next/headers', () => ({
  headers: () => Promise.resolve(new Map()),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
jest.mock('@/lib/utils/api', () => ({
  // Pass handler through — no wrapping needed for unit tests
  apiHandler: (fn: (...args: any[]) => any) => fn,
  // Delegate to the module-scope jest.fn() so tests can control behavior
  requireSystemAdmin: (...args: unknown[]) => mockRequireSystemAdmin(...args),
}));
jest.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(slug: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/docs/${encodeURIComponent(slug)}/revalidate`,
    { method: 'POST' },
  );
}

function makeContext(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/docs/[slug]/revalidate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  test('does not call revalidateTag when requireSystemAdmin throws', async () => {
    (mockRequireSystemAdmin as any).mockRejectedValue(
      new Error('System admin privileges required'),
    );

    const { POST } = await import('../route');

    try {
      await POST(makeRequest('system-admin/feature-flags'), makeContext('system-admin/feature-flags'));
    } catch {
      // expected — apiHandler is a pass-through in mock
    }

    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });

  test('returns 200 and calls revalidateTag with both tags for system admin', async () => {
    (mockRequireSystemAdmin as any).mockResolvedValue({
      userId: 'user-1',
      email: 'admin@example.com',
      isSystemAdmin: true,
    });

    const { POST } = await import('../route');

    const slug = 'system-admin/feature-flags';
    const response = (await POST(makeRequest(slug), makeContext(slug))) as Response;

    expect(response.status).toBe(200);

    const body = (await response.json()) as { ok: boolean; slug: string };
    expect(body.ok).toBe(true);
    expect(body.slug).toBe(slug);

    expect(mockRevalidateTag).toHaveBeenCalledWith('docs:db', 'everything');
    expect(mockRevalidateTag).toHaveBeenCalledWith(`docs:db:body:${slug}`, 'everything');
    expect(mockRevalidateTag).toHaveBeenCalledTimes(2);
  });

  test('busts per-slug tag for slug containing slashes', async () => {
    (mockRequireSystemAdmin as any).mockResolvedValue({
      userId: 'user-1',
      email: 'admin@example.com',
      isSystemAdmin: true,
    });

    const { POST } = await import('../route');

    const slug = 'platform-runbooks/deployment-lifecycle';
    const response = (await POST(makeRequest(slug), makeContext(slug))) as Response;

    expect(response.status).toBe(200);
    expect(mockRevalidateTag).toHaveBeenCalledWith(
      `docs:db:body:${slug}`,
      'everything',
    );
  });

  test('returns 400 when slug is empty string', async () => {
    (mockRequireSystemAdmin as any).mockResolvedValue({
      userId: 'user-1',
      isSystemAdmin: true,
    });

    const { POST } = await import('../route');

    const response = (await POST(
      new NextRequest('http://localhost/api/admin/docs//revalidate', { method: 'POST' }),
      makeContext(''),
    )) as Response;

    expect(response.status).toBe(400);
    expect(mockRevalidateTag).not.toHaveBeenCalled();
  });
});
