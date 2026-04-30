/**
 * Notion Connector
 *
 * Integrates with Notion via OAuth to import pages, databases, and embedded
 * media with proper markdown conversion and hierarchical structure preservation.
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Pages and databases listing
 * - Rich block content with nested structure
 * - Markdown conversion with Turndown
 * - Embedded file and media download
 * - Incremental sync with lastEditedTime tracking
 * - Database content extraction
 */

import { Client } from '@notionhq/client';
import TurndownService from 'turndown';

import { createClient } from '@/lib/supabase/admin';
import type { Json } from '@/lib/types/database';

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
} from './base';

type NotionRecord = Record<string, unknown>;

interface NotionRichText {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  };
}

interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  parent: NotionRecord;
  properties: Record<string, NotionRecord>;
  url: string;
}

interface NotionDatabase {
  id: string;
  object: 'database';
  created_time: string;
  last_edited_time: string;
  title: NotionRichText[];
  properties: Record<string, NotionRecord>;
  url: string;
}

interface NotionBlock {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  children?: NotionBlock[];
  [key: string]: unknown;
}

type NotionBlockData = NotionRecord & {
  rich_text?: NotionRichText[];
  checked?: boolean;
  language?: string;
  url?: string;
  caption?: NotionRichText[];
  icon?: {
    emoji?: string;
  };
};

type NotionFileData = NotionRecord & {
  type?: string;
  external?: {
    url?: string;
  };
  file?: {
    url?: string;
  };
  url?: string;
};

type NotionTitleSource = NotionRecord & {
  id?: string;
  object?: string;
  created_time?: string;
  last_edited_time?: string;
  url?: string;
  parent?: NotionRecord;
  title?: NotionRichText[];
  properties?: Record<string, NotionRecord & { title?: NotionRichText[]; type?: string }>;
};

interface ImportedDocumentRow {
  id: string;
  content_hash: string | null;
  sync_count?: number | null;
}

interface NotionDatabaseQueryClient {
  query(args: {
    database_id: string;
    page_size: number;
    start_cursor?: string;
  }): Promise<{
    results: unknown[];
    has_more: boolean;
    next_cursor: string | null;
  }>;
}

export class NotionConnector implements Connector {
  readonly type = ConnectorType.NOTION;
  readonly name = 'Notion';
  readonly description = 'Sync Notion pages, databases, and embedded content';

  private notion: Client;
  private turndownService: TurndownService;
  private accessToken: string;
  private refreshToken?: string;
  private expiresAt?: Date;
  private orgId?: string;
  private connectorId?: string;

  constructor(credentials: ConnectorCredentials, config?: { orgId: string; connectorId?: string }) {
    if (!credentials.accessToken) {
      throw new Error('Notion access token is required');
    }

    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt) : undefined;
    this.orgId = config?.orgId;
    this.connectorId = config?.connectorId;

    // Initialize Notion client
    this.notion = new Client({
      auth: this.accessToken,
    });

