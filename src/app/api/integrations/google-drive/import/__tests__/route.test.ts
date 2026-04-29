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

interface MockDownloadedFile {
  id: string;
  title: string;
  content: string | Buffer;
  mimeType: string;
  size: number;
  metadata: Record<string, unknown>;
}

const mockRequireOrg = jest.fn<
  () => Promise<{ orgId: string; userId: string }>
>();
const mockCreateAdminClient = jest.fn<() => unknown>();
const mockTestConnection = jest.fn<() => Promise<{ success: boolean }>>();
const mockDownloadFile = jest.fn<
  (fileId: string) => Promise<MockDownloadedFile>
>();

jest.mock('@/lib/utils/api', () => ({
  requireOrg: () => mockRequireOrg(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: () => mockCreateAdminClient(),
}));

jest.mock('@/lib/connectors/google-drive', () => ({
  GoogleDriveConnector: jest.fn().mockImplementation(() => ({
    testConnection: () => mockTestConnection(),
    downloadFile: (fileId: string) => mockDownloadFile(fileId),
  })),
}));

let POST: typeof import('../route').POST;

const connectorConfig = {
  id: 'connector_1',
  credentials: {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    scopes: ['drive.readonly'],
  },
};

function makeRequest(fileIds: string[]): NextRequest {
  return new Request('http://localhost/api/integrations/google-drive/import', {
    method: 'POST',
    body: JSON.stringify({ fileIds }),
  }) as unknown as NextRequest;
}

function selectSingleResult(data: unknown, error: unknown = null) {
  const chain = {
    select: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({ data, error })),
  };
  return chain;
}

