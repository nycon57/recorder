import { expect, test } from '@playwright/test';

import {
  buildCompiledMemoryAnswerContext,
  buildCompiledMemoryCitations,
  DEFAULT_CHAT_COMPILED_MEMORY_SCOPE,
} from '../../src/lib/services/compiled-memory-answer-context';
import {
  buildKnowledgeMatchExplainability,
  chooseKnowledgeMatch,
  summarizeKnowledgeAvailability,
  type KnowledgeMatchCandidate,
} from '../../src/lib/services/extension-context';
import { buildExtensionContextTelemetry } from '../../src/lib/services/extension-context-telemetry';
import { assembleKnowledgeDocsList } from '../../src/lib/services/knowledge-docs';
import { assembleKnowledgeGraph } from '../../src/lib/services/knowledge-graph';
import {
  buildReviewQueueItems,
  splitReviewQueueItemsByKind,
} from '../../src/lib/services/review-queue';
import {
  determineRoutingReviewDecisionAction,
  requiresRoutingReview,
} from '../../src/lib/services/routing-review';
import { knowledgeDocsQuerySchema } from '../../src/lib/types/knowledge-docs';
import { knowledgeGraphQuerySchema } from '../../src/lib/types/knowledge-graph';
import {
  getKnowledgeWorkspaceModeFromPathname,
  KNOWLEDGE_WORKSPACE_DEFAULT_MODE,
} from '../../src/app/components/knowledge/workspace-mode';
import {
  parseSearchUiMode,
  SEARCH_UI_DEFAULT_MODE,
} from '../../src/app/components/search/search-modes';

import {
  createCompiledMemoryContextFixture,
  createKnowledgeDocsAssemblyFixture,
} from './helpers/knowledge-cross-surface-fixtures';

