/**
 * URL Import Connector Tests
 *
 * Tests web page fetching, HTML parsing, markdown conversion, and content extraction.
 */

import { URLImportConnector } from '@/lib/connectors/url-import';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { supabaseAdmin } from '@/lib/supabase/admin';

// Mock Turndown
jest.mock('turndown');

describe('URLImportConnector', () => {
  let connector: URLImportConnector;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase storage
    mockStorage = {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ error: null }),
    };

    (supabaseAdmin as any).storage = mockStorage;

    // Default axios mocks
    mockedAxios.get = jest.fn();
    mockedAxios.head = jest.fn();
    mockedAxios.isAxiosError = jest.fn().mockReturnValue(false);
  });

  describe('Constructor', () => {
    it('should initialize with org ID', () => {
      connector = new URLImportConnector({ orgId: 'org-123' });
      expect(connector.type).toBe('url_import');
      expect(connector.name).toBe('URL Import');
    });
  });

  describe('authenticate()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should always authenticate successfully', async () => {
      const result = await connector.authenticate({});
      expect(result.success).toBe(true);
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should test connection successfully', async () => {
      mockedAxios.head.mockResolvedValue({ status: 200 });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('URL fetching is working');
    });

    it('should handle connection errors', async () => {
      mockedAxios.head.mockRejectedValue(new Error('Network error'));

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Network error');
    });
  });

  describe('addURL()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should add valid HTTP URL', async () => {
      const result = await connector.addURL('https://example.com');

      expect(result.success).toBe(true);
      expect(result.urlId).toBeDefined();
    });

    it('should add valid HTTPS URL', async () => {
      const result = await connector.addURL('https://example.com/page');

      expect(result.success).toBe(true);
    });

    it('should reject invalid URL format', async () => {
      const result = await connector.addURL('not-a-url');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid URL format');
    });

    it('should reject non-HTTP protocols', async () => {
      const result = await connector.addURL('ftp://example.com');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP and HTTPS');
    });

    it('should add URL with extraction options', async () => {
      const result = await connector.addURL('https://example.com', {
        includeImages: true,
        includeLinks: false,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({
        orgId: 'org-123',
        batchId: 'batch-123',
      });
    });

    it('should fetch and convert URLs to markdown', async () => {
      await connector.addURL('https://example.com');

      const htmlResponse = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <article>
              <h1>Main Heading</h1>
              <p>Paragraph content</p>
            </article>
          </body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({
        data: htmlResponse,
        headers: { 'content-type': 'text/html' },
      });

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
      expect(result.filesUpdated).toBe(1);
      expect(mockStorage.upload).toHaveBeenCalled();
    });

    it('should handle fetch errors', async () => {
      await connector.addURL('https://example.com');

      mockedAxios.get.mockRejectedValue(new Error('404 Not Found'));

      const result = await connector.sync();

      expect(result.success).toBe(false);
      expect(result.filesFailed).toBe(1);
      expect(result.errors[0].error).toContain('Not Found');
    });

    it('should apply limit option', async () => {
      await connector.addURL('https://example.com/1');
      await connector.addURL('https://example.com/2');
      await connector.addURL('https://example.com/3');

      mockedAxios.get.mockResolvedValue({
        data: '<html><body>Content</body></html>',
      });

      const result = await connector.sync({ limit: 2 });

      expect(result.filesProcessed).toBe(2);
    });

    it('should extract metadata from HTML', async () => {
      await connector.addURL('https://example.com');

      const htmlResponse = `
        <html>
          <head>
            <title>Page Title</title>
            <meta name="description" content="Page description">
          </head>
          <body><p>Content</p></body>
        </html>
      `;

      mockedAxios.get.mockResolvedValue({ data: htmlResponse });

      await connector.sync();

      const files = await connector.listFiles({ filters: { status: 'success' } });
      expect(files).toHaveLength(1);
    });
  });

  describe('listFiles()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should list added URLs', async () => {
      await connector.addURL('https://example.com/1');
      await connector.addURL('https://example.com/2');

      const files = await connector.listFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        type: 'url',
        mimeType: 'text/html',
      });
    });

    it('should filter by status', async () => {
      await connector.addURL('https://example.com');

      mockedAxios.get.mockResolvedValue({
        data: '<html><body>Success</body></html>',
      });

      await connector.sync();

      const successFiles = await connector.listFiles({
        filters: { status: 'success' },
      });

      expect(successFiles).toHaveLength(1);
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should get processed markdown content', async () => {
      const { urlId } = await connector.addURL('https://example.com');

      mockedAxios.get.mockResolvedValue({
        data: '<html><head><title>Test</title></head><body><p>Content</p></body></html>',
      });

      await connector.sync();

      const fileContent = await connector.downloadFile(urlId!);

      expect(fileContent.id).toBe(urlId);
      expect(fileContent.mimeType).toBe('text/markdown');
      expect(typeof fileContent.content).toBe('string');
    });

    it('should throw error for non-existent URL', async () => {
      await expect(connector.downloadFile('invalid-id')).rejects.toThrow(
        'URL not found'
      );
    });

    it('should throw error for unprocessed URL', async () => {
      const { urlId } = await connector.addURL('https://example.com');

      await expect(connector.downloadFile(urlId!)).rejects.toThrow(
        'URL not processed'
      );
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      connector = new URLImportConnector({ orgId: 'org-123' });
    });

    it('should get queue size', async () => {
      expect(connector.getQueueSize()).toBe(0);

      await connector.addURL('https://example.com/1');
      await connector.addURL('https://example.com/2');

      expect(connector.getQueueSize()).toBe(2);
    });

    it('should get queue stats', async () => {
      await connector.addURL('https://example.com/1');
      await connector.addURL('https://example.com/2');

      const stats = connector.getQueueStats();

      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.success).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('should clear queue', async () => {
      await connector.addURL('https://example.com');

      connector.clearQueue();

      expect(connector.getQueueSize()).toBe(0);
    });

    it('should retry failed URLs', async () => {
      const { urlId } = await connector.addURL('https://example.com');

      mockedAxios.get.mockRejectedValue(new Error('Timeout'));

      await connector.sync();

      let stats = connector.getQueueStats();
      expect(stats.failed).toBe(1);

      await connector.retryFailed();

      stats = connector.getQueueStats();
      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });
});
