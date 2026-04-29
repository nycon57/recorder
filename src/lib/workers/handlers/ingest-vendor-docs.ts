/**
 * Ingest Vendor Docs Job Handler (TRIB-45)
 *
 * Crawls vendor documentation sites and transforms them into structured
 * `vendor_wiki_pages` rows. Uses breadth-first crawling with robots.txt
 * respect, cheerio for HTML parsing, and SHA256 content hashing for
 * deduplication on re-crawl.
 *
 * Job payload: { sourceId: string, url: string, app: string, maxPages?: number }
 *
 * Pipeline:
 *   1. Parse seed URL, fetch and parse robots.txt for the domain
 *   2. BFS crawl same-domain pages up to maxPages (default 50)
 *   3. For each page: extract title, main content, convert to Markdown
 *   4. Derive `screen` from URL path structure
 *   5. Best-effort extraction of interactive element CSS selectors
 *   6. SHA256 hash content for deduplication
 *   7. Upsert into vendor_wiki_pages (skip unchanged, update changed)
 */

import { createHash } from 'crypto';

import * as cheerio from 'cheerio';
import type { AnyNode, Element as DomElement, Text as DomText } from 'domhandler';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { withAgentLogging } from '@/lib/services/agent-logger';
import {
  createVendorSourceRegistryService,
  hashVendorSourcePages,
  type VendorFetchStrategy,
  type VendorSourceRow,
} from '@/lib/services/vendor-source-registry';
import { syncVendorCorpusFromLegacyPages } from '@/lib/services/vendor-doc-corpus';
import { createLogger } from '@/lib/utils/logger';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

import { shouldSkipVendorWikiPageUpdate } from './ingest-vendor-docs-skip';

type Job = Database['public']['Tables']['jobs']['Row'];

const logger = createLogger({ service: 'ingest-vendor-docs' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngestVendorDocsPayload {
  url?: string;
  app?: string;
  maxPages?: number;
  sourceId?: string;
  syncType?: 'scheduled' | 'manual';
  /** Optional audit field — system-admin user who triggered this job (TRIB-146). */
  triggered_by_user_id?: string | null;
}

interface CrawledPage {
  url: string;
  title: string;
  screen: string;
  markdownContent: string;
  elementSelectors: string[];
  contentHash: string;
}

interface RobotsRules {
  disallowedPaths: string[];
  crawlDelay: number;
}

interface CrawlScope {
  allowedHost: string;
  exactPath: string;
  pathPrefix: string;
}

interface SourceAcquisitionPlan {
  app: string;
  seedUrl: string;
  maxPages: number;
  strategy: VendorFetchStrategy;
  scope: CrawlScope;
}

interface PageWriteOutcome {
  sourceUrl: string;
  screen: string;
  contentHash: string;
  status: 'inserted' | 'updated' | 'unchanged' | 'failed';
  pageId: string | null;
  error?: string;
}

interface PageWriteManifest {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  outcomes: PageWriteOutcome[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 15_000;
const CRAWL_DELAY_MS = 500; // Polite default between requests

// Selectors that typically wrap main documentation content
const MAIN_CONTENT_SELECTORS = [
  'article',
  'main',
  '[role="main"]',
  '.markdown-body',
  '.docs-content',
  '.documentation',
  '.content',
  '.post-content',
  '.article-content',
  '#content',
  '#main-content',
  '.prose',
];

// Elements to strip from content before extraction
const NOISE_SELECTORS = [
  'nav',
  'header',
  'footer',
  'aside',
  '.sidebar',
  '.navigation',
  '.nav',
  '.toc',
  '.table-of-contents',
  '.breadcrumb',
  '.breadcrumbs',
  'script',
  'style',
  'noscript',
  '.cookie-banner',
  '.cookie-consent',
  '.announcement-bar',
  '.banner',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="complementary"]',
];

// ---------------------------------------------------------------------------
// Robots.txt parsing
// ---------------------------------------------------------------------------

async function fetchRobotsTxt(baseUrl: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallowedPaths: [], crawlDelay: 0 };

  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Tribora-DocCrawler/1.0' },
    });

    if (response.status === 404) return rules;
    if (!response.ok) {
      throw new Error(`robots.txt returned HTTP ${response.status}`);
    }

    const text = await response.text();
    let inWildcardBlock = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim().toLowerCase();

      if (trimmed.startsWith('user-agent:')) {
        const agent = trimmed.slice('user-agent:'.length).trim();
        inWildcardBlock = agent === '*';
      } else if (inWildcardBlock && trimmed.startsWith('disallow:')) {
        const path = trimmed.slice('disallow:'.length).trim();
        if (path) rules.disallowedPaths.push(path);
      } else if (inWildcardBlock && trimmed.startsWith('crawl-delay:')) {
        const delay = parseInt(trimmed.slice('crawl-delay:'.length).trim(), 10);
        if (!isNaN(delay) && delay > 0) rules.crawlDelay = delay * 1000;
      }
    }
  } catch (error) {
    logger.warn('Failed to fetch robots.txt', {
      context: { baseUrl },
      error: error as Error,
    });
    throw new Error(
      `Unable to evaluate robots.txt for governed vendor source ${baseUrl}`,
    );
  }

  return rules;
}

