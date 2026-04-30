/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const rpcMock = jest.fn<
  () => Promise<{ data: unknown[]; error: unknown | null }>
>();

jest.mock('@/lib/utils/api', () => ({
  requireOrg: jest.fn(),
  errors: {
    badRequest: (message: string) =>
      Response.json({ code: 'BAD_REQUEST', message }, { status: 400 }),
    unauthorized: () =>
      Response.json({ code: 'UNAUTHORIZED', message: 'Unauthorized' }, { status: 401 }),
    forbidden: () =>
      Response.json(
        {
          code: 'FORBIDDEN',
          message: 'You do not have permission to perform this action',
        },
        { status: 403 }
      ),
    notFound: (resource: string) =>
      Response.json(
        { code: 'NOT_FOUND', message: `${resource} not found` },
        { status: 404 }
      ),
    internalError: () =>
      Response.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'An internal server error occurred',
        },
        { status: 500 }
      ),
  },
  successResponse: (data: unknown) => Response.json({ data }, { status: 200 }),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    rpc: rpcMock,
  })),
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
  }),
}));

jest.mock('@/lib/services/wiki-review', () => ({
  extractPendingContradictions: jest.fn(() => []),
  readCompilationLog: jest.fn((value: unknown) => value),
}));

const { requireOrg } = jest.requireMock('@/lib/utils/api') as {
  requireOrg: jest.MockedFunction<
    () => Promise<{ orgId: string; userId: string }>
  >;
};

let GET: typeof import('../route').GET;

describe('GET /api/knowledge/wiki-pages/[id]/history', () => {
  const currentPageId = '11111111-1111-1111-1111-111111111111';
  const previousPageId = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    ({ GET } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockReset();
    requireOrg.mockResolvedValue({
      orgId: 'org-1',
      userId: 'user-1',
    });
  });

  it('returns the version chain with the current head id from get_org_wiki_page_history', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: currentPageId,
          org_id: 'org-1',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal qualification',
          content: 'Use MEDDICC before handoff.',
          confidence: 0.93,
          valid_from: '2026-04-20T00:00:00.000Z',
          valid_until: null,
          supersedes_id: previousPageId,
          compilation_log: null,
          created_at: '2026-04-20T00:00:00.000Z',
          updated_at: '2026-04-20T00:05:00.000Z',
        },
        {
          id: previousPageId,
          org_id: 'org-1',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal qualification',
          content: 'Old handoff guidance.',
          confidence: 0.81,
          valid_from: '2026-04-19T00:00:00.000Z',
          valid_until: '2026-04-20T00:00:00.000Z',
          supersedes_id: null,
          compilation_log: null,
          created_at: '2026-04-19T00:00:00.000Z',
          updated_at: '2026-04-19T00:05:00.000Z',
        },
      ],
      error: null,
    });

    const response = await GET(
      new Request(
        `http://localhost:3000/api/knowledge/wiki-pages/${previousPageId}/history`
      ) as unknown as NextRequest,
      { params: Promise.resolve({ id: previousPageId }) }
    );

    expect(rpcMock).toHaveBeenCalledWith('get_org_wiki_page_history', {
      p_page_id: previousPageId,
      p_org_id: 'org-1',
    });
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      data: {
        id: previousPageId,
        headId: currentPageId,
        versionCount: 2,
        versions: [
          expect.objectContaining({
            id: currentPageId,
            knowledge_status: 'live',
          }),
          expect.objectContaining({
            id: previousPageId,
            knowledge_status: 'superseded',
          }),
        ],
      },
    });
  });

  it('returns not found when the history RPC returns no rows', async () => {
    rpcMock.mockResolvedValue({
      data: [],
      error: null,
    });

    const response = await GET(
      new Request('http://localhost:3000/api/knowledge/wiki-pages/page-missing/history') as unknown as NextRequest,
      { params: Promise.resolve({ id: '11111111-1111-1111-1111-111111111111' }) }
    );

    expect(response.status).toBe(404);
  });
});
