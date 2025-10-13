/**
 * Notion Connector Tests
 *
 * Tests OAuth authentication, page/database listing, block content extraction,
 * markdown conversion, and hierarchical structure preservation.
 */

import { NotionConnector } from '@/lib/connectors/notion';
import {
  ConnectorCredentials,
  SyncOptions,
} from '@/lib/connectors/base';

// Mock @notionhq/client
jest.mock('@notionhq/client');
import { Client } from '@notionhq/client';

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { createClient } from '@/lib/supabase/admin';

// Mock Turndown
jest.mock('turndown');

describe('NotionConnector', () => {
  let connector: NotionConnector;
  let mockNotionClient: any;
  let mockSupabase: any;

  const mockCredentials: ConnectorCredentials = {
    accessToken: 'mock-notion-token',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Notion client
    mockNotionClient = {
      users: {
        me: jest.fn().mockResolvedValue({
          id: 'user-123',
          name: 'Test User',
          type: 'person',
          person: { email: 'test@example.com' },
        }),
      },
      search: jest.fn(),
      pages: {
        retrieve: jest.fn(),
      },
      databases: {
        retrieve: jest.fn(),
        query: jest.fn(),
      },
      blocks: {
        children: {
          list: jest.fn(),
        },
      },
    };

    (Client as jest.Mock).mockImplementation(() => mockNotionClient);

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Constructor', () => {
    it('should initialize with credentials', () => {
      connector = new NotionConnector(mockCredentials);
      expect(connector.type).toBe('notion');
      expect(connector.name).toBe('Notion');
    });

    it('should throw error when no access token', () => {
      expect(() => new NotionConnector({})).toThrow(
        'Notion access token is required'
      );
    });

    it('should initialize with org ID config', () => {
      connector = new NotionConnector(mockCredentials, { orgId: 'org-123' });
      expect(connector).toBeDefined();
    });
  });

  describe('authenticate()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should authenticate successfully', async () => {
      const result = await connector.authenticate();

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.userName).toBe('Test User');
      expect(mockNotionClient.users.me).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      mockNotionClient.users.me.mockRejectedValue(
        new Error('Invalid token')
      );

      const result = await connector.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('should re-authenticate with new credentials', async () => {
      const newCredentials: ConnectorCredentials = {
        accessToken: 'new-token',
      };

      const result = await connector.authenticate(newCredentials);

      expect(result.success).toBe(true);
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should test connection successfully', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [],
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected as');
      expect(mockNotionClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { property: 'object', value: 'page' },
        })
      );
    });

    it('should handle connection test failure', async () => {
      mockNotionClient.users.me.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials, { orgId: 'org-123' });
    });

    it('should sync pages successfully', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            created_time: '2024-01-01T00:00:00Z',
            last_edited_time: '2024-01-02T00:00:00Z',
            url: 'https://notion.so/page-1',
            properties: {
              title: {
                type: 'title',
                title: [{ plain_text: 'Test Page' }],
              },
            },
          },
        ],
        has_more: false,
      });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-1',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ plain_text: 'Test content' }],
            },
            has_children: false,
          },
        ],
        has_more: false,
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
      expect(result.filesFailed).toBe(0);
    });

    it('should sync databases', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          {
            id: 'db-1',
            object: 'database',
            created_time: '2024-01-01T00:00:00Z',
            last_edited_time: '2024-01-02T00:00:00Z',
            title: [{ plain_text: 'Test Database' }],
            properties: {},
          },
        ],
        has_more: false,
      });

      mockNotionClient.databases.retrieve.mockResolvedValue({
        id: 'db-1',
        title: [{ plain_text: 'Test Database' }],
      });

      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
        has_more: false,
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(1);
    });

    it('should handle pagination', async () => {
      mockNotionClient.search
        .mockResolvedValueOnce({
          results: [
            {
              id: 'page-1',
              object: 'page',
              properties: {
                title: { type: 'title', title: [{ plain_text: 'Page 1' }] },
              },
            },
          ],
          has_more: true,
          next_cursor: 'cursor-1',
        })
        .mockResolvedValueOnce({
          results: [
            {
              id: 'page-2',
              object: 'page',
              properties: {
                title: { type: 'title', title: [{ plain_text: 'Page 2' }] },
              },
            },
          ],
          has_more: false,
        });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [],
        has_more: false,
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(mockNotionClient.search).toHaveBeenCalledTimes(2);
      expect(result.filesProcessed).toBe(2);
    });

    it('should sync with since filter', async () => {
      const sinceDate = new Date('2024-01-01');

      mockNotionClient.search.mockResolvedValue({
        results: [],
        has_more: false,
      });

      await connector.sync({ since: sinceDate });

      expect(mockNotionClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            timestamp: 'last_edited_time',
          }),
        })
      );
    });

    it('should handle sync with limit', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [],
        has_more: false,
      });

      await connector.sync({ limit: 10 });

      expect(mockNotionClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          page_size: 10,
        })
      );
    });

    it('should handle partial failures', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            properties: {
              title: { type: 'title', title: [{ plain_text: 'Page 1' }] },
            },
          },
          {
            id: 'page-2',
            object: 'page',
            properties: {
              title: { type: 'title', title: [{ plain_text: 'Page 2' }] },
            },
          },
        ],
        has_more: false,
      });

      mockNotionClient.blocks.children.list
        .mockResolvedValueOnce({ results: [], has_more: false })
        .mockRejectedValueOnce(new Error('Failed to fetch blocks'));

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(2);
      expect(result.filesFailed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('listFiles()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should list pages and databases', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: [
          {
            id: 'page-1',
            object: 'page',
            created_time: '2024-01-01T00:00:00Z',
            last_edited_time: '2024-01-02T00:00:00Z',
            url: 'https://notion.so/page-1',
            properties: {
              title: { type: 'title', title: [{ plain_text: 'Test Page' }] },
            },
            parent: { type: 'workspace', workspace: true },
          },
        ],
        has_more: false,
      });

      const files = await connector.listFiles();

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        id: 'page-1',
        name: 'Test Page',
        type: 'page',
        mimeType: 'text/markdown',
        url: 'https://notion.so/page-1',
      });
    });

    it('should list with limit and offset', async () => {
      mockNotionClient.search.mockResolvedValue({
        results: Array.from({ length: 20 }, (_, i) => ({
          id: `page-${i}`,
          object: 'page',
          created_time: '2024-01-01T00:00:00Z',
          last_edited_time: '2024-01-02T00:00:00Z',
          properties: {
            title: { type: 'title', title: [{ plain_text: `Page ${i}` }] },
          },
        })),
        has_more: false,
      });

      const files = await connector.listFiles({ limit: 5, offset: 10 });

      expect(files).toHaveLength(5);
      expect(files[0].name).toBe('Page 10');
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should download page content', async () => {
      mockNotionClient.pages.retrieve.mockResolvedValue({
        id: 'page-1',
        object: 'page',
        created_time: '2024-01-01T00:00:00Z',
        last_edited_time: '2024-01-02T00:00:00Z',
        url: 'https://notion.so/page-1',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Test Page' }] },
        },
      });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-1',
            type: 'heading_1',
            heading_1: {
              rich_text: [{ plain_text: 'Heading' }],
            },
            has_children: false,
          },
          {
            id: 'block-2',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ plain_text: 'Content' }],
            },
            has_children: false,
          },
        ],
        has_more: false,
      });

      const fileContent = await connector.downloadFile('page-1');

      expect(fileContent.id).toBe('page-1');
      expect(fileContent.title).toBe('Test Page');
      expect(fileContent.mimeType).toBe('text/markdown');
      expect(typeof fileContent.content).toBe('string');
      expect(fileContent.content).toContain('# Heading');
    });

    it('should download database content', async () => {
      mockNotionClient.pages.retrieve.mockRejectedValue(
        new Error('Not a page')
      );

      mockNotionClient.databases.retrieve.mockResolvedValue({
        id: 'db-1',
        object: 'database',
        created_time: '2024-01-01T00:00:00Z',
        last_edited_time: '2024-01-02T00:00:00Z',
        title: [{ plain_text: 'Test Database' }],
      });

      mockNotionClient.databases.query.mockResolvedValue({
        results: [],
        has_more: false,
      });

      const fileContent = await connector.downloadFile('db-1');

      expect(fileContent.id).toBe('db-1');
      expect(fileContent.title).toBe('Test Database');
    });

    it('should handle nested blocks', async () => {
      mockNotionClient.pages.retrieve.mockResolvedValue({
        id: 'page-1',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Page' }] },
        },
      });

      mockNotionClient.blocks.children.list
        .mockResolvedValueOnce({
          results: [
            {
              id: 'block-1',
              type: 'toggle',
              toggle: {
                rich_text: [{ plain_text: 'Toggle' }],
              },
              has_children: true,
            },
          ],
          has_more: false,
        })
        .mockResolvedValueOnce({
          results: [
            {
              id: 'block-2',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ plain_text: 'Nested content' }],
              },
              has_children: false,
            },
          ],
          has_more: false,
        });

      const fileContent = await connector.downloadFile('page-1');

      expect(fileContent.content).toContain('Toggle');
      expect(fileContent.content).toContain('Nested content');
      expect(mockNotionClient.blocks.children.list).toHaveBeenCalledTimes(2);
    });
  });

  describe('refreshCredentials()', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should validate existing credentials', async () => {
      const refreshed = await connector.refreshCredentials(mockCredentials);

      expect(refreshed).toEqual(mockCredentials);
      expect(mockNotionClient.users.me).toHaveBeenCalled();
    });

    it('should throw error on invalid credentials', async () => {
      mockNotionClient.users.me.mockRejectedValue(
        new Error('Invalid token')
      );

      await expect(
        connector.refreshCredentials(mockCredentials)
      ).rejects.toThrow('Failed to refresh Notion credentials');
    });
  });

  describe('Block Conversion', () => {
    beforeEach(() => {
      connector = new NotionConnector(mockCredentials);
    });

    it('should convert code blocks', async () => {
      mockNotionClient.pages.retrieve.mockResolvedValue({
        id: 'page-1',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Page' }] },
        },
      });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-1',
            type: 'code',
            code: {
              rich_text: [{ plain_text: 'console.log("test")' }],
              language: 'javascript',
            },
            has_children: false,
          },
        ],
        has_more: false,
      });

      const fileContent = await connector.downloadFile('page-1');

      expect(fileContent.content).toContain('```javascript');
      expect(fileContent.content).toContain('console.log("test")');
    });

    it('should convert tables', async () => {
      mockNotionClient.pages.retrieve.mockResolvedValue({
        id: 'page-1',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Page' }] },
        },
      });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'table-1',
            type: 'table',
            table: { has_column_header: true },
            has_children: true,
          },
        ],
        has_more: false,
      });

      // Mock table row children
      mockNotionClient.blocks.children.list.mockResolvedValueOnce({
        results: [
          {
            id: 'row-1',
            type: 'table_row',
            table_row: {
              cells: [
                [{ plain_text: 'Header 1' }],
                [{ plain_text: 'Header 2' }],
              ],
            },
          },
          {
            id: 'row-2',
            type: 'table_row',
            table_row: {
              cells: [[{ plain_text: 'Cell 1' }], [{ plain_text: 'Cell 2' }]],
            },
          },
        ],
        has_more: false,
      });

      const fileContent = await connector.downloadFile('page-1');

      expect(fileContent.content).toContain('|');
    });

    it('should handle rich text formatting', async () => {
      mockNotionClient.pages.retrieve.mockResolvedValue({
        id: 'page-1',
        properties: {
          title: { type: 'title', title: [{ plain_text: 'Page' }] },
        },
      });

      mockNotionClient.blocks.children.list.mockResolvedValue({
        results: [
          {
            id: 'block-1',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  plain_text: 'bold text',
                  annotations: { bold: true },
                },
                {
                  plain_text: 'italic text',
                  annotations: { italic: true },
                },
                {
                  plain_text: 'code',
                  annotations: { code: true },
                },
                {
                  plain_text: 'link',
                  href: 'https://example.com',
                },
              ],
            },
            has_children: false,
          },
        ],
        has_more: false,
      });

      const fileContent = await connector.downloadFile('page-1');

      expect(fileContent.content).toContain('**bold text**');
      expect(fileContent.content).toContain('*italic text*');
      expect(fileContent.content).toContain('`code`');
      expect(fileContent.content).toContain('[link](https://example.com)');
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limiting', async () => {
      connector = new NotionConnector(mockCredentials, { orgId: 'org-123' });

      const rateLimitError = new Error('Rate limited') as any;
      rateLimitError.code = 'rate_limited';

      mockNotionClient.search.mockRejectedValue(rateLimitError);

      const result = await connector.sync();

      expect(result.success).toBe(false);
      expect(result.errors[0].retryable).toBe(true);
    });
  });
});