function isAllowedByRobots(pathname: string, rules: RobotsRules): boolean {
  return !rules.disallowedPaths.some((disallowed) =>
    pathname.startsWith(disallowed)
  );
}

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

function isSameDomain(url: string, baseOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === baseOrigin;
  } catch {
    return false;
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function isWithinCrawlScope(url: string, scope: CrawlScope): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname || '/';
    return (
      normalizeHost(parsed.hostname) === scope.allowedHost &&
      (pathname === scope.exactPath || pathname.startsWith(scope.pathPrefix))
    );
  } catch {
    return false;
  }
}

function buildPathPrefix(sourceUrl: string): string {
  const parsed = new URL(sourceUrl);
  if (parsed.pathname === '/' || parsed.pathname === '') return '/';
  if (parsed.pathname.endsWith('/')) return parsed.pathname;
  return `${parsed.pathname}/`;
}

function buildSourceAcquisitionPlan(
  source: VendorSourceRow,
  payload: IngestVendorDocsPayload,
): SourceAcquisitionPlan {
  if (source.terms_review_status !== 'approved') {
    throw new Error(
      `Vendor source ${source.id} is not approved for ingestion (${source.terms_review_status})`,
    );
  }

  if (!source.official_source) {
    throw new Error(`Vendor source ${source.id} is not marked as official`);
  }

  const seed = new URL(source.source_url);
  const seedHost = normalizeHost(seed.hostname);
  const publisherHost = normalizeHost(source.publisher_hostname);
  if (seedHost !== publisherHost && !seedHost.endsWith(`.${publisherHost}`)) {
    throw new Error(
      `Vendor source ${source.id} URL is outside publisher host ${source.publisher_hostname}`,
    );
  }

  if (!['sanctioned_crawl', 'static_site'].includes(source.fetch_strategy)) {
    throw new Error(
      `Vendor fetch strategy ${source.fetch_strategy} is not yet supported by ingest_vendor_docs`,
    );
  }

  return {
    app: source.app,
    seedUrl: seed.toString(),
    maxPages: payload.maxPages ?? DEFAULT_MAX_PAGES,
    strategy: source.fetch_strategy,
    scope: {
      allowedHost: seedHost,
      exactPath: seed.pathname || '/',
      pathPrefix: buildPathPrefix(seed.toString()),
    },
  };
}

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    // Strip hash and query params for dedup
    url.hash = '';
    url.search = '';
    // Only follow http(s)
    if (!url.protocol.startsWith('http')) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Derive a `screen` identifier from a URL path.
 * e.g. `/docs/contacts/create` -> `contacts-create`
 *      `/help/billing/invoices` -> `billing-invoices`
 */
function deriveScreen(urlPath: string): string {
  // Remove common doc prefixes
  const cleaned = urlPath
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/^(docs|documentation|help|guide|guides|api|reference|manual)\/?/i, '')
    .replace(/\.(html?|md|mdx)$/i, '');

  if (!cleaned) return 'index';

  return cleaned
    .split('/')
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// HTML -> Markdown conversion
// ---------------------------------------------------------------------------

