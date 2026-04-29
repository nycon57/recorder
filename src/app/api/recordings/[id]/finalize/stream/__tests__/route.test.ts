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

const mockRequireOrg = jest.fn<() => Promise<{ orgId: string; userId: string }>>();
const mockDbFrom = jest.fn();
const mockStorageFrom = jest.fn();
const mockCreateSSEStream = jest.fn();
const mockCreateSSEResponse = jest.fn<
  (stream: ReadableStream) => Response
>();
const mockSendLog = jest.fn();
const mockSendError = jest.fn();
const mockSendProgress = jest.fn();
const mockSendComplete = jest.fn();
const mockExecuteJobPipelineWithStreaming = jest.fn<
  (jobIds: string[], contentId: string, maxRetries: number) => Promise<void>
>();

type MockHandler = (...args: unknown[]) => unknown;

jest.mock('@/lib/utils/api', () => ({
  apiHandler: <THandler extends MockHandler>(fn: THandler) => fn,
  requireOrg: () => mockRequireOrg(),
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockDbFrom(...args),
    storage: {
      from: (...args: unknown[]) => mockStorageFrom(...args),
    },
  },
}));

jest.mock('@/lib/services/streaming-processor', () => ({
  createSSEStream: (...args: unknown[]) => mockCreateSSEStream(...args),
  createSSEResponse: (stream: ReadableStream) => mockCreateSSEResponse(stream),
  streamingManager: {
    sendLog: (...args: unknown[]) => mockSendLog(...args),
    sendError: (...args: unknown[]) => mockSendError(...args),
    sendProgress: (...args: unknown[]) => mockSendProgress(...args),
    sendComplete: (...args: unknown[]) => mockSendComplete(...args),
  },
}));

jest.mock('@/lib/workers/streaming-job-executor', () => ({
  executeJobPipelineWithStreaming: (
    jobIds: string[],
    contentId: string,
    maxRetries: number,
  ) => mockExecuteJobPipelineWithStreaming(jobIds, contentId, maxRetries),
}));

let GET: typeof import('../route').GET;

function makeRequest(): NextRequest {
  return new Request(
    'http://localhost/api/recordings/rec_1/finalize/stream?startProcessing=true',
    { method: 'GET' },
  ) as unknown as NextRequest;
}

function createContentSelectChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    eq: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({
      data: {
        id: 'rec_1',
        org_id: 'org_1',
        status: 'uploading',
        title: 'Demo recording',
        storage_path_raw: 'org_1/recordings/rec_1/raw.webm',
        metadata: { source: 'upload_wizard', storageBucket: 'content' },
        content_type: 'recording',
        file_type: 'webm',
      },
      error: null,
    })),
  };
  return chain;
}

function createContentUpdateChain() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    eq: jest.fn(() => chain),
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve({
        data: { id: 'rec_1', status: 'transcribing' },
        error: null,
      })),
    })),
  };
  return chain;
}

function createJobInsertChain(jobInsertResult: {
  data: unknown;
  error: unknown;
}) {
  return {
    select: jest.fn(() => ({
      single: jest.fn(() => Promise.resolve(jobInsertResult)),
    })),
  };
}

function createExistingJobSelectChain(existingJob: unknown = {
  id: 'job_existing',
  type: 'transcribe',
  status: 'pending',
  payload: {},
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    eq: jest.fn(() => chain),
    in: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve({
      data: existingJob,
      error: null,
    })),
  };
  return chain;
}

