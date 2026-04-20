import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';

const rpcMock = jest.fn();

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(() => ({
    rpc: rpcMock,
  })),
}));

jest.mock('@/lib/services/embedding-fallback', () => ({
  generateEmbeddingWithFallback: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

let resolveOrgWikiPagesByVector: typeof import('../org-wiki-embedding').resolveOrgWikiPagesByVector;

describe('org-wiki-embedding service', () => {
  beforeAll(async () => {
    ({ resolveOrgWikiPagesByVector } = await import('../org-wiki-embedding'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rpcMock.mockReset();
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
    });

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
    });

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
});
