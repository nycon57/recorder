/** @jest-environment node */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateAdminClient = jest.fn();
const mockSendError = jest.fn();
const mockSendProgress = jest.fn();
const mockTranscribeRecording =
  jest.fn<(job: unknown, progress?: unknown) => Promise<void>>();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => mockCreateAdminClient(),
}));

jest.mock('@/lib/services/streaming-processor', () => ({
  streamingManager: {
    sendComplete: jest.fn(),
    sendError: (...args: unknown[]) => mockSendError(...args),
    sendLog: jest.fn(),
    sendProgress: (...args: unknown[]) => mockSendProgress(...args),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('../handlers/archive-search-metrics', () => ({ handleArchiveSearchMetrics: jest.fn() }));
jest.mock('../handlers/analyze-knowledge-gaps', () => ({ handleAnalyzeKnowledgeGaps: jest.fn() }));
jest.mock('../handlers/collect-metrics', () => ({ handleCollectMetrics: jest.fn() }));
jest.mock('../handlers/compile-wiki', () => ({ handleCompileWiki: jest.fn() }));
jest.mock('../handlers/compress-audio', () => ({ handleCompressAudio: jest.fn() }));
jest.mock('../handlers/compress-video', () => ({ handleCompressVideo: jest.fn() }));
jest.mock('../handlers/curate-knowledge', () => ({ handleCurateKnowledge: jest.fn() }));
jest.mock('../handlers/deduplicate-file', () => ({
  handleBatchDeduplicate: jest.fn(),
  handleDeduplicateFile: jest.fn(),
}));
jest.mock('../handlers/detect-similarity', () => ({
  handleBatchDetectSimilarity: jest.fn(),
  handleDetectSimilarity: jest.fn(),
}));
jest.mock('../handlers/docify-google', () => ({ generateDocument: jest.fn() }));
jest.mock('../handlers/embeddings-google', () => ({ generateEmbeddings: jest.fn() }));
jest.mock('../handlers/extract-audio', () => ({ handleExtractAudio: jest.fn() }));
jest.mock('../handlers/extract-frames', () => ({ handleExtractFrames: jest.fn() }));
jest.mock('../handlers/extract-text-docx', () => ({ handleExtractTextDocx: jest.fn() }));
jest.mock('../handlers/extract-text-pdf', () => ({ handleExtractTextPdf: jest.fn() }));
jest.mock('../handlers/generate-alerts', () => ({ handleGenerateAlerts: jest.fn() }));
jest.mock('../handlers/generate-metadata', () => ({ handleGenerateMetadata: jest.fn() }));
jest.mock('../handlers/generate-onboarding-plan', () => ({ handleGenerateOnboardingPlan: jest.fn() }));
jest.mock('../handlers/generate-recommendations', () => ({ handleGenerateRecommendations: jest.fn() }));
jest.mock('../handlers/generate-summary', () => ({ generateSummary: jest.fn() }));
jest.mock('../handlers/generate-weekly-digest', () => ({ handleGenerateWeeklyDigest: jest.fn() }));
jest.mock('../handlers/ingest-vendor-docs', () => ({ handleIngestVendorDocs: jest.fn() }));
jest.mock('../handlers/merge-transcripts', () => ({ mergeTranscripts: jest.fn() }));
jest.mock('../handlers/migrate-storage-tier', () => ({ handleMigrateStorageTier: jest.fn() }));
jest.mock('../handlers/perform-health-check', () => ({ handlePerformHealthCheck: jest.fn() }));
jest.mock('../handlers/process-imported-doc', () => ({ processImportedDocument: jest.fn() }));
jest.mock('../handlers/process-text-note', () => ({ handleProcessTextNote: jest.fn() }));
jest.mock('../handlers/process-webhook', () => ({ processWebhook: jest.fn() }));
jest.mock('../handlers/publish-document', () => ({ handlePublishDocument: jest.fn() }));
jest.mock('../handlers/sync-connector', () => ({ syncConnector: jest.fn() }));
jest.mock('../handlers/transcribe-gemini-video', () => ({
  transcribeRecording: (job: unknown, progress?: unknown) =>
    mockTranscribeRecording(job, progress),
}));
jest.mock('../handlers/transcribe-segment', () => ({ transcribeSegment: jest.fn() }));
jest.mock('../handlers/workflow-extraction', () => ({ handleWorkflowExtraction: jest.fn() }));

type ProcessJobById = typeof import('../job-processor').processJobById;

type UpdateChain = {
  payload: Record<string, unknown>;
  eqCalls: Array<[string, unknown]>;
};

let processJobById: ProcessJobById;

function makeClaimedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    type: 'transcribe',
    status: 'processing',
    payload: { contentId: 'content-1', orgId: 'org-1' },
    attempts: 0,
    max_attempts: 3,
    content_id: 'content-1',
    created_at: '2026-04-29T00:00:00.000Z',
    run_at: '2026-04-29T00:00:00.000Z',
    started_at: null,
    completed_at: null,
    result: null,
    error: null,
    dedupe_key: null,
    progress_percent: 0,
    progress_message: 'Starting job...',
    priority: 0,
    segments_completed: 0,
    total_segments: null,
    parent_job_id: null,
    ...overrides,
  };
}

function createSupabaseMock(claimedJob: ReturnType<typeof makeClaimedJob>) {
  const updates: UpdateChain[] = [];

  const update = jest.fn((payload: Record<string, unknown>) => {
    const chain = {
      payload,
      eqCalls: [] as Array<[string, unknown]>,
      eq: jest.fn((column: string, value: unknown) => {
        chain.eqCalls.push([column, value]);
        return chain;
      }),
      select: jest.fn(() => ({
        maybeSingle: jest.fn(() => Promise.resolve({ data: claimedJob, error: null })),
      })),
    };
    updates.push(chain);
    return chain;
  });

  const from = jest.fn((table: string) => {
    if (table !== 'jobs') {
      throw new Error(`Unexpected table ${table}`);
    }
    return { update };
  });

  return {
    client: { from },
    updates,
  };
}

describe('job processor claim ownership', () => {
  beforeAll(async () => {
    process.env.JOB_TIMEOUT_MS = '1';
    ({ processJobById } = await import('../job-processor'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranscribeRecording.mockReset();
  });

  it('marks successful jobs complete only while the processing claim is still owned', async () => {
    const { client, updates } = createSupabaseMock(makeClaimedJob());
    mockCreateAdminClient.mockReturnValue(client);
    mockTranscribeRecording.mockResolvedValue(undefined);

    await processJobById('job-1');

    const completionUpdate = updates.find((entry) => entry.payload.status === 'completed');

    expect(completionUpdate).toBeDefined();
    expect(completionUpdate?.payload).toMatchObject({
      status: 'completed',
      progress_percent: 100,
      progress_message: 'Transcription complete',
    });
    expect(completionUpdate?.eqCalls).toEqual([
      ['id', 'job-1'],
      ['status', 'processing'],
    ]);
  });

  it('fails timed-out jobs without rescheduling them while the original handler may still be running', async () => {
    const { client, updates } = createSupabaseMock(makeClaimedJob());
    mockCreateAdminClient.mockReturnValue(client);
    mockTranscribeRecording.mockImplementation(
      () => new Promise<void>(() => undefined),
    );

    await processJobById('job-1');

    const retryUpdate = updates.find((entry) => entry.payload.status === 'pending');
    const failedUpdate = updates.find((entry) => entry.payload.status === 'failed');

    expect(retryUpdate).toBeUndefined();
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate?.payload).toMatchObject({
      status: 'failed',
      attempts: 1,
      progress_percent: null,
      progress_message: 'Timed out; retry disabled because the original handler may still be running',
    });
    expect(failedUpdate?.payload.error).toEqual(expect.stringContaining('Job timeout exceeded'));
    expect(failedUpdate?.eqCalls).toEqual([
      ['id', 'job-1'],
      ['status', 'processing'],
    ]);
    expect(mockSendError).toHaveBeenCalledWith(
      'content-1',
      expect.stringContaining('will not be retried automatically'),
    );
  });

  it('retries ordinary failures only while the processing claim is still owned', async () => {
    const { client, updates } = createSupabaseMock(makeClaimedJob());
    mockCreateAdminClient.mockReturnValue(client);
    mockTranscribeRecording.mockRejectedValue(new Error('temporary failure'));

    await processJobById('job-1');

    const retryUpdate = updates.find((entry) => entry.payload.status === 'pending');

    expect(retryUpdate).toBeDefined();
    expect(retryUpdate?.payload).toMatchObject({
      status: 'pending',
      attempts: 1,
      error: 'temporary failure',
      progress_percent: null,
      progress_message: 'Retry scheduled (1/3)',
    });
    expect(retryUpdate?.payload.run_at).toEqual(expect.any(String));
    expect(retryUpdate?.eqCalls).toEqual([
      ['id', 'job-1'],
      ['status', 'processing'],
    ]);
  });
});
