import assert from 'node:assert/strict';

import {
  buildCompiledMemoryAnswerContext,
  buildExtensionCompiledMemoryPrompt,
  resolveCompiledMemoryAnswerContext,
  resolveScopedCompiledMemoryAnswerContext,
  summarizeCompiledMemoryAnswerObservability,
  DEFAULT_CHAT_COMPILED_MEMORY_SCOPE,
} from '../compiled-memory-answer-context';
import type { CompiledMemoryContext } from '../compiled-memory-context';

const EMPTY_FRESHNESS = {
  updatedAt: null,
  lastSuccessfulSyncAt: null,
  freshnessTarget: null,
  isStale: null,
} as const;

function provenance(
  pageId: string,
  overrides: Partial<{
    vendorPageId: string | null;
    vendorSourceId: string | null;
    sourceKind: string | null;
    sourceUrl: string | null;
  }> = {},
) {
  return {
    pageId,
    vendorPageId: null,
    vendorSourceId: null,
    sourceKind: null,
    sourceUrl: null,
    ...overrides,
  };
}

test('buildCompiledMemoryAnswerContext prioritizes org knowledge before vendor layers', () => {
  const compiledMemory: CompiledMemoryContext = {
    vendorKnowledge: {
      page: {
        id: 'vendor-1',
        app: 'hubspot',
        screen: 'deals',
        content: 'Vendor documentation for the general deal screen.',
        source_url: 'https://docs.example.com/deals',
      } as CompiledMemoryContext['vendorKnowledge']['page'],
      pages: [
        {
          id: 'vendor-1',
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
          app: 'hubspot',
          screen: 'deals',
          title: 'HubSpot deals',
          content: 'Vendor documentation for the general deal screen.',
          sourceUrl: 'https://docs.example.com/deals',
          updatedAt: '2026-04-19T12:00:00.000Z',
          confidence: 0.82,
          distance: 0.18,
          matchType: 'exact',
        },
        {
          id: 'vendor-2',
          vendorPageId: 'vendor-page-2',
          vendorSourceId: 'source-1',
          app: 'hubspot',
          screen: 'pipelines',
          title: 'Pipeline defaults',
          content: 'Vendor documentation for broader pipeline configuration.',
          sourceUrl: 'https://docs.example.com/pipelines',
          updatedAt: '2026-04-18T12:00:00.000Z',
          confidence: 0.74,
          distance: 0.26,
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
          topic: 'Vendor rollout playbook',
          content: 'Vendor training says to stage new deals before assignment.',
          confidence: 0.82,
          distance: 0.18,
        },
      ],
    },
    orgKnowledge: {
      pages: [
        {
          id: 'org-1',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Deal routing',
          content: 'Team knowledge says enterprise leads skip the SDR queue.',
          confidence: 0.94,
          distance: 0.06,
        },
      ],
      priorTopics: ['Deal routing'],
    },
    citationsBySourceId: {
      'org-1': {
        sourceId: 'org-1',
        title: 'Deal routing',
        layer: 'org',
        linkUrl: '/dashboard/recordings/recording-1',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-1'),
      },
      'training-1': {
        sourceId: 'training-1',
        title: 'Vendor rollout playbook',
        layer: 'vendor_training',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('training-1'),
      },
      'vendor-1': {
        sourceId: 'vendor-1',
        title: 'HubSpot deals',
        layer: 'vendor',
        linkUrl: 'https://docs.example.com/deals',
        freshness: {
          updatedAt: '2026-04-19T12:00:00.000Z',
          lastSuccessfulSyncAt: '2026-04-19T10:00:00.000Z',
          freshnessTarget: '7 days',
          isStale: false,
        },
        provenance: provenance('vendor-1', {
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
          sourceKind: 'documentation',
          sourceUrl: 'https://docs.example.com/deals',
        }),
      },
      'vendor-2': {
        sourceId: 'vendor-2',
        title: 'Pipeline defaults',
        layer: 'vendor',
        linkUrl: 'https://docs.example.com/pipelines',
        freshness: {
          updatedAt: '2026-04-18T12:00:00.000Z',
          lastSuccessfulSyncAt: '2026-04-19T10:00:00.000Z',
          freshnessTarget: '7 days',
          isStale: false,
        },
        provenance: provenance('vendor-2', {
          vendorPageId: 'vendor-page-2',
          vendorSourceId: 'source-1',
          sourceKind: 'documentation',
          sourceUrl: 'https://docs.example.com/pipelines',
        }),
      },
    },
  };

  const result = buildCompiledMemoryAnswerContext(compiledMemory);

  assert.deepEqual(
    result.sources.map((source) => source.sourceId),
    ['org-1', 'training-1', 'vendor-1', 'vendor-2'],
  );
  assert.match(result.context, /YOUR TEAM'S KNOWLEDGE:/);
  assert.match(result.context, /VENDOR TRAINING:/);
  assert.match(result.context, /VENDOR KNOWLEDGE:/);
  assert.match(result.context, /SOURCE PRECEDENCE:/);
  assert.match(
    result.context,
    /YOUR TEAM'S KNOWLEDGE overrides VENDOR TRAINING and VENDOR KNOWLEDGE/,
  );
  assert.match(result.context, /\[1\] Deal routing/);
  assert.match(result.context, /\[2\] Vendor rollout playbook/);
  assert.match(result.context, /\[3\] HubSpot deals/);
  assert.match(result.context, /\[4\] Pipeline defaults/);
  assert.deepEqual(
    result.sources.map((source) => source.citationNumber),
    [1, 2, 3, 4],
  );
  assert.equal(result.sources[0]?.url, '/dashboard/recordings/recording-1');
  assert.equal(result.sources[2]?.url, 'https://docs.example.com/deals');
  assert.equal(result.sources[3]?.url, 'https://docs.example.com/pipelines');
  assert.equal(
    result.citationsBySourceId['vendor-2']?.freshness.updatedAt,
    '2026-04-18T12:00:00.000Z',
  );
  assert.deepEqual(result.priorTopics, ['Deal routing']);
});

test('buildCompiledMemoryAnswerContext applies citation limits globally across layers', () => {
  const compiledMemory: CompiledMemoryContext = {
    vendorKnowledge: {
      page: {
        id: 'vendor-1',
        app: 'hubspot',
        screen: 'deals',
        content: 'Vendor documentation for the general deal screen.',
        source_url: 'https://docs.example.com/deals',
      } as CompiledMemoryContext['vendorKnowledge']['page'],
      pages: [
        {
          id: 'vendor-1',
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
          app: 'hubspot',
          screen: 'deals',
          title: 'HubSpot deals',
          content: 'Vendor documentation for the general deal screen.',
          sourceUrl: 'https://docs.example.com/deals',
          updatedAt: '2026-04-19T12:00:00.000Z',
          confidence: 0.82,
          distance: 0.18,
          matchType: 'exact',
        },
      ],
    },
    vendorTraining: {
      pages: [
        {
          id: 'training-1',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Vendor rollout playbook',
          content: 'Vendor training says to stage new deals before assignment.',
          confidence: 0.82,
          distance: 0.18,
        },
      ],
    },
    orgKnowledge: {
      pages: [
        {
          id: 'org-1',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Deal routing',
          content: 'Team knowledge says enterprise leads skip the SDR queue.',
          confidence: 0.94,
          distance: 0.06,
        },
        {
          id: 'org-2',
          app: 'hubspot',
          screen: 'deals',
          topic: 'Discount approvals',
          content: 'Managers approve discounts above twenty percent.',
          confidence: 0.89,
          distance: 0.11,
        },
      ],
      priorTopics: [],
    },
    citationsBySourceId: {
      'org-1': {
        sourceId: 'org-1',
        title: 'Deal routing',
        layer: 'org',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-1'),
      },
      'org-2': {
        sourceId: 'org-2',
        title: 'Discount approvals',
        layer: 'org',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-2'),
      },
      'training-1': {
        sourceId: 'training-1',
        title: 'Vendor rollout playbook',
        layer: 'vendor_training',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('training-1'),
      },
      'vendor-1': {
        sourceId: 'vendor-1',
        title: 'HubSpot deals',
        layer: 'vendor',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('vendor-1', {
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
        }),
      },
    },
  };

  const result = buildCompiledMemoryAnswerContext(compiledMemory, 2);

  assert.deepEqual(
    result.sources.map((source) => source.sourceId),
    ['org-1', 'org-2'],
  );
  assert.doesNotMatch(result.context, /VENDOR TRAINING:/);
  assert.doesNotMatch(result.context, /VENDOR KNOWLEDGE:/);
});

test('buildExtensionCompiledMemoryPrompt reuses the normalized answer context for extension answers', () => {
  const compiledMemory: CompiledMemoryContext = {
    vendorKnowledge: {
      page: null,
      pages: [
        {
          id: 'vendor-1',
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
          app: 'vercel',
          screen: 'projects',
          title: 'Project settings',
          content: 'Open Settings to manage project domains.',
          sourceUrl: 'https://vercel.com/docs/projects/settings',
          updatedAt: '2026-04-19T12:00:00.000Z',
          confidence: 0.81,
          distance: 0.19,
          matchType: 'semantic',
        },
      ],
    },
    vendorTraining: { pages: [] },
    orgKnowledge: {
      pages: [
        {
          id: 'org-1',
          app: 'vercel',
          screen: 'projects',
          topic: 'Project ownership',
          content: 'Our team updates domains from the project settings page.',
          confidence: 0.93,
          distance: 0.07,
        },
      ],
      priorTopics: ['Project ownership'],
    },
    citationsBySourceId: {
      'org-1': {
        sourceId: 'org-1',
        title: 'Project ownership',
        layer: 'org',
        linkUrl: '/dashboard/recordings/recording-1',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-1'),
      },
      'vendor-1': {
        sourceId: 'vendor-1',
        title: 'Project settings',
        layer: 'vendor',
        linkUrl: 'https://vercel.com/docs/projects/settings',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('vendor-1', {
          vendorPageId: 'vendor-1',
          vendorSourceId: 'source-1',
          sourceUrl: 'https://vercel.com/docs/projects/settings',
        }),
      },
    },
  };

  const answerContext = buildCompiledMemoryAnswerContext(compiledMemory);
  const prompt = buildExtensionCompiledMemoryPrompt({
    app: 'vercel',
    screen: 'projects',
    question: 'How do I update our domain?',
    elements: [{ selector: '[data-test=settings]', label: 'Settings' }],
    answerContext,
  });

  assert.match(prompt, /YOUR TEAM'S KNOWLEDGE/);
  assert.match(prompt, /\[SOURCE:org-1:Project ownership\]/);
  assert.match(prompt, /\[SOURCE:vendor-1:Project settings\]/);
  assert.match(prompt, /\[ELEMENT:selector:label\]/);
  assert.match(
    prompt,
    /The user has previously been shown information about: Project ownership/,
  );
});

test('buildExtensionCompiledMemoryPrompt includes DOM-first page context when provided', () => {
  const prompt = buildExtensionCompiledMemoryPrompt({
    app: 'unknown',
    screen: 'settings',
    question: 'Where is billing?',
    elements: [{ selector: '#billing', label: 'Billing' }],
    answerContext: {
      context: '',
      sources: [],
      citations: [],
      citationsBySourceId: {},
      priorTopics: [],
    },
    pageContext: {
      app: 'unknown',
      screen: 'settings',
      appSignature: 'unknown:settings',
      url: 'https://example.com/settings',
      title: 'Settings',
      interactiveElements: [
        { selector: '#billing', label: 'Billing', type: 'link' },
      ],
      regions: [
        {
          id: 'region-1',
          selector: 'main',
          kind: 'main',
          label: 'Settings',
          interactiveCount: 1,
          snippetCount: 1,
        },
      ],
      snippets: [
        {
          id: 'snippet-1',
          selector: 'h1',
          kind: 'heading',
          text: 'Settings',
          regionId: 'region-1',
        },
      ],
    },
  });

  expect(prompt).toContain('DOM-FIRST PAGE UNDERSTANDING');
  expect(prompt).toContain('region-1 main "Settings"');
  expect(prompt).toContain('answer from the visible page only');
});

test('resolveCompiledMemoryAnswerContext passes the default chat scope into the shared compiled-memory resolver', async () => {
  let receivedArgs: any;

  const result = await resolveCompiledMemoryAnswerContext(
    {
      orgId: 'org-123',
      userId: 'user-123',
      question: 'How do we route enterprise deals?',
      limit: 4,
    },
    {
      generateEmbedding: async () => ({
        embedding: [0.1, 0.2, 0.3],
        provider: 'google',
      }),
      resolveCompiledMemory: async (args) => {
        receivedArgs = args;
        return {
          vendorKnowledge: { page: null, pages: [] },
          vendorTraining: { pages: [] },
          orgKnowledge: {
            pages: [
              {
                id: 'org-1',
                app: 'workspace',
                screen: 'knowledge-chat',
                topic: 'Enterprise routing',
                content: 'Enterprise deals go straight to account executives.',
                confidence: 0.91,
                distance: 0.09,
              },
            ],
            priorTopics: [],
          },
          citationsBySourceId: {
            'org-1': {
              sourceId: 'org-1',
              title: 'Enterprise routing',
              layer: 'org',
              linkUrl: '/dashboard/recordings/recording-9',
              freshness: EMPTY_FRESHNESS,
              provenance: provenance('org-1'),
            },
          },
        };
      },
    },
  );

  assert.deepEqual(receivedArgs, {
    orgId: 'org-123',
    userId: 'user-123',
    app: DEFAULT_CHAT_COMPILED_MEMORY_SCOPE.app,
    screen: DEFAULT_CHAT_COMPILED_MEMORY_SCOPE.screen,
    asOf: undefined,
    question: 'How do we route enterprise deals?',
    questionEmbedding: [0.1, 0.2, 0.3],
    limit: 4,
  });
  assert.equal(result.sources[0]?.title, 'Enterprise routing');
  assert.match(result.context, /\[1\] Enterprise routing/);
  assert.equal(result.citations[0]?.citationNumber, 1);
});

test('resolveCompiledMemoryAnswerContext falls back to vendor-compatible resolution when embedding generation fails', async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const resolveCompiledMemory = async (args: any) => {
      assert.deepEqual(args.questionEmbedding, []);
      return {
        vendorKnowledge: { page: null, pages: [] },
        vendorTraining: { pages: [] },
        orgKnowledge: { pages: [], priorTopics: [] },
        citationsBySourceId: {},
      };
    };

    const result = await resolveCompiledMemoryAnswerContext(
      {
        orgId: 'org-123',
        userId: 'user-123',
        question: 'Where is the SOP?',
      },
      {
        generateEmbedding: async () => {
          throw new Error('embedding unavailable');
        },
        resolveCompiledMemory,
      },
    );

    assert.equal(result.context, '');
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.citationsBySourceId, {});
    assert.deepEqual(result.priorTopics, []);
  } finally {
    console.error = originalConsoleError;
  }
});

