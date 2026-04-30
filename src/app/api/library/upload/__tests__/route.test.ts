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

const mockRequireOrg =
  jest.fn<() => Promise<{ orgId: string; userId: string; role: string }>>();
const mockQuotaCheck = jest.fn<
  () => Promise<{
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: Date;
    message?: string;
  }>
>();
const mockReleaseQuota = jest.fn<() => Promise<boolean>>();
const mockFrom = jest.fn<(table: string) => unknown>();
const mockStorageFrom = jest.fn<(bucket: string) => unknown>();
const storageRemove =
  jest.fn<(paths: string[]) => Promise<{ data: unknown; error: null }>>();

jest.mock('@/lib/utils/api', () => ({
  apiHandler:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
  requireOrg: () => mockRequireOrg(),
  generateRequestId: () => 'req_1',
  successResponse: (data: unknown, _requestId?: string, status = 200) =>
    Response.json({ data }, { status }),
  errors: {
    badRequest: (message: string, details?: unknown, requestId?: string) =>
      Response.json({ error: message, details, requestId }, { status: 400 }),
    internalError: (requestId?: string) =>
      Response.json(
        { error: 'Internal server error', requestId },
        { status: 500 },
      ),
    forbidden: (requestId?: string) =>
      Response.json({ error: 'Forbidden', requestId }, { status: 403 }),
    quotaExceeded: (details: unknown) =>
      Response.json({ error: 'Quota exceeded', details }, { status: 402 }),
  },
}));

jest.mock('@/lib/rate-limit/middleware', () => ({
  withRateLimit:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
}));

jest.mock('@/lib/services/quotas/quota-manager', () => ({
  QuotaManager: {
    checkAndConsumeQuota: () => mockQuotaCheck(),
    releaseQuota: () => mockReleaseQuota(),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
    storage: {
      from: (bucket: string) => mockStorageFrom(bucket),
    },
  },
}));

let POST: typeof import('../route').POST;

function makeUploadRequest(
  files: File[],
  options?: Record<string, string>,
): NextRequest {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));
  for (const [key, value] of Object.entries(options ?? {})) {
    formData.append(key, value);
  }

  return new Request('http://localhost/api/library/upload', {
    method: 'POST',
    body: formData,
  }) as unknown as NextRequest;
}

function selectSingle(data: unknown, error: unknown = null) {
  const chain = {
    select: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({ data, error })),
  };
  return chain;
}

