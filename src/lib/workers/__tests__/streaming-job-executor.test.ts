/** @jest-environment node */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockCreateAdminClient = jest.fn();
const mockSendLog = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => mockCreateAdminClient(),
}));

jest.mock('@/lib/services/streaming-processor', () => ({
  streamingManager: {
    sendComplete: jest.fn(),
    sendError: jest.fn(),
    sendLog: (...args: unknown[]) => mockSendLog(...args),
    sendProgress: jest.fn(),
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

jest.mock('@/lib/workers/job-processor', () => ({
  updateJobProgress: jest.fn(),
}));

jest.mock('@/lib/workers/handlers/compile-wiki', () => ({
  handleCompileWiki: jest.fn(),
}));

jest.mock('../handlers/archive-search-metrics', () => ({ handleArchiveSearchMetrics: jest.fn() }));
jest.mock('../handlers/analyze-knowledge-gaps', () => ({ handleAnalyzeKnowledgeGaps: jest.fn() }));
jest.mock('../handlers/collect-metrics', () => ({ handleCollectMetrics: jest.fn() }));
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
jest.mock('../handlers/transcribe-gemini-video', () => ({ transcribeRecording: jest.fn() }));
jest.mock('../handlers/transcribe-segment', () => ({ transcribeSegment: jest.fn() }));
jest.mock('../handlers/workflow-extraction', () => ({ handleWorkflowExtraction: jest.fn() }));

let findRunnableDependentJobs: typeof import('../streaming-job-executor').findRunnableDependentJobs;
let executeJobWithStreaming: typeof import('../streaming-job-executor').executeJobWithStreaming;

function makeJob(overrides: Record<string, unknown>) {
  return {
    id: 'job_1',
    type: 'doc_generate',
    status: 'pending',
    payload: { recordingId: 'rec_1', orgId: 'org_1' },
    created_at: '2026-04-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('streaming job dependency discovery', () => {
  beforeAll(async () => {
    ({ executeJobWithStreaming, findRunnableDependentJobs } = await import(
      '../streaming-job-executor'
    ));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fills documentId into an early embeddings job after doc generation succeeds', async () => {
    const pendingJobs = [
      makeJob({
        id: 'job_doc',
        type: 'doc_generate',
        payload: { recordingId: 'rec_1', transcriptId: 'tx_1', orgId: 'org_1' },
      }),
      makeJob({
        id: 'job_embed',
        type: 'generate_embeddings',
        payload: { recordingId: 'rec_1', transcriptId: 'tx_1', orgId: 'org_1' },
      }),
      makeJob({
        id: 'job_compile',
        type: 'compile_wiki',
        payload: { recordingId: 'rec_1', orgId: 'org_1' },
      }),
      makeJob({
        id: 'job_compress',
        type: 'compress_audio',
        payload: { recordingId: 'rec_1', orgId: 'org_1' },
      }),
    ];

    const jobsOrder = jest
      .fn<() => Promise<{ data: unknown[]; error: null }>>()
      .mockResolvedValue({ data: pendingJobs, error: null });
    const jobsSelectChain = {
      eq: jest.fn(() => jobsSelectChain),
      order: jobsOrder,
    };
    const jobsSelect = jest.fn(() => jobsSelectChain);

    const jobsSingle = jest.fn(() =>
      Promise.resolve({
        data: makeJob({
          id: 'job_embed',
          type: 'generate_embeddings',
          payload: {
            recordingId: 'rec_1',
            transcriptId: 'tx_1',
            documentId: 'doc_1',
            orgId: 'org_1',
          },
        }),
        error: null,
      }),
    );
    const jobsUpdateChain = {
      eq: jest.fn(() => jobsUpdateChain),
      select: jest.fn(() => ({ single: jobsSingle })),
    };
    const jobsUpdate = jest.fn(() => jobsUpdateChain);

    const documentsMaybeSingle = jest.fn(() =>
      Promise.resolve({ data: { id: 'doc_1' }, error: null }),
    );
    const documentsChain = {
      eq: jest.fn(() => documentsChain),
      maybeSingle: documentsMaybeSingle,
    };
    const documentsSelect = jest.fn(() => documentsChain);

    const from = jest.fn((table: string) => {
      if (table === 'jobs') {
        return { select: jobsSelect, update: jobsUpdate };
      }
      if (table === 'documents') {
        return { select: documentsSelect };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mockCreateAdminClient.mockReturnValue({ from });

    const jobs = await findRunnableDependentJobs('rec_1', new Set());

    expect(jobs.map((job) => job.id)).toEqual([
      'job_doc',
      'job_embed',
      'job_compile',
    ]);
    expect(jobs[1].payload).toMatchObject({ documentId: 'doc_1' });
    expect(jobsUpdate).toHaveBeenCalledWith({
      payload: {
        recordingId: 'rec_1',
        transcriptId: 'tx_1',
        documentId: 'doc_1',
        orgId: 'org_1',
      },
    });
    expect(jobsUpdateChain.eq).toHaveBeenCalledWith('id', 'job_embed');
    expect(jobsUpdateChain.eq).toHaveBeenCalledWith('status', 'pending');
  });

  it('skips execution when it loses the pending job claim', async () => {
    const jobSelectSingle = jest.fn(() =>
      Promise.resolve({
        data: makeJob({
          id: 'job_transcribe',
          type: 'transcribe',
          status: 'pending',
          payload: { recordingId: 'rec_1', orgId: 'org_1' },
        }),
        error: null,
      }),
    );
    const jobSelectChain = {
      eq: jest.fn(() => jobSelectChain),
      single: jobSelectSingle,
    };

    const claimMaybeSingle = jest.fn(() =>
      Promise.resolve({ data: null, error: null }),
    );
    const claimChain = {
      eq: jest.fn(() => claimChain),
      select: jest.fn(() => ({ maybeSingle: claimMaybeSingle })),
    };
    const jobsUpdate = jest.fn(() => claimChain);
    const jobsSelect = jest.fn(() => jobSelectChain);
    const from = jest.fn((table: string) => {
      if (table === 'jobs') {
        return { select: jobsSelect, update: jobsUpdate };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    mockCreateAdminClient.mockReturnValue({ from });

    await executeJobWithStreaming('job_transcribe', 'rec_1');

    expect(jobsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processing' }),
    );
    expect(claimChain.eq).toHaveBeenCalledWith('status', 'pending');
    expect(mockSendLog).toHaveBeenCalledWith(
      'rec_1',
      'transcribe is already running or no longer pending.',
      expect.objectContaining({ jobId: 'job_transcribe' }),
    );
  });
});