    // Initialize Turndown for HTML to Markdown conversion
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Configure Turndown rules
    this.configureTurndown();
  }

  /**
   * Configure Turndown service with custom rules for Notion-specific content
   */
  private configureTurndown(): void {
    // Handle code blocks
    this.turndownService.addRule('codeBlock', {
      filter: ['pre'],
      replacement: (content, node) => {
        const language = (node as HTMLElement).getAttribute('data-language') || '';
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
      },
    });

    // Handle callouts
    this.turndownService.addRule('callout', {
      filter: (node) => {
        return (
          node.nodeName === 'DIV' &&
          (node as HTMLElement).classList.contains('notion-callout')
        );
      },
      replacement: (content) => {
        return `\n> ${content}\n`;
      },
    });

    // Handle tables
    this.turndownService.addRule('table', {
      filter: ['table'],
      replacement: (content) => {
        return `\n${content}\n`;
      },
    });
  }

  /**
   * Authenticate with Notion and verify access
   */
  async authenticate(credentials?: ConnectorCredentials): Promise<AuthResult> {
    try {
      if (credentials) {
        this.accessToken = credentials.accessToken!;
        this.notion = new Client({ auth: this.accessToken });
      }

      // Test the connection by listing users
      const response = await this.notion.users.me({});

      return {
        success: true,
        userId: response.id,
        userName: this.extractUserName(response),
      };
    } catch (error: unknown) {
      console.error('[Notion] Authentication failed:', error);
      return {
        success: false,
        error: this.extractErrorMessage(error) || 'Failed to authenticate with Notion',
      };
    }
  }

  /**
   * Test if connection is working
   */
  async testConnection(): Promise<TestResult> {
    try {
      const authResult = await this.authenticate();

      if (!authResult.success) {
        return {
          success: false,
          message: authResult.error,
        };
      }

      // Try to search for pages to verify permissions
      const searchResult = await this.notion.search({
        filter: {
          property: 'object',
          value: 'page',
        },
        page_size: 1,
      });

      return {
        success: true,
        message: `Connected as ${authResult.userName}`,
        metadata: {
          userId: authResult.userId,
          canAccessPages: searchResult.results.length >= 0,
        },
      };
    } catch (error: unknown) {
      console.error('[Notion] Connection test failed:', error);
      return {
        success: false,
        message: this.extractErrorMessage(error) || 'Failed to connect to Notion',
      };
    }
  }

  /**
   * Sync pages and databases from Notion
   */
  async sync(options?: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      filesProcessed: 0,
      filesUpdated: 0,
      filesFailed: 0,
      filesDeleted: 0,
      errors: [],
    };

    try {
      console.log('[Notion Sync] Starting sync...', {
        fullSync: options?.fullSync,
        since: options?.since,
        limit: options?.limit,
      });

      // Search for pages and databases
      let hasMore = true;
      let startCursor: string | undefined;
      let processedCount = 0;

      while (hasMore && (!options?.limit || processedCount < options.limit)) {
        const searchParams: Record<string, unknown> = {
          page_size: Math.min(100, options?.limit ? options.limit - processedCount : 100),
        };

        if (startCursor) {
          searchParams.start_cursor = startCursor;
        }

        if (options?.since && !options?.fullSync) {
          searchParams.filter = {
            timestamp: 'last_edited_time',
            last_edited_time: {
              on_or_after: options.since.toISOString(),
            },
          };
        }

        const searchResult = await this.notion.search(searchParams as Parameters<Client['search']>[0]);

        // Process each result
        for (const item of searchResult.results) {
          try {
            if (item.object === 'page') {
              await this.processPage(item as unknown as NotionPage);
              result.filesProcessed++;
            } else if ((item.object as string) === 'database') {
              await this.processDatabase(item as unknown as NotionDatabase);
              result.filesProcessed++;
            }

            processedCount++;
          } catch (error: unknown) {
            console.error(`[Notion Sync] Failed to process ${item.object} ${item.id}:`, error);
            result.filesFailed++;
            result.errors.push({
              fileId: item.id,
              fileName: this.extractTitle(item),
              error: this.extractErrorMessage(error),
              retryable: true,
            });
          }
        }

        hasMore = searchResult.has_more;
        startCursor = searchResult.next_cursor || undefined;
      }

      // Mark as success if less than 10% failed
      result.success = result.filesFailed === 0 || result.filesFailed < result.filesProcessed * 0.1;

      console.log('[Notion Sync] Sync completed', {
        processed: result.filesProcessed,
        failed: result.filesFailed,
        success: result.success,
      });

      return result;
    } catch (error: unknown) {
      console.error('[Notion Sync] Sync failed:', error);
      result.success = false;
      result.errors.push({
        fileId: 'sync',
        fileName: 'Notion Sync',
        error: this.extractErrorMessage(error),
        retryable: true,
      });
      return result;
    }
  }

  /**
   * List available pages and databases
   */
  async listFiles(options?: ListOptions): Promise<ConnectorFile[]> {
    try {
      const files: ConnectorFile[] = [];
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      let hasMore = true;
      let startCursor: string | undefined;
      let count = 0;
      let skipped = 0;

      while (hasMore && count < limit) {
        const searchParams: Parameters<Client['search']>[0] = {
          page_size: Math.min(100, limit - count),
        };

        if (startCursor) {
          searchParams.start_cursor = startCursor;
        }

        const searchResult = await this.notion.search(searchParams);

        for (const item of searchResult.results) {
          // Skip offset
          if (skipped < offset) {
            skipped++;
            continue;
          }

          const file = this.convertToConnectorFile(item);
          if (file) {
            files.push(file);
            count++;
          }

          if (count >= limit) break;
        }

        hasMore = searchResult.has_more && count < limit;
        startCursor = searchResult.next_cursor || undefined;
      }

      return files;
    } catch (error: unknown) {
      console.error('[Notion] Failed to list files:', error);
      throw new Error(`Failed to list Notion files: ${this.extractErrorMessage(error)}`);
    }
  }

  /**
   * Download specific page or database content
   */
  async downloadFile(fileId: string): Promise<FileContent> {
    try {
      // Remove notion:// prefix if present
      const cleanId = fileId.replace('notion://', '').replace(/-/g, '');

      // Try to retrieve as page first
      try {
        const page = await this.notion.pages.retrieve({ page_id: cleanId });
        const content = await this.extractPageContent(cleanId);
        const title = this.extractTitle(page);

        return {
          id: page.id,
          title,
          content,
          mimeType: 'text/markdown',
          size: Buffer.byteLength(content, 'utf8'),
          metadata: {
            url: (page as NotionTitleSource).url,
            createdTime: (page as NotionTitleSource).created_time,
            lastEditedTime: (page as NotionTitleSource).last_edited_time,
            parent: (page as NotionTitleSource).parent,
          },
        };
      } catch {
        // Try as database
        const database = await this.notion.databases.retrieve({ database_id: cleanId });
        const content = await this.extractDatabaseContent(cleanId);
        const title = this.extractTitle(database);

        return {
          id: database.id,
          title,
          content,
          mimeType: 'text/markdown',
          size: Buffer.byteLength(content, 'utf8'),
          metadata: {
            url: (database as NotionTitleSource).url,
            createdTime: (database as NotionTitleSource).created_time,
            lastEditedTime: (database as NotionTitleSource).last_edited_time,
          },
        };
      }
    } catch (error: unknown) {
      console.error(`[Notion] Failed to download file ${fileId}:`, error);
      throw new Error(`Failed to download Notion file: ${this.extractErrorMessage(error)}`);
    }
  }

  /**
   * Refresh expired credentials (Notion tokens don't expire unless revoked)
   */
  async refreshCredentials(credentials: ConnectorCredentials): Promise<ConnectorCredentials> {
    // Notion access tokens don't expire, but we can test if they're still valid
    const authResult = await this.authenticate(credentials);

    if (!authResult.success) {
      throw new Error('Failed to refresh Notion credentials: ' + authResult.error);
    }

    return credentials;
  }

  /**
   * Process a Notion page and store it
   */
  private async processPage(page: NotionPage): Promise<void> {
    try {
      const title = this.extractTitle(page);
      const content = await this.extractPageContent(page.id);

      // Store in database
      await this.storeImportedDocument({
        externalId: `notion-page-${page.id}`,
        externalUrl: page.url,
        title,
        content,
        fileType: 'text/markdown',
        sourceMetadata: {
          notionId: page.id,
          objectType: 'page',
          createdTime: page.created_time,
          lastEditedTime: page.last_edited_time,
          parent: page.parent,
          properties: page.properties,
        } as Json,
      });

      console.log(`[Notion] Processed page: ${title}`);
    } catch (error: unknown) {
      console.error(`[Notion] Failed to process page ${page.id}:`, error);
      throw error;
    }
  }

  /**
   * Process a Notion database and store it
   */
  private async processDatabase(database: NotionDatabase): Promise<void> {
    try {
      const title = this.extractTitle(database);
      const content = await this.extractDatabaseContent(database.id);

      // Store in database
      await this.storeImportedDocument({
        externalId: `notion-database-${database.id}`,
        externalUrl: database.url,
        title,
        content,
        fileType: 'text/markdown',
        sourceMetadata: {
          notionId: database.id,
          objectType: 'database',
          createdTime: database.created_time,
          lastEditedTime: database.last_edited_time,
          properties: database.properties,
        } as Json,
      });

      console.log(`[Notion] Processed database: ${title}`);
    } catch (error: unknown) {
      console.error(`[Notion] Failed to process database ${database.id}:`, error);
      throw error;
    }
  }

  /**
   * Extract page content as markdown
   */
  private async extractPageContent(pageId: string): Promise<string> {
    const blocks = await this.getBlockChildren(pageId);
    return await this.blocksToMarkdown(blocks);
  }

  /**
   * Extract database content as markdown
   */
  private async extractDatabaseContent(databaseId: string): Promise<string> {
    const markdown: string[] = [];

    // Get database metadata
    const database = await this.notion.databases.retrieve({ database_id: databaseId });
    const title = this.extractTitle(database);
    markdown.push(`# ${title}\n`);

    // Get database pages
    let hasMore = true;
    let startCursor: string | undefined;
    const pages: NotionTitleSource[] = [];

    while (hasMore) {
      const queryParams: {
        database_id: string;
        page_size: number;
        start_cursor?: string;
      } = {
        database_id: databaseId,
        page_size: 100,
      };

      if (startCursor) {
        queryParams.start_cursor = startCursor;
      }

      const response = await (this.notion.databases as unknown as NotionDatabaseQueryClient).query(queryParams);
      pages.push(...(response.results as unknown as NotionTitleSource[]));

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    markdown.push(`\nFound ${pages.length} pages in this database.\n`);

    // Extract properties from each page
    for (const page of pages.slice(0, 50)) {
      // Limit to first 50 pages
      const pageTitle = this.extractTitle(page);
      markdown.push(`\n## ${pageTitle}\n`);

      // Extract page content
      try {
        if (page.id) {
          const content = await this.extractPageContent(page.id);
          markdown.push(content);
        }
      } catch (error) {
        console.error(`[Notion] Failed to extract page content for ${page.id}:`, error);
      }
    }

    return markdown.join('\n');
  }

  /**
   * Get all child blocks recursively
   */
  private async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
    const blocks: NotionBlock[] = [];
    let hasMore = true;
    let startCursor: string | undefined;

    while (hasMore) {
      const params: Parameters<Client['blocks']['children']['list']>[0] = {
        block_id: blockId,
        page_size: 100,
      };

      if (startCursor) {
        params.start_cursor = startCursor;
      }

      const response = await this.notion.blocks.children.list(params);
      blocks.push(...(response.results as NotionBlock[]));

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    // Get children of blocks that have children
    for (const block of blocks) {
      if (block.has_children) {
        try {
          const children = await this.getBlockChildren(block.id);
          block.children = children;
        } catch (error) {
          console.error(`[Notion] Failed to get children for block ${block.id}:`, error);
        }
      }
    }

    return blocks;
  }

  /**
   * Convert Notion blocks to Markdown
   */
  private async blocksToMarkdown(blocks: NotionBlock[], indent: number = 0): Promise<string> {
    const markdown: string[] = [];

    for (const block of blocks) {
      try {
        const blockMarkdown = await this.blockToMarkdown(block, indent);
        if (blockMarkdown) {
          markdown.push(blockMarkdown);
        }
      } catch (error) {
        console.error(`[Notion] Failed to convert block ${block.id} to markdown:`, error);
      }
    }

    return markdown.join('\n');
  }

  /**
   * Convert single Notion block to Markdown
   */
  private async blockToMarkdown(block: NotionBlock, indent: number = 0): Promise<string> {
    const indentStr = '  '.repeat(indent);
    const type = block.type;
    const blockData = block[type] as NotionBlockData | undefined;

    if (!blockData) {
      return '';
    }

    let markdown = '';

    switch (type) {
      case 'paragraph':
        markdown = indentStr + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'heading_1':
        markdown = indentStr + '# ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'heading_2':
        markdown = indentStr + '## ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'heading_3':
        markdown = indentStr + '### ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'bulleted_list_item':
        markdown = indentStr + '- ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'numbered_list_item':
        markdown = indentStr + '1. ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'to_do': {
        const checked = blockData.checked ? 'x' : ' ';
        markdown = indentStr + `- [${checked}] ` + this.extractRichText(blockData.rich_text) + '\n';
        break;
      }

      case 'toggle':
        markdown = indentStr + '<details>\n';
        markdown += indentStr + '<summary>' + this.extractRichText(blockData.rich_text) + '</summary>\n';
        if (block.children) {
          markdown += await this.blocksToMarkdown(block.children, indent + 1);
        }
        markdown += indentStr + '</details>\n';
        break;

      case 'quote':
        markdown = indentStr + '> ' + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'callout':
        markdown = indentStr + '> ' + (blockData.icon?.emoji || '💡') + ' ';
        markdown += this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'code': {
        const language = blockData.language || '';
        markdown = indentStr + '```' + language + '\n';
        markdown += indentStr + this.extractRichText(blockData.rich_text) + '\n';
        markdown += indentStr + '```\n';
        break;
      }

      case 'divider':
        markdown = indentStr + '---\n';
        break;

      case 'image': {
        const imageUrl = this.extractFileUrl(blockData);
        const imageCaption = this.extractRichText(blockData.caption || []);
        markdown = indentStr + `![${imageCaption}](${imageUrl})\n`;
        break;
      }

      case 'video': {
        const videoUrl = this.extractFileUrl(blockData);
        markdown = indentStr + `[Video: ${videoUrl}](${videoUrl})\n`;
        break;
      }

      case 'file': {
        const fileUrl = this.extractFileUrl(blockData);
        const fileName = this.extractRichText(blockData.caption || []) || 'File';
        markdown = indentStr + `[${fileName}](${fileUrl})\n`;
        break;
      }

      case 'pdf': {
        const pdfUrl = this.extractFileUrl(blockData);
        markdown = indentStr + `[PDF Document](${pdfUrl})\n`;
        break;
      }

      case 'bookmark': {
        const bookmarkUrl = blockData.url;
        const bookmarkCaption = this.extractRichText(blockData.caption || []);
        markdown = indentStr + `[${bookmarkCaption || bookmarkUrl}](${bookmarkUrl})\n`;
        break;
      }

      case 'embed': {
        const embedUrl = blockData.url;
        markdown = indentStr + `[Embedded Content](${embedUrl})\n`;
        break;
      }

      case 'table':
        // Tables require special handling
        markdown = await this.extractTable(block);
        break;

      case 'column_list':
        // Process columns
        if (block.children) {
          markdown += await this.blocksToMarkdown(block.children, indent);
        }
        break;

      case 'column':
        // Process column content
        if (block.children) {
          markdown += await this.blocksToMarkdown(block.children, indent);
        }
        break;

      default:
        // Handle unknown block types
        if (blockData.rich_text) {
          markdown = indentStr + this.extractRichText(blockData.rich_text) + '\n';
        }
    }

    // Add children if not already processed
    if (
      block.children &&
      !['toggle', 'column_list', 'column'].includes(type)
    ) {
      markdown += await this.blocksToMarkdown(block.children, indent + 1);
    }

    return markdown;
  }

  /**
   * Extract plain text from Notion rich text array
   */
  private extractRichText(richText?: NotionRichText[]): string {
    if (!richText || !Array.isArray(richText)) {
      return '';
    }

    return richText
      .map((text) => {
        let content = text.plain_text || '';

        // Apply formatting
        if (text.annotations) {
          if (text.annotations.bold) content = `**${content}**`;
          if (text.annotations.italic) content = `*${content}*`;
          if (text.annotations.strikethrough) content = `~~${content}~~`;
          if (text.annotations.code) content = `\`${content}\``;
        }

        // Handle links
        if (text.href) {
          content = `[${content}](${text.href})`;
        }

        return content;
      })
      .join('');
  }

  /**
   * Extract file URL from Notion file object
   */
  private extractFileUrl(fileData: NotionFileData): string {
    if (fileData.type === 'external') {
      return fileData.external?.url || '';
    } else if (fileData.type === 'file') {
      return fileData.file?.url || '';
    } else if (fileData.url) {
      return fileData.url;
    }
    return '';
  }

  /**
   * Extract table content as markdown
   */
  private async extractTable(tableBlock: NotionBlock): Promise<string> {
    const markdown: string[] = [];
    const tableData = tableBlock.table as { has_column_header?: boolean } | undefined;

    if (!tableBlock.children || tableBlock.children.length === 0) {
      return '';
    }

    const rows = tableBlock.children;
    const hasColumnHeader = tableData?.has_column_header;

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.type === 'table_row') {
        const tableRow = row.table_row as { cells?: NotionRichText[][] } | undefined;
        const cells = tableRow?.cells || [];
        const cellContent = cells.map((cell) => this.extractRichText(cell)).join(' | ');
        markdown.push('| ' + cellContent + ' |');

        // Add separator after header row
        if (i === 0 && hasColumnHeader) {
          const separator = cells.map(() => '---').join(' | ');
          markdown.push('| ' + separator + ' |');
        }
      }
    }

    return markdown.join('\n') + '\n';
  }

  /**
   * Extract title from page/database object
   */
  private extractTitle(item: unknown): string {
    if (!this.isRecord(item)) return 'Untitled';

    const titleSource = item as NotionTitleSource;
    if (!item) return 'Untitled';

    // For databases
    if (titleSource.title && Array.isArray(titleSource.title)) {
      return this.extractRichText(titleSource.title) || 'Untitled';
    }

    // For pages
    if (titleSource.properties) {
      // Look for title property
      const titleProp = Object.values(titleSource.properties).find((prop) => prop.type === 'title');
      if (titleProp?.title) {
        return this.extractRichText(titleProp.title) || 'Untitled';
      }

      // Fallback to Name property
      if (titleSource.properties.Name?.title) {
        return this.extractRichText(titleSource.properties.Name.title) || 'Untitled';
      }
    }

    return 'Untitled';
  }

  /**
   * Extract user name from user object
   */
  private extractUserName(user: unknown): string {
    if (!this.isRecord(user)) return 'Unknown User';
    if (typeof user.name === 'string') return user.name;
    if (this.isRecord(user.person) && typeof user.person.email === 'string') return user.person.email;
    if (
      this.isRecord(user.bot) &&
      this.isRecord(user.bot.owner) &&
      this.isRecord(user.bot.owner.user) &&
      typeof user.bot.owner.user.name === 'string'
    ) {
      return user.bot.owner.user.name;
    }
    return 'Unknown User';
  }

  /**
   * Convert Notion item to ConnectorFile format
   */
  private convertToConnectorFile(item: unknown): ConnectorFile | null {
    try {
      if (!this.isRecord(item) || typeof item.id !== 'string') {
        return null;
      }

      const notionItem = item as NotionTitleSource;
      const file: ConnectorFile = {
        id: item.id,
        name: this.extractTitle(item),
        type: typeof notionItem.object === 'string' ? notionItem.object : 'notion',
        mimeType: 'text/markdown',
        modifiedAt: new Date(notionItem.last_edited_time || Date.now()),
        createdAt: new Date(notionItem.created_time || Date.now()),
        url: notionItem.url,
        metadata: {
          notionId: item.id,
          objectType: notionItem.object,
          parent: notionItem.parent,
        },
      };

      return file;
    } catch (error) {
      console.error('[Notion] Failed to convert item to ConnectorFile:', error);
      return null;
    }
  }

  /**
   * Store imported document in database
   */
  private async storeImportedDocument(doc: {
    externalId: string;
    externalUrl?: string;
    title: string;
    content: string;
    fileType: string;
    sourceMetadata: Json;
  }): Promise<void> {
    if (!this.orgId) {
      console.warn('[Notion] No orgId provided, skipping document storage');
      return;
    }

    if (!this.connectorId) {
      throw new Error('Notion connector ID is required to store imported documents');
    }

    try {
      const supabase = createClient();

      // Calculate content hash for deduplication
      const contentHash = await this.hashContent(doc.content);

      // Check if document already exists
      const { data: existing } = await supabase
        .from('imported_documents')
        .select('id, content_hash, sync_count')
        .eq('connector_id', this.connectorId)
        .eq('external_id', doc.externalId)
        .single();

      const now = new Date().toISOString();

      if (existing) {
        // Update if content changed
        if (existing.content_hash !== contentHash) {
          await supabase
            .from('imported_documents')
            .update({
              title: doc.title,
              content: doc.content,
              content_hash: contentHash,
              external_url: doc.externalUrl,
              file_type: doc.fileType,
              file_size: Buffer.byteLength(doc.content, 'utf8'),
              source_metadata: doc.sourceMetadata,
              last_synced_at: now,
              sync_count: ((existing as ImportedDocumentRow).sync_count || 0) + 1,
              processing_status: 'pending',
              chunks_generated: false,
              embeddings_generated: false,
            })
            .eq('id', existing.id);

          console.log(`[Notion] Updated document: ${doc.title}`);
        } else {
          // Just update sync timestamp
          await supabase
            .from('imported_documents')
            .update({
              last_synced_at: now,
              sync_count: ((existing as ImportedDocumentRow).sync_count || 0) + 1,
            })
            .eq('id', existing.id);
        }
      } else {
        // Insert new document
        await supabase.from('imported_documents').insert({
          connector_id: this.connectorId,
          org_id: this.orgId,
          external_id: doc.externalId,
          external_url: doc.externalUrl,
          title: doc.title,
          content: doc.content,
          content_hash: contentHash,
          file_type: doc.fileType,
          file_size: Buffer.byteLength(doc.content, 'utf8'),
          source_metadata: doc.sourceMetadata,
          processing_status: 'pending',
          chunks_generated: false,
          embeddings_generated: false,
          first_synced_at: now,
          last_synced_at: now,
          sync_count: 1,
        });

        console.log(`[Notion] Inserted new document: ${doc.title}`);
      }
    } catch (error: unknown) {
      console.error('[Notion] Failed to store imported document:', error);
      throw error;
    }
  }

  private extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private isRecord(value: unknown): value is NotionRecord {
    return typeof value === 'object' && value !== null;
  }

  /**
   * Calculate hash of content for deduplication
   */
  private async hashContent(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