describe('POST /api/library/upload', () => {
  const contentInsert = jest.fn<(value: unknown) => unknown>();
  const contentUpdate = jest.fn<(value: unknown) => unknown>();
  const contentDelete = jest.fn<() => unknown>();
  const transcriptInsert = jest.fn<(value: unknown) => unknown>();
  const jobsInsert = jest.fn<(value: unknown) => Promise<{ error: null }>>();
  const storageUpload =
    jest.fn<
      (
        path: string,
        body: ArrayBuffer,
        options: { contentType: string; upsert: boolean },
      ) => Promise<{ data: unknown; error: null }>
    >();
  const createSignedUrl =
    jest.fn<
      (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } }>
    >();

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireOrg.mockResolvedValue({
      orgId: 'org_1',
      userId: 'user_1',
      role: 'contributor',
    });
    mockQuotaCheck.mockResolvedValue({
      allowed: true,
      remaining: 10,
      limit: 20,
      resetAt: new Date('2026-04-29T00:00:00.000Z'),
    });
    mockReleaseQuota.mockResolvedValue(true);

    contentInsert.mockImplementation(() => selectSingle({ id: 'content_1' }));
    contentUpdate.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    contentDelete.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    transcriptInsert.mockImplementation(() =>
      selectSingle({ id: 'transcript_1' }),
    );
    jobsInsert.mockResolvedValue({ error: null });
    storageUpload.mockResolvedValue({ data: {}, error: null });
    storageRemove.mockResolvedValue({ data: {}, error: null });
    createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/content_1' },
    });

    mockStorageFrom.mockReturnValue({
      upload: storageUpload,
      remove: storageRemove,
      createSignedUrl,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'content') {
        return {
          insert: contentInsert,
          update: contentUpdate,
          delete: contentDelete,
        };
      }
      if (table === 'transcripts') {
        return { insert: transcriptInsert };
      }
      if (table === 'jobs') {
        return { insert: jobsInsert };
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('creates a transcript-backed job for text uploads', async () => {
    const response = await POST(
      makeUploadRequest(
        [
          new File(['Customer workflow note'], 'note.txt', {
            type: 'text/plain',
          }),
        ],
        { analysisType: 'sop', skipAnalysis: 'true' },
      ),
    );

    expect(response.status).toBe(201);
    expect(contentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: 'text',
        analysis_type: 'sop',
        skip_analysis: true,
      }),
    );
    expect(transcriptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_id: 'content_1',
        text: 'Customer workflow note',
        provider: 'library_upload',
      }),
    );
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'process_text_note',
        content_id: 'content_1',
        dedupe_key: 'process_text_note:content_1',
        payload: expect.objectContaining({
          recordingId: 'content_1',
          transcriptId: 'transcript_1',
          contentType: 'text',
        }),
      }),
    );
  });

  it('rejects reader users before parsing multipart data or consuming quota', async () => {
    mockRequireOrg.mockResolvedValue({
      orgId: 'org_1',
      userId: 'reader_1',
      role: 'reader',
    });
    const formData = jest.fn<() => Promise<FormData>>();
    const request = {
      headers: new Headers(),
      formData,
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(formData).not.toHaveBeenCalled();
    expect(mockQuotaCheck).not.toHaveBeenCalled();
    expect(contentInsert).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects declared payloads over the library cap before multipart parsing', async () => {
    const formData = jest.fn<() => Promise<FormData>>();
    const request = {
      headers: new Headers({
        'content-length': String(2 * 1024 * 1024 * 1024 + 1),
      }),
      formData,
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
    expect(mockQuotaCheck).not.toHaveBeenCalled();
    expect(contentInsert).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('rejects aggregate parsed files over the library cap before quota or storage', async () => {
    const files = [
      {
        name: 'a.mp4',
        type: 'video/mp4',
        size: 1024 * 1024 * 1024 + 1,
      },
      {
        name: 'b.mp4',
        type: 'video/mp4',
        size: 1024 * 1024 * 1024,
      },
    ] as File[];
    const formData = new FormData();
    const getAll = jest.spyOn(formData, 'getAll').mockReturnValue(files);
    const request = {
      headers: new Headers(),
      formData: jest.fn(() => Promise.resolve(formData)),
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(getAll).toHaveBeenCalledWith('files');
    expect(mockQuotaCheck).not.toHaveBeenCalled();
    expect(contentInsert).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it('accepts WebM as a library video upload', async () => {
    const response = await POST(
      makeUploadRequest([
        new File(['webm bytes'], 'demo.webm', { type: 'video/webm' }),
      ]),
    );

    expect(response.status).toBe(201);
    expect(contentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: 'video',
        file_type: 'webm',
      }),
    );
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'extract_audio',
        content_id: 'content_1',
        dedupe_key: 'extract_audio:content_1',
      }),
    );
  });

  it('rolls back quota, content, and storage when text transcript creation fails', async () => {
    transcriptInsert.mockImplementation(() =>
      selectSingle(null, new Error('transcript insert failed')),
    );

    const response = await POST(
      makeUploadRequest([
        new File(['Customer workflow note'], 'note.txt', {
          type: 'text/plain',
        }),
      ]),
    );

    expect(response.status).toBe(400);
    expect(mockQuotaCheck).toHaveBeenCalledTimes(1);
    expect(mockReleaseQuota).toHaveBeenCalledTimes(1);
    expect(storageRemove).toHaveBeenCalledWith(['org_1/text/content_1.txt']);
    expect(contentDelete).toHaveBeenCalledTimes(1);
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('does not release quota when rollback fails to delete the content row', async () => {
    transcriptInsert.mockImplementation(() =>
      selectSingle(null, new Error('transcript insert failed')),
    );
    contentDelete.mockReturnValue({
      eq: jest.fn(() =>
        Promise.resolve({ error: new Error('content delete failed') }),
      ),
    });

    const response = await POST(
      makeUploadRequest([
        new File(['Customer workflow note'], 'note.txt', {
          type: 'text/plain',
        }),
      ]),
    );

    expect(response.status).toBe(400);
    expect(storageRemove).toHaveBeenCalledWith(['org_1/text/content_1.txt']);
    expect(contentDelete).toHaveBeenCalledTimes(1);
    expect(mockReleaseQuota).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('rolls back content, storage, and quota when an unexpected per-file error occurs', async () => {
    createSignedUrl.mockRejectedValue(new Error('signed URL failed'));

    const response = await POST(
      makeUploadRequest([
        new File(['webm bytes'], 'demo.webm', { type: 'video/webm' }),
      ]),
    );

    expect(response.status).toBe(400);
    expect(storageRemove).toHaveBeenCalledWith(['org_1/videos/content_1.webm']);
    expect(contentDelete).toHaveBeenCalledTimes(1);
    expect(mockReleaseQuota).toHaveBeenCalledTimes(1);
  });
});
