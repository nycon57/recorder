import { createHash } from 'crypto';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

import { filterQueryableVendorSourceRows } from './vendor-source-queryability';

const logger = createLogger({ service: 'vendor-doc-corpus' });

const DEFAULT_MATCH_LIMIT = 3;
const CONTENT_EXCERPT_MAX_CHARS = 1_400;
const EMBEDDING_INPUT_MAX_CHARS = 2_400;
const MIN_SEMANTIC_SIMILARITY = 0.45;
const MIN_KEYWORD_SCORE = 0.2;
const SCREEN_MATCH_BOOST = 0.15;
const VENDOR_LABELS: Record<string, string> = {
  hubspot: 'HubSpot',
  salesforce: 'Salesforce',
  vercel: 'Vercel',
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'we',
  'what',
  'with',
]);

type VendorWikiPage = Database['public']['Tables']['vendor_wiki_pages']['Row'];
interface VendorCorpusPageRow {
  id: string;
  app: string;
  screen: string | null;
  title: string;
  normalized_content: string;
  content_excerpt: string;
  source_url: string | null;
  vendor_page_id: string | null;
  vendor_source_id: string | null;
  content_hash: string;
  embedding: number[] | null;
  created_at: string;
  updated_at: string;
}

interface VendorDocCorpusDeps {
  supabase?: Pick<typeof supabaseAdmin, 'from'>;
  generateEmbedding?: typeof generateEmbeddingWithFallback;
}

export interface VendorCorpusPageMatch {
  id: string;
  vendorPageId: string | null;
  vendorSourceId: string | null;
  app: string;
  screen: string | null;
  title: string;
  content: string;
  sourceUrl: string | null;
  updatedAt: string | null;
  confidence: number;
  distance: number;
  matchType: 'semantic' | 'exact';
}

export function formatVendorKnowledgeTitle(app: string, screen: string | null): string {
  const appLabel = VENDOR_LABELS[app.toLowerCase()] ?? humanizeSlug(app);
  const screenLabel = humanizeSlug(screen || 'overview');
  return `${appLabel} ${screenLabel}`.trim();
}

function normalizeApp(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeScreen(value: string | null | undefined): string | null {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function humanizeSlug(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeVendorContent(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildVendorContentExcerpt(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, CONTENT_EXCERPT_MAX_CHARS);
}

function extractMarkdownHeading(content: string): string | null {
  const match = content.match(/^\s*#{1,2}\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function deriveVendorCorpusTitle(page: VendorWikiPage, normalizedContent: string): string {
  return (
    extractMarkdownHeading(normalizedContent) ??
    humanizeSlug(page.screen || 'overview')
  );
}

function buildVendorEmbeddingInput(args: {
  app: string;
  screen: string | null;
  title: string;
  excerpt: string;
}): string {
  return [
    args.title,
    `Application: ${args.app}`,
    `Screen: ${args.screen ?? 'general'}`,
    args.excerpt,
  ]
    .join('\n\n')
    .slice(0, EMBEDDING_INPUT_MAX_CHARS);
}

function ensureVendorContentHash(page: VendorWikiPage, normalizedContent: string): string {
  if (page.content_hash) {
    return page.content_hash;
  }

  return createHash('sha256').update(normalizedContent).digest('hex');
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z0-9]{3,}/g)
        ?.filter((token) => !STOP_WORDS.has(token)) ?? [],
    ),
  );
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index]! * right[index]!;
    leftMagnitude += left[index]! * left[index]!;
    rightMagnitude += right[index]! * right[index]!;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function computeKeywordScore(tokens: string[], searchableText: string): number {
  if (tokens.length === 0) {
    return 0;
  }

  const normalizedText = searchableText.toLowerCase();
  let matchedTokens = 0;

  for (const token of tokens) {
    if (normalizedText.includes(token)) {
      matchedTokens += 1;
    }
  }

  return matchedTokens / Math.min(tokens.length, 6);
}

