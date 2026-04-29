import {
  resolveCompiledMemoryContext,
  type CompiledMemoryCitation,
  type CompiledMemoryCitationLayer,
  type CompiledMemoryContext,
} from '@/lib/services/compiled-memory-context';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import { formatVendorKnowledgeTitle } from '@/lib/services/vendor-doc-corpus';
import type { PageContext } from '@tribora/shared';

const ORG_SEPARATOR = '\n\n---\n\n';
const MAX_CONTENT_CHARS_PER_SOURCE = 1_200;
const MAX_EXCERPT_CHARS = 220;

export const DEFAULT_CHAT_COMPILED_MEMORY_SCOPE = {
  app: 'workspace',
  screen: 'knowledge-chat',
} as const;

export interface CompiledMemoryAnswerSource {
  citationNumber: number;
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  content: string;
  excerpt: string;
  confidence: number;
  url?: string;
  freshness: CompiledMemoryCitation['freshness'];
  provenance: CompiledMemoryCitation['provenance'];
  matchType?: 'exact' | 'semantic' | null;
}

export interface CompiledMemoryAnswerCitation {
  citationNumber: number;
  sourceId: string;
  title: string;
  layer: CompiledMemoryCitationLayer;
  excerpt: string;
  confidence: number;
  url?: string;
  freshness: CompiledMemoryCitation['freshness'];
  provenance: CompiledMemoryCitation['provenance'];
  matchType?: 'exact' | 'semantic' | null;
}

export interface CompiledMemoryAnswerContext {
  context: string;
  sources: CompiledMemoryAnswerSource[];
  citations: CompiledMemoryAnswerCitation[];
  citationsBySourceId: Record<string, CompiledMemoryAnswerCitation>;
  priorTopics: string[];
}

export type SharedVendorRetrievalMode =
  | 'none'
  | 'exact'
  | 'semantic'
  | 'hybrid';

export interface CompiledMemoryAnswerObservability {
  sourceLayers: CompiledMemoryCitationLayer[];
  orgSourcesCount: number;
  vendorTrainingSourcesCount: number;
  vendorSourcesCount: number;
  citationsCount: number;
  citationsWithFreshnessCount: number;
  staleCitationsCount: number;
  staleVendorCitationsCount: number;
  vendorSourceIds: string[];
  vendorRetrievalMode: SharedVendorRetrievalMode;
  hasStaleVendorContent: boolean;
}

interface ResolveCompiledMemoryAnswerContextArgs {
  orgId: string;
  userId?: string;
  question: string;
  app?: string;
  screen?: string;
  asOf?: string | null;
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
  freshness?: CompiledMemoryCitation['freshness'];
  provenance?: CompiledMemoryCitation['provenance'];
  matchType?: 'exact' | 'semantic' | null;
}): CompiledMemoryAnswerSource | null {
  const content = clampContent(args.content);
  if (!content) {
    return null;
  }

  return {
    citationNumber: 0,
    sourceId: args.sourceId,
    title: args.title,
    layer: args.layer,
    content,
    excerpt: buildExcerpt(content),
    confidence: args.confidence ?? 0.75,
    url: args.url,
    freshness: args.freshness ?? {
      updatedAt: null,
      lastSuccessfulSyncAt: null,
      freshnessTarget: null,
      isStale: null,
    },
    provenance: args.provenance ?? {
      pageId: args.sourceId,
      vendorPageId: null,
      vendorSourceId: null,
      sourceKind: null,
      sourceUrl: null,
    },
    matchType: args.matchType ?? null,
  };
}

function hasFreshnessMetadata(
  freshness: CompiledMemoryCitation['freshness'] | null | undefined,
): boolean {
  if (!freshness) {
    return false;
  }

  return (
    freshness.updatedAt != null ||
    freshness.lastSuccessfulSyncAt != null ||
    freshness.freshnessTarget != null ||
    freshness.isStale != null
  );
}

function resolveVendorRetrievalMode(
  sources: CompiledMemoryAnswerSource[],
): SharedVendorRetrievalMode {
  const vendorMatchTypes = new Set(
    sources
      .filter((source) => source.layer === 'vendor' && source.matchType)
      .map((source) => source.matchType),
  );

  if (vendorMatchTypes.size === 0) {
    return 'none';
  }

  if (vendorMatchTypes.has('exact') && vendorMatchTypes.has('semantic')) {
    return 'hybrid';
  }

  if (vendorMatchTypes.has('exact')) {
    return 'exact';
  }

  return 'semantic';
}

