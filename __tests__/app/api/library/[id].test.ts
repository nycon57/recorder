/**
 * API Tests for Library Single Item Endpoint
 *
 * Tests: GET /api/library/[id], PATCH /api/library/[id], DELETE /api/library/[id]
 *
 * Validates:
 * - GET single item retrieval with full details
 * - PATCH metadata updates
 * - DELETE soft delete
 * - DELETE permanent delete
 * - Signed URL generation
 * - Organization-level access control
 * - Transcript and document embedding
 * - Error handling
 */

import { GET, PATCH, DELETE } from '@/app/api/library/[id]/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

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

describe('Library Single Item API', () => {
  let mockSupabase: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      from: jest.fn().mockReturnThis(),
      createSignedUrl: jest.fn(),
      remove: jest.fn(),
    };

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn(),
      storage: mockStorage,
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
    (supabaseAdmin.from as jest.Mock) = mockSupabase.from;
    (supabaseAdmin.storage.from as jest.Mock) = mockStorage.from;
  });

  describe('GET /api/library/[id]', () => {
    it('should retrieve item with full details', async () => {
      // Arrange
      const mockItem = {
        id: 'item-123',
        title: 'Test Video',
        description: 'A test video',
        content_type: 'video',
        file_type: 'mp4',
        status: 'completed',
        storage_path_raw: 'org/video.mp4',
        storage_path_processed: 'org/video-processed.mp4',
        transcripts: [{ id: 'transcript-1', text: 'Hello world' }],
        documents: [{ id: 'doc-1', content: 'Summary' }],
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockItem,
        error: null,
      });

      mockStorage.createSignedUrl
        .mockResolvedValueOnce({
          data: { signedUrl: 'https://example.com/raw-url' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { signedUrl: 'https://example.com/processed-url' },
          error: null,
        });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123');
      const params = Promise.resolve({ id: 'item-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.id).toBe('item-123');
      expect(data.data.fileUrl).toBe('https://example.com/processed-url'); // Prefers processed
      expect(data.data.transcripts).toBeDefined();
      expect(data.data.documents).toBeDefined();
    });

    it('should return 404 for non-existent item', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/fake-id');
      const params = Promise.resolve({ id: 'fake-id' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.message).toContain('not found');
    });

    it('should enforce organization-level access control', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/other-org-item');
      const params = Promise.resolve({ id: 'other-org-item' });
      await GET(request, { params });

      // Assert - Verify org_id filter was applied
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });

    it('should generate signed URLs for video files', async () => {
      // Arrange
      const mockItem = {
        id: 'item-123',
        content_type: 'video',
        storage_path_raw: 'org/video.webm',
        storage_path_processed: 'org/video.mp4',
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockItem,
        error: null,
      });

      mockStorage.createSignedUrl
        .mockResolvedValueOnce({
          data: { signedUrl: 'https://example.com/raw' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { signedUrl: 'https://example.com/processed' },
          error: null,
        });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123');
      const params = Promise.resolve({ id: 'item-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.fileUrl).toBe('https://example.com/processed');
      expect(data.data.downloadUrl).toBe('https://example.com/processed');
    });

    it('should not generate URLs for text notes', async () => {
      // Arrange
      const mockItem = {
        id: 'item-123',
        content_type: 'text',
        storage_path_raw: null,
        transcripts: [{ text: 'Note content' }],
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockItem,
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123');
      const params = Promise.resolve({ id: 'item-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.fileUrl).toBeNull();
      expect(data.data.downloadUrl).toBeNull();
    });

    it('should handle missing processed file for videos', async () => {
      // Arrange
      const mockItem = {
        id: 'item-123',
        content_type: 'video',
        storage_path_raw: 'org/video.mp4',
        storage_path_processed: null,
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: mockItem,
        error: null,
      });

      mockStorage.createSignedUrl.mockResolvedValueOnce({
        data: { signedUrl: 'https://example.com/raw' },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123');
      const params = Promise.resolve({ id: 'item-123' });
      const response = await GET(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.fileUrl).toBe('https://example.com/raw'); // Falls back to raw
    });
  });

  describe('PATCH /api/library/[id]', () => {
    it('should update item title', async () => {
      // Arrange
      const updates = { title: 'Updated Title' };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          title: 'Updated Title',
          description: null,
          metadata: {},
          updated_at: '2025-01-15T12:00:00Z',
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await PATCH(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.title).toBe('Updated Title');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should update item description', async () => {
      // Arrange
      const updates = { description: 'New description' };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          title: 'Test',
          description: 'New description',
          metadata: {},
          updated_at: '2025-01-15T12:00:00Z',
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await PATCH(request, { params });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should update item metadata', async () => {
      // Arrange
      const updates = {
        metadata: {
          tags: ['important', 'urgent'],
          category: 'meetings',
        },
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          title: 'Test',
          description: null,
          metadata: updates.metadata,
          updated_at: '2025-01-15T12:00:00Z',
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await PATCH(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.metadata).toMatchObject(updates.metadata);
    });

    it('should update multiple fields at once', async () => {
      // Arrange
      const updates = {
        title: 'New Title',
        description: 'New Description',
        metadata: { tag: 'test' },
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          ...updates,
          updated_at: '2025-01-15T12:00:00Z',
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await PATCH(request, { params });

      // Assert
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent item', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/fake-id', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Test' }),
      });
      const params = Promise.resolve({ id: 'fake-id' });
      const response = await PATCH(request, { params });

      // Assert
      expect(response.status).toBe(404);
    });

    it('should validate title length', async () => {
      // Arrange
      const updates = { title: 'a'.repeat(201) }; // Exceeds max length

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await PATCH(request, { params });

      // Assert
      expect(response.status).toBe(400); // Validation error
    });

    it('should enforce organization-level access control', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Test' }),
      });
      const params = Promise.resolve({ id: 'item-123' });
      await PATCH(request, { params });

      // Assert
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });
  });

  describe('DELETE /api/library/[id]', () => {
    it('should perform soft delete by default', async () => {
      // Arrange
      const deletedAt = new Date().toISOString();

      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          deleted_at: deletedAt,
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'item-123' });
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
      expect(data.data.message).toContain('soft deleted');
      expect(data.data.deleted_at).toBeDefined();
    });

    it('should perform permanent delete when requested', async () => {
      // Arrange
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'item-123',
            storage_path_raw: 'org/video.mp4',
            storage_path_processed: 'org/video-processed.mp4',
            content_type: 'video',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      mockStorage.remove.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library/item-123?permanent=true',
        { method: 'DELETE' }
      );
      const params = Promise.resolve({ id: 'item-123' });
      const response = await DELETE(request, { params });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.success).toBe(true);
      expect(data.data.message).toContain('permanently deleted');
      expect(mockStorage.remove).toHaveBeenCalled();
      expect(mockSupabase.delete).toHaveBeenCalled();
    });

    it('should delete storage files on permanent delete', async () => {
      // Arrange
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'item-123',
            storage_path_raw: 'org/file1.mp4',
            storage_path_processed: 'org/file2.mp4',
            content_type: 'video',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: null,
        });

      mockStorage.remove.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library/item-123?permanent=true',
        { method: 'DELETE' }
      );
      const params = Promise.resolve({ id: 'item-123' });
      await DELETE(request, { params });

      // Assert
      expect(mockStorage.remove).toHaveBeenCalledWith([
        'org/file1.mp4',
        'org/file2.mp4',
      ]);
    });

    it('should return 404 for non-existent item on soft delete', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/fake-id', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'fake-id' });
      const response = await DELETE(request, { params });

      // Assert
      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent item on permanent delete', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library/fake-id?permanent=true',
        { method: 'DELETE' }
      );
      const params = Promise.resolve({ id: 'fake-id' });
      const response = await DELETE(request, { params });

      // Assert
      expect(response.status).toBe(404);
    });

    it('should enforce organization-level access control on delete', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'item-123',
          deleted_at: new Date().toISOString(),
        },
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library/item-123', {
        method: 'DELETE',
      });
      const params = Promise.resolve({ id: 'item-123' });
      await DELETE(request, { params });

      // Assert
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });
  });
});