function htmlToMarkdown($: cheerio.CheerioAPI, $el: cheerio.Cheerio<AnyNode>): string {
  const lines: string[] = [];

  function processNode(node: AnyNode): void {
    if (node.type === 'text') {
      const text = (node as DomText).data?.trim();
      if (text) lines.push(text);
      return;
    }

    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return;

    const el = node as DomElement;
    const tagName = el.name?.toLowerCase();
    const children = el.children || [];

    switch (tagName) {
      case 'h1':
        lines.push(`\n# ${$(el).text().trim()}\n`);
        return;
      case 'h2':
        lines.push(`\n## ${$(el).text().trim()}\n`);
        return;
      case 'h3':
        lines.push(`\n### ${$(el).text().trim()}\n`);
        return;
      case 'h4':
        lines.push(`\n#### ${$(el).text().trim()}\n`);
        return;
      case 'h5':
        lines.push(`\n##### ${$(el).text().trim()}\n`);
        return;
      case 'h6':
        lines.push(`\n###### ${$(el).text().trim()}\n`);
        return;
      case 'p':
        lines.push(`\n${$(el).text().trim()}\n`);
        return;
      case 'pre':
      case 'code': {
        const codeText = $(el).text().trim();
        if (tagName === 'pre' || $(el).parent().is('pre')) {
          lines.push(`\n\`\`\`\n${codeText}\n\`\`\`\n`);
        } else {
          lines.push(`\`${codeText}\``);
        }
        return;
      }
      case 'ul':
      case 'ol': {
        lines.push('');
        children.forEach((child, idx) => {
          if ((child as DomElement).name?.toLowerCase() === 'li') {
            const prefix = tagName === 'ol' ? `${idx + 1}. ` : '- ';
            lines.push(`${prefix}${$(child).text().trim()}`);
          }
        });
        lines.push('');
        return;
      }
      case 'blockquote':
        lines.push(`\n> ${$(el).text().trim()}\n`);
        return;
      case 'table': {
        const rows: string[][] = [];
        $(el)
          .find('tr')
          .each((_, tr) => {
            const cells: string[] = [];
            $(tr)
              .find('th, td')
              .each((_, cell) => {
                cells.push($(cell).text().trim());
              });
            rows.push(cells);
          });
        if (rows.length > 0) {
          lines.push('');
          lines.push(`| ${rows[0].join(' | ')} |`);
          lines.push(`| ${rows[0].map(() => '---').join(' | ')} |`);
          rows.slice(1).forEach((row) => {
            lines.push(`| ${row.join(' | ')} |`);
          });
          lines.push('');
        }
        return;
      }
      case 'br':
        lines.push('');
        return;
      case 'hr':
        lines.push('\n---\n');
        return;
      case 'a': {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text) {
          lines.push(`[${text}](${href})`);
        } else if (text) {
          lines.push(text);
        }
        return;
      }
      case 'strong':
      case 'b':
        lines.push(`**${$(el).text().trim()}**`);
        return;
      case 'em':
      case 'i':
        lines.push(`*${$(el).text().trim()}*`);
        return;
      case 'img': {
        const alt = $(el).attr('alt') || '';
        const src = $(el).attr('src') || '';
        if (alt || src) lines.push(`![${alt}](${src})`);
        return;
      }
      default:
        // Recurse into children for div, span, section, etc.
        for (const child of children) {
          processNode(child as AnyNode);
        }
    }
  }

  $el.each((_, el) => {
    const domEl = el as DomElement;
    for (const child of domEl.children || []) {
      processNode(child as AnyNode);
    }
  });

  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// Element selector extraction (best-effort)
// ---------------------------------------------------------------------------

/**
 * Extract CSS selectors from code examples and descriptive text in vendor docs.
 * This is best-effort — many vendor docs describe UI elements textually rather
 * than with actual selectors.
 */