function renderSection(
  label: string,
  sources: CompiledMemoryAnswerSource[],
): string | null {
  if (sources.length === 0) {
    return null;
  }

  const body = sources
    .map(
      (source) =>
        `[${source.citationNumber}] ${source.title}\n${source.content}`,
    )
    .join('\n\n');

  return `${label}:\n${body}`;
}

function buildTaggedLayerSection(
  emptyLabel: string,
  sources: CompiledMemoryAnswerSource[],
): string {
  if (sources.length === 0) {
    return `(no ${emptyLabel} available)`;
  }

  return sources
    .map((source) => {
      const header = `### ${source.title} [SOURCE:${source.sourceId}:${source.title}]`;
      return `${header}\n${source.content}`;
    })
    .join(ORG_SEPARATOR);
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
        freshness: compiledMemory.citationsBySourceId[page.id]?.freshness,
        provenance: compiledMemory.citationsBySourceId[page.id]?.provenance,
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
        freshness: compiledMemory.citationsBySourceId[page.id]?.freshness,
        provenance: compiledMemory.citationsBySourceId[page.id]?.provenance,
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
              vendorSourceId:
                compiledMemory.vendorKnowledge.page.vendor_source_id,
              app: compiledMemory.vendorKnowledge.page.app,
              screen: compiledMemory.vendorKnowledge.page.screen,
              title: formatVendorKnowledgeTitle(
                compiledMemory.vendorKnowledge.page.app,
                compiledMemory.vendorKnowledge.page.screen,
              ),
              content: compiledMemory.vendorKnowledge.page.content,
              sourceUrl: compiledMemory.vendorKnowledge.page.source_url,
              updatedAt: null,
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
        freshness: compiledMemory.citationsBySourceId[page.id]?.freshness,
        provenance: compiledMemory.citationsBySourceId[page.id]?.provenance,
        matchType: page.matchType,
      }),
    )
    .filter((source): source is CompiledMemoryAnswerSource => source != null);

  const remainingBudget =
    citationLimit == null
      ? Number.POSITIVE_INFINITY
      : Math.max(citationLimit, 0);
  const limitedOrgSources = orgSources.slice(0, remainingBudget);
  const remainingAfterOrg = remainingBudget - limitedOrgSources.length;
  const limitedVendorTrainingSources = vendorTrainingSources.slice(
    0,
    Math.max(remainingAfterOrg, 0),
  );
  const remainingAfterTraining =
    remainingAfterOrg - limitedVendorTrainingSources.length;
  const limitedVendorSources = vendorSources.slice(
    0,
    Math.max(remainingAfterTraining, 0),
  );

  const sources = [
    ...limitedOrgSources,
    ...limitedVendorTrainingSources,
    ...limitedVendorSources,
  ].map((source, index) => ({
    ...source,
    citationNumber: index + 1,
  }));

  if (sources.length === 0) {
    return {
      context: '',
      sources: [],
      citations: [],
      citationsBySourceId: {},
      priorTopics: compiledMemory.orgKnowledge.priorTopics,
    };
  }

  const sections: string[] = [];

  sections.push(
    [
      'SOURCE PRECEDENCE:',
      "- If guidance conflicts, YOUR TEAM'S KNOWLEDGE overrides VENDOR TRAINING and VENDOR KNOWLEDGE.",
      '- VENDOR TRAINING overrides VENDOR KNOWLEDGE when those two conflict.',
      '- Prefer the highest-precedence source with explicit citations.',
    ].join('\n'),
  );

  const orgSection = renderSection(
    "YOUR TEAM'S KNOWLEDGE",
    sources.filter((source) => source.layer === 'org'),
  );
  if (orgSection) {
    sections.push(orgSection);
  }

  const vendorTrainingSection = renderSection(
    'VENDOR TRAINING',
    sources.filter((source) => source.layer === 'vendor_training'),
  );
  if (vendorTrainingSection) {
    sections.push(vendorTrainingSection);
  }

  const vendorSection = renderSection(
    'VENDOR KNOWLEDGE',
    sources.filter((source) => source.layer === 'vendor'),
  );
  if (vendorSection) {
    sections.push(vendorSection);
  }

  const citations = buildCompiledMemoryCitations(sources);
  const citationsBySourceId = Object.fromEntries(
    citations.map((citation) => [citation.sourceId, citation]),
  );

  return {
    context: sections.join('\n\n'),
    sources,
    citations,
    citationsBySourceId,
    priorTopics: compiledMemory.orgKnowledge.priorTopics,
  };
}

