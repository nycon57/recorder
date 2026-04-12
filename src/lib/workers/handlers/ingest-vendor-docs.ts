/**
 * Ingest Vendor Docs Job Handler (TRIB-45)
 *
 * Crawls vendor documentation sites and transforms them into structured
 * `vendor_wiki_pages` rows. Uses breadth-first crawling with robots.txt
 * respect, cheerio for HTML parsing, and SHA256 content hashing for
 * deduplication on re-crawl.
 *
 * Job payload: { url: string, app: string, maxPages?: number }
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
import { createLogger } from '@/lib/utils/logger';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

const logger = createLogger({ service: 'ingest-vendor-docs' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IngestVendorDocsPayload {
  url: string;
  app: string;
  maxPages?: number;
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

    if (!response.ok) return rules;

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
    logger.warn('Failed to fetch robots.txt, proceeding without restrictions', {
      context: { baseUrl },
      error: error as Error,
    });
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
  baseOrigin: string
): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const normalized = normalizeUrl(href, currentUrl);
    if (normalized && isSameDomain(normalized, baseOrigin)) {
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
    const links = extractLinks(html, url, baseOrigin);
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
  progressCallback?: ProgressCallback
): Promise<{ inserted: number; updated: number; skipped: number }> {
  const supabase = createAdminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (progressCallback) {
      const percent = 85 + Math.round((i / pages.length) * 14);
      progressCallback(percent, `Saving page ${i + 1}/${pages.length}: ${page.screen}`);
    }

    // Check for existing page by app + screen
    type VendorRow = Database['public']['Tables']['vendor_wiki_pages']['Row'];
    const { data: existing } = await supabase
      .from('vendor_wiki_pages')
      .select('*')
      .eq('app', app)
      .eq('screen', page.screen)
      .maybeSingle() as { data: VendorRow | null };

    if (existing) {
      // Compare hashes — skip if unchanged
      if (existing.content_hash === page.contentHash) {
        skipped++;
        logger.debug('Skipping unchanged page', {
          context: { app, screen: page.screen },
        });
        continue;
      }

      // Update changed page (type assertion needed — Supabase JS PostgREST
      // builder resolves vendor_wiki_pages to `never` due to missing
      // Relationships metadata in the generated types)
      const { error } = await (supabase
        .from('vendor_wiki_pages') as any)
        .update({
          content: page.markdownContent,
          element_selectors: page.elementSelectors,
          source_url: page.url,
          content_hash: page.contentHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        logger.error('Failed to update vendor wiki page', {
          context: { app, screen: page.screen },
          error,
        });
      } else {
        updated++;
      }
    } else {
      // Insert new page
      const { error } = await (supabase
        .from('vendor_wiki_pages') as any)
        .insert({
          app,
          screen: page.screen,
          content: page.markdownContent,
          element_selectors: page.elementSelectors,
          source_url: page.url,
          content_hash: page.contentHash,
        });

      if (error) {
        logger.error('Failed to insert vendor wiki page', {
          context: { app, screen: page.screen },
          error,
        });
      } else {
        inserted++;
      }
    }
  }

  return { inserted, updated, skipped };
}

// ---------------------------------------------------------------------------
// Main handler (registered in job-processor.ts)
// ---------------------------------------------------------------------------

export async function handleIngestVendorDocs(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as unknown as IngestVendorDocsPayload;

  if (!payload?.url || !payload?.app) {
    throw new Error('ingest_vendor_docs requires { url, app } in payload');
  }

  const { url: seedUrl, app, maxPages = DEFAULT_MAX_PAGES } = payload;

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

  logger.info('Starting vendor doc ingestion', {
    context: { seedUrl, app, maxPages, jobId: job.id },
  });

  // Use a placeholder orgId for vendor docs (they are not org-scoped)
  const orgId = 'system';

  await withAgentLogging(
    {
      orgId,
      agentType: 'vendor_doc_ingestion',
      actionType: 'crawl_and_ingest',
      inputSummary: `Crawl ${seedUrl} for app="${app}", maxPages=${maxPages}`,
    },
    async () => {
      // Step 1: Fetch robots.txt
      if (progressCallback) progressCallback(2, 'Fetching robots.txt...');
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
        progressCallback
      );

      logger.info('Crawl complete', {
        context: { pagesFound: pages.length, maxPages },
      });

      if (pages.length === 0) {
        logger.warn('No pages crawled — check seed URL and robots.txt', {
          context: { seedUrl },
        });
        if (progressCallback) progressCallback(100, 'No pages found to ingest');
        return;
      }

      // Step 3: Upsert into vendor_wiki_pages with hash dedup
      if (progressCallback) {
        progressCallback(85, `Saving ${pages.length} pages to database...`);
      }

      const result = await upsertPages(pages, app, progressCallback);

      logger.info('Vendor doc ingestion complete', {
        context: {
          app,
          seedUrl,
          totalCrawled: pages.length,
          inserted: result.inserted,
          updated: result.updated,
          skipped: result.skipped,
        },
      });

      if (progressCallback) {
        progressCallback(
          100,
          `Done: ${result.inserted} new, ${result.updated} updated, ${result.skipped} unchanged`
        );
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