function extractElementSelectors($: cheerio.CheerioAPI): string[] {
  const selectors = new Set<string>();

  // Look for CSS selectors in code blocks
  $('code, pre').each((_, el) => {
    const text = $(el).text();

    // Match CSS selector patterns: .class, #id, [data-attr], element.class
    const selectorPatterns = text.match(
      /(?:^|\s)((?:[.#][a-zA-Z][\w-]*|(?:\[[\w-]+(?:=[^\]]+)?\]))+(?:\s+[>+~]\s+(?:[.#]?[a-zA-Z][\w-]*|\[[\w-]+(?:=[^\]]+)?\]))*)/g
    );
    if (selectorPatterns) {
      for (const sel of selectorPatterns) {
        const trimmed = sel.trim();
        // Only keep reasonable-length selectors
        if (trimmed.length >= 2 && trimmed.length <= 200) {
          selectors.add(trimmed);
        }
      }
    }

    // Match data-testid or data-cy attributes (common in modern docs)
    const dataAttrs = text.match(/data-(?:testid|cy|test|qa)=["']([^"']+)["']/g);
    if (dataAttrs) {
      for (const attr of dataAttrs) {
        const match = attr.match(/data-(?:testid|cy|test|qa)=["']([^"']+)["']/);
        if (match) selectors.add(`[${match[0].replace(/["']/g, '"')}]`);
      }
    }
  });

  // Look for aria-label references in docs
  $('code, pre').each((_, el) => {
    const text = $(el).text();
    const ariaLabels = text.match(/aria-label=["']([^"']+)["']/g);
    if (ariaLabels) {
      for (const attr of ariaLabels) {
        selectors.add(`[${attr.replace(/'/g, '"')}]`);
      }
    }
  });

  return Array.from(selectors).slice(0, 50); // Cap at 50 selectors per page
}

// ---------------------------------------------------------------------------
// Link extraction & page parsing
// ---------------------------------------------------------------------------

/**
 * Extract same-domain links from an HTML page.
 */
function extractLinks(
  html: string,
  currentUrl: string,
  baseOrigin: string,
  scope: CrawlScope,
): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const normalized = normalizeUrl(href, currentUrl);
    if (
      normalized &&
      isSameDomain(normalized, baseOrigin) &&
      isWithinCrawlScope(normalized, scope)
    ) {
      links.add(normalized);
    }
  });

  return Array.from(links);
}

// ---------------------------------------------------------------------------
// BFS Crawl
// ---------------------------------------------------------------------------

async function crawlSite(
  seedUrl: string,
  app: string,
  maxPages: number,
  robotsRules: RobotsRules,
  scope: CrawlScope,
  progressCallback?: ProgressCallback
): Promise<CrawledPage[]> {
  const parsed = new URL(seedUrl);
  const baseOrigin = parsed.origin;
  const crawlDelay = Math.max(CRAWL_DELAY_MS, robotsRules.crawlDelay);

  const visited = new Set<string>();
  const queue: string[] = [seedUrl];
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift()!;

    if (visited.has(url)) continue;
    visited.add(url);
    if (!isWithinCrawlScope(url, scope)) {
      logger.debug('Skipping out-of-scope URL', { context: { url } });
      continue;
    }

    // Check robots.txt
    const urlPath = new URL(url).pathname;
    if (!isAllowedByRobots(urlPath, robotsRules)) {
      logger.debug('Skipping disallowed URL', { context: { url } });
      continue;
    }

    // Report progress
    if (progressCallback) {
      const percent = Math.round((pages.length / maxPages) * 80) + 5;
      progressCallback(
        percent,
        `Crawling page ${pages.length + 1}/${maxPages}: ${url}`
      );
    }

    // Fetch for link extraction (separate from content parsing to get raw HTML)
    let html: string;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Tribora-DocCrawler/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        logger.debug('Skipping non-OK URL', {
          context: { url, status: response.status },
        });
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
        continue;
      }

      html = await response.text();
    } catch {
      continue;
    }

    // Parse the page content
    const page = await parseFetchedPage(html, url, app);
    if (page) {
      pages.push(page);
    }

    // Extract and enqueue links
    const links = extractLinks(html, url, baseOrigin, scope);
    for (const link of links) {
      if (!visited.has(link) && !queue.includes(link)) {
        queue.push(link);
      }
    }

    // Polite crawl delay
    if (queue.length > 0 && pages.length < maxPages) {
      await sleep(crawlDelay);
    }
  }

  return pages;
}

