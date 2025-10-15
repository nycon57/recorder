/**
 * API Tests for Library List Endpoint
 *
 * Tests: GET /api/library
 *
 * Validates:
 * - List all items retrieval
 * - Filtering by content type
 * - Filtering by status
 * - Search functionality
 * - Pagination (limit, offset)
 * - Sorting by date
 * - Organization-level data isolation
 * - Soft-delete exclusion
 * - Query parameter validation
 * - Error handling
 */

import { GET } from '@/app/api/library/route';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
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

describe('Library List API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      or: jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('GET /api/library', () => {
    it('should list all items with default pagination', async () => {
      // Arrange
      const mockItems = Array.from({ length: 5 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        content_type: 'video',
        status: 'completed',
        created_at: new Date(2025, 0, 15 - i).toISOString(),
      }));

      mockSupabase.range.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 5,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.data).toHaveLength(5);
      expect(data.data.pagination.total).toBe(5);
      expect(data.data.pagination.limit).toBe(50); // Default limit
      expect(data.data.pagination.offset).toBe(0);
    });

    it('should respect custom limit parameter', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library?limit=20');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.pagination.limit).toBe(20);
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 19); // limit-1
    });

    it('should respect custom offset parameter', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 100,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library?limit=10&offset=20');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.pagination.offset).toBe(20);
      expect(mockSupabase.range).toHaveBeenCalledWith(20, 29);
    });

    it('should enforce maximum limit of 100', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library?limit=500');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.pagination.limit).toBe(100); // Capped at max
    });

    it('should filter by content type', async () => {
      // Arrange
      const mockVideos = [
        { id: '1', content_type: 'video', title: 'Video 1' },
        { id: '2', content_type: 'video', title: 'Video 2' },
      ];

      mockSupabase.range.mockResolvedValueOnce({
        data: mockVideos,
        error: null,
        count: 2,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?content_type=video'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.filters.content_type).toBe('video');
      expect(mockSupabase.eq).toHaveBeenCalledWith('content_type', 'video');
    });

    it('should filter by status', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?status=transcribing'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.filters.status).toBe('transcribing');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'transcribing');
    });

    it('should search by title, description, or filename', async () => {
      // Arrange
      mockSupabase.or.mockResolvedValueOnce({
        data: [{ id: '1', title: 'Meeting Notes', content_type: 'text' }],
        error: null,
        count: 1,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?search=meeting'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.filters.search).toBe('meeting');
      expect(mockSupabase.or).toHaveBeenCalledWith(
        expect.stringContaining('title.ilike.%meeting%')
      );
    });

    it('should combine multiple filters', async () => {
      // Arrange
      mockSupabase.or.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?content_type=document&status=completed&search=report'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.filters.content_type).toBe('document');
      expect(data.data.filters.status).toBe('completed');
      expect(data.data.filters.search).toBe('report');
    });

    it('should sort by created_at descending', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      await GET(request);

      // Assert
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
    });

    it('should enforce organization-level data isolation', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      await GET(request);

      // Assert
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });

    it('should exclude soft-deleted items', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      await GET(request);

      // Assert
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should calculate hasMore correctly', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: Array(10).fill({ id: '1' }),
        error: null,
        count: 100,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library?limit=10&offset=0');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.pagination.hasMore).toBe(true);
    });

    it('should set hasMore to false on last page', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: Array(10).fill({ id: '1' }),
        error: null,
        count: 10,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library?limit=10&offset=0');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.pagination.hasMore).toBe(false);
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.data).toEqual([]);
      expect(data.data.pagination.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(500);
    });

    it('should handle all content types', async () => {
      const contentTypes = ['recording', 'video', 'audio', 'document', 'text'];

      for (const type of contentTypes) {
        jest.clearAllMocks();

        mockSupabase.range.mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/library?content_type=${type}`
        );
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockSupabase.eq).toHaveBeenCalledWith('content_type', type);
      }
    });

    it('should return all required fields', async () => {
      // Arrange
      const mockItem = {
        id: '1',
        title: 'Test Item',
        description: 'Test description',
        content_type: 'video',
        file_type: 'mp4',
        status: 'completed',
        file_size: 10000000,
        duration_sec: 120,
        thumbnail_url: 'https://example.com/thumb.jpg',
        storage_path_raw: 'org/video.mp4',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
        created_by: 'user-123',
      };

      mockSupabase.range.mockResolvedValueOnce({
        data: [mockItem],
        error: null,
        count: 1,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/library');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.data[0]).toMatchObject(mockItem);
    });

    it('should handle case-insensitive search', async () => {
      // Arrange
      mockSupabase.or.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?search=MEETING'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockSupabase.or).toHaveBeenCalledWith(
        expect.stringContaining('ilike')
      );
    });

    it('should handle special characters in search', async () => {
      // Arrange
      mockSupabase.or.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/library?search=test%20file'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.filters.search).toBe('test file');
    });

    it('should handle pagination beyond available items', async () => {
      // Arrange
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 10,
      });

      // Act - Request offset 100 when only 10 items exist
      const request = new NextRequest(
        'http://localhost:3000/api/library?limit=10&offset=100'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data.data).toEqual([]);
      expect(data.data.pagination.hasMore).toBe(false);
    });
  });
});