test.describe('TRIB-114 knowledge cross-surface rollout gates', () => {
  test('compiled-memory happy path aligns extension touchpoint and dashboard chat behavior', () => {
    const vendorCandidate: KnowledgeMatchCandidate = {
      pageIds: ['vendor-hubspot-deals'],
      basis: 'exact',
      confidence: 0.95,
      app: 'hubspot',
      screen: 'deals',
      label: 'hubspot — deals',
      selectorHints: ['[data-surface="deals"]'],
    };
    const appOnlyFallback: KnowledgeMatchCandidate = {
      pageIds: ['vendor-fallback'],
      basis: 'app_only',
      confidence: 0.66,
      app: 'hubspot',
      screen: null,
      label: 'hubspot',
      selectorHints: [],
    };
    const orgCandidate: KnowledgeMatchCandidate = {
      pageIds: ['org-deal-escalation-playbook'],
      basis: 'exact',
      confidence: 0.94,
      app: 'hubspot',
      screen: 'deals',
      label: 'Deal escalation playbook',
      selectorHints: [],
    };

    const selectedVendorCandidate = chooseKnowledgeMatch([
      appOnlyFallback,
      vendorCandidate,
    ]);
    expect(selectedVendorCandidate?.basis).toBe('exact');

    const vendorExplainability = buildKnowledgeMatchExplainability({
      surface: 'vendor',
      basis: selectedVendorCandidate?.basis ?? 'app_only',
      url: 'https://app.hubspot.com/deals',
      requestedApp: 'hubspot',
      requestedScreen: 'deals',
      matchedApp: selectedVendorCandidate?.app ?? null,
      matchedScreen: selectedVendorCandidate?.screen ?? null,
      matchedLabel: selectedVendorCandidate?.label ?? null,
    });

    const availability = summarizeKnowledgeAvailability(
      selectedVendorCandidate,
      orgCandidate,
    );
    expect(availability.mode).toBe('org_backed');

    const telemetry = buildExtensionContextTelemetry({
      context: {
        app: 'hubspot',
        screen: 'deals',
        appSignature: 'hubspot:deals',
        url: 'https://app.hubspot.com/deals',
        title: 'HubSpot Deals',
        interactiveElements: [],
        vendorKnowledgeMatch: {
          matched: true,
          basis: selectedVendorCandidate?.basis ?? 'exact',
          confidence: selectedVendorCandidate?.confidence ?? 0.95,
          app: selectedVendorCandidate?.app ?? null,
          screen: selectedVendorCandidate?.screen ?? null,
          pageIds: selectedVendorCandidate?.pageIds ?? [],
          basisCategory: vendorExplainability.basisCategory,
          basisLabel: vendorExplainability.basisLabel,
          basisExplanation: vendorExplainability.basisExplanation,
        },
        orgKnowledgeMatch: {
          matched: true,
          basis: orgCandidate.basis,
          confidence: orgCandidate.confidence,
          app: orgCandidate.app,
          screen: orgCandidate.screen,
          pageIds: orgCandidate.pageIds,
          basisCategory: 'exact',
          basisLabel: 'Exact match',
          basisExplanation:
            'Matched the org overlay because the detected app and screen matched the compiled team page.',
        },
        knowledgeAvailability: availability,
      },
      latencyMs: 28,
      authMethod: 'session',
      orgId: 'org-tribora',
      actorId: 'user-tribora',
    });

    const compiledMemory = createCompiledMemoryContextFixture();
    const answerContext = buildCompiledMemoryAnswerContext(compiledMemory, 3);
    const citations = buildCompiledMemoryCitations(answerContext.sources);

    expect(DEFAULT_CHAT_COMPILED_MEMORY_SCOPE).toEqual({
      app: 'workspace',
      screen: 'knowledge-chat',
    });
    expect(telemetry.knowledgeMode).toBe('org_backed');
    expect(telemetry.vendorMatchCategory).toBe('exact');
    expect(telemetry.orgMatchCategory).toBe('exact');
    expect(answerContext.sources.map((source) => source.layer)).toEqual([
      'org',
      'vendor_training',
      'vendor',
    ]);
    expect(answerContext.context).toContain('SOURCE PRECEDENCE');
    expect(answerContext.context).toContain("YOUR TEAM'S KNOWLEDGE");
    expect(answerContext.context).toContain('VENDOR TRAINING');
    expect(answerContext.context).toContain('VENDOR KNOWLEDGE');
    expect(citations.map((citation) => citation.citationNumber)).toEqual([1, 2, 3]);
  });

  test('docs, graph, and review surfaces stay coherent for governance-critical routes', () => {
    const docsFixture = createKnowledgeDocsAssemblyFixture();
    const docsPayload = assembleKnowledgeDocsList({
      query: knowledgeDocsQuerySchema.parse({ sort: 'updated_desc', limit: 50 }),
      ...docsFixture,
    });

    const liveDoc = docsPayload.items.find(
      (item) => item.id === 'org-deal-escalation-playbook',
    );
    const reviewDoc = docsPayload.items.find(
      (item) => item.id === 'org-handoff-needs-review',
    );

    expect(liveDoc?.status).toBe('live');
    expect(liveDoc?.vendorCoverage).toBe('covered');
    expect(liveDoc?.detailHref).toBe('/knowledge/pages/org-deal-escalation-playbook');
    expect(reviewDoc?.status).toBe('needs_review');

    const graphPayload = assembleKnowledgeGraph({
      orgId: 'org-tribora',
      query: knowledgeGraphQuerySchema.parse({
        vendorMatchesPerOrgPage: '1',
      }),
      orgPages: docsFixture.pages,
      vendorPages: [
        {
          id: 'vendor-hubspot-deals',
          app: 'hubspot',
          screen: 'deals',
          source_url: 'https://docs.vendor.example/hubspot/deals',
        },
      ],
      clusters: [
        {
          id: 'cluster-revops',
          name: 'Revenue Ops',
          member_count: 2,
          central_page_id: 'org-deal-escalation-playbook',
          modularity: 0.61,
          computed_at: '2026-04-19T13:00:00.000Z',
        },
      ],
      relationships: [
        {
          id: 'relationship-1',
          source_page_id: 'org-deal-escalation-playbook',
          target_page_id: 'org-handoff-needs-review',
          relationship_type: 'requires',
          source_type: 'inferred',
          confidence: 0.72,
          evidence: 'escalation precedes handoff',
        },
      ],
    });

    expect(
      graphPayload.nodes.some(
        (node) => node.id === 'org_page:org-deal-escalation-playbook',
      ),
    ).toBe(true);
    expect(
      graphPayload.edges.some((edge) => edge.kind === 'org_matches_vendor'),
    ).toBe(true);

    const reviewItems = buildReviewQueueItems({
      contradictions: [
        {
          page: {
            id: 'org-handoff-needs-review',
            org_id: 'org-tribora',
            app: 'hubspot',
            screen: 'deals',
            topic: 'Deal handoff checklist',
            content: 'Current checklist',
            confidence: 0.78,
            valid_from: '2026-04-18T12:00:00.000Z',
            valid_until: null,
            supersedes_id: null,
            compilation_log: [],
            created_at: '2026-04-18T12:00:00.000Z',
            updated_at: '2026-04-18T12:00:00.000Z',
          },
          pendingEntries: [
            {
              entryIndex: 0,
              entry: {
                action: 'flagged',
                source_recording_id: 'recording-ops-2',
                detected_at: '2026-04-18T14:00:00.000Z',
                contradictions: [{ old: 'A', new: 'B', field: 'step' }],
              },
            },
          ],
        },
      ],
      routing: [
        {
          approvalId: 'approval-routing-1',
          contentId: 'recording-ops-2',
          title: 'Deal handoff call',
          createdAt: '2026-04-18T15:00:00.000Z',
          routeConfidence: 0.42,
          routeReason: 'Detected app is clear but screen confidence is low.',
          proposedRoute: {
            topic: 'deal-handoff-checklist',
            app: 'hubspot',
            screen: 'deals',
          },
        },
      ],
      manualPublications: [
        {
          contentId: 'document-ops-1',
          documentId: 'doc-ops-1',
          title: 'Quarterly handoff SOP',
          createdAt: '2026-04-19T10:00:00.000Z',
          connectorCount: 2,
        },
      ],
    });

    const groupedReview = splitReviewQueueItemsByKind(reviewItems);
    expect(groupedReview.contradiction.length).toBe(1);
    expect(groupedReview.routing.length).toBe(1);
    expect(groupedReview['manual-publication'].length).toBe(1);

    expect(
      determineRoutingReviewDecisionAction({
        status: 'approved',
        proposedRoute: {
          topic: 'deal-handoff-checklist',
          app: 'hubspot',
          screen: 'deals',
        },
        approvedRoute: {
          topic: 'deal-handoff-checklist',
          app: 'hubspot',
          screen: 'deals-v2',
        },
      }),
    ).toBe('reroute');

    expect(
      determineRoutingReviewDecisionAction({
        status: 'approved',
        proposedRoute: {
          topic: 'deal-handoff-checklist',
          app: 'hubspot',
          screen: 'deals',
        },
        approvedRoute: {
          topic: 'deal-handoff-checklist',
          app: 'hubspot',
          screen: 'deals-v2',
        },
        decisionHint: 'edit_and_approve',
      }),
    ).toBe('edit_and_approve');

    expect(
      determineRoutingReviewDecisionAction({
        status: 'rejected',
        proposedRoute: {
          topic: 'deal-handoff-checklist',
          app: 'hubspot',
          screen: 'deals',
        },
        approvedRoute: null,
      }),
    ).toBe('reject');

    expect(
      requiresRoutingReview({
        topic: 'deal-handoff-checklist',
        app: 'hubspot',
        screen: 'deals',
        routeConfidence: 0.42,
      }),
    ).toBe(true);
    expect(
      requiresRoutingReview({
        topic: 'deal-handoff-checklist',
        app: 'hubspot',
        screen: 'deals',
        routeConfidence: 0.91,
      }),
    ).toBe(false);
  });

  test('navigation contracts keep docs, graph, and review surfaces stable', () => {
    expect(KNOWLEDGE_WORKSPACE_DEFAULT_MODE).toBe('docs');
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge')).toBe('docs');
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/map')).toBe('map');
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/review')).toBe('review');
    expect(getKnowledgeWorkspaceModeFromPathname('/knowledge/pages/page-123')).toBe(
      'docs',
    );

    expect(SEARCH_UI_DEFAULT_MODE).toBe('answer');
    expect(parseSearchUiMode('answer')).toBe('answer');
    expect(parseSearchUiMode('docs')).toBe('docs');
    expect(parseSearchUiMode('sources')).toBe('sources');
    expect(parseSearchUiMode('unexpected')).toBe('answer');
  });
});
