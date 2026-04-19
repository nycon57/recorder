import { knowledgeGraphQuerySchema } from '@/lib/types/knowledge-graph';

import { assembleKnowledgeGraph } from '../knowledge-graph';

describe('knowledge-graph service', () => {
  test('assembleKnowledgeGraph returns page-centric nodes and typed multi-entity edges', () => {
    const query = knowledgeGraphQuerySchema.parse({
      includeSuperseded: 'true',
      orgPageLimit: '200',
      vendorPageLimit: '200',
      clusterLimit: '50',
      relationshipLimit: '1000',
      vendorMatchesPerOrgPage: '2',
    });

    const graph = assembleKnowledgeGraph({
      orgId: 'org-1',
      query,
      orgPages: [
        {
          id: 'org-page-a',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal Qualification',
          confidence: 0.92,
          valid_until: null,
          cluster_id: 'cluster-1',
          updated_at: '2026-04-19T01:00:00.000Z',
        },
        {
          id: 'org-page-b',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal Handoff',
          confidence: 0.88,
          valid_until: '2026-04-01T00:00:00.000Z',
          cluster_id: null,
          updated_at: '2026-04-19T01:00:00.000Z',
        },
      ],
      vendorPages: [
        {
          id: 'vendor-page-1',
          app: 'hubspot',
          screen: 'deal',
          source_url: 'https://docs.example/deal',
        },
        {
          id: 'vendor-page-2',
          app: 'hubspot',
          screen: 'deal',
          source_url: 'https://docs.example/deal-2',
        },
      ],
      clusters: [
        {
          id: 'cluster-1',
          name: 'Revenue operations',
          member_count: 3,
          central_page_id: 'org-page-a',
          modularity: 0.61,
          computed_at: '2026-04-18T04:00:00.000Z',
        },
      ],
      relationships: [
        {
          id: 'rel-1',
          source_page_id: 'org-page-a',
          target_page_id: 'org-page-b',
          relationship_type: 'requires',
          source_type: 'inferred',
          confidence: 0.77,
          evidence: 'handoff requires qualification',
        },
      ],
    });

    expect(graph.nodes.length).toBe(5);
    expect(graph.meta.counts.orgPages).toBe(2);
    expect(graph.meta.counts.vendorPages).toBe(2);
    expect(graph.meta.counts.clusters).toBe(1);

    const orgNodeA = graph.nodes.find((node) => node.id === 'org_page:org-page-a');
    const orgNodeB = graph.nodes.find((node) => node.id === 'org_page:org-page-b');
    expect(orgNodeA && orgNodeA.kind === 'org_page').toBe(true);
    expect(orgNodeB && orgNodeB.kind === 'org_page').toBe(true);
    expect(orgNodeA && orgNodeA.kind === 'org_page' && orgNodeA.status).toBe('active');
    expect(orgNodeB && orgNodeB.kind === 'org_page' && orgNodeB.status).toBe('superseded');

    const relationshipEdge = graph.edges.find((edge) => edge.id === 'org_relationship:rel-1');
    expect(relationshipEdge).toBeTruthy();
    expect(relationshipEdge?.kind).toBe('org_relationship');

    const membershipEdge = graph.edges.find(
      (edge) => edge.id === 'org_in_cluster:org-page-a:cluster-1'
    );
    expect(membershipEdge).toBeTruthy();
    expect(membershipEdge?.kind).toBe('org_in_cluster');

    const vendorMatchEdges = graph.edges.filter(
      (edge) => edge.kind === 'org_matches_vendor'
    );
    expect(vendorMatchEdges.length).toBe(4);
    expect(graph.meta.counts.vendorMatches).toBe(4);
  });

  test('assembleKnowledgeGraph enforces vendor match fanout cap per org page', () => {
    const query = knowledgeGraphQuerySchema.parse({
      vendorMatchesPerOrgPage: '1',
    });

    const graph = assembleKnowledgeGraph({
      orgId: 'org-1',
      query,
      orgPages: [
        {
          id: 'org-page-a',
          app: 'HubSpot',
          screen: 'Deal',
          topic: 'Deal Qualification',
          confidence: 0.92,
          valid_until: null,
          cluster_id: null,
          updated_at: '2026-04-19T01:00:00.000Z',
        },
      ],
      vendorPages: [
        {
          id: 'vendor-page-1',
          app: 'hubspot',
          screen: 'deal',
          source_url: null,
        },
        {
          id: 'vendor-page-2',
          app: 'hubspot',
          screen: 'deal',
          source_url: null,
        },
        {
          id: 'vendor-page-3',
          app: 'hubspot',
          screen: 'deal',
          source_url: null,
        },
      ],
      clusters: [],
      relationships: [],
    });

    const vendorMatchEdges = graph.edges.filter(
      (edge) => edge.kind === 'org_matches_vendor'
    );
    expect(vendorMatchEdges.length).toBe(1);
    expect(graph.meta.counts.vendorMatches).toBe(1);
  });

  test('knowledgeGraphQuerySchema provides safe operational defaults', () => {
    const parsed = knowledgeGraphQuerySchema.parse({});

    expect(parsed).toEqual({
      orgPageLimit: 300,
      vendorPageLimit: 300,
      clusterLimit: 200,
      relationshipLimit: 2000,
      vendorMatchesPerOrgPage: 3,
      includeSuperseded: false,
    });
  });
});