describe('POST /api/integrations/google-drive/import', () => {
  const from = jest.fn<(table: string) => unknown>();
  const contentInsert = jest.fn<(value: unknown) => unknown>();
  const contentUpdate = jest.fn<(value: unknown) => unknown>();
  const contentDelete = jest.fn<() => unknown>();
  const transcriptInsert = jest.fn<(value: unknown) => unknown>();
  const jobsInsert = jest.fn<
    (value: unknown) => Promise<{ error: { message: string } | null }>
  >();
  const syncStateInsert = jest.fn<
    (value: unknown) => Promise<{ error: { message: string } | null }>
  >();
  const syncStateDelete = jest.fn<() => unknown>();
  const connectorUpdate = jest.fn<(value: unknown) => unknown>();
  const storageUpload = jest.fn<
    (
      path: string,
      body: Buffer,
      options: { contentType: string; upsert: boolean },
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  >();
  const storageRemove = jest.fn<
    (paths: string[]) => Promise<{ data: unknown[]; error: { message: string } | null }>
  >();

  beforeAll(async () => {
    ({ POST } = await import('../route'));
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequireOrg.mockResolvedValue({
      orgId: 'org_1',
      userId: 'user_1',
    });
    mockTestConnection.mockResolvedValue({ success: true });
    mockCreateAdminClient.mockReturnValue({
      from,
      storage: {
        from: jest.fn(() => ({ upload: storageUpload, remove: storageRemove })),
      },
    });

    const connectorSelectChain = {
      select: jest.fn(() => connectorSelectChain),
      eq: jest.fn(() => connectorSelectChain),
      single: jest.fn(() =>
        Promise.resolve({ data: connectorConfig, error: null }),
      ),
    };

    const existingImportChain = {
      select: jest.fn(() => existingImportChain),
      eq: jest.fn(() => existingImportChain),
      in: jest.fn(() => Promise.resolve({ data: [], error: null })),
    };

    contentInsert.mockImplementation(() =>
      selectSingleResult({ id: 'content_1' }),
    );
    contentUpdate.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    contentDelete.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    transcriptInsert.mockImplementation(() =>
      selectSingleResult({ id: 'transcript_1' }),
    );
    jobsInsert.mockResolvedValue({ error: null });
    syncStateInsert.mockResolvedValue({ error: null });
    syncStateDelete.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    connectorUpdate.mockReturnValue({
      eq: jest.fn(() => Promise.resolve({ error: null })),
    });
    storageUpload.mockResolvedValue({ data: { path: 'stored' }, error: null });
    storageRemove.mockResolvedValue({ data: [], error: null });

    from.mockImplementation((table: string) => {
      if (table === 'connector_configs') {
        return {
          ...connectorSelectChain,
          update: connectorUpdate,
        };
      }

      if (table === 'content') {
        return {
          ...existingImportChain,
          insert: contentInsert,
          update: contentUpdate,
          delete: contentDelete,
        };
      }

      if (table === 'connector_sync_state') {
        return {
          insert: syncStateInsert,
          delete: syncStateDelete,
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

  it('imports Google Docs as transcript-backed doc_generate jobs', async () => {
    mockDownloadFile.mockResolvedValue({
      id: 'gdoc_1',
      title: 'Implementation Notes',
      content: '# Notes\nRecall me later.',
      mimeType: 'text/markdown',
      size: 24,
      metadata: {
        originalMimeType: 'application/vnd.google-apps.document',
        webViewLink: 'https://drive.google.com/file/d/gdoc_1/view',
        modifiedTime: '2026-04-29T12:00:00.000Z',
        owners: [{ emailAddress: 'owner@example.com' }],
      },
    });

    const response = await POST(makeRequest(['gdoc_1']));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(1);
    expect(contentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: 'org_1',
        source_type: 'google_drive',
        source_connector_id: 'connector_1',
        source_external_id: 'gdoc_1',
        source_url: 'https://drive.google.com/file/d/gdoc_1/view',
        metadata: expect.objectContaining({
          source: 'google_drive',
          sourceFileId: 'gdoc_1',
          sourceConnectorId: 'connector_1',
          originalMimeType: 'application/vnd.google-apps.document',
          importedMimeType: 'text/markdown',
          exportedMimeType: 'text/markdown',
        }),
      }),
    );
    expect(transcriptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_id: 'content_1',
        text: '# Notes\nRecall me later.',
        provider: 'google_drive_import',
      }),
    );
    expect(jobsInsert).toHaveBeenCalledWith({
      type: 'doc_generate',
      status: 'pending',
      content_id: 'content_1',
      payload: {
        recordingId: 'content_1',
        transcriptId: 'transcript_1',
        orgId: 'org_1',
      },
      dedupe_key: 'doc_generate:content_1',
    });
    expect(jobsInsert).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'generate_embeddings' }),
    );
  });

  it('stores PDFs as raw bytes and enqueues the existing extraction payload', async () => {
    const pdfBytes = Buffer.from('%PDF-1.7 real bytes');
    mockDownloadFile.mockResolvedValue({
      id: 'pdf_1',
      title: 'Vendor Spec.pdf',
      content: pdfBytes,
      mimeType: 'application/pdf',
      size: pdfBytes.length,
      metadata: {
        webViewLink: 'https://drive.google.com/file/d/pdf_1/view',
        modifiedTime: '2026-04-29T12:00:00.000Z',
      },
    });

    const response = await POST(makeRequest(['pdf_1']));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(1);
    expect(storageUpload).toHaveBeenCalledWith(
      'org_1/documents/content_1.pdf',
      pdfBytes,
      {
        contentType: 'application/pdf',
        upsert: false,
      },
    );
    expect(transcriptInsert).not.toHaveBeenCalled();
    expect(jobsInsert).toHaveBeenCalledWith({
      type: 'extract_text_pdf',
      status: 'pending',
      content_id: 'content_1',
      payload: {
        recordingId: 'content_1',
        orgId: 'org_1',
        pdfPath: 'org_1/documents/content_1.pdf',
      },
      dedupe_key: 'extract_text_pdf:content_1',
    });
  });

  it('rolls back a newly created content row if job setup fails', async () => {
    mockDownloadFile.mockResolvedValue({
      id: 'gdoc_1',
      title: 'Implementation Notes',
      content: '# Notes\nRecall me later.',
      mimeType: 'text/markdown',
      size: 24,
      metadata: {
        originalMimeType: 'application/vnd.google-apps.document',
      },
    });
    jobsInsert.mockResolvedValue({
      error: { message: 'duplicate job key' },
    });

    const response = await POST(makeRequest(['gdoc_1']));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(0);
    expect(body.failed).toEqual([
      { fileId: 'gdoc_1', error: 'duplicate job key' },
    ]);
    expect(syncStateDelete).toHaveBeenCalled();
    expect(contentDelete).toHaveBeenCalled();
  });

  it('removes uploaded binary storage if extraction job setup fails', async () => {
    const pdfBytes = Buffer.from('%PDF-1.7 real bytes');
    mockDownloadFile.mockResolvedValue({
      id: 'pdf_1',
      title: 'Vendor Spec.pdf',
      content: pdfBytes,
      mimeType: 'application/pdf',
      size: pdfBytes.length,
      metadata: {},
    });
    jobsInsert.mockResolvedValue({
      error: { message: 'job queue unavailable' },
    });

    const response = await POST(makeRequest(['pdf_1']));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(0);
    expect(body.failed).toEqual([
      { fileId: 'pdf_1', error: 'job queue unavailable' },
    ]);
    expect(storageRemove).toHaveBeenCalledWith([
      'org_1/documents/content_1.pdf',
    ]);
    expect(syncStateDelete).toHaveBeenCalled();
    expect(contentDelete).toHaveBeenCalled();
  });

  it.each([
    ['doc_legacy', 'application/msword'],
    [
      'xlsx_1',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
    ['xls_1', 'application/vnd.ms-excel'],
  ])('rejects unsupported binary Drive import %s before creating content', async (
    fileId,
    mimeType,
  ) => {
    mockDownloadFile.mockResolvedValue({
      id: fileId,
      title: 'Unsupported binary',
      content: Buffer.from('binary bytes'),
      mimeType,
      size: 12,
      metadata: {},
    });

    const response = await POST(makeRequest([fileId]));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.imported).toBe(0);
    expect(body.failed).toEqual([
      { fileId, error: `Unsupported file type: ${mimeType}` },
    ]);
    expect(contentInsert).not.toHaveBeenCalled();
    expect(storageUpload).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });
});
