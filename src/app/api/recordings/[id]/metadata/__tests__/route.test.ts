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
      content_type: 'recording',
      file_type: 'webm',
      storage_path_raw: null,
      metadata: { source: 'upload_wizard' },
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
      then: (resolve: (value: { error: null }) => unknown) =>
        Promise.resolve({ error: null }).then(resolve),
    };
    contentUpdate.mockReturnValue(contentUpdateChain);
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
    expect(storageList).toHaveBeenCalledWith('org_1/recordings/rec_1', {
      limit: 10,
      search: 'raw.webm',
    });
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

  it('rejects reader users before loading or mutating the recording', async () => {
    mockRequireOrg.mockImplementation(() => Promise.resolve({
      orgId: 'org_1',
      userId: 'reader_1',
      role: 'reader',
    }));

    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(403);
    expect(mockDbFrom).not.toHaveBeenCalled();
    expect(storageList).not.toHaveBeenCalled();
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('rejects contributors submitting metadata for another user recording', async () => {
    contentRow.created_by = 'other_user';

    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(403);
    expect(storageList).not.toHaveBeenCalled();
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
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

  it('treats repeated metadata with the same idempotency key as success', async () => {
    jobsInsert.mockImplementation(() =>
      Promise.resolve({
        error: { code: '23505', message: 'duplicate key value' },
      }),
    );

    contentRow = {
      id: 'rec_1',
      org_id: 'org_1',
      created_by: 'user_1',
      status: 'transcribing',
      content_type: 'recording',
      file_type: 'webm',
      storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
      metadata: {
        source: 'extension',
        upload_idempotency_key: 'idem_existing_1',
      },
    };

    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
      idempotencyKey: 'idem_existing_1',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toMatchObject({
      success: true,
      recordingId: 'rec_1',
      recovered: true,
    });
    expect(contentUpdate).not.toHaveBeenCalled();
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupe_key: 'transcribe:rec_1',
      }),
    );
  });

  it('rolls metadata status back to uploading when job enqueue fails', async () => {
    jobsInsert.mockImplementation(() =>
      Promise.resolve({
        error: { message: 'queue unavailable' },
      }),
    );

    const response = await POST(makeRequest({
      title: 'Screen demo',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
    }), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(500);
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
        status: 'uploaded',
      }),
    );
    expect(contentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'uploading',
      }),
    );
  });
});
