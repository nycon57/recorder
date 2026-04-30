/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@/lib/services/vendor-wiki-resolver', () => ({
  resolveVendorWikiPage: jest.fn(),
}));

jest.mock('@/lib/services/vendor-customers', () => ({
  getVendorForOrg: jest.fn(),
}));

jest.mock('@/lib/services/org-wiki-embedding', () => ({
  resolveOrgWikiPagesByVector: jest.fn(),
}));

jest.mock('@/lib/services/vendor-doc-corpus', () => ({
  resolveVendorCorpusPages: jest.fn(),
}));

jest.mock('@/lib/services/wiki-clusters', () => ({
  resolveClusterContext: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

import { resolveCompiledMemoryContext } from '../compiled-memory-context';

const { getVendorForOrg } = jest.requireMock('@/lib/services/vendor-customers') as {
  getVendorForOrg: jest.Mock;
};

const { resolveOrgWikiPagesByVector } = jest.requireMock(
  '@/lib/services/org-wiki-embedding',
) as {
  resolveOrgWikiPagesByVector: jest.Mock;
};

const { resolveVendorCorpusPages } = jest.requireMock(
  '@/lib/services/vendor-doc-corpus',
) as {
  resolveVendorCorpusPages: jest.Mock;
};

const { resolveVendorWikiPage } = jest.requireMock(
  '@/lib/services/vendor-wiki-resolver',
) as {
  resolveVendorWikiPage: jest.Mock;
};

const { resolveClusterContext } = jest.requireMock(
  '@/lib/services/wiki-clusters',
) as {
  resolveClusterContext: jest.Mock;
};

const { createClient: createAdminClient } = jest.requireMock(
  '@/lib/supabase/admin',
) as {
  createClient: jest.Mock;
};

function createSupabaseMock(args: {
  clusterEnabled?: boolean | null;
  priorInteractionIds?: string[];
  citationRows?: Array<{ page_id: string; source_id: string; source_type: string }>;
  orgFreshnessRows?: Array<{ id: string; updated_at: string | null }>;
  vendorSourceRows?: Array<{
    id: string;
    source_kind: string | null;
    source_url: string | null;
    freshness_target: string | null;
    last_success_at: string | null;
    updated_at: string | null;
  }>;
}) {
  return {
    from: jest.fn((table: string) => {
      if (table === 'org_agent_settings') {
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn(async () => ({
            data: { wiki_cluster_context_enabled: args.clusterEnabled ?? null },
            error: null,
          })),
        };
        return query;
      }

      if (table === 'user_wiki_interactions') {
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn(async () => ({
            data: (args.priorInteractionIds ?? []).map((wiki_page_id) => ({
              wiki_page_id,
            })),
            error: null,
          })),
        };
        return query;
      }

      if (table === 'wiki_page_sources') {
        const query = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn(async () => ({
            data: args.citationRows ?? [],
            error: null,
          })),
        };
        return query;
      }

      if (table === 'org_wiki_pages') {
        const query = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn(async () => ({
            data: args.orgFreshnessRows ?? [],
            error: null,
          })),
        };
        return query;
      }

      if (table === 'vendor_doc_sources') {
        const query = {
          select: jest.fn().mockReturnThis(),
          in: jest.fn(async () => ({
            data: args.vendorSourceRows ?? [],
            error: null,
          })),
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('resolveCompiledMemoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns vendor, vendor-training, and org layers plus structured citations', async () => {
    const resolveVendorWikiPage: any = jest.fn();
    resolveVendorWikiPage.mockResolvedValue({
      id: 'vendor-1',
      app: 'hubspot',
      screen: 'deals',
      content: 'Vendor knowledge',
      source_url: 'https://docs.example.com/deals',
      vendor_source_id: 'source-1',
    });
    const resolveVendorCorpusPages: any = jest.fn();
    resolveVendorCorpusPages.mockResolvedValue([
      {
        id: 'vendor-1',
        vendorPageId: 'vendor-1',
        vendorSourceId: 'source-1',
        app: 'hubspot',
        screen: 'deals',
        title: 'HubSpot deals',
        content: 'Vendor knowledge',
        sourceUrl: 'https://docs.example.com/deals',
        updatedAt: '2026-04-19T12:00:00.000Z',
        confidence: 0.81,
        distance: 0.19,
        matchType: 'exact',
      },
      {
        id: 'vendor-2',
        vendorPageId: 'vendor-page-2',
        vendorSourceId: 'source-1',
        app: 'hubspot',
        screen: 'pipelines',
        title: 'Pipeline stages',
        content: 'Broader vendor guidance',
        sourceUrl: 'https://docs.example.com/pipelines',
        updatedAt: '2026-04-18T12:00:00.000Z',
        confidence: 0.73,
        distance: 0.27,
        matchType: 'semantic',
      },
    ]);

    const getVendorForOrg: any = jest.fn();
    getVendorForOrg.mockResolvedValue({
      vendorOrgId: 'vendor-org-1',
      whiteLabelConfig: {
        knowledge_scope: ['hubspot'],
      },
    });

    const resolveOrgWikiPagesByVector: any = jest.fn();
    resolveOrgWikiPagesByVector.mockImplementation(
      async ({ orgId }: { orgId: string }) => {
        if (orgId === 'vendor-org-1') {
          return [
            {
              id: 'training-1',
              app: 'hubspot',
              screen: 'deals',
              topic: 'Vendor playbook',
              content: 'Training content',
              confidence: 0.86,
              distance: 0.14,
            },
          ];
        }

        return [
          {
            id: 'org-1',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Deal stages',
            content: 'Primary content',
            confidence: 0.92,
            distance: 0.08,
          },
          {
            id: 'org-2',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Deal owners',
            content: 'Secondary content',
            confidence: 0.88,
            distance: 0.12,
          },
        ];
      },
    );

    const resolveClusterContext: any = jest.fn();
    resolveClusterContext.mockResolvedValue([
      {
        id: 'org-3',
        app: 'hubspot',
        screen: 'deals',
        topic: 'Renewal notes',
        content: 'Cluster content',
        confidence: 0.7,
        distance: 0.3,
      },
    ]);

    const createAdminClient: any = jest.fn();
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        clusterEnabled: true,
        priorInteractionIds: ['org-3', 'org-1', 'org-1'],
        citationRows: [
          {
            page_id: 'org-1',
            source_id: 'recording-1',
            source_type: 'recording',
          },
          {
            page_id: 'org-3',
            source_id: 'recording-3',
            source_type: 'document',
          },
        ],
        orgFreshnessRows: [
          { id: 'training-1', updated_at: '2026-04-16T12:00:00.000Z' },
          { id: 'org-1', updated_at: '2026-04-19T12:00:00.000Z' },
          { id: 'org-2', updated_at: '2026-04-18T12:00:00.000Z' },
          { id: 'org-3', updated_at: '2026-04-17T12:00:00.000Z' },
        ],
        vendorSourceRows: [
          {
            id: 'source-1',
            source_kind: 'documentation',
            source_url: 'https://docs.example.com',
            freshness_target: '36500 days',
            last_success_at: '2026-04-19T10:00:00.000Z',
            updated_at: '2026-04-19T10:00:00.000Z',
          },
        ],
      }),
    );

    const result = await resolveCompiledMemoryContext(
      {
        orgId: 'org-123',
        userId: 'user-123',
        app: 'hubspot',
        screen: 'deals',
        question: 'How do I handle deal stages?',
        questionEmbedding: [0.1, 0.2, 0.3],
      },
      {
        createAdminClient,
        getVendorForOrg,
        resolveOrgWikiPagesByVector,
        resolveVendorCorpusPages,
        resolveVendorWikiPage,
        resolveClusterContext,
      } as any,
    );

    expect(resolveVendorWikiPage).toHaveBeenCalledWith({
      app: 'hubspot',
      screen: 'deals',
    });
    expect(resolveVendorCorpusPages).toHaveBeenCalledWith({
      app: 'hubspot',
      screen: 'deals',
      question: 'How do I handle deal stages?',
      questionEmbedding: [0.1, 0.2, 0.3],
      limit: 3,
    });
    expect(resolveClusterContext).toHaveBeenCalledWith({
      orgId: 'org-123',
      basePageIds: ['org-1', 'org-2'],
      perCluster: 2,
      excludePageIds: ['org-1', 'org-2'],
    });
    expect(result).toEqual({
      vendorKnowledge: {
        page: {
          id: 'vendor-1',
          app: 'hubspot',
          screen: 'deals',
          content: 'Vendor knowledge',
          source_url: 'https://docs.example.com/deals',
          vendor_source_id: 'source-1',
        },
        pages: [
          {
            id: 'vendor-1',
            vendorPageId: 'vendor-1',
            vendorSourceId: 'source-1',
            app: 'hubspot',
            screen: 'deals',
            title: 'HubSpot deals',
            content: 'Vendor knowledge',
            sourceUrl: 'https://docs.example.com/deals',
            updatedAt: '2026-04-19T12:00:00.000Z',
            confidence: 0.81,
            distance: 0.19,
            matchType: 'exact',
          },
          {
            id: 'vendor-2',
            vendorPageId: 'vendor-page-2',
            vendorSourceId: 'source-1',
            app: 'hubspot',
            screen: 'pipelines',
            title: 'Pipeline stages',
            content: 'Broader vendor guidance',
            sourceUrl: 'https://docs.example.com/pipelines',
            updatedAt: '2026-04-18T12:00:00.000Z',
            confidence: 0.73,
            distance: 0.27,
            matchType: 'semantic',
          },
        ],
      },
      vendorTraining: {
        pages: [
          {
            id: 'training-1',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Vendor playbook',
            content: 'Training content',
            confidence: 0.86,
            distance: 0.14,
          },
        ],
      },
      orgKnowledge: {
        pages: [
          {
            id: 'org-1',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Deal stages',
            content: 'Primary content',
            confidence: 0.92,
            distance: 0.08,
          },
          {
            id: 'org-2',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Deal owners',
            content: 'Secondary content',
            confidence: 0.88,
            distance: 0.12,
          },
          {
            id: 'org-3',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Renewal notes',
            content: 'Cluster content',
            confidence: 0.7,
            distance: 0.3,
          },
        ],
        priorTopics: ['Deal stages', 'Renewal notes'],
      },
      citationsBySourceId: {
        'vendor-1': {
          sourceId: 'vendor-1',
          title: 'HubSpot deals',
          layer: 'vendor',
          linkUrl: 'https://docs.example.com/deals',
          freshness: {
            updatedAt: '2026-04-19T12:00:00.000Z',
            lastSuccessfulSyncAt: '2026-04-19T10:00:00.000Z',
            freshnessTarget: '36500 days',
            isStale: false,
          },
          provenance: {
            pageId: 'vendor-1',
            vendorPageId: 'vendor-1',
            vendorSourceId: 'source-1',
            sourceKind: 'documentation',
            sourceUrl: 'https://docs.example.com/deals',
          },
        },
        'vendor-2': {
          sourceId: 'vendor-2',
          title: 'Pipeline stages',
          layer: 'vendor',
          linkUrl: 'https://docs.example.com/pipelines',
          freshness: {
            updatedAt: '2026-04-18T12:00:00.000Z',
            lastSuccessfulSyncAt: '2026-04-19T10:00:00.000Z',
            freshnessTarget: '36500 days',
            isStale: false,
          },
          provenance: {
            pageId: 'vendor-2',
            vendorPageId: 'vendor-page-2',
            vendorSourceId: 'source-1',
            sourceKind: 'documentation',
            sourceUrl: 'https://docs.example.com/pipelines',
          },
        },
        'training-1': {
          sourceId: 'training-1',
          title: 'Vendor playbook',
          layer: 'vendor_training',
          freshness: {
            updatedAt: '2026-04-16T12:00:00.000Z',
            lastSuccessfulSyncAt: null,
            freshnessTarget: null,
            isStale: null,
          },
          provenance: {
            pageId: 'training-1',
            vendorPageId: null,
            vendorSourceId: null,
            sourceKind: null,
            sourceUrl: null,
          },
        },
        'org-1': {
          sourceId: 'org-1',
          title: 'Deal stages',
          layer: 'org',
          linkUrl: '/dashboard/recordings/recording-1',
          freshness: {
            updatedAt: '2026-04-19T12:00:00.000Z',
            lastSuccessfulSyncAt: null,
            freshnessTarget: null,
            isStale: null,
          },
          provenance: {
            pageId: 'org-1',
            vendorPageId: null,
            vendorSourceId: null,
            sourceKind: null,
            sourceUrl: null,
          },
        },
        'org-2': {
          sourceId: 'org-2',
          title: 'Deal owners',
          layer: 'org',
          linkUrl: undefined,
          freshness: {
            updatedAt: '2026-04-18T12:00:00.000Z',
            lastSuccessfulSyncAt: null,
            freshnessTarget: null,
            isStale: null,
          },
          provenance: {
            pageId: 'org-2',
            vendorPageId: null,
            vendorSourceId: null,
            sourceKind: null,
            sourceUrl: null,
          },
        },
        'org-3': {
          sourceId: 'org-3',
          title: 'Renewal notes',
          layer: 'org',
          linkUrl: '/dashboard/recordings/recording-3',
          freshness: {
            updatedAt: '2026-04-17T12:00:00.000Z',
            lastSuccessfulSyncAt: null,
            freshnessTarget: null,
            isStale: null,
          },
          provenance: {
            pageId: 'org-3',
            vendorPageId: null,
            vendorSourceId: null,
            sourceKind: null,
            sourceUrl: null,
          },
        },
      },
    });
  });

  it('skips cluster expansion for as-of lookups while still returning vendor and org citation metadata', async () => {
    const resolveVendorWikiPage: any = jest.fn();
    resolveVendorWikiPage.mockResolvedValue({
      id: 'vendor-9',
      app: 'salesforce',
      screen: 'lead-detail',
      content: 'Vendor fallback',
      source_url: 'https://docs.example.com/lead-detail',
    });
    const resolveVendorCorpusPages: any = jest.fn();
    resolveVendorCorpusPages.mockResolvedValue([
      {
        id: 'vendor-9',
        vendorPageId: 'vendor-9',
        vendorSourceId: 'source-9',
        app: 'salesforce',
        screen: 'lead-detail',
        title: 'Lead detail',
        content: 'Vendor fallback',
        sourceUrl: 'https://docs.example.com/lead-detail',
        updatedAt: '2026-04-01T11:00:00.000Z',
        confidence: 0.69,
        distance: 0.31,
        matchType: 'exact',
      },
    ]);

    const getVendorForOrg: any = jest.fn();
    getVendorForOrg.mockResolvedValue(null);

    const resolveOrgWikiPagesByVector: any = jest.fn();
    resolveOrgWikiPagesByVector.mockResolvedValue([
      {
        id: 'org-9',
        app: 'salesforce',
        screen: 'lead-detail',
        topic: 'Lead routing',
        content: 'Historical content',
        confidence: 0.84,
        distance: 0.16,
      },
    ]);

    const createAdminClient: any = jest.fn();
    createAdminClient.mockReturnValue(
      createSupabaseMock({
        priorInteractionIds: ['org-9'],
        citationRows: [
          {
            page_id: 'org-9',
            source_id: 'recording-9',
            source_type: 'recording',
          },
        ],
        orgFreshnessRows: [
          { id: 'org-9', updated_at: '2026-04-01T10:00:00.000Z' },
        ],
        vendorSourceRows: [
          {
            id: 'source-9',
            source_kind: 'documentation',
            source_url: 'https://docs.example.com',
            freshness_target: '36500 days',
            last_success_at: '2026-04-01T09:00:00.000Z',
            updated_at: '2026-04-01T09:00:00.000Z',
          },
        ],
      }),
    );
    const resolveClusterContext: any = jest.fn();

    const result = await resolveCompiledMemoryContext(
      {
        orgId: 'org-999',
        userId: 'user-999',
        app: 'salesforce',
        screen: 'lead-detail',
        question: 'How should I update a lead owner?',
        questionEmbedding: [0.4, 0.5, 0.6],
        asOf: '2026-04-01T12:00:00.000Z',
      },
      {
        createAdminClient,
        getVendorForOrg,
        resolveOrgWikiPagesByVector,
        resolveVendorCorpusPages,
        resolveVendorWikiPage,
        resolveClusterContext,
      } as any,
    );

    expect(resolveClusterContext).not.toHaveBeenCalled();
    expect(result.vendorKnowledge.page?.id).toBe('vendor-9');
    expect(result.vendorKnowledge.pages).toHaveLength(1);
    expect(result.vendorTraining.pages).toEqual([]);
    expect(result.orgKnowledge.priorTopics).toEqual(['Lead routing']);
    expect(result.citationsBySourceId['org-9']).toEqual({
      sourceId: 'org-9',
      title: 'Lead routing',
      layer: 'org',
      linkUrl: '/dashboard/recordings/recording-9',
      freshness: {
        updatedAt: '2026-04-01T10:00:00.000Z',
        lastSuccessfulSyncAt: null,
        freshnessTarget: null,
        isStale: null,
      },
      provenance: {
        pageId: 'org-9',
        vendorPageId: null,
        vendorSourceId: null,
        sourceKind: null,
        sourceUrl: null,
      },
    });
  });
});
