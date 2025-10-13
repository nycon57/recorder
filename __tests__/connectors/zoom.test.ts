/**
 * Zoom Connector Tests
 *
 * Tests OAuth authentication, meeting recordings sync, transcript download,
 * webhook handling, and token refresh.
 */

import { ZoomConnector } from '@/lib/connectors/zoom';
import { ConnectorCredentials, WebhookEvent } from '@/lib/connectors/base';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { createClient } from '@/lib/supabase/admin';

describe('ZoomConnector', () => {
  let connector: ZoomConnector;
  let mockSupabase: any;

  const mockCredentials: ConnectorCredentials = {
    accessToken: 'mock-zoom-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      rpc: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Default axios mocks
    mockedAxios.get = jest.fn();
    mockedAxios.post = jest.fn();
  });

  describe('Constructor', () => {
    it('should initialize with credentials', () => {
      connector = new ZoomConnector(mockCredentials as any, { orgId: 'org-123' });
      expect(connector.type).toBe('zoom');
      expect(connector.name).toBe('Zoom Meetings');
    });
  });

  describe('authenticate()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, { orgId: 'org-123' });
    });

    it('should authenticate successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
        },
      });

      const result = await connector.authenticate();

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.userName).toBe('John Doe');
    });

    it('should refresh expired token before authenticating', async () => {
      const expiredCredentials = {
        ...mockCredentials,
        expiresAt: new Date(Date.now() - 1000), // Expired
      };

      connector = new ZoomConnector(expiredCredentials as any, { orgId: 'org-123' });

      // Mock token refresh
      process.env.ZOOM_CLIENT_ID = 'client-id';
      process.env.ZOOM_CLIENT_SECRET = 'client-secret';

      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        },
      });

      mockedAxios.get.mockResolvedValue({
        data: { id: 'user-123', first_name: 'John', last_name: 'Doe' },
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await connector.authenticate();

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should handle authentication failure', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Unauthorized'));

      const result = await connector.authenticate();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized');
    });

    it('should retry on 401 error', async () => {
      const error = new Error('Unauthorized') as any;
      error.response = { status: 401 };

      process.env.ZOOM_CLIENT_ID = 'client-id';
      process.env.ZOOM_CLIENT_SECRET = 'client-secret';

      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'new-token',
          expires_in: 3600,
        },
      });

      mockedAxios.get
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({
          data: { id: 'user-123', first_name: 'John', last_name: 'Doe' },
        });

      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await connector.authenticate();

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalled();
    });
  });

  describe('testConnection()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, { orgId: 'org-123' });
    });

    it('should test connection successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          id: 'user-123',
          first_name: 'John',
          last_name: 'Doe',
        },
      });

      const result = await connector.testConnection();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connected as John Doe');
      expect(result.metadata).toHaveProperty('userId', 'user-123');
    });
  });

  describe('sync()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, {
        orgId: 'org-123',
        connectorId: 'connector-123',
      });
    });

    it('should sync recordings successfully', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { id: 'user-123' },
        })
        .mockResolvedValueOnce({
          data: {
            meetings: [
              {
                uuid: 'meeting-1',
                id: 12345,
                topic: 'Test Meeting',
                start_time: '2024-01-01T10:00:00Z',
                duration: 60,
                recording_count: 1,
                recording_files: [
                  {
                    id: 'rec-1',
                    meeting_id: '12345',
                    recording_start: '2024-01-01T10:00:00Z',
                    recording_end: '2024-01-01T11:00:00Z',
                    file_type: 'MP4',
                    file_size: 1000000,
                    file_extension: 'MP4',
                    download_url: 'https://zoom.us/rec/download/abc',
                    status: 'completed',
                    recording_type: 'shared_screen_with_speaker_view',
                  },
                ],
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: Buffer.from('video content'),
          headers: { 'content-type': 'video/mp4' },
        });

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1);
      expect(result.filesFailed).toBe(0);
    });

    it('should skip incomplete recordings', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { id: 'user-123' } })
        .mockResolvedValueOnce({
          data: {
            meetings: [
              {
                uuid: 'meeting-1',
                id: 12345,
                topic: 'Test Meeting',
                recording_files: [
                  {
                    id: 'rec-1',
                    status: 'processing', // Not completed
                    download_url: 'https://zoom.us/rec/download/abc',
                  },
                ],
              },
            ],
          },
        });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(1);
      expect(result.filesUpdated).toBe(0);
    });

    it('should handle pagination', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { id: 'user-123' } })
        .mockResolvedValueOnce({
          data: {
            meetings: [{ uuid: 'meeting-1', recording_files: [] }],
            next_page_token: 'token-1',
          },
        })
        .mockResolvedValueOnce({
          data: {
            meetings: [{ uuid: 'meeting-2', recording_files: [] }],
          },
        });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(2);
    });

    it('should download transcripts when available', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { id: 'user-123' } })
        .mockResolvedValueOnce({
          data: {
            meetings: [
              {
                uuid: 'meeting-1',
                id: 12345,
                topic: 'Test Meeting',
                recording_files: [],
                recording_transcript_file: {
                  download_url: 'https://zoom.us/rec/transcript/abc',
                  file_type: 'TRANSCRIPT',
                  file_size: 5000,
                },
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nTranscript content',
        });

      mockSupabase.single.mockResolvedValue({ data: null });

      const result = await connector.sync();

      expect(result.filesProcessed).toBe(1);
    });

    it('should handle sync with date range', async () => {
      const sinceDate = new Date('2024-01-01');

      mockedAxios.get
        .mockResolvedValueOnce({ data: { id: 'user-123' } })
        .mockResolvedValueOnce({
          data: { meetings: [] },
        });

      await connector.sync({ since: sinceDate });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            from: '2024-01-01',
          }),
        })
      );
    });
  });

  describe('listFiles()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, { orgId: 'org-123' });
    });

    it('should list recording files', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: { id: 'user-123' } })
        .mockResolvedValueOnce({
          data: {
            meetings: [
              {
                uuid: 'meeting-1',
                id: 12345,
                topic: 'Test Meeting',
                start_time: '2024-01-01T10:00:00Z',
                duration: 60,
                recording_files: [
                  {
                    id: 'rec-1',
                    file_type: 'MP4',
                    file_size: 1000000,
                    recording_start: '2024-01-01T10:00:00Z',
                    recording_end: '2024-01-01T11:00:00Z',
                    download_url: 'https://zoom.us/rec/download/abc',
                    status: 'completed',
                    recording_type: 'shared_screen_with_speaker_view',
                  },
                ],
              },
            ],
          },
        });

      const files = await connector.listFiles();

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        id: 'rec-1',
        name: 'Test Meeting - shared_screen_with_speaker_view',
        type: 'MP4',
        mimeType: 'video/mp4',
        size: 1000000,
      });
    });
  });

  describe('downloadFile()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, { orgId: 'org-123' });
    });

    it('should download recording file', async () => {
      const downloadUrl = 'https://zoom.us/rec/download/abc';

      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('video content'),
        headers: { 'content-type': 'video/mp4' },
      });

      const fileContent = await connector.downloadFile(downloadUrl);

      expect(fileContent.id).toBe(downloadUrl);
      expect(fileContent.title).toBe('Zoom Recording');
      expect(fileContent.content).toBeInstanceOf(Buffer);
      expect(fileContent.mimeType).toBe('video/mp4');
    });
  });

  describe('handleWebhook()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, {
        orgId: 'org-123',
        connectorId: 'connector-123',
      });
    });

    it('should handle recording.completed webhook', async () => {
      mockedAxios.get.mockResolvedValue({
        data: Buffer.from('video content'),
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const event: WebhookEvent = {
        id: 'webhook-1',
        type: 'recording.completed',
        source: 'zoom',
        payload: {
          object: {
            uuid: 'meeting-1',
            topic: 'Test Meeting',
            recording_files: [
              {
                id: 'rec-1',
                status: 'completed',
                download_url: 'https://zoom.us/rec/download/abc',
                file_type: 'MP4',
                file_size: 1000000,
              },
            ],
          },
        },
        timestamp: new Date(),
      };

      await expect(connector.handleWebhook(event)).resolves.not.toThrow();
    });

    it('should handle recording.transcript_completed webhook', async () => {
      mockedAxios.get.mockResolvedValue({
        data: 'WEBVTT\n\nTranscript',
      });

      mockSupabase.single.mockResolvedValue({ data: null });

      const event: WebhookEvent = {
        id: 'webhook-2',
        type: 'recording.transcript_completed',
        source: 'zoom',
        payload: {
          object: {
            uuid: 'meeting-1',
            topic: 'Test Meeting',
            transcript_url: 'https://zoom.us/rec/transcript/abc',
          },
        },
        timestamp: new Date(),
      };

      await expect(connector.handleWebhook(event)).resolves.not.toThrow();
    });
  });

  describe('refreshCredentials()', () => {
    beforeEach(() => {
      connector = new ZoomConnector(mockCredentials as any, {
        orgId: 'org-123',
        connectorId: 'connector-123',
      });

      process.env.ZOOM_CLIENT_ID = 'client-id';
      process.env.ZOOM_CLIENT_SECRET = 'client-secret';
    });

    it('should refresh credentials successfully', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        },
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      const newCredentials = await connector.refreshCredentials(mockCredentials);

      expect(newCredentials.accessToken).toBe('new-access-token');
      expect(newCredentials.refreshToken).toBe('new-refresh-token');
      expect(newCredentials.expiresAt).toBeDefined();
    });

    it('should handle refresh failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Invalid refresh token'));

      await expect(
        connector.refreshCredentials(mockCredentials)
      ).rejects.toThrow('Failed to refresh credentials');
    });
  });
});
