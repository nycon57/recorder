/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockRequireOrg = jest.fn<
  () => Promise<{ orgId: string; userId: string; role: string }>
>();
const mockFrom = jest.fn<(table: string) => unknown>();

jest.mock('@/lib/utils/api', () => ({
  apiHandler:
    (handler: (request: NextRequest) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request),
  requireOrg: () => mockRequireOrg(),
  parseBody: async (request: NextRequest, schema: { parse: (body: unknown) => unknown }) =>
    schema.parse(await request.json()),
  generateRequestId: () => 'req_test',
  successResponse: (data: unknown, requestId?: string, status = 200) =>
    Response.json({ data, requestId }, { status }),
  errors: {
    badRequest: (message: string, details?: unknown, requestId?: string) =>
      Response.json(
        { code: 'BAD_REQUEST', message, details, requestId },
        { status: 400 },
      ),
    internalError: (requestId?: string) =>
      Response.json(
        { code: 'INTERNAL_ERROR', message: 'Internal error', requestId },
        { status: 500 },
      ),
    forbidden: (requestId?: string) =>
      Response.json(
        { code: 'FORBIDDEN', message: 'Forbidden', requestId },
        { status: 403 },
      ),
    validationError: (details: unknown, requestId?: string) =>
      Response.json(
        { code: 'VALIDATION_ERROR', message: 'Validation failed', details, requestId },
        { status: 400 },
      ),
  },
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: (table: string) => mockFrom(table),
  },
}));

let POST: typeof import('../route').POST;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/library/text', {
    method: 'POST',
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function selectSingleResult(data: unknown, error: unknown = null) {
  const chain = {
    select: jest.fn(() => chain),
    single: jest.fn(() => Promise.resolve({ data, error })),
  };
  return chain;
}

describe('POST /api/library/text', () => {
  const contentInsert = jest.fn<(value: unknown) => unknown>();
  const contentUpdate = jest.fn<(value: unknown) => unknown>();
  const contentDelete = jest.fn<() => unknown>();
  const transcriptInsert = jest.fn<(value: unknown) => unknown>();
  const transcriptDelete = jest.fn<() => unknown>();
  const jobsInsert = jest.fn<
    (value: unknown) => Promise<{ error: { message: string } | null }>
  >();
  const contentUpdateEq = jest.fn<
    (column: string, value: string) => Promise<{ error: null }>
  >();
  const contentDeleteEq = jest.fn<
    (column: string, value: string) => Promise<{ error: null }>
  >();
  const transcriptDeleteEq = jest.fn<
    (column: string, value: string) => Promise<{ error: null }>
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
    contentInsert.mockReturnValue(
      selectSingleResult({
        id: 'content_1',
        title: 'Useful note',
        content_type: 'text',
        file_type: 'md',
        created_at: '2026-04-29T00:00:00.000Z',
      }),
    );
    contentUpdate.mockReturnValue({ eq: contentUpdateEq });
    contentDelete.mockReturnValue({ eq: contentDeleteEq });
    transcriptInsert.mockReturnValue(selectSingleResult({ id: 'transcript_1' }));
    transcriptDelete.mockReturnValue({ eq: transcriptDeleteEq });
    jobsInsert.mockResolvedValue({ error: null });
    contentUpdateEq.mockResolvedValue({ error: null });
    contentDeleteEq.mockResolvedValue({ error: null });
    transcriptDeleteEq.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'content') {
        return {
          insert: contentInsert,
          update: contentUpdate,
          delete: contentDelete,
        };
      }

      if (table === 'transcripts') {
        return {
          insert: transcriptInsert,
          delete: transcriptDelete,
        };
      }

      if (table === 'jobs') {
        return { insert: jobsInsert };
      }

      throw new Error(`Unexpected table ${table}`);
    });
  });

  it('queues doc generation with the created transcript id', async () => {
    const response = await POST(
      makeRequest({
        title: 'Useful note',
        content: '# Useful\nThis should become knowledge.',
        format: 'markdown',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.id).toBe('content_1');
    expect(transcriptInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_id: 'content_1',
        text: '# Useful\nThis should become knowledge.',
        provider: 'user_input',
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
        contentType: 'text',
        format: 'markdown',
      },
      run_at: expect.any(String),
      dedupe_key: 'doc_generate:content_1',
    });
  });

  it('rejects reader users before parsing or creating text content', async () => {
    mockRequireOrg.mockResolvedValue({
      orgId: 'org_1',
      userId: 'reader_1',
      role: 'reader',
    });
    const json = jest.fn<() => Promise<unknown>>();
    const request = {
      json,
    } as unknown as NextRequest;

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(json).not.toHaveBeenCalled();
    expect(contentInsert).not.toHaveBeenCalled();
    expect(transcriptInsert).not.toHaveBeenCalled();
    expect(jobsInsert).not.toHaveBeenCalled();
  });

  it('rolls back text note rows when doc generation cannot be queued', async () => {
    jobsInsert.mockResolvedValue({ error: { message: 'queue unavailable' } });

    const response = await POST(
      makeRequest({
        title: 'Useful note',
        content: 'This should not be left half-created.',
        format: 'plain',
      }),
    );

    expect(response.status).toBe(500);
    expect(transcriptDelete).toHaveBeenCalled();
    expect(transcriptDeleteEq).toHaveBeenCalledWith('id', 'transcript_1');
    expect(contentDelete).toHaveBeenCalled();
    expect(contentDeleteEq).toHaveBeenCalledWith('id', 'content_1');
  });
});