export async function syncVendorCorpusFromLegacyPages(args: {
  app: string;
}, deps: VendorDocCorpusDeps = {}): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
}> {
  const app = normalizeApp(args.app);
  const supabase = deps.supabase ?? supabaseAdmin;
  const generateEmbedding = deps.generateEmbedding ?? generateEmbeddingWithFallback;

  const { data: legacyData, error: legacyError } = await supabase
    .from('vendor_wiki_pages')
    .select(
      'id, app, screen, content, source_url, content_hash, vendor_source_id, created_at, updated_at',
    )
    .eq('app', app)
    .is('retired_at', null);

  if (legacyError) {
    throw new Error(`Failed to load legacy vendor pages for ${app}: ${legacyError.message}`);
  }

  const legacyPages = await filterQueryableVendorSourceRows(
    (legacyData as VendorWikiPage[] | null) ?? [],
    supabase,
  );

  const { data: existingData, error: existingError } = await supabase
    .from('vendor_corpus_pages')
    .select('id, vendor_page_id, content_hash, embedding')
    .eq('app', app);

  if (existingError) {
    throw new Error(
      `Failed to load existing vendor corpus pages for ${app}: ${existingError.message}`,
    );
  }

  const existingRows =
    (existingData as
      | Array<Pick<VendorCorpusPageRow, 'id' | 'vendor_page_id' | 'content_hash' | 'embedding'>>
      | null) ?? [];

  const existingByVendorPageId = new Map(
    existingRows
      .filter((row) => row.vendor_page_id != null)
      .map((row) => [row.vendor_page_id as string, row]),
  );
  const activeVendorPageIds = new Set(legacyPages.map((page) => page.id));
  const staleCorpusIds = existingRows
    .filter(
      (row) =>
        row.vendor_page_id != null && !activeVendorPageIds.has(row.vendor_page_id),
    )
    .map((row) => row.id);

  if (staleCorpusIds.length > 0) {
    const { error: deleteError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('vendor_corpus_pages') as any)
      .delete()
      .in('id', staleCorpusIds);

    if (deleteError) {
      throw new Error(
        `Failed to delete retired vendor corpus pages for ${app}: ${deleteError.message}`,
      );
    }
  }

  if (legacyPages.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
  }

  const rowsToUpsert: Array<Record<string, unknown>> = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const page of legacyPages) {
    const normalizedContent = normalizeVendorContent(page.content ?? '');
    if (!normalizedContent) {
      skipped += 1;
      continue;
    }

    const contentHash = ensureVendorContentHash(page, normalizedContent);
    const existingRow = existingByVendorPageId.get(page.id);

    if (
      existingRow &&
      existingRow.content_hash === contentHash &&
      Array.isArray(existingRow.embedding) &&
      existingRow.embedding.length > 0
    ) {
      skipped += 1;
      continue;
    }

    const title = deriveVendorCorpusTitle(page, normalizedContent);
    const excerpt = buildVendorContentExcerpt(normalizedContent);
    const embeddingInput = buildVendorEmbeddingInput({
      app,
      screen: normalizeScreen(page.screen),
      title,
      excerpt,
    });

    const { embedding } = await generateEmbedding(
      embeddingInput,
      'RETRIEVAL_DOCUMENT',
    );

    rowsToUpsert.push({
      app,
      screen: normalizeScreen(page.screen),
      title,
      normalized_content: normalizedContent,
      content_excerpt: excerpt,
      source_url: page.source_url,
      vendor_page_id: page.id,
      vendor_source_id: page.vendor_source_id,
      content_hash: contentHash,
      embedding: JSON.stringify(embedding),
      updated_at: new Date().toISOString(),
    });

    if (existingRow) {
      updated += 1;
    } else {
      inserted += 1;
    }
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await (supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('vendor_corpus_pages') as any)
      .upsert(rowsToUpsert, {
        onConflict: 'vendor_page_id',
      });

    if (upsertError) {
      throw new Error(`Failed to upsert vendor corpus pages for ${app}: ${upsertError.message}`);
    }
  }

  logger.info('Vendor corpus sync complete', {
    context: {
      app,
      inserted,
      updated,
      skipped,
    },
  });

  return {
    inserted,
    updated,
    skipped,
  };
}

export async function resolveVendorCorpusPages(args: {
  app: string;
  screen?: string;
  question: string;
  questionEmbedding: number[];
  limit?: number;
}, deps: VendorDocCorpusDeps = {}): Promise<VendorCorpusPageMatch[]> {
  const app = normalizeApp(args.app);
  const screen = normalizeScreen(args.screen);
  const questionTokens = tokenize(args.question);
  const supabase = deps.supabase ?? supabaseAdmin;

  try {
    await syncVendorCorpusFromLegacyPages({ app }, deps);
  } catch (error) {
    logger.warn('Vendor corpus sync failed during retrieval; continuing with existing corpus', {
      context: { app, screen },
      error: error as Error,
    });
  }

  const { data, error } = await supabase
    .from('vendor_corpus_pages')
    .select(
      'id, app, screen, title, normalized_content, content_excerpt, source_url, vendor_page_id, vendor_source_id, content_hash, embedding, created_at, updated_at',
    )
    .eq('app', app);

  if (error) {
    throw new Error(`Failed to load vendor corpus pages for ${app}: ${error.message}`);
  }

  const rows = await filterQueryableVendorSourceRows(
    (data as VendorCorpusPageRow[] | null) ?? [],
    supabase,
  );
  if (rows.length === 0) {
    return [];
  }

  const rankedResults = rows
    .map((row) => {
      const semanticSimilarity = cosineSimilarity(
        args.questionEmbedding,
        row.embedding ?? [],
      );
      const exactScreenMatch = screen != null && normalizeScreen(row.screen) === screen;
      const keywordScore = computeKeywordScore(
        questionTokens,
        `${row.title} ${row.screen ?? ''} ${row.content_excerpt} ${row.normalized_content}`,
      );
      const combinedScore = Math.min(
        0.99,
        semanticSimilarity * 0.72 +
          keywordScore * 0.18 +
          (exactScreenMatch ? SCREEN_MATCH_BOOST : 0),
      );

      return {
        row,
        semanticSimilarity,
        keywordScore,
        exactScreenMatch,
        combinedScore,
      };
    })
    .filter(
      (result) =>
        result.exactScreenMatch ||
        result.semanticSimilarity >= MIN_SEMANTIC_SIMILARITY ||
        result.keywordScore >= MIN_KEYWORD_SCORE,
    )
    .sort((left, right) => {
      if (left.exactScreenMatch !== right.exactScreenMatch) {
        return left.exactScreenMatch ? -1 : 1;
      }

      if (right.combinedScore !== left.combinedScore) {
        return right.combinedScore - left.combinedScore;
      }

      return right.row.updated_at.localeCompare(left.row.updated_at);
    })
    .slice(0, args.limit ?? DEFAULT_MATCH_LIMIT);

  return rankedResults.map((result) => ({
    id: result.row.id,
    vendorPageId: result.row.vendor_page_id,
    vendorSourceId: result.row.vendor_source_id,
    app: result.row.app,
    screen: result.row.screen,
    title: result.row.title,
    content: result.row.normalized_content,
    sourceUrl: result.row.source_url,
    updatedAt: result.row.updated_at,
    confidence: Number(result.combinedScore.toFixed(4)),
    distance: Number(Math.max(0, 1 - result.semanticSimilarity).toFixed(4)),
    matchType: 'semantic',
  }));
}
