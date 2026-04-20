import {
  resolveCompiledMemoryContext,
  type CompiledMemoryCitationLayer,
  type CompiledMemoryContext,
} from '@/lib/services/compiled-memory-context';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import { formatVendorKnowledgeTitle } from '@/lib/services/vendor-doc-corpus';

const MAX_CONTENT_CHARS_PER_SOURCE = 1_200;
const MAX_EXCERPT_CHARS = 220;

export const DEFAULT_CHAT_COMPILED_MEMORY_SCOPE = {
  app: 'workspace',
  screen: 'knowledge-chat',
} as const;

export interface CompiledMemoryAnswerSource {
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  content: string;
  excerpt: string;
  confidence: number;
  url?: string;
}

export interface CompiledMemoryAnswerCitation {
  citationNumber: number;
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  excerpt: string;
  confidence: number;
  url?: string;
}

export interface CompiledMemoryAnswerContext {
  context: string;
  sources: CompiledMemoryAnswerSource[];
  priorTopics: string[];
}

interface ResolveCompiledMemoryAnswerContextArgs {
  orgId: string;
  userId?: string;
  question: string;
  app?: string;
  screen?: string;
  limit?: number;
}

interface ResolveCompiledMemoryAnswerContextDeps {
  generateEmbedding?: typeof generateEmbeddingWithFallback;
  resolveCompiledMemory?: typeof resolveCompiledMemoryContext;
}

function clampContent(value: string | null | undefined): string {
  return (value ?? '').trim().slice(0, MAX_CONTENT_CHARS_PER_SOURCE);
}

function buildExcerpt(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, MAX_EXCERPT_CHARS);
}

function toSource(args: {
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  content: string | null | undefined;
  confidence?: number | null;
  url?: string;
}): CompiledMemoryAnswerSource | null {
  const content = clampContent(args.content);
  if (!content) {
    return null;
  }

  return {
    sourceId: args.sourceId,
    title: args.title,
    layer: args.layer,
    content,
    excerpt: buildExcerpt(content),
    confidence: args.confidence ?? 0.75,
    url: args.url,
  };
}

function renderSection(
  label: string,
  sources: CompiledMemoryAnswerSource[],
  startIndex: number,
): string | null {
  if (sources.length === 0) {
    return null;
  }

  const body = sources
    .map((source, index) => `[${startIndex + index}] ${source.title}\n${source.content}`)
    .join('\n\n');

  return `${label}:\n${body}`;
}