export function buildCompiledMemoryCitations(
  sources: CompiledMemoryAnswerSource[],
): CompiledMemoryAnswerCitation[] {
  return sources.map((source) => ({
    citationNumber: source.citationNumber,
    sourceId: source.sourceId,
    title: source.title,
    layer: source.layer,
    excerpt: source.excerpt,
    confidence: source.confidence,
    url: source.url,
    freshness: source.freshness,
    provenance: source.provenance,
    matchType: source.matchType ?? null,
  }));
}

export function summarizeCompiledMemoryAnswerObservability(
  answerContext:
    | Pick<CompiledMemoryAnswerContext, 'sources'>
    | null
    | undefined,
): CompiledMemoryAnswerObservability {
  const sources = answerContext?.sources ?? [];
  const orgSourcesCount = sources.filter(
    (source) => source.layer === 'org',
  ).length;
  const vendorTrainingSourcesCount = sources.filter(
    (source) => source.layer === 'vendor_training',
  ).length;
  const vendorSourcesCount = sources.filter(
    (source) => source.layer === 'vendor',
  ).length;
  const citationsWithFreshnessCount = sources.filter((source) =>
    hasFreshnessMetadata(source.freshness),
  ).length;
  const staleCitationsCount = sources.filter(
    (source) => source.freshness.isStale === true,
  ).length;
  const staleVendorCitationsCount = sources.filter(
    (source) => source.layer === 'vendor' && source.freshness.isStale === true,
  ).length;

  const vendorSourceIds = Array.from(
    new Set(
      sources
        .map((source) => source.provenance.vendorSourceId)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  return {
    sourceLayers: (['org', 'vendor_training', 'vendor'] as const).filter(
      (layer) => sources.some((source) => source.layer === layer),
    ),
    orgSourcesCount,
    vendorTrainingSourcesCount,
    vendorSourcesCount,
    citationsCount: sources.length,
    citationsWithFreshnessCount,
    staleCitationsCount,
    staleVendorCitationsCount,
    vendorSourceIds,
    vendorRetrievalMode: resolveVendorRetrievalMode(sources),
    hasStaleVendorContent: staleVendorCitationsCount > 0,
  };
}

export function buildExtensionCompiledMemoryPrompt(args: {
  app: string;
  screen: string;
  question: string;
  elements: Array<{ selector: string; label: string }>;
  answerContext: CompiledMemoryAnswerContext;
  pageContext?: PageContext;
}): string {
  const { app, screen, question, elements, answerContext, pageContext } = args;
  const vendorSources = answerContext.sources.filter(
    (source) => source.layer === 'vendor',
  );
  const vendorTrainingSources = answerContext.sources.filter(
    (source) => source.layer === 'vendor_training',
  );
  const orgSources = answerContext.sources.filter(
    (source) => source.layer === 'org',
  );

  const elementsSection =
    elements.length > 0
      ? elements.map((el) => `- ${el.label}: ${el.selector}`).join('\n')
      : '(no interactive elements provided)';

  const domSection = pageContext
    ? [
        pageContext.pageSummary
          ? `PAGE SUMMARY: ${pageContext.pageSummary}`
          : null,
        pageContext.viewport
          ? `VIEWPORT: ${pageContext.viewport.width}x${pageContext.viewport.height}, scroll ${pageContext.viewport.scrollX},${pageContext.viewport.scrollY}`
          : null,
        (pageContext.regions ?? []).length > 0
          ? `REGIONS:\n${(pageContext.regions ?? [])
              .slice(0, 10)
              .map(
                (region) =>
                  `- ${region.id} ${region.kind}${region.label ? ` "${region.label}"` : ''}: ${region.selector}`,
              )
              .join('\n')}`
          : null,
        (pageContext.snippets ?? []).length > 0
          ? `SAFE DOM SNIPPETS:\n${(pageContext.snippets ?? [])
              .slice(0, 12)
              .map(
                (snippet) =>
                  `- ${snippet.kind}${snippet.regionId ? ` in ${snippet.regionId}` : ''}: ${snippet.text}`,
              )
              .join('\n')}`
          : null,
        (pageContext.forms ?? []).length > 0
          ? `FORMS:\n${(pageContext.forms ?? [])
              .slice(0, 5)
              .map(
                (form) =>
                  `- ${form.label ?? form.selector ?? 'form'}: ${form.fields
                    .slice(0, 8)
                    .map((field) =>
                      [
                        field.label,
                        field.type,
                        field.required ? 'required' : null,
                        field.valuePresent ? 'value present' : null,
                      ]
                        .filter(Boolean)
                        .join(' '),
                    )
                    .join(', ')}`,
              )
              .join('\n')}`
          : null,
        (pageContext.tables ?? []).length > 0
          ? `TABLES:\n${(pageContext.tables ?? [])
              .slice(0, 5)
              .map(
                (table) =>
                  `- ${table.label ?? table.selector ?? 'table'}: ${table.rowCount} rows, columns ${table.columns.slice(0, 8).join(', ')}`,
              )
              .join('\n')}`
          : null,
        (pageContext.dialogs ?? []).length > 0
          ? `DIALOGS:\n${(pageContext.dialogs ?? [])
              .slice(0, 4)
              .map(
                (dialog) =>
                  `- ${dialog.title ?? dialog.selector}: actions ${dialog.actionLabels.slice(0, 6).join(', ')}`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    : '';

  const userContextSection =
    answerContext.priorTopics.length > 0
      ? `\nUSER CONTEXT:
The user has previously been shown information about: ${answerContext.priorTopics.join(', ')}. Skip basic explanations they've already seen and focus on their specific question. If they ask about a topic they've seen before, go deeper rather than repeating fundamentals.\n`
      : '';

  return `You are a context-aware assistant helping someone use ${app}'s ${screen} page.

VENDOR KNOWLEDGE (generic software documentation):
${buildTaggedLayerSection('vendor knowledge', vendorSources)}

VENDOR TRAINING (how the vendor recommends using it):
${buildTaggedLayerSection('vendor training knowledge', vendorTrainingSources)}

YOUR TEAM'S KNOWLEDGE (how your team specifically uses it):
${buildTaggedLayerSection('team knowledge', orgSources)}

INTERACTIVE ELEMENTS VISIBLE ON SCREEN:
${elementsSection}

DOM-FIRST PAGE UNDERSTANDING:
${domSection || '(no DOM context provided)'}
${userContextSection}
QUESTION: ${question}

Rules:
- YOUR TEAM'S KNOWLEDGE takes highest precedence, followed by VENDOR TRAINING, then VENDOR KNOWLEDGE. Explicitly mention when you're following the team's specific way versus vendor recommendations.
- When referring to a clickable element that exists in INTERACTIVE ELEMENTS, tag it like [ELEMENT:selector:label] so the extension can highlight/point at it. Use the selector exactly as provided above.
- When citing a source, tag it [SOURCE:id:title]. Use the normalized source id from the compiled-memory source itself. Team sources should come first in the citation list, followed by vendor training sources, then vendor knowledge.
- If vendor/team docs are absent but DOM-FIRST PAGE UNDERSTANDING has enough structure, answer from the visible page only and say what you can infer from the page. Do not invent product-specific workflows.
- Keep the answer concise and conversational. Prioritize actionable steps a user can follow right now.
- If you don't know the answer from any layer, say so clearly instead of guessing.`;
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
    asOf,
    limit,
  } = args;

  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return {
      context: '',
      sources: [],
      citations: [],
      citationsBySourceId: {},
      priorTopics: [],
    };
  }

  const generateEmbedding =
    deps.generateEmbedding ?? generateEmbeddingWithFallback;
  const resolveCompiledMemory =
    deps.resolveCompiledMemory ?? resolveCompiledMemoryContext;

  let questionEmbedding: number[] = [];
  try {
    const embeddingResult = await generateEmbedding(
      trimmedQuestion,
      'RETRIEVAL_QUERY',
    );
    questionEmbedding = embeddingResult.embedding;
  } catch (error) {
    console.error(
      '[compiled-memory-answer-context] embedding failed, continuing with vendor-compatible fallback:',
      error,
    );
  }

  try {
    const compiledMemory = await resolveCompiledMemory({
      orgId,
      userId,
      app,
      screen,
      asOf,
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
      citations: [],
      citationsBySourceId: {},
      priorTopics: [],
    };
  }
}
