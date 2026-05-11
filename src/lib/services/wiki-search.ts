import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import {
  resolveOrgWikiPagesByVector,
  type ResolvedOrgWikiPage,
} from '@/lib/services/org-wiki-embedding';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

import { filterQueryableVendorSourceRows } from './vendor-source-queryability';

type OrgWikiPageRow = Database['public']['Tables']['org_wiki_pages']['Row'];
type VendorWikiPageRow =
  Database['public']['Tables']['vendor_wiki_pages']['Row'];

const KEYWORD_FALLBACK_FETCH_LIMIT = 100;
const SNIPPET_LENGTH = 240;

export interface OrgWikiSearchResult {
  id: string;
  source: 'org_wiki';
  title: string;
  app: string | null;
  screen: string | null;
  snippet: string;
  content: string;
  confidence: number;
  similarity: number;
  updatedAt: string;
}

export interface VendorWikiSearchResult {
  id: string;
  source: 'vendor_wiki';
  title: string;
  app: string;
  screen: string;
  snippet: string;
  content: string;
  sourceUrl: string | null;
  similarity: number;
  updatedAt: string | null;
}

export interface WikiPageResult {
  id: string;
  source: 'org_wiki' | 'vendor_wiki';
  title: string;
  app: string | null;
  screen: string | null;
  content: string;
  confidence?: number;
  sourceUrl?: string | null;
  updatedAt: string | null;
}

