/**
 * API Tests for Library Text Endpoint
 *
 * Tests: POST /api/library/text
 *
 * Validates:
 * - Text note creation
 * - Input validation (Zod schema)
 * - Plain text vs markdown format
 * - Database record creation
 * - Transcript storage
 * - Job queue enqueuing
 * - Content size limits
 * - Error handling
 * - Organization-level isolation
 */

import { POST } from '@/app/api/library/text/route';
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Mock Supabase
jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: {
    from: jest.fn(),
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

describe('Library Text API', () => {
  let mockSupabase: any;

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

    (supabaseAdmin.from as jest.Mock) = mockSupabase.from;
  });

  describe('POST /api/library/text', () => {
    it('should create plain text note successfully', async () => {
      // Arrange
      const recordingId = 'recording-123';
      const requestBody = {
        title: 'Meeting Notes',
        content: 'This is a test note with important information.',
        format: 'plain',
      };

      // Mock recording insert
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: recordingId,
          org_id: 'test-org-id',
          title: 'Meeting Notes',
          status: 'uploaded',
          content_type: 'text',
          file_type: 'txt',
          created_at: '2025-01-15T10:00:00Z',
        },
        error: null,
      });

      // Mock transcript insert
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock status update to transcribed
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock job insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'job-1' },
        error: null,
      });

      // Mock status update to doc_generating
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.id).toBe(recordingId);
      expect(data.title).toBe('Meeting Notes');
      expect(data.content_type).toBe('text');
      expect(data.file_type).toBe('txt');
      expect(data.status).toBe('doc_generating');
    });

    it('should create markdown note successfully', async () => {
      // Arrange
      const recordingId = 'recording-456';
      const requestBody = {
        title: 'Documentation',
        content: '# Header\n\nThis is **markdown** content.',
        format: 'markdown',
      };

      // Mock successful flow
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: recordingId,
            title: 'Documentation',
            status: 'uploaded',
            content_type: 'text',
            file_type: 'md',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null }) // transcript
        .mockResolvedValueOnce({ data: null, error: null }) // update
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null }) // job
        .mockResolvedValueOnce({ data: null, error: null }); // update

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.file_type).toBe('md');
    });

    it('should default to plain format if not specified', async () => {
      // Arrange
      const requestBody = {
        title: 'Quick Note',
        content: 'Simple note without format specified',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'rec-1',
            file_type: 'txt',
            status: 'uploaded',
            content_type: 'text',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.file_type).toBe('txt'); // Should default to plain
    });

    it('should include optional description', async () => {
      // Arrange
      const requestBody = {
        title: 'Project Notes',
        content: 'Project content',
        description: 'Detailed notes about the project',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'rec-1',
            description: 'Detailed notes about the project',
            status: 'uploaded',
            content_type: 'text',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify description was included
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.description).toBe('Detailed notes about the project');
    });

    it('should include optional metadata', async () => {
      // Arrange
      const requestBody = {
        title: 'Tagged Note',
        content: 'Content',
        metadata: {
          tags: ['important', 'urgent'],
          category: 'meetings',
        },
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify metadata was included
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.metadata).toMatchObject({
        tags: ['important', 'urgent'],
        category: 'meetings',
      });
    });

    it('should reject missing title', async () => {
      // Arrange
      const requestBody = {
        content: 'Content without title',
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject missing content', async () => {
      // Arrange
      const requestBody = {
        title: 'Title without content',
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject title exceeding 200 characters', async () => {
      // Arrange
      const requestBody = {
        title: 'a'.repeat(201),
        content: 'Content',
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject content exceeding 500KB', async () => {
      // Arrange - Create content larger than 500KB
      const largeContent = 'a'.repeat(500001);
      const requestBody = {
        title: 'Large Note',
        content: largeContent,
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject description exceeding 2000 characters', async () => {
      // Arrange
      const requestBody = {
        title: 'Note',
        content: 'Content',
        description: 'a'.repeat(2001),
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject invalid format', async () => {
      // Arrange
      const requestBody = {
        title: 'Note',
        content: 'Content',
        format: 'html', // Invalid format
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should calculate content size correctly', async () => {
      // Arrange
      const content = 'Test content with émojis 🎉 and unicode';
      const requestBody = {
        title: 'Unicode Note',
        content,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'rec-1',
            file_size: new TextEncoder().encode(content).length,
            status: 'uploaded',
            content_type: 'text',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(201);
      expect(data.file_size).toBeGreaterThan(content.length); // UTF-8 encoding
    });

    it('should store content in transcript table', async () => {
      // Arrange
      const requestBody = {
        title: 'Test Note',
        content: 'This content should be stored in transcripts table',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify transcript insert
      const insertCalls = mockSupabase.insert.mock.calls;
      const transcriptInsert = insertCalls.find(
        (call: any) => call[0]?.text === requestBody.content
      );
      expect(transcriptInsert).toBeDefined();
      expect(transcriptInsert[0]).toMatchObject({
        recording_id: 'rec-1',
        text: requestBody.content,
        language: 'en',
        confidence: 1.0,
        provider: 'user_input',
      });
    });

    it('should enqueue doc_generate job', async () => {
      // Arrange
      const requestBody = {
        title: 'Test',
        content: 'Content',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify doc_generate job was created
      const insertCalls = mockSupabase.insert.mock.calls;
      const jobInsert = insertCalls.find((call: any) => call[0]?.type === 'doc_generate');
      expect(jobInsert).toBeDefined();
      expect(jobInsert[0].payload).toMatchObject({
        recordingId: 'rec-1',
        orgId: 'test-org-id',
        contentType: 'text',
      });
    });

    it('should update status through lifecycle', async () => {
      // Arrange
      const requestBody = {
        title: 'Test',
        content: 'Content',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify status updates
      const updateCalls = mockSupabase.update.mock.calls;
      expect(updateCalls[0][0]).toMatchObject({ status: 'transcribed' });
      expect(updateCalls[1][0]).toMatchObject({ status: 'doc_generating' });
    });

    it('should handle database error gracefully', async () => {
      // Arrange
      const requestBody = {
        title: 'Test',
        content: 'Content',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
    });

    it('should handle transcript insertion failure and cleanup', async () => {
      // Arrange
      const requestBody = {
        title: 'Test',
        content: 'Content',
      };

      const recordingId = 'rec-fail';

      // Mock successful recording insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: recordingId, status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
        error: null,
      });

      // Mock transcript insert failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Transcript insert failed' },
      });

      // Mock cleanup delete
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', recordingId);
    });

    it('should enforce organization-level data isolation', async () => {
      // Arrange
      const requestBody = {
        title: 'Test',
        content: 'Content',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: 'rec-1', org_id: 'test-org-id', status: 'uploaded', content_type: 'text', created_at: '2025-01-15T10:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert - Verify org_id and created_by were set
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.org_id).toBe('test-org-id');
      expect(insertCall.created_by).toBe('test-user-id');
    });

    it('should set correct MIME type for plain text', async () => {
      // Arrange
      const requestBody = {
        title: 'Plain Note',
        content: 'Plain text content',
        format: 'plain',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'rec-1',
            mime_type: 'text/plain',
            status: 'uploaded',
            content_type: 'text',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.mime_type).toBe('text/plain');
    });

    it('should set correct MIME type for markdown', async () => {
      // Arrange
      const requestBody = {
        title: 'Markdown Note',
        content: '# Markdown',
        format: 'markdown',
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'rec-1',
            mime_type: 'text/markdown',
            status: 'uploaded',
            content_type: 'text',
            created_at: '2025-01-15T10:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: 'job-1' }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      await POST(request);

      // Assert
      const insertCall = mockSupabase.insert.mock.calls[0][0];
      expect(insertCall.mime_type).toBe('text/markdown');
    });

    it('should handle empty string title gracefully', async () => {
      // Arrange
      const requestBody = {
        title: '',
        content: 'Content',
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should handle empty string content gracefully', async () => {
      // Arrange
      const requestBody = {
        title: 'Title',
        content: '',
      };

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/text', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
    });
  });
});
