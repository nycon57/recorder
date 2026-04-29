import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const rpcMock = jest.fn();
const fromMock = jest.fn();
const mockGenerateEmbeddingWithFallback = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    rpc: rpcMock,
    from: fromMock,
  })),
}));

jest.mock('@/lib/services/embedding-fallback', () => ({
  generateEmbeddingWithFallback: mockGenerateEmbeddingWithFallback,
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

let resolveOrgWikiPagesByVector: typeof import('../org-wiki-embedding').resolveOrgWikiPagesByVector;
let generateOrgWikiPageEmbeddingBestEffort: typeof import('../org-wiki-embedding').generateOrgWikiPageEmbeddingBestEffort;

describe('org-wiki-embedding service', () => {
  beforeAll(async () => {
    ({
      resolveOrgWikiPagesByVector,
      generateOrgWikiPageEmbeddingBestEffort,
    } = await import('../org-wiki-embedding'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockReset();
    fromMock.mockReset();
    mockGenerateEmbeddingWithFallback.mockReset();
  });

  it('uses match_org_wiki_pages_as_of when a point-in-time filter is provided', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'page-1',
          org_id: 'org-1',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal qualification',
          content: 'Use MEDDICC before handoff.',
          confidence: 0.91,
          distance: 0.07,
        },
      ],
      error: null,
    } as never);

    const result = await resolveOrgWikiPagesByVector({
      orgId: 'org-1',
      questionEmbedding: [0.1, 0.2, 0.3],
      limit: 5,
      asOf: '2026-04-20T00:00:00.000Z',
    });

    expect(rpcMock).toHaveBeenCalledWith('match_org_wiki_pages_as_of', {
      query_embedding: [0.1, 0.2, 0.3],
      match_org_id: 'org-1',
      match_as_of: '2026-04-20T00:00:00.000Z',
      match_limit: 5,
    });
    expect(result).toEqual([
      {
        id: 'page-1',
        app: 'HubSpot',
        screen: 'Deal',
        topic: 'Deal qualification',
        content: 'Use MEDDICC before handoff.',
        confidence: 0.91,
        distance: 0.07,
      },
    ]);
  });

  it('uses the current-state matcher when no point-in-time filter is provided', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: 'page-2',
          org_id: 'org-1',
          app: null,
          screen: null,
          topic: 'Escalation path',
          content: 'Route billing issues to finance ops.',
          confidence: 0.88,
          distance: 0.11,
        },
      ],
      error: null,
    } as never);

    const result = await resolveOrgWikiPagesByVector({
      orgId: 'org-1',
      questionEmbedding: [0.4, 0.5, 0.6],
    });

    expect(rpcMock).toHaveBeenCalledWith('match_org_wiki_pages', {
      query_embedding: [0.4, 0.5, 0.6],
      match_org_id: 'org-1',
      match_limit: 3,
    });
    expect(result).toEqual([
      {
        id: 'page-2',
        app: null,
        screen: null,
        topic: 'Escalation path',
        content: 'Route billing issues to finance ops.',
        confidence: 0.88,
        distance: 0.11,
      },
    ]);
  });

  it('returns true when best-effort embedding generation succeeds', async () => {
    mockGenerateEmbeddingWithFallback.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      provider: 'test-provider',
    } as never);

    const singleMock = jest.fn().mockResolvedValue({
      data: {
        id: 'page-3',
        topic: 'Renewal workflow',
        content: 'Send renewal reminder after the account review.',
      },
      error: null,
    } as never);
    const updateEqMock = jest.fn().mockResolvedValue({ error: null } as never);

    fromMock
      .mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: singleMock,
          })),
        })),
      })
      .mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: updateEqMock,
        })),
      });

    await expect(
      generateOrgWikiPageEmbeddingBestEffort('page-3', {
        source: 'unit-test',
      })
    ).resolves.toBe(true);

    expect(mockGenerateEmbeddingWithFallback).toHaveBeenCalledWith(
      'Renewal workflow\n\nSend renewal reminder after the account review.',
      'RETRIEVAL_DOCUMENT'
    );
    expect(updateEqMock).toHaveBeenCalledWith('id', 'page-3');
  });

  it('returns false when best-effort embedding generation fails', async () => {
    fromMock.mockImplementation(() => {
      throw new Error('database unavailable');
    });

    await expect(
      generateOrgWikiPageEmbeddingBestEffort('page-4', {
        source: 'unit-test',
      })
    ).resolves.toBe(false);
  });
});
