import { describe, expect, test } from '@jest/globals';

import { knowledgeDocsQuerySchema } from '@/lib/types/knowledge-docs';

import { assembleKnowledgeDocsList } from '../knowledge-docs';

describe('knowledge-docs service', () => {
  test('assembles compiled knowledge docs with operational facets and detail links', () => {
    const query = knowledgeDocsQuerySchema.parse({});

    const payload = assembleKnowledgeDocsList({
      query,
      pages: [
        {
          id: 'page-live',
          app: 'HubSpot',
          screen: 'Deals',
          topic: 'Deal Qualification',
          confidence: 0.92,
          valid_until: null,
          cluster_id: 'cluster-revops',
          updated_at: '2026-04-19T10:00:00.000Z',
          compilation_log: [],
        },
        {
          id: 'page-review',
          app: 'HubSpot',
          screen: 'Deals',
          topic: 'Deal Handoff',
          confidence: 0.84,
          valid_until: null,
          cluster_id: null,
          updated_at: '2026-04-18T10:00:00.000Z',
          compilation_log: [
            {
              action: 'flagged',
              source_recording_id: 'recording-1',
              detected_at: '2026-04-18T09:00:00.000Z',
              resolved_at: null,
            },
          ],
        },
        {
          id: 'page-superseded',
          app: null,
          screen: null,
          topic: 'Legacy Process',
          confidence: 0.61,
          valid_until: '2026-04-01T00:00:00.000Z',
          cluster_id: null,
          updated_at: '2026-04-17T10:00:00.000Z',
          compilation_log: [],
        },
      ],
      pageSources: [
        {
          page_id: 'page-live',
          source_type: 'video',
        },
        {
          page_id: 'page-review',
          source_type: 'document',
        },
        { page_id: 'page-review', source_type: 'manual' },
      ],
      clusters: [{ id: 'cluster-revops', name: 'Revenue Ops' }],
      vendorPages: [{ app: 'hubspot', screen: 'deals' }],
    });

    expect(payload.items).toHaveLength(3);
    expect(payload.items[0]?.id).toBe('page-live');
    expect(payload.items[0]?.detailHref).toBe('/knowledge/pages/page-live');
    expect(payload.items[0]?.status).toBe('live');
    expect(payload.items[0]?.type).toBe('video');
    expect(payload.items[0]?.sourceTypes).toEqual(['video']);
    expect(payload.items[0]?.vendorCoverage).toBe('covered');
    expect(payload.items[1]?.status).toBe('needs_review');
    expect(payload.items[1]?.type).toBe('mixed');
    expect(payload.items[2]?.status).toBe('superseded');
    expect(payload.items[2]?.vendorCoverage).toBe('unrouted');

    const appsFacet = payload.facets.apps.find((item) => item.value === 'hubspot');
    expect(appsFacet?.count).toBe(2);

    const clusterFacet = payload.facets.clusters.find(
      (item) => item.value === 'cluster-revops'
    );
    expect(clusterFacet?.label).toBe('Revenue Ops');
  });

  test('filters by type, status, app, vendor coverage, and cluster', () => {
    const baseRows = {
      pages: [
        {
          id: 'page-a',
          app: 'HubSpot',
          screen: 'Deals',
          topic: 'Deal Qualification',
          confidence: 0.9,
          valid_until: null,
          cluster_id: 'cluster-a',
          updated_at: '2026-04-20T10:00:00.000Z',
          compilation_log: [],
        },
        {
          id: 'page-b',
          app: 'Salesforce',
          screen: 'Leads',
          topic: 'Lead Routing',
          confidence: 0.8,
          valid_until: null,
          cluster_id: null,
          updated_at: '2026-04-18T10:00:00.000Z',
          compilation_log: [],
        },
      ],
      pageSources: [
        { page_id: 'page-a', source_type: 'recording' },
        { page_id: 'page-b', source_type: 'manual' },
      ],
      clusters: [{ id: 'cluster-a', name: 'Cluster A' }],
      vendorPages: [{ app: 'hubspot', screen: 'deals' }],
    };

    const filtered = assembleKnowledgeDocsList({
      ...baseRows,
      query: knowledgeDocsQuerySchema.parse({
        type: 'recording',
        status: 'live',
        app: 'hubspot',
        vendorCoverage: 'covered',
        cluster: 'cluster-a',
      }),
    });

    expect(filtered.items).toHaveLength(1);
    expect(filtered.items[0]?.id).toBe('page-a');

    const unclustered = assembleKnowledgeDocsList({
      ...baseRows,
      query: knowledgeDocsQuerySchema.parse({
        cluster: 'unclustered',
      }),
    });

    expect(unclustered.items).toHaveLength(1);
    expect(unclustered.items[0]?.id).toBe('page-b');
  });

  test('knowledgeDocsQuerySchema enforces safe defaults', () => {
    const parsed = knowledgeDocsQuerySchema.parse({});

    expect(parsed).toEqual({
      sort: 'updated_desc',
      limit: 100,
      offset: 0,
    });
  });
});
