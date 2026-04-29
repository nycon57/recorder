/** @jest-environment node */

import type { NextRequest } from 'next/server';
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const mockRequireOrg = jest.fn();
const mockCheckAndConsumeQuota = jest.fn();
const mockReleaseQuota = jest.fn();
const mockDbFrom = jest.fn();
const mockStorageFrom = jest.fn();

type MockHandler = (...args: unknown[]) => unknown;

jest.mock('@/lib/utils/api', () => ({
  apiHandler: <THandler extends MockHandler>(fn: THandler) => fn,
  requireOrg: (...args: unknown[]) => mockRequireOrg(...args),
  successResponse: (data: unknown, requestId?: string, status = 200) =>
    Response.json({ data, requestId }, { status }),
  errors: {
    badRequest: (message: string, details?: unknown, requestId?: string) =>
      Response.json({ message, details, requestId }, { status: 400 }),
    internalError: (requestId?: string) =>
      Response.json({ message: 'Internal error', requestId }, { status: 500 }),
    quotaExceeded: (details?: unknown) =>
      Response.json({ message: 'Quota exceeded', details }, { status: 402 }),
  },
  generateRequestId: () => 'req_test',
}));

jest.mock('@/lib/rate-limit/middleware', () => ({
  withRateLimit: <THandler extends MockHandler>(handler: THandler) => handler,
}));

jest.mock('@/lib/services/quotas/quota-manager', () => ({
  QuotaManager: {
    checkAndConsumeQuota: (...args: unknown[]) =>
      mockCheckAndConsumeQuota(...args),
    releaseQuota: (...args: unknown[]) => mockReleaseQuota(...args),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockDbFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

let POST: typeof import('../route').POST;

describe('POST /api/recordings/upload/init', () => {
  const createSignedUploadUrl = jest.fn();
  let existingUpload: Record<string, unknown> | null;

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    existingUpload = null;

    mockRequireOrg.mockImplementation(() => Promise.resolve({
      orgId: 'org_1',
      userId: 'user_1',
    }));
    mockCheckAndConsumeQuota.mockImplementation(() => Promise.resolve({
      allowed: true,
      remaining: 5,
      limit: 10,
      resetAt: new Date('2026-04-23T00:00:00.000Z'),
      message: 'ok',
    }));

    mockDbFrom.mockImplementation((table) => {
      if (table !== 'content') {
        throw new Error(`Unexpected table ${String(table)}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const selectChain: any = {
        eq: jest.fn(() => selectChain),
        order: jest.fn(() => selectChain),
        limit: jest.fn(() => selectChain),
        maybeSingle: jest.fn(() => Promise.resolve({
          data: existingUpload,
          error: null,
        })),
      };

      return {
        select: jest.fn(() => selectChain),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(() => Promise.resolve({
              data: { id: 'rec_1' },
              error: null,
            })),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn(() => Promise.resolve({ error: null })),
        }),
      };
    });

    createSignedUploadUrl.mockImplementation((path) =>
      Promise.resolve({
        data: {
          signedUrl: `https://storage.test/${path}`,
          token: `token:${path}`,
          path,
        },
        error: null,
      }),
    );
    mockStorageFrom.mockReturnValue({ createSignedUploadUrl });
  });

  it('uses the content storage contract path and returns uploadBucket', async () => {
    const response = await POST(
      new Request('http://localhost/api/recordings/upload/init', {
        method: 'POST',
        body: JSON.stringify({
          filename: 'screen demo.webm',
          mimeType: 'video/webm',
          fileSize: 1024,
        }),
      }) as unknown as NextRequest,
    );

    expect(response.status).toBe(201);
    expect(mockStorageFrom).toHaveBeenNthCalledWith(1, 'content');
    expect(createSignedUploadUrl).toHaveBeenNthCalledWith(
      1,
      'org_1/recordings/rec_1/raw.webm',
      { upsert: false },
    );

    const json = await response.json();
    expect(json.data).toMatchObject({
      recordingId: 'rec_1',
      uploadBucket: 'content',
      uploadPath: 'org_1/recordings/rec_1/raw.webm',
      thumbnailPath: 'org_org_1/recordings/rec_1/thumbnail.jpg',
    });
  });

  it('reuses an existing extension upload for the same idempotency key', async () => {
    existingUpload = {
      id: 'rec_existing',
      status: 'uploading',
      content_type: 'recording',
      file_type: 'webm',
    };

    const response = await POST(
      new Request('http://localhost/api/recordings/upload/init', {
        method: 'POST',
        headers: { 'Idempotency-Key': 'idem_existing_1' },
        body: JSON.stringify({
          filename: 'screen demo.webm',
          mimeType: 'video/webm',
          fileSize: 1024,
          source: 'extension',
        }),
      }) as unknown as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mockCheckAndConsumeQuota).not.toHaveBeenCalled();
    const json = await response.json();
    expect(json.data).toMatchObject({
      recordingId: 'rec_existing',
      uploadPath: 'org_1/recordings/rec_existing/raw.webm',
      recovered: true,
      currentStatus: 'uploading',
    });
  });
});
