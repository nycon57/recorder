import {
  buildKnowledgePageArtifactIndex,
  buildKnowledgePageRelationships,
  enrichKnowledgePageSources,
  splitApprovalRowsByStatus,
} from '../knowledge-page-detail';

describe('knowledge-page-detail service helpers', () => {
  test('buildKnowledgePageArtifactIndex keeps most recent artifact per content id', () => {
    const index = buildKnowledgePageArtifactIndex({
      transcripts: [
        { id: 't-old', content_id: 'content-a', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 't-new', content_id: 'content-a', updated_at: '2026-01-02T00:00:00.000Z' },
      ],
      documents: [
        {
          id: 'd-new',
          content_id: 'content-a',
          status: 'generated',
          updated_at: '2026-01-03T00:00:00.000Z',
        },
      ],
      workflows: [
        {
          id: 'w-old',
          content_id: 'content-a',
          title: 'Old workflow',
          status: 'draft',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'w-new',
          content_id: 'content-a',
          title: 'New workflow',
          status: 'published',
          updated_at: '2026-01-04T00:00:00.000Z',
        },
      ],
    });

    const item = index.get('content-a');

    expect(item?.transcript?.id).toBe('t-new');
    expect(item?.document?.id).toBe('d-new');
    expect(item?.workflow?.id).toBe('w-new');
  });

  test('enrichKnowledgePageSources orders by contributed_at and hydrates content/artifacts', () => {
    const artifacts = buildKnowledgePageArtifactIndex({
      transcripts: [{ id: 't-1', content_id: 'content-a', updated_at: '2026-01-02T00:00:00.000Z' }],
      documents: [],
      workflows: [],
    });

    const sources = enrichKnowledgePageSources({
      sourceRows: [
        {
          id: 'source-older',
          source_type: 'recording',
          source_id: 'content-a',
          contributed_at: '2026-01-01T00:00:00.000Z',
          contribution_summary: null,
        },
        {
          id: 'source-newer',
          source_type: 'manual',
          source_id: 'manual-id',
          contributed_at: '2026-01-05T00:00:00.000Z',
          contribution_summary: 'Manual merge',
        },
      ],
      contentById: new Map([
        [
          'content-a',
          {
            id: 'content-a',
            title: 'Demo recording',
            status: 'completed',
            content_type: 'recording',
            updated_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      ]),
      artifactIndex: artifacts,
    });

    expect(sources[0].id).toBe('source-newer');
    expect(sources[0].content).toBeNull();
    expect(sources[1].content?.id).toBe('content-a');
    expect(sources[1].artifacts.transcript?.id).toBe('t-1');
  });

  test('buildKnowledgePageRelationships marks direction and resolves related page metadata', () => {
    const relationships = buildKnowledgePageRelationships({
      pageId: 'page-a',
      relationships: [
        {
          id: 'r-out',
          source_page_id: 'page-a',
          target_page_id: 'page-b',
          relationship_type: 'requires',
          source_type: 'manual',
          confidence: 0.9,
          evidence: 'step dependency',
          created_at: '2026-01-03T00:00:00.000Z',
        },
        {
          id: 'r-in',
          source_page_id: 'page-c',
          target_page_id: 'page-a',
          relationship_type: 'related',
          source_type: 'inferred',
          confidence: 0.7,
          evidence: null,
          created_at: '2026-01-04T00:00:00.000Z',
        },
      ],
      pagesById: new Map([
        ['page-b', { id: 'page-b', topic: 'Target', app: 'HubSpot', screen: 'Deal', valid_until: null }],
        ['page-c', { id: 'page-c', topic: 'Source', app: null, screen: null, valid_until: null }],
      ]),
    });

    expect(relationships[0].id).toBe('r-in');
    expect(relationships[0].direction).toBe('incoming');
    expect(relationships[0].relatedPage?.id).toBe('page-c');
    expect(relationships[1].direction).toBe('outgoing');
    expect(relationships[1].relatedPage?.id).toBe('page-b');
  });

  test('splitApprovalRowsByStatus separates pending and reviewed approvals', () => {
    const approvals = splitApprovalRowsByStatus([
      {
        id: 'a-pending',
        agent_type: 'curator',
        action_type: 'reroute_content',
        content_id: 'content-a',
        description: 'Pending action',
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        expires_at: '2026-01-10T00:00:00.000Z',
        created_at: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'a-approved',
        agent_type: 'curator',
        action_type: 'reroute_content',
        content_id: 'content-b',
        description: 'Reviewed action',
        status: 'approved',
        reviewed_by: 'user-1',
        reviewed_at: '2026-01-04T00:00:00.000Z',
        rejection_reason: null,
        expires_at: '2026-01-10T00:00:00.000Z',
        created_at: '2026-01-04T00:00:00.000Z',
      },
    ]);

    expect(approvals.pendingApprovals).toHaveLength(1);
    expect(approvals.pendingApprovals[0].id).toBe('a-pending');
    expect(approvals.reviewedApprovals).toHaveLength(1);
    expect(approvals.reviewedApprovals[0].id).toBe('a-approved');
  });
});
