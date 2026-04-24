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
    notFound: (resource: string, requestId?: string) =>
      Response.json({ message: `${resource} not found`, requestId }, { status: 404 }),
    internalError: (requestId?: string) =>
      Response.json({ message: 'Internal error', requestId }, { status: 500 }),
  },
  generateRequestId: () => 'req_test',
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

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/recordings/rec_1/metadata', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe('POST /api/recordings/[id]/metadata', () => {
  const contentUpdate = jest.fn();
  const jobsInsert = jest.fn();
  const eventsInsert = jest.fn();
  const storageList = jest.fn();

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireOrg.mockImplementation(() => Promise.resolve({
      orgId: 'org_1',
      userId: 'user_1',
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentSelectChain: any = {
      eq: jest.fn(() => contentSelectChain),
      single: jest.fn(() => Promise.resolve({
        data: {
          id: 'rec_1',
          org_id: 'org_1',
          status: 'uploading',
          content_type: 'recording',
          file_type: 'webm',
          metadata: { source: 'upload_wizard' },
        },
        error: null,
      })),
    };

    contentUpdate.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    jobsInsert.mockImplementation(() => Promise.resolve({ error: null }));
    eventsInsert.mockImplementation(() => Promise.resolve({ error: null }));

    mockDbFrom.mockImplementation((table) => {
      if (table === 'content') {
        return {
          select: jest.fn(() => contentSelectChain),
          update: contentUpdate,
        };
      }

      if (table === 'jobs') {
        return { insert: jobsInsert };
      }

      if (table === 'events') {
        return { insert: eventsInsert };
      }

      throw new Error(`Unexpected table ${String(table)}`);
    });

    storageList.mockImplementation(() => Promise.resolve({
      data: [{ name: 'raw.webm', metadata: { size: 1024 } }],
      error: null,
    }));
    mockStorageFrom.mockReturnValue({ list: storageList });
  });

  it('verifies the content object and enqueues transcribe with storageBucket', async () => {
    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(mockStorageFrom).toHaveBeenCalledWith('content');
    expect(storageList).toHaveBeenCalledWith('org_1/recordings/rec_1');
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
      }),
    );
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcribe',
        payload: expect.objectContaining({
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/raw.webm',
          storageBucket: 'content',
        }),
      }),
    );
    const firstJob = jobsInsert.mock.calls[0][0] as {
      payload: Record<string, unknown>;
    };
    expect(firstJob.payload).not.toHaveProperty('audioPath');
  });

  it('rejects storage paths outside the authenticated recording contract', async () => {
    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/other/raw.webm',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(400);
    expect(storageList).not.toHaveBeenCalled();
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });
});
