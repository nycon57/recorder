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
    forbidden: (requestId?: string) =>
      Response.json({ message: 'Forbidden', requestId }, { status: 403 }),
    internalError: (requestId?: string) =>
      Response.json({ message: 'Internal error', requestId }, { status: 500 }),
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

let POST: typeof import('../route').POST;

function makeRequest(body?: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/recordings/rec_1/finalize', {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe('POST /api/recordings/[id]/finalize', () => {
  const contentUpdate = jest.fn();
  const jobsInsert = jest.fn();
  const storageList = jest.fn();
  let contentRow: Record<string, unknown>;

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireOrg.mockImplementation(() => Promise.resolve({
      orgId: 'org_1',
      userId: 'user_1',
      role: 'contributor',
    }));

    contentRow = {
      id: 'rec_1',
      org_id: 'org_1',
      created_by: 'user_1',
      status: 'uploading',
      metadata: { existing: true },
      storage_path_raw: null,
      content_type: 'recording',
      file_type: 'webm',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentSelectChain: any = {
      eq: jest.fn(() => contentSelectChain),
      single: jest.fn(() => Promise.resolve({
        data: contentRow,
        error: null,
      })),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentUpdateChain: any = {
      eq: jest.fn(() => contentUpdateChain),
      select: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: { id: 'rec_1', status: 'transcribing' },
          error: null,
        })),
      })),
    };

    contentUpdate.mockReturnValue(contentUpdateChain);
    jobsInsert.mockImplementation(() => Promise.resolve({ error: null }));

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

      throw new Error(`Unexpected table ${String(table)}`);
    });

    storageList.mockImplementation(() => Promise.resolve({
      data: [{ name: 'raw.webm', metadata: { size: 4096 } }],
      error: null,
    }));
    mockStorageFrom.mockReturnValue({ list: storageList });
  });

  it('preserves the legacy no-body recordings bucket path', async () => {
    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(mockStorageFrom).toHaveBeenCalledWith('recordings');
    expect(storageList).toHaveBeenCalledWith('org_org_1/recordings/rec_1', {
      limit: 10,
      search: 'raw.webm',
    });
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path_raw: 'org_org_1/recordings/rec_1/raw.webm',
        metadata: expect.objectContaining({
          existing: true,
          sizeBytes: 4096,
          storageBucket: 'recordings',
        }),
      }),
    );
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcribe',
        payload: expect.objectContaining({
          storagePath: 'org_org_1/recordings/rec_1/raw.webm',
          storageBucket: 'recordings',
        }),
      }),
    );
  });

  it('rejects reader users before loading or mutating the recording', async () => {
    mockRequireOrg.mockImplementation(() => Promise.resolve({
      orgId: 'org_1',
      userId: 'reader_1',
      role: 'reader',
    }));

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(403);
    expect(mockDbFrom).not.toHaveBeenCalled();
    expect(storageList).not.toHaveBeenCalled();
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('rejects contributors finalizing another user recording', async () => {
    contentRow.created_by = 'other_user';

    const response = await POST(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(403);
    expect(storageList).not.toHaveBeenCalled();
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('accepts content storage paths and respects startProcessing false', async () => {
    const response = await POST(makeRequest({
      storagePath: 'org_1/recordings/rec_1/raw.webm',
      storageBucket: 'content',
      startProcessing: false,
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(mockStorageFrom).toHaveBeenCalledWith('content');
    expect(storageList).toHaveBeenCalledWith('org_1/recordings/rec_1', {
      limit: 10,
      search: 'raw.webm',
    });
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
        status: 'uploaded',
      }),
    );
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('treats duplicate transcription enqueue as an idempotent finalize success', async () => {
    jobsInsert.mockImplementation(() =>
      Promise.resolve({
        error: { code: '23505', message: 'duplicate key value' },
      }),
    );

    const response = await POST(makeRequest({
      storagePath: 'org_1/recordings/rec_1/raw.webm',
      storageBucket: 'content',
      idempotencyKey: 'idem_existing_1',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toMatchObject({
      recovered: true,
      message: 'Upload already finalized. Transcription will begin shortly.',
    });
  });

  it('does not regress status when the same finalize request is retried', async () => {
    jobsInsert.mockImplementation(() =>
      Promise.resolve({
        error: { code: '23505', message: 'duplicate key value' },
      }),
    );
    contentRow = {
      id: 'rec_1',
      org_id: 'org_1',
      created_by: 'user_1',
      status: 'transcribed',
      metadata: {
        existing: true,
        upload_idempotency_key: 'idem_existing_1',
      },
      storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
      content_type: 'recording',
      file_type: 'webm',
    };

    const response = await POST(makeRequest({
      storagePath: 'org_1/recordings/rec_1/raw.webm',
      storageBucket: 'content',
      idempotencyKey: 'idem_existing_1',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(contentUpdate).not.toHaveBeenCalled();
    const json = await response.json();
    expect(json.data).toMatchObject({
      recovered: true,
      message: 'Upload already finalized. Transcription will begin shortly.',
    });
  });
});