test('resolveScopedCompiledMemoryAnswerContext limits org knowledge to source-linked wiki pages', async () => {
  const sourceInCalls: Array<[string, unknown[]]> = [];
  const sourceQuery = {
    select() {
      return sourceQuery;
    },
    in(column: string, values: unknown[]) {
      sourceInCalls.push([column, values]);
      if (sourceInCalls.length === 1) {
        return sourceQuery;
      }
      return {
        data: [
          {
            page_id: 'page-1',
            source_id: 'recording-1',
            source_type: 'recording',
          },
        ],
        error: null,
      };
    },
  };
  const pageEqCalls: Array<[string, unknown]> = [];
  const pageQuery = {
    select() {
      return pageQuery;
    },
    eq(column: string, value: unknown) {
      pageEqCalls.push([column, value]);
      return pageQuery;
    },
    is() {
      return pageQuery;
    },
    in() {
      return {
      data: [
        {
          id: 'page-1',
          app: 'workspace',
          screen: 'content-detail',
          topic: 'Scoped customer knowledge',
          content: 'Only this selected recording should be available.',
          confidence: 0.87,
          updated_at: '2026-04-30T01:00:00.000Z',
        },
      ],
      error: null,
      };
    },
  };
  const createAdminClient = () => ({
    from(table: string) {
      if (table === 'wiki_page_sources') return sourceQuery;
      if (table === 'org_wiki_pages') return pageQuery;
      throw new Error(`Unexpected table: ${table}`);
    },
  });

  const result = await resolveScopedCompiledMemoryAnswerContext(
    {
      orgId: 'org-123',
      userId: 'user-123',
      question: 'What did this recording say?',
      sourceIds: ['recording-1'],
      limit: 5,
    },
    { createAdminClient: createAdminClient as any },
  );

  assert.deepEqual(
    result.sources.map((source) => source.sourceId),
    ['page-1'],
  );
  assert.equal(result.sources[0]?.url, '/dashboard/recordings/recording-1');
  assert.match(result.context, /Scoped customer knowledge/);
  assert.deepEqual(sourceInCalls[0], ['source_id', ['recording-1']]);
  assert.deepEqual(pageEqCalls[0], ['org_id', 'org-123']);
});

