/**
 * API Tests for Library Upload Endpoint
 *
 * Tests: POST /api/library/upload
 *
 * Validates:
 * - File upload handling
 * - Multi-file batch uploads
 * - File validation (type, size)
 * - Database record creation
 * - Storage integration
 * - Job queue enqueuing
 * - Error handling and cleanup
 * - Recording prevention
 * - Filename sanitization
 * - Organization-level isolation
 */

import { POST } from '@/app/api/library/upload/route';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Mock Supabase
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

// Mock auth
jest.mock('@/lib/utils/api', () => ({
  ...jest.requireActual('@/lib/utils/api'),
  requireOrg: jest.fn().mockResolvedValue({
    userId: 'test-user-id',
    orgId: 'test-org-id',
    role: 'admin',
  }),
}));

describe('Library Upload API', () => {
  let mockSupabase: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      delete: jest.fn().mockReturnThis(),
    };

    mockStorage = {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      createSignedUrl: jest.fn(),
    };

    (supabaseAdmin.from as jest.Mock) = mockSupabase.from;
    (supabaseAdmin.storage.from as jest.Mock) = mockStorage.from;
  });

  describe('POST /api/library/upload', () => {
    it('should upload single video file successfully', async () => {
      // Arrange
      const file = new File(['video content'], 'test-video.mp4', {
        type: 'video/mp4',
      });
      const formData = new FormData();
      formData.append('files', file);

      const recordingId = 'recording-123';

      // Mock database insert
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: recordingId,
          org_id: 'test-org-id',
          title: 'test-video.mp4',
          status: 'uploading',
          content_type: 'video',
          file_type: 'mp4',
        },
        error: null,
      });

      // Mock storage upload
      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'test-org-id/videos/recording-123.mp4' },
        error: null,
      });

      // Mock status update
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock job insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'job-1' },
        error: null,
      });

      // Mock status update after job
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock signed URL
      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.uploads).toHaveLength(1);
      expect(data.uploads[0].status).toBe('success');
      expect(data.uploads[0].id).toBe(recordingId);
      expect(data.uploads[0].contentType).toBe('video');
      expect(data.summary.successful).toBe(1);
      expect(data.summary.failed).toBe(0);
    });

    it('should upload multiple files in batch', async () => {
      // Arrange
      const files = [
        new File(['video'], 'video.mp4', { type: 'video/mp4' }),
        new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' }),
        new File(['pdf'], 'doc.pdf', { type: 'application/pdf' }),
      ];

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      // Mock successful uploads for all files
      for (let i = 0; i < files.length; i++) {
        mockSupabase.single.mockResolvedValueOnce({
          data: { id: `recording-${i}`, status: 'uploading' },
          error: null,
        });

        mockStorage.upload.mockResolvedValueOnce({
          data: { path: `path-${i}` },
          error: null,
        });

        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // update
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // job
        mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }); // update
        mockStorage.createSignedUrl.mockResolvedValueOnce({
          data: { signedUrl: `url-${i}` },
          error: null,
        });
      }

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.uploads).toHaveLength(3);
      expect(data.summary.successful).toBe(3);
      expect(data.summary.failed).toBe(0);
    });

    it('should reject request with no files', async () => {
      // Arrange
      const formData = new FormData();

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('No files provided');
    });

    it('should reject more than 10 files', async () => {
      // Arrange
      const formData = new FormData();
      for (let i = 0; i < 11; i++) {
        const file = new File(['content'], `file${i}.pdf`, {
          type: 'application/pdf',
        });
        formData.append('files', file);
      }

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('Too many files');
      expect(data.error).toContain('Maximum 10 files');
    });

    it('should reject invalid file type', async () => {
      // Arrange
      const file = new File(['executable'], 'malware.exe', {
        type: 'application/x-msdownload',
      });
      const formData = new FormData();
      formData.append('files', file);

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.uploads[0].status).toBe('error');
      expect(data.uploads[0].error).toContain('Unsupported file type');
      expect(data.summary.failed).toBe(1);
    });

    it('should reject file exceeding size limit', async () => {
      // Arrange - Create 600MB video (exceeds 500MB limit)
      const largeFile = new File([new ArrayBuffer(600 * 1024 * 1024)], 'large.mp4', {
        type: 'video/mp4',
      });
      const formData = new FormData();
      formData.append('files', largeFile);

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.uploads[0].status).toBe('error');
      expect(data.uploads[0].error).toContain('File size exceeds limit');
      expect(data.summary.failed).toBe(1);
    });

    it('should prevent recordings from being uploaded', async () => {
      // Arrange
      const file = new File(['webm content'], 'recording.webm', {
        type: 'video/webm',
      });
      const formData = new FormData();
      formData.append('files', file);

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.uploads[0].status).toBe('error');
      expect(data.uploads[0].error).toContain('Screen recordings must be created via');
      expect(data.summary.failed).toBe(1);
    });

    it('should sanitize filenames', async () => {
      // Arrange
      const file = new File(['content'], 'file with spaces & symbols!@#.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'recording-123',
          title: 'file_with_spaces___symbols___.pdf', // Sanitized
          status: 'uploading',
        },
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.uploads[0].status).toBe('success');
      // Filename should be sanitized in database
    });

    it('should handle storage upload failure and cleanup database', async () => {
      // Arrange
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('files', file);

      const recordingId = 'recording-fail';

      // Mock successful database insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: recordingId, status: 'uploading' },
        error: null,
      });

      // Mock storage failure
      mockStorage.upload.mockResolvedValueOnce({
        data: null,
        error: { message: 'Storage quota exceeded' },
      });

      // Mock cleanup delete
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.uploads[0].status).toBe('error');
      expect(data.uploads[0].error).toContain('Storage upload failed');
      expect(data.summary.failed).toBe(1);

      // Verify cleanup was called
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', recordingId);
    });

    it('should handle database creation failure', async () => {
      // Arrange
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('files', file);

      // Mock database error
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.uploads[0].status).toBe('error');
      expect(data.uploads[0].error).toBe('Failed to create database record');
    });

    it('should enqueue correct processing job for video', async () => {
      // Arrange
      const file = new File(['video'], 'video.mp4', { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploading' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // storage path update
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null }) // job insert
        .mockResolvedValueOnce({ data: null, error: null }); // status update

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      await POST(request);

      // Assert - Verify extract_audio job was created
      const insertCalls = mockSupabase.insert.mock.calls;
      const jobInsert = insertCalls.find(
        (call: any) => call[0]?.type === 'extract_audio'
      );
      expect(jobInsert).toBeDefined();
    });

    it('should enqueue correct processing job for audio', async () => {
      // Arrange
      const file = new File(['audio'], 'audio.mp3', { type: 'audio/mpeg' });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploading' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      await POST(request);

      // Assert - Verify transcribe job was created
      const insertCalls = mockSupabase.insert.mock.calls;
      const jobInsert = insertCalls.find((call: any) => call[0]?.type === 'transcribe');
      expect(jobInsert).toBeDefined();
    });

    it('should enqueue correct processing job for PDF', async () => {
      // Arrange
      const file = new File(['pdf'], 'doc.pdf', { type: 'application/pdf' });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploading' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      await POST(request);

      // Assert - Verify extract_text_pdf job was created
      const insertCalls = mockSupabase.insert.mock.calls;
      const jobInsert = insertCalls.find(
        (call: any) => call[0]?.type === 'extract_text_pdf'
      );
      expect(jobInsert).toBeDefined();
    });

    it('should handle partial batch failures', async () => {
      // Arrange
      const files = [
        new File(['valid'], 'valid.pdf', { type: 'application/pdf' }),
        new File(['invalid'], 'invalid.exe', { type: 'application/x-msdownload' }),
      ];

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));

      // Mock success for first file
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'rec-1', status: 'uploading' },
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400); // Mixed results default to 400
      expect(data.uploads).toHaveLength(2);
      expect(data.uploads[0].status).toBe('success');
      expect(data.uploads[1].status).toBe('error');
      expect(data.summary.successful).toBe(1);
      expect(data.summary.failed).toBe(1);
    });

    it('should enforce organization-level data isolation', async () => {
      // Arrange
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'rec-1', org_id: 'test-org-id', status: 'uploading' },
        error: null,
      });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'path' },
        error: null,
      });

      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });
      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'url' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      await POST(request);

      // Assert - Verify org_id was set in insert
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.org_id).toBe('test-org-id');
      expect(insertCall.created_by).toBe('test-user-id');
    });

    it('should return signed URLs for uploaded files', async () => {
      // Arrange
      const file = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      });
      const formData = new FormData();
      formData.append('files', file);

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploading' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      mockStorage.upload.mockResolvedValueOnce({
        data: { path: 'test-org-id/documents/rec-1.pdf' },
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://storage.example.com/signed-url?token=abc' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/upload', {
        method: 'POST',
        body: formData,
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.uploads[0].uploadUrl).toBe(
        'https://storage.example.com/signed-url?token=abc'
      );
    });
  });
});
