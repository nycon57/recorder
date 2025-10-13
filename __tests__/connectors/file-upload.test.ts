/**
 * File Upload Connector Tests
 *
 * Tests direct file uploads, validation, and storage.
 */

import { FileUploadConnector } from '@/lib/connectors/file-upload';

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { supabaseAdmin } from '@/lib/supabase/admin';

describe('FileUploadConnector', () => {
  let connector: FileUploadConnector;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase storage
    mockStorage = {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn().mockResolvedValue({ error: null }),
      listBuckets: jest.fn().mockResolvedValue({
        data: [{ name: 'recordings', id: 'bucket-1' }],
        error: null,
      }),
    };

    (supabaseAdmin as any).storage = mockStorage;
  });

  describe('Constructor', () => {
    it('should initialize with org ID', () => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
      expect(connector.type).toBe('file_upload');
      expect(connector.name).toBe('File Upload');
    });

    it('should initialize with user ID and batch ID', () => {
      connector = new FileUploadConnector({
        orgId: 'org-123',
        userId: 'user-123',
        batchId: 'batch-123',
      });
      expect(connector).toBeDefined();
    });
  });

  describe('authenticate()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should always authenticate successfully', async () => {
      const result = await connector.authenticate({});

      expect(result.success).toBe(true);
      expect(result.userName).toBe('File Upload User');
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should test storage connection successfully', async () => {
      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Storage connection successful');
      expect(result.metadata).toHaveProperty('bucketsAvailable', 1);
    });

    it('should handle missing recordings bucket', async () => {
      mockStorage.listBuckets.mockResolvedValue({
        data: [{ name: 'other', id: 'bucket-2' }],
        error: null,
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Recordings bucket not found');
    });

    it('should handle storage errors', async () => {
      mockStorage.listBuckets.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });

  describe('addFile()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should add PDF file', async () => {
      const buffer = Buffer.from('PDF content');

      const result = await connector.addFile('document.pdf', buffer, 'application/pdf');

      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
    });

    it('should add DOCX file', async () => {
      const buffer = Buffer.from('DOCX content');

      const result = await connector.addFile(
        'document.docx',
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.success).toBe(true);
    });

    it('should auto-detect MIME type from filename', async () => {
      const buffer = Buffer.from('Text content');

      const result = await connector.addFile('document.txt', buffer);

      expect(result.success).toBe(true);
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(60 * 1024 * 1024); // 60MB

      const result = await connector.addFile('large.pdf', largeBuffer, 'application/pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should reject unsupported file types', async () => {
      const buffer = Buffer.from('Executable content');

      const result = await connector.addFile('file.exe', buffer, 'application/x-msdownload');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported file type');
    });

    it('should add file with metadata', async () => {
      const buffer = Buffer.from('Content');
      const metadata = { uploadedBy: 'user-123', tags: ['important'] };

      const result = await connector.addFile('document.pdf', buffer, 'application/pdf', metadata);

      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({
        orgId: 'org-123',
        batchId: 'batch-123',
      });
    });

    it('should sync uploaded files to storage', async () => {
      await connector.addFile('file1.pdf', Buffer.from('Content 1'), 'application/pdf');
      await connector.addFile('file2.txt', Buffer.from('Content 2'), 'text/plain');

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.filesUpdated).toBe(2);
      expect(result.filesFailed).toBe(0);
      expect(mockStorage.from).toHaveBeenCalledWith('recordings');
      expect(mockStorage.upload).toHaveBeenCalledTimes(2);
    });

    it('should filter by file types', async () => {
      await connector.addFile('file1.pdf', Buffer.from('PDF'), 'application/pdf');
      await connector.addFile('file2.txt', Buffer.from('Text'), 'text/plain');

      const result = await connector.sync({
        fileTypes: ['application/pdf'],
      });

      expect(result.filesProcessed).toBe(1);
      expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    });

    it('should apply limit', async () => {
      await connector.addFile('file1.pdf', Buffer.from('1'), 'application/pdf');
      await connector.addFile('file2.pdf', Buffer.from('2'), 'application/pdf');
      await connector.addFile('file3.pdf', Buffer.from('3'), 'application/pdf');

      const result = await connector.sync({ limit: 2 });

      expect(result.filesProcessed).toBe(2);
    });

    it('should handle upload errors', async () => {
      await connector.addFile('file1.pdf', Buffer.from('Content'), 'application/pdf');

      mockStorage.upload.mockResolvedValue({
        error: { message: 'Upload failed' },
      });

      const result = await connector.sync();

      expect(result.success).toBe(false);
      expect(result.filesFailed).toBe(1);
      expect(result.errors[0].error).toContain('Upload failed');
    });

    it('should remove files from memory after successful upload', async () => {
      const { fileId } = await connector.addFile('file.pdf', Buffer.from('Content'), 'application/pdf');

      await connector.sync();

      expect(connector.getQueueSize()).toBe(0);
    });

    it('should generate correct storage path with batch ID', async () => {
      await connector.addFile('test.pdf', Buffer.from('Content'), 'application/pdf');

      await connector.sync();

      expect(mockStorage.upload).toHaveBeenCalledWith(
        expect.stringContaining('org_org-123/uploads/batch-123/'),
        expect.any(Buffer),
        expect.any(Object)
      );
    });
  });

  describe('listFiles()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should list files in queue', async () => {
      await connector.addFile('file1.pdf', Buffer.from('1'), 'application/pdf');
      await connector.addFile('file2.txt', Buffer.from('2'), 'text/plain');

      const files = await connector.listFiles();

      expect(files).toHaveLength(2);
      expect(files[0]).toMatchObject({
        name: 'file1.pdf',
        type: 'documents',
        mimeType: 'application/pdf',
      });
    });

    it('should apply limit and offset', async () => {
      for (let i = 0; i < 10; i++) {
        await connector.addFile(`file${i}.pdf`, Buffer.from(`${i}`), 'application/pdf');
      }

      const files = await connector.listFiles({ limit: 5, offset: 3 });

      expect(files).toHaveLength(5);
      expect(files[0].name).toBe('file3.pdf');
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should retrieve file from queue', async () => {
      const buffer = Buffer.from('Test content');
      const { fileId } = await connector.addFile('test.pdf', buffer, 'application/pdf');

      const fileContent = await connector.downloadFile(fileId!);

      expect(fileContent.id).toBe(fileId);
      expect(fileContent.title).toBe('test.pdf');
      expect(fileContent.content).toEqual(buffer);
      expect(fileContent.mimeType).toBe('application/pdf');
    });

    it('should throw error for non-existent file', async () => {
      await expect(connector.downloadFile('invalid-id')).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('Helper Methods', () => {
    it('should get supported types', () => {
      const types = FileUploadConnector.getSupportedTypes();

      expect(types).toContain('application/pdf');
      expect(types).toContain('text/plain');
      expect(types).toContain('application/json');
    });

    it('should check if type is supported', () => {
      expect(FileUploadConnector.isSupported('application/pdf')).toBe(true);
      expect(FileUploadConnector.isSupported('application/x-executable')).toBe(false);
    });

    it('should get extensions by category', () => {
      const docExtensions = FileUploadConnector.getExtensions('documents');

      expect(docExtensions).toContain('pdf');
      expect(docExtensions).toContain('txt');
    });

    it('should get all extensions', () => {
      const allExtensions = FileUploadConnector.getExtensions();

      expect(allExtensions.length).toBeGreaterThan(0);
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      connector = new FileUploadConnector({ orgId: 'org-123' });
    });

    it('should get queue size', async () => {
      expect(connector.getQueueSize()).toBe(0);

      await connector.addFile('file1.pdf', Buffer.from('1'), 'application/pdf');
      await connector.addFile('file2.pdf', Buffer.from('2'), 'application/pdf');

      expect(connector.getQueueSize()).toBe(2);
    });

    it('should clear queue', async () => {
      await connector.addFile('file1.pdf', Buffer.from('1'), 'application/pdf');
      await connector.addFile('file2.pdf', Buffer.from('2'), 'application/pdf');

      connector.clearQueue();

      expect(connector.getQueueSize()).toBe(0);
    });
  });
});