test('summarizeCompiledMemoryAnswerObservability captures shared vendor freshness and retrieval mode', () => {
  const compiledMemory: CompiledMemoryContext = {
    vendorKnowledge: {
      page: null,
      pages: [
        {
          id: 'vendor-exact',
          vendorPageId: 'vendor-page-exact',
          vendorSourceId: 'source-1',
          app: 'vercel',
          screen: 'projects',
          title: 'Project settings',
          content: 'Exact vendor guidance for project settings.',
          sourceUrl: 'https://vercel.com/docs/projects',
          updatedAt: '2026-04-19T12:00:00.000Z',
          confidence: 0.88,
          distance: 0.12,
          matchType: 'exact',
        },
        {
          id: 'vendor-semantic',
          vendorPageId: 'vendor-page-semantic',
          vendorSourceId: 'source-2',
          app: 'vercel',
          screen: 'domains',
          title: 'Domain routing',
          content: 'Broader vendor guidance for domain routing.',
          sourceUrl: 'https://vercel.com/docs/domains',
          updatedAt: '2026-04-10T12:00:00.000Z',
          confidence: 0.76,
          distance: 0.24,
          matchType: 'semantic',
        },
      ],
    },
    vendorTraining: {
      pages: [
        {
          id: 'training-1',
          app: 'vercel',
          screen: 'projects',
          topic: 'Internal vendor rollout',
          content: 'Start with the staging project before production.',
          confidence: 0.8,
          distance: 0.2,
        },
      ],
    },
    orgKnowledge: {
      pages: [
        {
          id: 'org-1',
          app: 'vercel',
          screen: 'projects',
          topic: 'Project ownership',
          content: 'Our team owns production project settings centrally.',
          confidence: 0.91,
          distance: 0.09,
        },
      ],
      priorTopics: [],
    },
    citationsBySourceId: {
      'org-1': {
        sourceId: 'org-1',
        title: 'Project ownership',
        layer: 'org',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('org-1'),
      },
      'training-1': {
        sourceId: 'training-1',
        title: 'Internal vendor rollout',
        layer: 'vendor_training',
        freshness: EMPTY_FRESHNESS,
        provenance: provenance('training-1'),
      },
      'vendor-exact': {
        sourceId: 'vendor-exact',
        title: 'Project settings',
        layer: 'vendor',
        linkUrl: 'https://vercel.com/docs/projects',
        freshness: {
          updatedAt: '2026-04-19T12:00:00.000Z',
          lastSuccessfulSyncAt: '2026-04-19T11:00:00.000Z',
          freshnessTarget: '7 days',
          isStale: false,
        },
        provenance: provenance('vendor-exact', {
          vendorPageId: 'vendor-page-exact',
          vendorSourceId: 'source-1',
          sourceKind: 'documentation',
          sourceUrl: 'https://vercel.com/docs/projects',
        }),
      },
      'vendor-semantic': {
        sourceId: 'vendor-semantic',
        title: 'Domain routing',
        layer: 'vendor',
        linkUrl: 'https://vercel.com/docs/domains',
        freshness: {
          updatedAt: '2026-04-10T12:00:00.000Z',
          lastSuccessfulSyncAt: '2026-04-10T11:00:00.000Z',
          freshnessTarget: '3 days',
          isStale: true,
        },
        provenance: provenance('vendor-semantic', {
          vendorPageId: 'vendor-page-semantic',
          vendorSourceId: 'source-2',
          sourceKind: 'documentation',
          sourceUrl: 'https://vercel.com/docs/domains',
        }),
      },
    },
  };

  const answerContext = buildCompiledMemoryAnswerContext(compiledMemory);
  const summary = summarizeCompiledMemoryAnswerObservability(answerContext);

  assert.deepEqual(summary.sourceLayers, ['org', 'vendor_training', 'vendor']);
  assert.equal(summary.orgSourcesCount, 1);
  assert.equal(summary.vendorTrainingSourcesCount, 1);
  assert.equal(summary.vendorSourcesCount, 2);
  assert.equal(summary.citationsCount, 4);
  assert.equal(summary.citationsWithFreshnessCount, 2);
  assert.equal(summary.staleCitationsCount, 1);
  assert.equal(summary.staleVendorCitationsCount, 1);
  assert.deepEqual(summary.vendorSourceIds, ['source-1', 'source-2']);
  assert.equal(summary.vendorRetrievalMode, 'hybrid');
  assert.equal(summary.hasStaleVendorContent, true);
});
