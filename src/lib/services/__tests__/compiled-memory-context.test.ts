import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resolveCompiledMemoryContext } from '../compiled-memory-context';
import { getVendorForOrg } from '../vendor-customers';
import { resolveOrgWikiPagesByVector } from '../org-wiki-embedding';
import { resolveVendorWikiPage } from '../vendor-wiki-resolver';
import { resolveClusterContext } from '../wiki-clusters';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

jest.mock('../vendor-wiki-resolver', () => ({
  resolveVendorWikiPage: jest.fn(),
}));

jest.mock('../vendor-customers', () => ({
  getVendorForOrg: jest.fn(),
}));

jest.mock('../org-wiki-embedding', () => ({
  resolveOrgWikiPagesByVector: jest.fn(),
}));

jest.mock('../wiki-clusters', () => ({
  resolveClusterContext: jest.fn(),
}));

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

function createSupabaseMock(args: {
  clusterEnabled?: boolean | null;
  priorInteractionIds?: string[];
  citationRows?: Array<{ page_id: string; source_id: string; source_type: string }>;
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

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

describe('resolveCompiledMemoryContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns vendor, vendor-training, and org layers plus structured citations', async () => {
    (resolveVendorWikiPage as jest.Mock).mockResolvedValue({
      id: 'vendor-1',
      app: 'hubspot',
      screen: 'deals',
      content: 'Vendor knowledge',
      source_url: 'https://docs.example.com/deals',
    });

    (getVendorForOrg as jest.Mock).mockResolvedValue({
      vendorOrgId: 'vendor-org-1',
      whiteLabelConfig: {
        knowledge_scope: ['hubspot'],
      },
    });

    (resolveOrgWikiPagesByVector as jest.Mock).mockImplementation(
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

    (resolveClusterContext as jest.Mock).mockResolvedValue([
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

    (createAdminClient as jest.Mock).mockReturnValue(
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
            source_type: 'recording',
          },
        ],
      }),
    );

    const result = await resolveCompiledMemoryContext({
      orgId: 'org-123',
      userId: 'user-123',
      app: 'hubspot',
      screen: 'deals',
      questionEmbedding: [0.1, 0.2, 0.3],
    });

    expect(resolveVendorWikiPage).toHaveBeenCalledWith({
      app: 'hubspot',
      screen: 'deals',
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
        },
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
          title: 'hubspot — deals',
          layer: 'vendor',
          linkUrl: 'https://docs.example.com/deals',
        },
        'training-1': {
          sourceId: 'training-1',
          title: 'Vendor playbook',
          layer: 'vendor_training',
        },
        'org-1': {
          sourceId: 'org-1',
          title: 'Deal stages',
          layer: 'org',
          linkUrl: '/dashboard/recordings/recording-1',
        },
        'org-2': {
          sourceId: 'org-2',
          title: 'Deal owners',
          layer: 'org',
          linkUrl: undefined,
        },
        'org-3': {
          sourceId: 'org-3',
          title: 'Renewal notes',
          layer: 'org',
          linkUrl: '/dashboard/recordings/recording-3',
        },
      },
    });
  });

  it('skips cluster expansion for as-of lookups while still returning vendor and org citation metadata', async () => {
    (resolveVendorWikiPage as jest.Mock).mockResolvedValue({
      id: 'vendor-9',
      app: 'salesforce',
      screen: 'lead-detail',
      content: 'Vendor fallback',
      source_url: 'https://docs.example.com/lead-detail',
    });

    (getVendorForOrg as jest.Mock).mockResolvedValue(null);

    (resolveOrgWikiPagesByVector as jest.Mock).mockResolvedValue([
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

    (createAdminClient as jest.Mock).mockReturnValue(
      createSupabaseMock({
        priorInteractionIds: ['org-9'],
        citationRows: [
          {
            page_id: 'org-9',
            source_id: 'recording-9',
            source_type: 'recording',
          },
        ],
      }),
    );

    const result = await resolveCompiledMemoryContext({
      orgId: 'org-999',
      userId: 'user-999',
      app: 'salesforce',
      screen: 'lead-detail',
      questionEmbedding: [0.4, 0.5, 0.6],
      asOf: '2026-04-01T12:00:00.000Z',
    });

    expect(resolveClusterContext).not.toHaveBeenCalled();
    expect(result.vendorKnowledge.page?.id).toBe('vendor-9');
    expect(result.vendorTraining.pages).toEqual([]);
    expect(result.orgKnowledge.priorTopics).toEqual(['Lead routing']);
    expect(result.citationsBySourceId['org-9']).toEqual({
      sourceId: 'org-9',
      title: 'Lead routing',
      layer: 'org',
      linkUrl: '/dashboard/recordings/recording-9',
    });
  });
});