export function buildCompiledMemoryAnswerContext(
  compiledMemory: CompiledMemoryContext,
  citationLimit?: number,
): CompiledMemoryAnswerContext {
  const orgSources = compiledMemory.orgKnowledge.pages
    .map((page) =>
      toSource({
        sourceId: page.id,
        title: compiledMemory.citationsBySourceId[page.id]?.title ?? page.topic,
        layer: 'org',
        content: page.content,
        confidence: page.confidence,
        url: compiledMemory.citationsBySourceId[page.id]?.linkUrl,
      }),
    )
    .filter((source): source is CompiledMemoryAnswerSource => source != null);

  const vendorTrainingSources = compiledMemory.vendorTraining.pages
    .map((page) =>
      toSource({
        sourceId: page.id,
        title: compiledMemory.citationsBySourceId[page.id]?.title ?? page.topic,
        layer: 'vendor_training',
        content: page.content,
        confidence: page.confidence,
        url: compiledMemory.citationsBySourceId[page.id]?.linkUrl,
      }),
    )
    .filter((source): source is CompiledMemoryAnswerSource => source != null);

  const vendorKnowledgePages =
    compiledMemory.vendorKnowledge.pages.length > 0
      ? compiledMemory.vendorKnowledge.pages
      : compiledMemory.vendorKnowledge.page
        ? [
            {
              id: compiledMemory.vendorKnowledge.page.id,
              vendorPageId: compiledMemory.vendorKnowledge.page.id,
              vendorSourceId: compiledMemory.vendorKnowledge.page.vendor_source_id,
              app: compiledMemory.vendorKnowledge.page.app,
              screen: compiledMemory.vendorKnowledge.page.screen,
              title: formatVendorKnowledgeTitle(
                compiledMemory.vendorKnowledge.page.app,
                compiledMemory.vendorKnowledge.page.screen,
              ),
              content: compiledMemory.vendorKnowledge.page.content,
              sourceUrl: compiledMemory.vendorKnowledge.page.source_url,
              confidence: 0.6,
              distance: 0.4,
              matchType: 'exact' as const,
            },
          ]
        : [];

  const vendorSources = vendorKnowledgePages
    .map((page) =>
      toSource({
        sourceId: page.id,
        title: compiledMemory.citationsBySourceId[page.id]?.title ?? page.title,
        layer: 'vendor',
        content: page.content,
        confidence: page.confidence,
        url:
          compiledMemory.citationsBySourceId[page.id]?.linkUrl ??
          page.sourceUrl ??
          undefined,
      }),
    )
    .filter((source): source is CompiledMemoryAnswerSource => source != null);

  const remainingBudget =
    citationLimit == null ? Number.POSITIVE_INFINITY : Math.max(citationLimit, 0);
  const limitedOrgSources = orgSources.slice(0, remainingBudget);
  const remainingAfterOrg = remainingBudget - limitedOrgSources.length;
  const limitedVendorTrainingSources = vendorTrainingSources.slice(
    0,
    Math.max(remainingAfterOrg, 0),
  );
  const remainingAfterTraining =
    remainingAfterOrg - limitedVendorTrainingSources.length;
  const limitedVendorSources = vendorSources.slice(0, Math.max(remainingAfterTraining, 0));

  const sources = [
    ...limitedOrgSources,
    ...limitedVendorTrainingSources,
    ...limitedVendorSources,
  ];

  const sections: string[] = [];
  let nextIndex = 1;

  sections.push(
    [
      'SOURCE PRECEDENCE:',
      '- If guidance conflicts, YOUR TEAM\'S KNOWLEDGE overrides VENDOR TRAINING and VENDOR KNOWLEDGE.',
      '- VENDOR TRAINING overrides VENDOR KNOWLEDGE when those two conflict.',
      '- Prefer the highest-precedence source with explicit citations.',
    ].join('\n'),
  );

  const orgSection = renderSection(
    "YOUR TEAM'S KNOWLEDGE",
    limitedOrgSources,
    nextIndex,
  );
  if (orgSection) {
    sections.push(orgSection);
    nextIndex += limitedOrgSources.length;
  }

  const vendorTrainingSection = renderSection(
    'VENDOR TRAINING',
    limitedVendorTrainingSources,
    nextIndex,
  );
  if (vendorTrainingSection) {
    sections.push(vendorTrainingSection);
    nextIndex += limitedVendorTrainingSources.length;
  }

  const vendorSection = renderSection(
    'VENDOR KNOWLEDGE',
    limitedVendorSources,
    nextIndex,
  );
  if (vendorSection) {
    sections.push(vendorSection);
  }

  return {
    context: sections.join('\n\n'),
    sources,
    priorTopics: compiledMemory.orgKnowledge.priorTopics,
  };
}

export function buildCompiledMemoryCitations(
  sources: CompiledMemoryAnswerSource[],
): CompiledMemoryAnswerCitation[] {
  return sources.map((source, index) => ({
    citationNumber: index + 1,
    sourceId: source.sourceId,
    title: source.title,
    layer: source.layer,
    excerpt: source.excerpt,
    confidence: source.confidence,
    url: source.url,
  }));
}

export async function resolveCompiledMemoryAnswerContext(
  args: ResolveCompiledMemoryAnswerContextArgs,
  deps: ResolveCompiledMemoryAnswerContextDeps = {},
): Promise<CompiledMemoryAnswerContext> {
  const {
    orgId,
    userId,
    question,
    app = DEFAULT_CHAT_COMPILED_MEMORY_SCOPE.app,
    screen = DEFAULT_CHAT_COMPILED_MEMORY_SCOPE.screen,
    limit,
  } = args;

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return {
      context: '',
      sources: [],
      priorTopics: [],
    };
  }

  const generateEmbedding = deps.generateEmbedding ?? generateEmbeddingWithFallback;
  const resolveCompiledMemory = deps.resolveCompiledMemory ?? resolveCompiledMemoryContext;

  let questionEmbedding: number[] = [];
  try {
    const embeddingResult = await generateEmbedding(trimmedQuestion, 'RETRIEVAL_QUERY');
    questionEmbedding = embeddingResult.embedding;
  } catch (error) {
    console.error(
      '[compiled-memory-answer-context] embedding failed, returning empty context:',
      error,
    );
    return {
      context: '',
      sources: [],
      priorTopics: [],
    };
  }

  if (questionEmbedding.length === 0) {
    return {
      context: '',
      sources: [],
      priorTopics: [],
    };
  }

  try {
    const compiledMemory = await resolveCompiledMemory({
      orgId,
      userId,
      app,
      screen,
      question: trimmedQuestion,
      questionEmbedding,
      limit,
    });

    return buildCompiledMemoryAnswerContext(compiledMemory, limit);
  } catch (error) {
    console.error(
      '[compiled-memory-answer-context] compiled memory resolution failed:',
      error,
    );
    return {
      context: '',
      sources: [],
      priorTopics: [],
    };
  }
}
