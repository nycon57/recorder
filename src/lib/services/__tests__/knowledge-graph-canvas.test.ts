import type { KnowledgeGraphPayload } from '@/lib/types/knowledge-graph';

import { toCanvasGraphData } from '../knowledge-graph-canvas';

describe('knowledge-graph canvas adapter', () => {
  test('maps operational payload into legacy canvas nodes and typed edges', () => {
    const payload: KnowledgeGraphPayload = {
      nodes: [
        {
          id: 'org_page:page-1',
          rawId: 'page-1',
          kind: 'org_page',
          label: 'Lead routing',
          topic: 'Lead routing',
          app: 'HubSpot',
          screen: 'contact',
          confidence: 0.91,
          status: 'active',
          clusterId: 'cluster-1',
          updatedAt: '2026-04-19T00:00:00.000Z',
        },
        {
          id: 'vendor_page:vendor-1',
          rawId: 'vendor-1',
          kind: 'vendor_page',
          label: 'hubspot · contact',
          app: 'hubspot',
          screen: 'contact',
          sourceUrl: 'https://example.com',
        },
        {
          id: 'cluster:cluster-1',
          rawId: 'cluster-1',
          kind: 'cluster',
          label: 'Revenue ops',
          name: 'Revenue ops',
          memberCount: 4,
          centralPageId: 'page-1',
          modularity: 0.63,
          computedAt: '2026-04-18T04:00:00.000Z',
        },
      ],
      edges: [
        {
          id: 'org_relationship:r1',
          kind: 'org_relationship',
          source: 'org_page:page-1',
          target: 'org_page:page-1',
          relationshipType: 'related',
          sourceType: 'inferred',
          confidence: 0.66,
          evidence: null,
        },
        {
          id: 'org_in_cluster:page-1:cluster-1',
          kind: 'org_in_cluster',
          source: 'org_page:page-1',
          target: 'cluster:cluster-1',
        },
        {
          id: 'org_matches_vendor:page-1:vendor-1',
          kind: 'org_matches_vendor',
          source: 'org_page:page-1',
          target: 'vendor_page:vendor-1',
          matchKey: 'hubspot::contact',
        },
      ],
      meta: {
        generatedAt: '2026-04-19T00:00:00.000Z',
        orgId: 'org-1',
        limits: {
          orgPageLimit: 300,
          vendorPageLimit: 300,
          clusterLimit: 200,
          relationshipLimit: 2000,
          vendorMatchesPerOrgPage: 3,
          includeSuperseded: false,
        },
        counts: {
          nodes: 3,
          edges: 3,
          orgPages: 1,
          vendorPages: 1,
          clusters: 1,
          orgRelationships: 1,
          clusterMemberships: 1,
          vendorMatches: 1,
        },
      },
    };

    const canvasData = toCanvasGraphData(payload);

    expect(canvasData.nodes).toHaveLength(3);
    expect(canvasData.edges).toHaveLength(3);

    const orgNode = canvasData.nodes.find(
      (node) => node.id === 'org_page:page-1'
    );
    expect(orgNode).toMatchObject({
      type: 'process',
      metricLabel: 'confidence',
      typeLabel: 'org page',
      mentionCount: 91,
    });

    const vendorNode = canvasData.nodes.find(
      (node) => node.id === 'vendor_page:vendor-1'
    );
    expect(vendorNode).toMatchObject({
      type: 'tool',
      metricLabel: 'sources',
      typeLabel: 'vendor page',
      mentionCount: 1,
    });

    const clusterNode = canvasData.nodes.find(
      (node) => node.id === 'cluster:cluster-1'
    );
    expect(clusterNode).toMatchObject({
      type: 'organization',
      metricLabel: 'members',
      typeLabel: 'cluster',
      mentionCount: 4,
    });

    const membershipEdge = canvasData.edges.find(
      (edge) => edge.id === 'org_in_cluster:page-1:cluster-1'
    );
    expect(membershipEdge).toMatchObject({
      type: 'related_to',
      strength: 0.85,
    });
  });

  test('drops edges whose source/target nodes are missing', () => {
    const payload: KnowledgeGraphPayload = {
      nodes: [],
      edges: [
        {
          id: 'org_matches_vendor:missing',
          kind: 'org_matches_vendor',
          source: 'org_page:missing',
          target: 'vendor_page:missing',
          matchKey: 'a::b',
        },
      ],
      meta: {
        generatedAt: '2026-04-19T00:00:00.000Z',
        orgId: 'org-1',
        limits: {
          orgPageLimit: 300,
          vendorPageLimit: 300,
          clusterLimit: 200,
          relationshipLimit: 2000,
          vendorMatchesPerOrgPage: 3,
          includeSuperseded: false,
        },
        counts: {
          nodes: 0,
          edges: 1,
          orgPages: 0,
          vendorPages: 0,
          clusters: 0,
          orgRelationships: 0,
          clusterMemberships: 0,
          vendorMatches: 1,
        },
      },
    };

    const canvasData = toCanvasGraphData(payload);
    expect(canvasData.edges).toEqual([]);
  });
});