/**
 * Parse an already-fetched HTML string into a CrawledPage.
 * This avoids a double-fetch (once for links, once for content).
 */
function parseFetchedPage(
  html: string,
  url: string,
  app: string
): CrawledPage | null {
  try {
    const $ = cheerio.load(html);

    // Remove noise elements
    $(NOISE_SELECTORS.join(', ')).remove();

    // Find main content area
    let $mainContent: cheerio.Cheerio<AnyNode> | null = null;
    for (const selector of MAIN_CONTENT_SELECTORS) {
      const $found = $(selector).first();
      if ($found.length > 0) {
        $mainContent = $found;
        break;
      }
    }

    if (!$mainContent || $mainContent.length === 0) {
      $mainContent = $('body');
    }

    // Extract title
    const title =
      $('h1').first().text().trim() ||
      $('title').text().trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      'Untitled';

    // Convert to Markdown
    const markdownContent = htmlToMarkdown($, $mainContent);

    if (!markdownContent || markdownContent.length < 50) {
      return null;
    }

    const parsed = new URL(url);
    const screen = deriveScreen(parsed.pathname);
    const fullContent = [
      '---',
      `title: "${title.replace(/"/g, '\\"')}"`,
      `app: "${app}"`,
      `screen: "${screen}"`,
      `source_url: "${url}"`,
      `crawled_at: "${new Date().toISOString()}"`,
      '---',
      '',
      markdownContent,
    ].join('\n');

    const contentHash = createHash('sha256')
      .update(markdownContent)
      .digest('hex');

    const elementSelectors = extractElementSelectors($);

    return {
      url,
      title,
      screen,
      markdownContent: fullContent,
      elementSelectors,
      contentHash,
    };
  } catch (error) {
    logger.warn('Failed to parse fetched page', {
      context: { url },
      error: error as Error,
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Database upsert with hash-based deduplication
// ---------------------------------------------------------------------------

async function upsertPages(
  pages: CrawledPage[],
  app: string,
  options?: {
    vendorSourceId?: string | null;
    triggeredByUserId?: string | null;
    jobId?: string | null;
  },
  progressCallback?: ProgressCallback
): Promise<PageWriteManifest> {
  const supabase = createAdminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const outcomes: PageWriteOutcome[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (progressCallback) {
      const percent = 85 + Math.round((i / pages.length) * 14);
      progressCallback(percent, `Saving page ${i + 1}/${pages.length}: ${page.screen}`);
    }

    // Source-scoped identity first. Legacy app+screen lookup is retained only
    // for old non-source jobs, which are now rejected before execution.
    type VendorRow = Database['public']['Tables']['vendor_wiki_pages']['Row'];
    let existingQuery = supabase.from('vendor_wiki_pages').select('*');
    if (options?.vendorSourceId) {
      existingQuery = existingQuery
        .eq('vendor_source_id', options.vendorSourceId)
        .eq('source_url', page.url);
    } else {
      existingQuery = existingQuery.eq('app', app).eq('screen', page.screen);
    }
    const { data: existing } = await existingQuery.maybeSingle() as {
      data: VendorRow | null;
    };

    if (existing) {
      // Skip only when both the page content and the registry mapping already match.
      if (
        shouldSkipVendorWikiPageUpdate({
          existingContentHash: existing.content_hash,
          nextContentHash: page.contentHash,
          existingVendorSourceId: existing.vendor_source_id,
          nextVendorSourceId: options?.vendorSourceId,
        })
      ) {
        skipped++;
        outcomes.push({
          sourceUrl: page.url,
          screen: page.screen,
          contentHash: page.contentHash,
          status: 'unchanged',
          pageId: existing.id,
        });
        logger.debug('Skipping unchanged page', {
          context: { app, screen: page.screen },
        });
        continue;
      }

      // Update changed page (type assertion needed — Supabase JS PostgREST
      // builder resolves vendor_wiki_pages to `never` due to missing
      // Relationships metadata in the generated types)
      const { error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('vendor_wiki_pages') as any)
        .update({
          content: page.markdownContent,
          element_selectors: page.elementSelectors,
          source_url: page.url,
          content_hash: page.contentHash,
          vendor_source_id: options?.vendorSourceId ?? existing.vendor_source_id,
          updated_at: new Date().toISOString(),
          curated_by: options?.triggeredByUserId ?? null,
          ingest_job_id: options?.jobId ?? null,
        })
        .eq('id', existing.id);

      if (error) {
        failed++;
        outcomes.push({
          sourceUrl: page.url,
          screen: page.screen,
          contentHash: page.contentHash,
          status: 'failed',
          pageId: existing.id,
          error: error.message,
        });
        logger.error('Failed to update vendor wiki page', {
          context: { app, screen: page.screen },
          error,
        });
      } else {
        updated++;
        outcomes.push({
          sourceUrl: page.url,
          screen: page.screen,
          contentHash: page.contentHash,
          status: 'updated',
          pageId: existing.id,
        });
      }
    } else {
      // Insert new page
      const { data: insertedRow, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('vendor_wiki_pages') as any)
        .insert({
          app,
          screen: page.screen,
          content: page.markdownContent,
          element_selectors: page.elementSelectors,
          source_url: page.url,
          content_hash: page.contentHash,
          vendor_source_id: options?.vendorSourceId ?? null,
          curated_by: options?.triggeredByUserId ?? null,
          ingest_job_id: options?.jobId ?? null,
        })
        .select('id')
        .single();

      if (error) {
        failed++;
        outcomes.push({
          sourceUrl: page.url,
          screen: page.screen,
          contentHash: page.contentHash,
          status: 'failed',
          pageId: null,
          error: error.message,
        });
        logger.error('Failed to insert vendor wiki page', {
          context: { app, screen: page.screen },
          error,
        });
      } else {
        inserted++;
        outcomes.push({
          sourceUrl: page.url,
          screen: page.screen,
          contentHash: page.contentHash,
          status: 'inserted',
          pageId: insertedRow?.id ?? null,
        });
      }
    }
  }

  return { inserted, updated, skipped, failed, outcomes };
}

async function recordVendorIngestJobResult(
  jobId: string,
  manifest: PageWriteManifest,
): Promise<void> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('jobs') as any)
    .update({ result: manifest })
    .eq('id', jobId);

  if (error) {
    throw new Error(`Failed to record vendor ingest manifest: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main handler (registered in job-processor.ts)
// ---------------------------------------------------------------------------

export async function handleIngestVendorDocs(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as IngestVendorDocsPayload;

  if (!payload?.sourceId) {
    throw new Error('ingest_vendor_docs requires { sourceId } in payload');
  }

  const registry = createVendorSourceRegistryService();
  const attemptedAt = new Date().toISOString();
  const registrySource = await registry.findSourceForIngestion({
    sourceId: payload.sourceId,
    app: payload.app ?? '',
    sourceUrl: payload.url ?? 'https://example.com',
  });

  if (!registrySource) {
    throw new Error(`Vendor source ${payload.sourceId} was not found`);
  }

  await registry.recordAttempt(registrySource.id, attemptedAt);

  const acquisitionPlan = buildSourceAcquisitionPlan(registrySource, payload);
  const { seedUrl, app, maxPages } = acquisitionPlan;

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(seedUrl);
  } catch {
    throw new Error(`Invalid seed URL: ${seedUrl}`);
  }

  if (!parsedUrl.protocol.startsWith('http')) {
    throw new Error(`URL must use http or https protocol: ${seedUrl}`);
  }

  // Audit provenance — back-compat: defaults to null for existing queued jobs
  const triggeredByUserId = payload.triggered_by_user_id ?? null;

  logger.info('Starting vendor doc ingestion', {
    context: {
      seedUrl,
      app,
      maxPages,
      sourceId: payload.sourceId,
      strategy: acquisitionPlan.strategy,
      pathPrefix: acquisitionPlan.scope.pathPrefix,
      jobId: job.id,
      triggeredByUserId,
    },
  });

  // 'platform' sentinel: vendor docs are not org-scoped — they belong to the platform corpus
  const orgId = 'platform';

  await withAgentLogging(
    {
      orgId,
      agentType: 'vendor_doc_ingestion',
      actionType: 'crawl_and_ingest',
      inputSummary: `Crawl ${seedUrl} for app="${app}", maxPages=${maxPages}${triggeredByUserId ? `, triggered_by=${triggeredByUserId}` : ''}`,
    },
    async () => {
      // Step 1: Fetch robots.txt
      if (progressCallback) progressCallback(2, 'Fetching robots.txt...');
      try {
        const robotsRules = await fetchRobotsTxt(parsedUrl.origin);

        logger.info('Robots.txt parsed', {
          context: {
            disallowedPaths: robotsRules.disallowedPaths.length,
            crawlDelay: robotsRules.crawlDelay,
          },
        });

        // Step 2: BFS crawl
        if (progressCallback) progressCallback(5, 'Starting crawl...');
        const pages = await crawlSite(
          seedUrl,
          app,
          maxPages,
          robotsRules,
          acquisitionPlan.scope,
          progressCallback
        );

        logger.info('Crawl complete', {
          context: { pagesFound: pages.length, maxPages },
        });

        if (pages.length === 0) {
          logger.warn('No pages crawled — check seed URL and robots.txt', {
            context: { seedUrl },
          });

          throw new Error('No pages found to ingest');
        }

        // Step 3: Upsert into vendor_wiki_pages with hash dedup
        if (progressCallback) {
          progressCallback(85, `Saving ${pages.length} pages to database...`);
        }

        const result = await upsertPages(
          pages,
          app,
          {
            vendorSourceId: registrySource.id,
            triggeredByUserId: triggeredByUserId,
            jobId: job.id,
          },
          progressCallback
        );

        await recordVendorIngestJobResult(job.id, result);

        if (result.failed > 0) {
          throw new Error(
            `Vendor source ingestion failed to persist ${result.failed} of ${pages.length} pages`,
          );
        }

        if (result.inserted + result.updated + result.skipped === 0) {
          throw new Error('Vendor source ingestion did not persist any pages');
        }

        try {
          const corpusResult = await syncVendorCorpusFromLegacyPages({ app });
          logger.info('Vendor corpus sync after ingestion complete', {
            context: {
              app,
              inserted: corpusResult.inserted,
              updated: corpusResult.updated,
              skipped: corpusResult.skipped,
            },
          });
        } catch (corpusError) {
          logger.error('Vendor corpus sync after ingestion failed', {
            context: { app, sourceId: registrySource.id },
            error: corpusError as Error,
          });
        }

        const combinedHashInput = hashVendorSourcePages(
          result.outcomes
            .filter((outcome) => outcome.status !== 'failed')
            .map((outcome) => ({
              screen: outcome.screen,
              contentHash: outcome.contentHash,
            }))
        );

        const sourceContentHash = combinedHashInput
          ? createHash('sha256').update(combinedHashInput).digest('hex')
          : registrySource.content_hash ?? '';

        await registry.recordSuccess(registrySource.id, {
          attemptedAt,
          succeededAt: new Date().toISOString(),
          contentHash: sourceContentHash,
        });

        logger.info('Vendor doc ingestion complete', {
          context: {
            app,
            seedUrl,
            sourceId: registrySource.id,
            totalCrawled: pages.length,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            failed: result.failed,
          },
        });

        if (progressCallback) {
          progressCallback(
            100,
            `Done: ${result.inserted} new, ${result.updated} updated, ${result.skipped} unchanged`
          );
        }
      } catch (error) {
        if (registrySource) {
          try {
            await registry.recordFailure(registrySource.id, {
              attemptedAt,
              failedAt: new Date().toISOString(),
              errorMessage:
                error instanceof Error ? error.message : 'Unknown vendor ingestion error',
            });
          } catch (recordError) {
            logger.error('Failed to record vendor source ingestion failure', {
              context: { sourceId: registrySource.id },
              error: recordError as Error,
            });
          }
        }

        throw error;
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
