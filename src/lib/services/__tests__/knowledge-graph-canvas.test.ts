import type { KnowledgeGraphPayload } from '@/lib/types/knowledge-graph';

import {
  buildCanvasClusterHulls,
  filterCanvasGraphData,
  toCanvasGraphData,
} from '../knowledge-graph-canvas';

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
      nodeKind: 'org_page',
      status: 'active',
      app: 'HubSpot',
      screen: 'contact',
    });

    const vendorNode = canvasData.nodes.find(
      (node) => node.id === 'vendor_page:vendor-1'
    );
    expect(vendorNode).toMatchObject({
      type: 'tool',
      metricLabel: 'sources',
      typeLabel: 'vendor page',
      mentionCount: 1,
      nodeKind: 'vendor_page',
      sourceUrl: 'https://example.com',
    });

    const clusterNode = canvasData.nodes.find(
      (node) => node.id === 'cluster:cluster-1'
    );
    expect(clusterNode).toMatchObject({
      type: 'organization',
      metricLabel: 'members',
      typeLabel: 'cluster',
      mentionCount: 4,
      nodeKind: 'cluster',
      memberCount: 4,
    });

    const membershipEdge = canvasData.edges.find(
      (edge) => edge.id === 'org_in_cluster:page-1:cluster-1'
    );
    expect(membershipEdge).toMatchObject({
      type: 'related_to',
      strength: 0.85,
      edgeKind: 'org_in_cluster',
    });

    const relationshipEdge = canvasData.edges.find(
      (edge) => edge.id === 'org_relationship:r1'
    );
    expect(relationshipEdge).toMatchObject({
      edgeKind: 'org_relationship',
      relationshipType: 'related',
      sourceType: 'inferred',
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

  test('filterCanvasGraphData narrows graph by node kind, edge kind, and search', () => {
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

    const graph = toCanvasGraphData(payload);
    const filtered = filterCanvasGraphData(graph, {
      nodeKinds: ['org_page', 'cluster'],
      edgeKinds: ['org_in_cluster'],
      search: 'lead',
    });

    expect(filtered.nodes).toHaveLength(1);
    expect(filtered.nodes[0].id).toBe('org_page:page-1');
    expect(filtered.edges).toHaveLength(0);

    const clusterOnly = filterCanvasGraphData(graph, {
      nodeKinds: ['org_page', 'cluster'],
      edgeKinds: ['org_in_cluster'],
    });

    expect(clusterOnly.nodes.map((node) => node.id).sort()).toEqual([
      'cluster:cluster-1',
      'org_page:page-1',
    ]);
    expect(clusterOnly.edges.map((edge) => edge.id)).toEqual([
      'org_in_cluster:page-1:cluster-1',
    ]);
  });

  test('buildCanvasClusterHulls summarizes membership, vendor links, and relationships', () => {
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
          id: 'org_page:page-2',
          rawId: 'page-2',
          kind: 'org_page',
          label: 'Follow-up flow',
          topic: 'Follow-up flow',
          app: 'HubSpot',
          screen: 'workflow',
          confidence: 0.82,
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
          sourceUrl: 'https://example.com/contact',
        },
        {
          id: 'cluster:cluster-1',
          rawId: 'cluster-1',
          kind: 'cluster',
          label: 'Revenue ops',
          name: 'Revenue ops',
          memberCount: 2,
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
          target: 'org_page:page-2',
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
          id: 'org_in_cluster:page-2:cluster-1',
          kind: 'org_in_cluster',
          source: 'org_page:page-2',
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
          nodes: 4,
          edges: 4,
          orgPages: 2,
          vendorPages: 1,
          clusters: 1,
          orgRelationships: 1,
          clusterMemberships: 2,
          vendorMatches: 1,
        },
      },
    };

    const graph = toCanvasGraphData(payload);
    const hulls = buildCanvasClusterHulls(graph);

    expect(hulls).toHaveLength(1);
    expect(hulls[0]).toMatchObject({
      clusterNodeId: 'cluster:cluster-1',
      clusterLabel: 'Revenue ops',
      memberCount: 2,
      relationshipEdgeCount: 1,
    });
    expect(hulls[0].memberNodeIds.sort()).toEqual([
      'org_page:page-1',
      'org_page:page-2',
    ]);
    expect(hulls[0].vendorNodeIds).toEqual(['vendor_page:vendor-1']);
  });
});
