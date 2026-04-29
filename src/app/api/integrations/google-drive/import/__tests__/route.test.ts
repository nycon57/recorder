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
const mockCreateAdminClient = jest.fn();
const mockTestConnection = jest.fn();
const mockDownloadFile = jest.fn();

jest.mock('@/lib/utils/api', () => ({
  requireOrg: (...args: unknown[]) => mockRequireOrg(...args),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

jest.mock('@/lib/connectors/google-drive', () => ({
  GoogleDriveConnector: jest.fn().mockImplementation(() => ({
    testConnection: (...args: unknown[]) => mockTestConnection(...args),
    downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
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
  const from = jest.fn();
  const contentInsert = jest.fn();
  const contentUpdate = jest.fn();
  const contentDelete = jest.fn();
  const transcriptInsert = jest.fn();
  const jobsInsert = jest.fn();
  const syncStateInsert = jest.fn();
  const syncStateDelete = jest.fn();
  const connectorUpdate = jest.fn();
  const storageUpload = jest.fn();

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
        from: jest.fn(() => ({ upload: storageUpload })),
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
});