function clampLimit(limit: number | undefined, max = 20): number {
  if (!Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(max, Math.floor(limit ?? 5)));
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function tokenize(value: string): string[] {
  return Array.from(
    new Set(
      normalize(value)
        .split(/[^a-z0-9]+/i)
        .filter((token) => token.length >= 2),
    ),
  );
}

function snippetFor(content: string, query: string): string {
  const normalizedContent = content.replace(/\s+/g, ' ').trim();
  if (normalizedContent.length <= SNIPPET_LENGTH) return normalizedContent;

  const firstToken = tokenize(query)[0];
  const matchIndex = firstToken
    ? normalizedContent.toLowerCase().indexOf(firstToken)
    : -1;
  const start = Math.max(0, matchIndex - 60);
  return normalizedContent.slice(start, start + SNIPPET_LENGTH).trim();
}

function lexicalScore(args: {
  query: string;
  title: string;
  content: string;
  app?: string | null;
  screen?: string | null;
  requestedApp?: string | null;
  requestedScreen?: string | null;
}): number {
  const queryTokens = tokenize(args.query);
  const haystack = normalize(
    [args.title, args.app, args.screen, args.content].filter(Boolean).join(' '),
  );

  let score = 0;
  for (const token of queryTokens) {
    if (containsText(haystack, token)) score += 0.12;
  }

  if (
    args.requestedApp &&
    normalize(args.app) === normalize(args.requestedApp)
  ) {
    score += 0.35;
  }
  if (
    args.requestedScreen &&
    normalize(args.screen) === normalize(args.requestedScreen)
  ) {
    score += 0.3;
  }
  if (normalize(args.title).includes(normalize(args.query))) score += 0.25;

  return Math.min(1, Math.max(0.05, score));
}

function containsText(text: string, searchText: string) {
  return text.includes(searchText);
}

function mapVectorOrgPage(
  page: ResolvedOrgWikiPage,
  query: string,
): OrgWikiSearchResult {
  return {
    id: page.id,
    source: 'org_wiki',
    title: page.topic,
    app: page.app,
    screen: page.screen,
    snippet: snippetFor(page.content, query),
    content: page.content,
    confidence: page.confidence,
    similarity: Math.max(0, Math.min(1, 1 - page.distance)),
    updatedAt: '',
  };
}

function mapOrgPage(
  page: Pick<
    OrgWikiPageRow,
    'id' | 'app' | 'screen' | 'topic' | 'content' | 'confidence' | 'updated_at'
  >,
  query: string,
): OrgWikiSearchResult {
  return {
    id: page.id,
    source: 'org_wiki',
    title: page.topic,
    app: page.app,
    screen: page.screen,
    snippet: snippetFor(page.content, query),
    content: page.content,
    confidence: page.confidence,
    similarity: lexicalScore({
      query,
      title: page.topic,
      content: page.content,
      app: page.app,
      screen: page.screen,
    }),
    updatedAt: page.updated_at,
  };
}

function mapVendorPage(
  page: Pick<
    VendorWikiPageRow,
    'id' | 'app' | 'screen' | 'content' | 'source_url' | 'updated_at'
  >,
  query: string,
  filters: { app?: string | null; screen?: string | null } = {},
): VendorWikiSearchResult {
  const title = `${page.app} / ${page.screen}`;
  return {
    id: page.id,
    source: 'vendor_wiki',
    title,
    app: page.app,
    screen: page.screen,
    snippet: snippetFor(page.content, query),
    content: page.content,
    sourceUrl: page.source_url,
    similarity: lexicalScore({
      query,
      title,
      content: page.content,
      app: page.app,
      screen: page.screen,
      requestedApp: filters.app,
      requestedScreen: filters.screen,
    }),
    updatedAt: page.updated_at,
  };
}

export async function searchCompiledOrgWikiPages(args: {
  orgId: string;
  query: string;
  limit?: number;
}): Promise<OrgWikiSearchResult[]> {
  const limit = clampLimit(args.limit);

  try {
    const { embedding } = await generateEmbeddingWithFallback(
      args.query,
      'RETRIEVAL_QUERY',
    );
    const pages = await resolveOrgWikiPagesByVector({
      orgId: args.orgId,
      questionEmbedding: embedding,
      limit,
    });

    if (pages.length > 0) {
      return pages.map((page) => mapVectorOrgPage(page, args.query));
    }
  } catch (error) {
    console.warn(
      '[wiki-search] vector org wiki search failed; using keyword fallback',
      {
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    );
  }

  const firstQueryToken = tokenize(args.query)[0];
  let query = supabaseAdmin
    .from('org_wiki_pages')
    .select('id, app, screen, topic, content, confidence, updated_at')
    .eq('org_id', args.orgId)
    .is('valid_until', null)
    .order('updated_at', { ascending: false });

  if (firstQueryToken) {
    query = query.or(
      `topic.ilike.%${firstQueryToken}%,content.ilike.%${firstQueryToken}%,app.ilike.%${firstQueryToken}%,screen.ilike.%${firstQueryToken}%`,
    );
  }

  const { data, error } = await query.limit(KEYWORD_FALLBACK_FETCH_LIMIT);

  if (error) {
    throw new Error(`Failed to search org wiki pages: ${error.message}`);
  }

  return ((data ?? []) as OrgWikiPageRow[])
    .flatMap((__item, __index, __array) => {
      const __mapped = mapOrgPage(__item, args.query);
      return __mapped.similarity > 0.05 ? [__mapped] : [];
    })
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
}

export async function searchVendorWikiPages(args: {
  query: string;
  limit?: number;
  app?: string | null;
  screen?: string | null;
}): Promise<VendorWikiSearchResult[]> {
  const limit = clampLimit(args.limit);
  let query = supabaseAdmin
    .from('vendor_wiki_pages')
    .select(
      'id, app, screen, content, source_url, updated_at, vendor_source_id',
    )
    .is('retired_at', null);

  if (args.app) {
    query = query.eq('app', normalize(args.app));
  }
  if (args.screen) {
    query = query.eq('screen', normalize(args.screen));
  }
  const firstQueryToken = tokenize(args.query)[0];
  if (firstQueryToken) {
    query = query.or(
      `app.ilike.%${firstQueryToken}%,screen.ilike.%${firstQueryToken}%,content.ilike.%${firstQueryToken}%`,
    );
  }

  const { data, error } = await query.limit(KEYWORD_FALLBACK_FETCH_LIMIT);

  if (error) {
    throw new Error(`Failed to search vendor wiki pages: ${error.message}`);
  }

  const queryableRows = await filterQueryableVendorSourceRows(
    (data ?? []) as VendorWikiPageRow[],
  );

  return queryableRows
    .flatMap((__item, __index, __array) => {
      const __mapped = mapVendorPage(__item, args.query, {
        app: args.app,
        screen: args.screen,
      });
      return __mapped.similarity > 0.05 ? [__mapped] : [];
    })
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, limit);
}

export async function getOrgWikiPage(args: {
  orgId: string;
  pageId: string;
}): Promise<WikiPageResult | null> {
  const { data, error } = await supabaseAdmin
    .from('org_wiki_pages')
    .select('id, app, screen, topic, content, confidence, updated_at')
    .eq('id', args.pageId)
    .eq('org_id', args.orgId)
    .is('valid_until', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch org wiki page: ${error.message}`);
  }

  const page = data as OrgWikiPageRow | null;
  if (!page) return null;

  return {
    id: page.id,
    source: 'org_wiki',
    title: page.topic,
    app: page.app,
    screen: page.screen,
    content: page.content,
    confidence: page.confidence,
    updatedAt: page.updated_at,
  };
}

export async function getVendorWikiPage(args: {
  pageId: string;
}): Promise<WikiPageResult | null> {
  const { data, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select(
      'id, app, screen, content, source_url, updated_at, vendor_source_id',
    )
    .eq('id', args.pageId)
    .is('retired_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch vendor wiki page: ${error.message}`);
  }

  if (!data) return null;

  const [page] = await filterQueryableVendorSourceRows([
    data,
  ] as VendorWikiPageRow[]);
  return page
    ? {
        id: page.id,
        source: 'vendor_wiki',
        title: `${page.app} / ${page.screen}`,
        app: page.app,
        screen: page.screen,
        content: page.content,
        sourceUrl: page.source_url,
        updatedAt: page.updated_at,
      }
    : null;
}
