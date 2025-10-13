/**
 * URL Import Connector
 *
 * Fetches web pages and converts HTML to markdown for import
 * Uses cheerio for content extraction and turndown for markdown conversion
 */

import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  Connector,
  ConnectorType,
  ConnectorCredentials,
  AuthResult,
  TestResult,
  SyncOptions,
  SyncResult,
  ListOptions,
  ConnectorFile,
  FileContent,
  SyncError,
} from './base';

// Request timeout: 30 seconds
const REQUEST_TIMEOUT = 30000;

// Max content size: 10MB
const MAX_CONTENT_SIZE = 10 * 1024 * 1024;

// User agent for web scraping
const USER_AGENT =
  'Mozilla/5.0 (compatible; RecordBot/1.0; +https://record.app/bot)';

interface URLImportOptions {
  orgId: string;
  userId?: string;
  batchId?: string;
}

interface ImportedURL {
  id: string;
  url: string;
  title?: string;
  content?: string;
  markdown?: string;
  metadata?: Record<string, any>;
  fetchedAt?: Date;
  status: 'pending' | 'success' | 'failed';
  error?: string;
}

interface ContentExtractionOptions {
  removeSelectors?: string[]; // Selectors to remove (ads, nav, footer)
  mainContentSelector?: string; // Selector for main content
  includeImages?: boolean; // Whether to keep image references
  includeLinks?: boolean; // Whether to keep links
}

export class URLImportConnector implements Connector {
  readonly type = ConnectorType.URL_IMPORT;
  readonly name = 'URL Import';
  readonly description =
    'Import content from web URLs with HTML to markdown conversion';

  private orgId: string;
  private userId?: string;
  private batchId?: string;
  private urls: Map<string, ImportedURL> = new Map();
  private turndownService: TurndownService;

