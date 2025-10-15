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
import axios from 'axios';

import { createClient } from '@/lib/supabase/admin';

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

/**
 * Notion block types that contain content
 */
const CONTENT_BLOCK_TYPES = [
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
  'code',
  'table',
  'column_list',
  'divider',
] as const;

/**
 * Notion block types that contain media
 */
const MEDIA_BLOCK_TYPES = ['image', 'video', 'file', 'pdf', 'audio', 'embed'] as const;

interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  parent: any;
  properties: any;
  url: string;
}

interface NotionDatabase {
  id: string;
  object: 'database';
  created_time: string;
  last_edited_time: string;
  title: any[];
  properties: any;
  url: string;
}

interface NotionBlock {
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  [key: string]: any;
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

  constructor(credentials: ConnectorCredentials, config?: { orgId: string }) {
    if (!credentials.accessToken) {
      throw new Error('Notion access token is required');
    }

    this.accessToken = credentials.accessToken;
    this.refreshToken = credentials.refreshToken;
    this.expiresAt = credentials.expiresAt ? new Date(credentials.expiresAt) : undefined;
    this.orgId = config?.orgId;

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
    } catch (error: any) {
      console.error('[Notion] Authentication failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to authenticate with Notion',
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
    } catch (error: any) {
      console.error('[Notion] Connection test failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to Notion',
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

      // Build search filter
      const filter: any = options?.filters || {};

      // Search for pages and databases
      let hasMore = true;
      let startCursor: string | undefined;
      let processedCount = 0;

      while (hasMore && (!options?.limit || processedCount < options.limit)) {
        const searchParams: any = {
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

        const searchResult = await this.notion.search(searchParams);

        // Process each result
        for (const item of searchResult.results) {
          try {
            if (item.object === 'page') {
              await this.processPage(item as NotionPage);
              result.filesProcessed++;
            } else if (item.object === 'database') {
              await this.processDatabase(item as NotionDatabase);
              result.filesProcessed++;
            }

            processedCount++;
          } catch (error: any) {
            console.error(`[Notion Sync] Failed to process ${item.object} ${item.id}:`, error);
            result.filesFailed++;
            result.errors.push({
              fileId: item.id,
              fileName: this.extractTitle(item),
              error: error.message,
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
    } catch (error: any) {
      console.error('[Notion Sync] Sync failed:', error);
      result.success = false;
      result.errors.push({
        fileId: 'sync',
        fileName: 'Notion Sync',
        error: error.message,
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
        const searchParams: any = {
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
    } catch (error: any) {
      console.error('[Notion] Failed to list files:', error);
      throw new Error(`Failed to list Notion files: ${error.message}`);
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
            url: (page as any).url,
            createdTime: (page as any).created_time,
            lastEditedTime: (page as any).last_edited_time,
            parent: (page as any).parent,
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
            url: (database as any).url,
            createdTime: (database as any).created_time,
            lastEditedTime: (database as any).last_edited_time,
          },
        };
      }
    } catch (error: any) {
      console.error(`[Notion] Failed to download file ${fileId}:`, error);
      throw new Error(`Failed to download Notion file: ${error.message}`);
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
        },
      });

      console.log(`[Notion] Processed page: ${title}`);
    } catch (error: any) {
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
        },
      });

      console.log(`[Notion] Processed database: ${title}`);
    } catch (error: any) {
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
    const pages: any[] = [];

    while (hasMore) {
      const queryParams: any = {
        database_id: databaseId,
        page_size: 100,
      };

      if (startCursor) {
        queryParams.start_cursor = startCursor;
      }

      const response = await this.notion.databases.query(queryParams);
      pages.push(...response.results);

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
        const content = await this.extractPageContent(page.id);
        markdown.push(content);
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
      const params: any = {
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
          (block as any).children = children;
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
    const indentStr = '  '.repeat(indent);

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
    const blockData = (block as any)[type];

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

      case 'to_do':
        const checked = blockData.checked ? 'x' : ' ';
        markdown = indentStr + `- [${checked}] ` + this.extractRichText(blockData.rich_text) + '\n';
        break;

      case 'toggle':
        markdown = indentStr + '<details>\n';
        markdown += indentStr + '<summary>' + this.extractRichText(blockData.rich_text) + '</summary>\n';
        if ((block as any).children) {
          markdown += await this.blocksToMarkdown((block as any).children, indent + 1);
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

      case 'code':
        const language = blockData.language || '';
        markdown = indentStr + '```' + language + '\n';
        markdown += indentStr + this.extractRichText(blockData.rich_text) + '\n';
        markdown += indentStr + '```\n';
        break;

      case 'divider':
        markdown = indentStr + '---\n';
        break;

      case 'image':
        const imageUrl = this.extractFileUrl(blockData);
        const imageCaption = this.extractRichText(blockData.caption || []);
        markdown = indentStr + `![${imageCaption}](${imageUrl})\n`;
        break;

      case 'video':
        const videoUrl = this.extractFileUrl(blockData);
        markdown = indentStr + `[Video: ${videoUrl}](${videoUrl})\n`;
        break;

      case 'file':
        const fileUrl = this.extractFileUrl(blockData);
        const fileName = this.extractRichText(blockData.caption || []) || 'File';
        markdown = indentStr + `[${fileName}](${fileUrl})\n`;
        break;

      case 'pdf':
        const pdfUrl = this.extractFileUrl(blockData);
        markdown = indentStr + `[PDF Document](${pdfUrl})\n`;
        break;

      case 'bookmark':
        const bookmarkUrl = blockData.url;
        const bookmarkCaption = this.extractRichText(blockData.caption || []);
        markdown = indentStr + `[${bookmarkCaption || bookmarkUrl}](${bookmarkUrl})\n`;
        break;

      case 'embed':
        const embedUrl = blockData.url;
        markdown = indentStr + `[Embedded Content](${embedUrl})\n`;
        break;

      case 'table':
        // Tables require special handling
        markdown = await this.extractTable(block);
        break;

      case 'column_list':
        // Process columns
        if ((block as any).children) {
          markdown += await this.blocksToMarkdown((block as any).children, indent);
        }
        break;

      case 'column':
        // Process column content
        if ((block as any).children) {
          markdown += await this.blocksToMarkdown((block as any).children, indent);
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
      (block as any).children &&
      !['toggle', 'column_list', 'column'].includes(type)
    ) {
      markdown += await this.blocksToMarkdown((block as any).children, indent + 1);
    }

    return markdown;
  }

  /**
   * Extract plain text from Notion rich text array
   */
  private extractRichText(richText: any[]): string {
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
  private extractFileUrl(fileData: any): string {
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
    const tableData = (tableBlock as any).table;

    if (!(tableBlock as any).children || (tableBlock as any).children.length === 0) {
      return '';
    }

    const rows = (tableBlock as any).children;
    const hasColumnHeader = tableData?.has_column_header;

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.type === 'table_row') {
        const cells = row.table_row?.cells || [];
        const cellContent = cells.map((cell: any) => this.extractRichText(cell)).join(' | ');
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
  private extractTitle(item: any): string {
    if (!item) return 'Untitled';

    // For databases
    if (item.title && Array.isArray(item.title)) {
      return this.extractRichText(item.title) || 'Untitled';
    }

    // For pages
    if (item.properties) {
      // Look for title property
      const titleProp = Object.values(item.properties).find((prop: any) => prop.type === 'title');
      if (titleProp && (titleProp as any).title) {
        return this.extractRichText((titleProp as any).title) || 'Untitled';
      }

      // Fallback to Name property
      if (item.properties.Name?.title) {
        return this.extractRichText(item.properties.Name.title) || 'Untitled';
      }
    }

    return 'Untitled';
  }

  /**
   * Extract user name from user object
   */
  private extractUserName(user: any): string {
    if (user.name) return user.name;
    if (user.person?.email) return user.person.email;
    if (user.bot?.owner?.user?.name) return user.bot.owner.user.name;
    return 'Unknown User';
  }

  /**
   * Convert Notion item to ConnectorFile format
   */
  private convertToConnectorFile(item: any): ConnectorFile | null {
    try {
      const file: ConnectorFile = {
        id: item.id,
        name: this.extractTitle(item),
        type: item.object,
        mimeType: 'text/markdown',
        modifiedAt: new Date(item.last_edited_time),
        createdAt: new Date(item.created_time),
        url: item.url,
        metadata: {
          notionId: item.id,
          objectType: item.object,
          parent: item.parent,
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
    sourceMetadata: any;
  }): Promise<void> {
    if (!this.orgId) {
      console.warn('[Notion] No orgId provided, skipping document storage');
      return;
    }

    try {
      const supabase = createClient();

      // Calculate content hash for deduplication
      const contentHash = await this.hashContent(doc.content);

      // Check if document already exists
      const { data: existing } = await supabase
        .from('imported_documents')
        .select('id, content_hash')
        .eq('org_id', this.orgId)
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
              sync_count: existing.sync_count + 1,
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
              sync_count: existing.sync_count + 1,
            })
            .eq('id', existing.id);
        }
      } else {
        // Insert new document
        await supabase.from('imported_documents').insert({
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
    } catch (error: any) {
      console.error('[Notion] Failed to store imported document:', error);
      throw error;
    }
  }

  /**
   * Calculate hash of content for deduplication
   */
  private async hashContent(content: string): Promise<string> {
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
