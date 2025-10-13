/**
 * Google Drive Connector Tests
 *
 * Tests OAuth authentication, file listing, downloading, token refresh,
 * and Google Workspace file conversion.
 */

import { GoogleDriveConnector } from '@/lib/connectors/google-drive';
import {
  ConnectorCredentials,
  SyncOptions,
  WebhookEvent,
} from '@/lib/connectors/base';

// Mock googleapis
jest.mock('googleapis');
import { google } from 'googleapis';

// Mock Turndown
jest.mock('turndown');

describe('GoogleDriveConnector', () => {
  let connector: GoogleDriveConnector;
  let mockDrive: any;
  let mockAuth: any;

  const mockCredentials: ConnectorCredentials = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OAuth2 client
    mockAuth = {
      setCredentials: jest.fn(),
      getToken: jest.fn(),
      generateAuthUrl: jest.fn().mockReturnValue('https://auth.url'),
      refreshAccessToken: jest.fn().mockResolvedValue({
        credentials: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expiry_date: Date.now() + 3600000,
        },
      }),
    };

    // Mock Drive API
    mockDrive = {
      files: {
        list: jest.fn(),
        get: jest.fn(),
        export: jest.fn(),
      },
      about: {
        get: jest.fn(),
      },
    };

    // Mock google.auth and google.drive
    (google.auth as any).OAuth2 = jest.fn(() => mockAuth);
    (google.drive as any) = jest.fn(() => mockDrive);
  });

  describe('Constructor', () => {
    it('should initialize with credentials', () => {
      connector = new GoogleDriveConnector(mockCredentials);
      expect(connector.type).toBe('google_drive');
      expect(connector.name).toBe('Google Drive');
    });

    it('should initialize with config options', () => {
      connector = new GoogleDriveConnector(mockCredentials, {
        folderIds: ['folder-1', 'folder-2'],
        includeSharedDrives: true,
        maxFileSizeBytes: 100 * 1024 * 1024,
      });
      expect(connector).toBeDefined();
    });
  });

  describe('authenticate()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should authenticate with authorization code', async () => {
      mockAuth.getToken.mockResolvedValue({
        tokens: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expiry_date: Date.now() + 3600000,
        },
      });

      mockDrive.about.get.mockResolvedValue({
        data: {
          user: {
            emailAddress: 'test@example.com',
            displayName: 'Test User',
          },
        },
      });

      const result = await connector.authenticate({ code: 'auth-code' });

      expect(result.success).toBe(true);
      expect(result.userId).toBe('test@example.com');
      expect(result.userName).toBe('Test User');
      expect(mockAuth.getToken).toHaveBeenCalledWith('auth-code');
    });

    it('should return auth URL when no code provided', async () => {
      const result = await connector.authenticate({});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Please visit this URL to authorize');
      expect(mockAuth.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          scope: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive.readonly',
          ]),
        })
      );
    });

    it('should handle authentication errors', async () => {
      mockAuth.getToken.mockRejectedValue(new Error('Invalid code'));

      const result = await connector.authenticate({ code: 'invalid-code' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid code');
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should successfully test connection', async () => {
      mockDrive.about.get.mockResolvedValue({
        data: {
          user: {
            emailAddress: 'test@example.com',
            displayName: 'Test User',
          },
          storageQuota: {
            usage: '1000000',
            limit: '15000000000',
          },
        },
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(result.metadata).toHaveProperty('user');
      expect(result.metadata).toHaveProperty('storage');
    });

    it('should handle unauthenticated state', async () => {
      const unauthConnector = new GoogleDriveConnector({});

      const result = await unauthConnector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Not authenticated');
    });

    it('should handle connection errors', async () => {
      mockDrive.about.get.mockRejectedValue(new Error('Network error'));

      const result = await connector.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network error');
    });

    it('should refresh token on 401 error', async () => {
      const error = new Error('Unauthorized') as any;
      error.code = 401;

      mockDrive.about.get
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          data: {
            user: { emailAddress: 'test@example.com' },
          },
        });

      const result = await connector.testConnection();

      expect(mockAuth.refreshAccessToken).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should sync files successfully', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'Document 1.pdf',
              mimeType: 'application/pdf',
              size: '1000',
              modifiedTime: '2024-01-01T00:00:00Z',
            },
            {
              id: 'file-2',
              name: 'Document 2.docx',
              mimeType:
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              size: '2000',
              modifiedTime: '2024-01-02T00:00:00Z',
            },
          ],
        },
      });

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(2);
      expect(result.filesUpdated).toBe(2);
      expect(result.filesFailed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should sync with limit option', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'Document 1.pdf',
              mimeType: 'application/pdf',
              size: '1000',
            },
          ],
        },
      });

      const options: SyncOptions = { limit: 1 };
      const result = await connector.sync(options);

      expect(result.filesProcessed).toBe(1);
    });

    it('should skip files that are too large', async () => {
      connector = new GoogleDriveConnector(mockCredentials, {
        maxFileSizeBytes: 1000,
      });

      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'Large File.pdf',
              mimeType: 'application/pdf',
              size: '2000', // Exceeds 1000 byte limit
              modifiedTime: '2024-01-01T00:00:00Z',
            },
          ],
        },
      });

      const result = await connector.sync();

      expect(result.filesFailed).toBe(1);
      expect(result.errors[0].error).toContain('File too large');
    });

    it('should handle pagination', async () => {
      mockDrive.files.list
        .mockResolvedValueOnce({
          data: {
            files: [{ id: 'file-1', name: 'File 1.pdf', mimeType: 'application/pdf', size: '1000' }],
            nextPageToken: 'token-1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            files: [{ id: 'file-2', name: 'File 2.pdf', mimeType: 'application/pdf', size: '1000' }],
          },
        });

      const result = await connector.sync();

      expect(mockDrive.files.list).toHaveBeenCalledTimes(2);
      expect(result.filesProcessed).toBe(2);
    });

    it('should skip folders during sync', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'folder-1',
              name: 'My Folder',
              mimeType: 'application/vnd.google-apps.folder',
            },
            {
              id: 'file-1',
              name: 'Document.pdf',
              mimeType: 'application/pdf',
              size: '1000',
            },
          ],
        },
      });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(2);
      expect(result.filesUpdated).toBe(1); // Only file, not folder
    });

    it('should handle sync with since option', async () => {
      const sinceDate = new Date('2024-01-01');

      mockDrive.files.list.mockResolvedValue({
        data: { files: [] },
      });

      await connector.sync({ since: sinceDate });

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: expect.stringContaining('modifiedTime > \'2024-01-01\''),
        })
      );
    });
  });

  describe('listFiles()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should list files', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            {
              id: 'file-1',
              name: 'Document 1.pdf',
              mimeType: 'application/pdf',
              size: '1000',
              modifiedTime: '2024-01-01T00:00:00Z',
              createdTime: '2024-01-01T00:00:00Z',
              webViewLink: 'https://drive.google.com/file/d/file-1',
            },
          ],
        },
      });

      const files = await connector.listFiles();

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        id: 'file-1',
        name: 'Document 1.pdf',
        type: 'pdf',
        mimeType: 'application/pdf',
        url: 'https://drive.google.com/file/d/file-1',
      });
    });

    it('should list files with limit', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            { id: 'file-1', name: 'File 1.pdf', mimeType: 'application/pdf' },
          ],
        },
      });

      const files = await connector.listFiles({ limit: 10 });

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({
          pageSize: 10,
        })
      );
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should download regular file', async () => {
      mockDrive.files.get
        .mockResolvedValueOnce({
          data: {
            id: 'file-1',
            name: 'Document.pdf',
            mimeType: 'application/pdf',
            size: '1000',
          },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('PDF content'),
        });

      const fileContent = await connector.downloadFile('file-1');

      expect(fileContent.id).toBe('file-1');
      expect(fileContent.title).toBe('Document.pdf');
      expect(fileContent.mimeType).toBe('application/pdf');
      expect(fileContent.content).toBeInstanceOf(Buffer);
    });

    it('should export and convert Google Doc to markdown', async () => {
      mockDrive.files.get.mockResolvedValueOnce({
        data: {
          id: 'doc-1',
          name: 'My Document',
          mimeType: 'application/vnd.google-apps.document',
        },
      });

      mockDrive.files.export.mockResolvedValue({
        data: Buffer.from('<html><body><h1>Title</h1><p>Content</p></body></html>'),
      });

      const fileContent = await connector.downloadFile('doc-1');

      expect(mockDrive.files.export).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'doc-1',
          mimeType: 'text/html',
        }),
        expect.any(Object)
      );
      expect(fileContent.mimeType).toBe('text/markdown');
      expect(typeof fileContent.content).toBe('string');
    });

    it('should handle download errors', async () => {
      mockDrive.files.get.mockRejectedValue(new Error('File not found'));

      await expect(connector.downloadFile('invalid-id')).rejects.toThrow();
    });
  });

  describe('refreshCredentials()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should refresh credentials successfully', async () => {
      const newCredentials = await connector.refreshCredentials(mockCredentials);

      expect(newCredentials.accessToken).toBe('new-access-token');
      expect(newCredentials.refreshToken).toBe('new-refresh-token');
      expect(newCredentials.expiresAt).toBeDefined();
      expect(mockAuth.refreshAccessToken).toHaveBeenCalled();
    });

    it('should throw error when no refresh token', async () => {
      await expect(
        connector.refreshCredentials({ accessToken: 'token' })
      ).rejects.toThrow('No refresh token available');
    });

    it('should handle refresh errors', async () => {
      mockAuth.refreshAccessToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      await expect(
        connector.refreshCredentials(mockCredentials)
      ).rejects.toThrow();
    });
  });

  describe('handleWebhook()', () => {
    beforeEach(() => {
      connector = new GoogleDriveConnector(mockCredentials);
    });

    it('should handle webhook events', async () => {
      const event: WebhookEvent = {
        id: 'webhook-1',
        type: 'file.created',
        source: 'google_drive',
        payload: { fileId: 'file-1' },
        timestamp: new Date(),
      };

      await expect(connector.handleWebhook(event)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file list', async () => {
      connector = new GoogleDriveConnector(mockCredentials);

      mockDrive.files.list.mockResolvedValue({
        data: { files: [] },
      });

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(0);
    });

    it('should handle Google Sheets export', async () => {
      connector = new GoogleDriveConnector(mockCredentials);

      mockDrive.files.get.mockResolvedValueOnce({
        data: {
          id: 'sheet-1',
          name: 'Spreadsheet',
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
      });

      mockDrive.files.export.mockResolvedValue({
        data: Buffer.from('col1,col2\nval1,val2'),
      });

      const fileContent = await connector.downloadFile('sheet-1');

      expect(mockDrive.files.export).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'text/csv',
        }),
        expect.any(Object)
      );
      expect(fileContent.content).toBeInstanceOf(Buffer);
    });

    it('should handle Google Slides export', async () => {
      connector = new GoogleDriveConnector(mockCredentials);

      mockDrive.files.get.mockResolvedValueOnce({
        data: {
          id: 'slides-1',
          name: 'Presentation',
          mimeType: 'application/vnd.google-apps.presentation',
        },
      });

      mockDrive.files.export.mockResolvedValue({
        data: Buffer.from('Slide content'),
      });

      const fileContent = await connector.downloadFile('slides-1');

      expect(mockDrive.files.export).toHaveBeenCalledWith(
        expect.objectContaining({
          mimeType: 'text/plain',
        }),
        expect.any(Object)
      );
    });
  });
});