  constructor(options: URLImportOptions) {
    this.orgId = options.orgId;
    this.userId = options.userId;
    this.batchId = options.batchId;

    // Configure turndown for markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
    });

    // Add custom rules for better markdown output
    this.setupTurndownRules();
  }

  /**
   * Setup custom turndown rules for better markdown conversion
   */
  private setupTurndownRules(): void {
    // Keep links but clean them up
    this.turndownService.addRule('cleanLinks', {
      filter: 'a',
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).getAttribute('href');
        if (!href || href.startsWith('#')) return content;
        return `[${content}](${href})`;
      },
    });

    // Handle code blocks better
    this.turndownService.addRule('codeBlocks', {
      filter: ['pre'],
      replacement: (content, node) => {
        const code = (node as HTMLElement).querySelector('code');
        if (code) {
          const language = code.className.match(/language-(\w+)/)?.[1] || '';
          return `\n\`\`\`${language}\n${code.textContent}\n\`\`\`\n`;
        }
        return `\n\`\`\`\n${content}\n\`\`\`\n`;
      },
    });
  }

  /**
   * No authentication needed for public URL fetching
   */
  async authenticate(credentials: ConnectorCredentials): Promise<AuthResult> {
    return {
      success: true,
      userId: this.userId,
      userName: 'URL Import User',
    };
  }

  /**
   * Test if we can fetch URLs
   */
  async testConnection(): Promise<TestResult> {
    try {
      // Test with a simple HEAD request to a known URL
      const response = await axios.head('https://www.example.com', {
        timeout: 5000,
        headers: {
          'User-Agent': USER_AGENT,
        },
      });

      return {
        success: response.status === 200,
        message: 'URL fetching is working',
        metadata: {
          statusCode: response.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Add URL to import queue
   */
  async addURL(
    url: string,
    options?: ContentExtractionOptions,
  ): Promise<{ success: boolean; urlId?: string; error?: string }> {
    try {
      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }

      // Only allow HTTP/HTTPS
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return {
          success: false,
          error: 'Only HTTP and HTTPS URLs are supported',
        };
      }

      // Generate unique URL ID
      const urlId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

      // Add to queue
      this.urls.set(urlId, {
        id: urlId,
        url,
        status: 'pending',
        metadata: {
          extractionOptions: options,
        },
      });

      return {
        success: true,
        urlId,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Fetch and process URLs
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const errors: SyncError[] = [];
    let filesProcessed = 0;
    let filesUpdated = 0;
    let filesFailed = 0;

    try {
      // Get URLs to process
      let urlsToProcess = Array.from(this.urls.values()).filter(
        (u) => u.status === 'pending',
      );

      // Apply limit if specified
      if (options?.limit) {
        urlsToProcess = urlsToProcess.slice(0, options.limit);
      }

      // Process each URL
      for (const urlData of urlsToProcess) {
        try {
          filesProcessed++;

          // Fetch and extract content
          const result = await this.fetchAndExtract(
            urlData.url,
            urlData.metadata?.extractionOptions,
          );

          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch URL');
          }

          // Update URL data
          urlData.title = result.title;
          urlData.content = result.content;
          urlData.markdown = result.markdown;
          urlData.fetchedAt = new Date();
          urlData.status = 'success';
          urlData.metadata = {
            ...urlData.metadata,
            contentLength: result.content?.length || 0,
            markdownLength: result.markdown?.length || 0,
            description: result.description,
          };

          // Save to Supabase storage
          if (result.markdown) {
            const storagePath = this.batchId
              ? `org_${this.orgId}/imports/${this.batchId}/${urlData.id}.md`
              : `org_${this.orgId}/imports/${urlData.id}.md`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from('recordings')
              .upload(storagePath, result.markdown, {
                contentType: 'text/markdown',
                upsert: false,
                cacheControl: '3600',
              });

            if (uploadError) {
              throw new Error(`Upload failed: ${uploadError.message}`);
            }
          }

          filesUpdated++;
        } catch (error) {
          filesFailed++;
          urlData.status = 'failed';
          urlData.error =
            error instanceof Error ? error.message : 'Unknown error';

          errors.push({
            fileId: urlData.id,
            fileName: urlData.url,
            error: urlData.error,
            retryable: this.isRetryableError(error),
          });
        }
      }

      return {
        success: filesFailed === 0,
        filesProcessed,
        filesUpdated,
        filesFailed,
        filesDeleted: 0,
        errors,
        metadata: {
          batchId: this.batchId,
          remainingUrls: Array.from(this.urls.values()).filter(
            (u) => u.status === 'pending',
          ).length,
        },
      };
    } catch (error) {
      return {
        success: false,
        filesProcessed,
        filesUpdated,
        filesFailed,
        filesDeleted: 0,
        errors: [
          {
            fileId: 'batch',
            fileName: 'batch-operation',
            error: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            retryable: true,
          },
        ],
      };
    }
  }

  /**
   * Fetch URL and extract content
   */
  private async fetchAndExtract(
    url: string,
    options?: ContentExtractionOptions,
  ): Promise<{
    success: boolean;
    title?: string;
    description?: string;
    content?: string;
    markdown?: string;
    error?: string;
  }> {
    try {
      // Fetch URL
      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        maxContentLength: MAX_CONTENT_SIZE,
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
        },
        validateStatus: (status) => status >= 200 && status < 400,
      });

      const html = response.data;

      // Parse HTML with cheerio
      const $ = cheerio.load(html);

      // Remove unwanted elements
      const defaultRemoveSelectors = [
        'script',
        'style',
        'noscript',
        'iframe',
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.ad',
        '.ads',
        '.cookie-banner',
        '.social-share',
      ];

      const removeSelectors =
        options?.removeSelectors || defaultRemoveSelectors;
      removeSelectors.forEach((selector) => $(selector).remove());

      // Extract metadata
      const title =
        $('title').text() ||
        $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text() ||
        'Untitled';

      const description =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

      // Extract main content
      let contentHtml: string;

      if (options?.mainContentSelector) {
        contentHtml = $(options.mainContentSelector).html() || '';
      } else {
        // Try common content selectors
        const contentSelectors = [
          'article',
          'main',
          '[role="main"]',
          '.content',
          '.post-content',
          '.article-content',
          '#content',
        ];

        let found = false;
        for (const selector of contentSelectors) {
          const element = $(selector).first();
          if (element.length > 0) {
            contentHtml = element.html() || '';
            found = true;
            break;
          }
        }

        if (!found) {
          // Fallback to body
          contentHtml = $('body').html() || '';
        }
      }

      // Handle images
      if (!options?.includeImages) {
        const $content = cheerio.load(contentHtml);
        $content('img').remove();
        contentHtml = $content.html() || '';
      }

      // Handle links
      if (!options?.includeLinks) {
        const $content = cheerio.load(contentHtml);
        $content('a').each((_, el) => {
          const $el = $content(el);
          $el.replaceWith($el.text());
        });
        contentHtml = $content.html() || '';
      }

      // Convert to markdown
      const markdown = this.turndownService.turndown(contentHtml);

      // Clean up markdown (remove excessive newlines, etc.)
      const cleanMarkdown = markdown
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .replace(/^\s+|\s+$/g, '') // Trim
        .replace(/\[ \]/g, '[ ]'); // Fix checkboxes

      // Extract plain text for content field
      const $content = cheerio.load(contentHtml);
      const content = $content.text().trim();

      return {
        success: true,
        title: title.trim(),
        description: description.trim(),
        content,
        markdown: `# ${title}\n\n${description ? `> ${description}\n\n` : ''}${cleanMarkdown}`,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.code === 'ECONNABORTED') {
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        if (axiosError.response) {
          return {
            success: false,
            error: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          };
        }
      }

      return {
        success: false,
        error: `Failed to fetch: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      // Retry on timeout or 5xx errors
      return (
        axiosError.code === 'ECONNABORTED' ||
        (axiosError.response?.status !== undefined &&
          axiosError.response.status >= 500)
      );
    }
    return false;
  }

  /**
   * List URLs in queue
   */
  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    const urls = Array.from(this.urls.values());

    // Apply filters
    let filtered = urls;
    if (options?.filters?.status) {
      filtered = filtered.filter((u) => u.status === options.filters?.status);
    }

    // Apply limit and offset
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    return filtered.slice(offset, offset + limit).map((urlData) => ({
      id: urlData.id,
      name: urlData.title || urlData.url,
      type: 'url',
      mimeType: 'text/html',
      size: urlData.markdown?.length || 0,
      modifiedAt: urlData.fetchedAt || new Date(),
      createdAt: urlData.fetchedAt || new Date(),
      url: urlData.url,
      metadata: {
        status: urlData.status,
        error: urlData.error,
        ...urlData.metadata,
      },
    }));
  }

  /**
   * Get processed content for a URL
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    const urlData = this.urls.get(fileId);

    if (!urlData) {
      throw new Error(`URL not found: ${fileId}`);
    }

    if (urlData.status !== 'success') {
      throw new Error(`URL not processed: ${urlData.status}`);
    }

    if (!urlData.markdown) {
      throw new Error('No markdown content available');
    }

    return {
      id: urlData.id,
      title: urlData.title || urlData.url,
      content: urlData.markdown,
      mimeType: 'text/markdown',
      size: urlData.markdown.length,
      metadata: {
        url: urlData.url,
        fetchedAt: urlData.fetchedAt,
        ...urlData.metadata,
      },
    };
  }

  /**
   * Clear all URLs from queue
   */
  clearQueue(): void {
    this.urls.clear();
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.urls.size;
  }

  /**
   * Get queue stats
   */
  getQueueStats(): {
    total: number;
    pending: number;
    success: number;
    failed: number;
  } {
    const urls = Array.from(this.urls.values());
    return {
      total: urls.length,
      pending: urls.filter((u) => u.status === 'pending').length,
      success: urls.filter((u) => u.status === 'success').length,
      failed: urls.filter((u) => u.status === 'failed').length,
    };
  }

  /**
   * Retry failed URLs
   */
  async retryFailed(): Promise<void> {
    Array.from(this.urls.values())
      .filter((u) => u.status === 'failed')
      .forEach((u) => {
        u.status = 'pending';
        u.error = undefined;
      });
  }
}
