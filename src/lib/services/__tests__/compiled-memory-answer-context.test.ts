import assert from 'node:assert/strict';

import {
  buildCompiledMemoryAnswerContext,
  resolveCompiledMemoryAnswerContext,
  DEFAULT_CHAT_COMPILED_MEMORY_SCOPE,
} from '../compiled-memory-answer-context';
import type { CompiledMemoryContext } from '../compiled-memory-context';

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
      },
      'training-1': {
        sourceId: 'training-1',
        title: 'Vendor rollout playbook',
        layer: 'vendor_training',
      },
      'vendor-1': {
        sourceId: 'vendor-1',
        title: 'hubspot — deals',
        layer: 'vendor',
        linkUrl: 'https://docs.example.com/deals',
      },
    },
  };

  const result = buildCompiledMemoryAnswerContext(compiledMemory);

  assert.deepEqual(
    result.sources.map((source) => source.sourceId),
    ['org-1', 'training-1', 'vendor-1'],
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
  assert.match(result.context, /\[3\] hubspot — deals/);
  assert.equal(result.sources[0]?.url, '/dashboard/recordings/recording-1');
  assert.equal(result.sources[2]?.url, 'https://docs.example.com/deals');
  assert.deepEqual(result.priorTopics, ['Deal routing']);
});

test('resolveCompiledMemoryAnswerContext passes the default chat scope into the shared compiled-memory resolver', async () => {
  let receivedArgs:
    | {
        orgId: string;
        userId: string;
        app: string;
        screen: string;
        questionEmbedding: number[];
        limit?: number;
      }
    | undefined;

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
          vendorKnowledge: { page: null },
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
    questionEmbedding: [0.1, 0.2, 0.3],
    limit: 4,
  });
  assert.equal(result.sources[0]?.title, 'Enterprise routing');
  assert.match(result.context, /\[1\] Enterprise routing/);
});

test('resolveCompiledMemoryAnswerContext returns empty context when embedding generation fails', async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
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
        resolveCompiledMemory: async () => {
          throw new Error('should not be called');
        },
      },
    );

    assert.equal(result.context, '');
    assert.deepEqual(result.sources, []);
    assert.deepEqual(result.priorTopics, []);
  } finally {
    console.error = originalConsoleError;
  }
});