function installSupabaseMocks(
  jobInsertResult: { data: unknown; error: unknown } = {
    data: { id: 'job_1', type: 'transcribe', status: 'pending', payload: {} },
    error: null,
  },
  existingJob?: unknown,
) {
  const contentUpdate = jest.fn(() => createContentUpdateChain());
  const jobsInsert = jest.fn(() => createJobInsertChain(jobInsertResult));
  const existingJobSelect = createExistingJobSelectChain(existingJob);
  const storageList = jest.fn(() => Promise.resolve({
    data: [{ name: 'raw.webm', metadata: { size: 4096 } }],
    error: null,
  }));

  mockDbFrom.mockImplementation((table) => {
    if (table === 'content') {
      return {
        select: jest.fn(() => createContentSelectChain()),
        update: contentUpdate,
      };
    }

    if (table === 'jobs') {
      return {
        insert: jobsInsert,
        select: jest.fn(() => existingJobSelect),
      };
    }

    throw new Error(`Unexpected table ${String(table)}`);
  });

  mockStorageFrom.mockReturnValue({ list: storageList });

  return {
    contentUpdate,
    jobsInsert,
    storageList,
    existingJobSelect,
  };
}

describe('GET /api/recordings/[id]/finalize/stream', () => {
  beforeAll(async () => {
    ({ GET } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireOrg.mockResolvedValue({
      orgId: 'org_1',
      userId: 'user_1',
    });
    mockCreateSSEStream.mockReturnValue(new ReadableStream());
    mockCreateSSEResponse.mockImplementation((stream: ReadableStream) =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
    mockExecuteJobPipelineWithStreaming.mockResolvedValue(undefined);
  });

  it('finalizes streaming upload with canonical transcribe payload only', async () => {
    const { jobsInsert, storageList } = installSupabaseMocks();

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(mockCreateSSEStream).toHaveBeenCalledWith('rec_1');
    expect(mockStorageFrom).toHaveBeenCalledWith('content');
    expect(storageList).toHaveBeenCalledWith('org_1/recordings/rec_1', {
      limit: 10,
      search: 'raw.webm',
    });
    expect(jobsInsert).toHaveBeenCalledTimes(1);
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcribe',
        dedupe_key: 'transcribe:rec_1',
        payload: expect.objectContaining({
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/raw.webm',
          storageBucket: 'content',
          contentType: 'recording',
          fileType: 'webm',
        }),
      }),
    );
    expect(jobsInsert).not.toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ type: 'doc_generate' }),
      ]),
    );
    expect(mockExecuteJobPipelineWithStreaming).toHaveBeenCalledWith(
      ['job_1'],
      'rec_1',
      3,
    );
  });

  it('rejects missing params before storage lookup, DB mutation, or SSE setup', async () => {
    installSupabaseMocks();

    const response = await GET(makeRequest(), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      message: 'Recording ID is required',
    });
    expect(mockRequireOrg).not.toHaveBeenCalled();
    expect(mockStorageFrom).not.toHaveBeenCalled();
    expect(mockDbFrom).not.toHaveBeenCalled();
    expect(mockCreateSSEStream).not.toHaveBeenCalled();
  });

  it('reuses an active transcribe job on retry without enqueueing dependent jobs', async () => {
    const { jobsInsert } = installSupabaseMocks({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(jobsInsert).toHaveBeenCalledTimes(1);
    expect(jobsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transcribe',
        dedupe_key: 'transcribe:rec_1',
      }),
    );
    expect(mockExecuteJobPipelineWithStreaming).toHaveBeenCalledWith(
      ['job_existing'],
      'rec_1',
      3,
    );
  });

  it('does not execute an already-processing transcribe job on double submit', async () => {
    installSupabaseMocks(
      {
        data: null,
        error: { code: '23505', message: 'duplicate key value' },
      },
      {
        id: 'job_existing',
        type: 'transcribe',
        status: 'processing',
        payload: {},
      },
    );

    const response = await GET(makeRequest(), {
      params: Promise.resolve({ id: 'rec_1' }),
    });

    expect(response.status).toBe(200);
    expect(mockSendLog).toHaveBeenCalledWith(
      'rec_1',
      'Processing is already running for this recording.',
      expect.objectContaining({
        jobs: [
          expect.objectContaining({
            id: 'job_existing',
            type: 'transcribe',
            status: 'processing',
          }),
        ],
      }),
    );
    expect(mockExecuteJobPipelineWithStreaming).not.toHaveBeenCalled();
  });
});
