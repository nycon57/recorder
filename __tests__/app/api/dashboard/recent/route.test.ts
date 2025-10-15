/**
 * API Tests for Dashboard Recent Endpoint
 *
 * Tests: GET /api/dashboard/recent
 *
 * Validates:
 * - Recent items retrieval
 * - Content type filtering
 * - Limit parameter enforcement
 * - Sorting (most recent first)
 * - Organization-level data isolation
 * - Soft-delete exclusion
 * - Query parameter validation
 * - Error handling
 */

import { GET } from '@/app/api/dashboard/recent/route';
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

describe('Dashboard Recent API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      }),
    };

    (createClient as jest.Mock).mockResolvedValue(mockSupabase);
  });

  describe('GET /api/dashboard/recent', () => {
    it('should return recent items with default limit of 8', async () => {
      // Arrange
      const mockItems = [
        {
          id: '1',
          title: 'Recent Video',
          content_type: 'video',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Recent Audio',
          content_type: 'audio',
          status: 'completed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 2,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(mockSupabase.limit).toHaveBeenCalledWith(8); // Default limit
    });

    it('should respect custom limit parameter', async () => {
      // Arrange
      const mockItems = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Item ${i + 1}`,
        content_type: 'video',
        status: 'completed',
        created_at: new Date(2025, 0, 15 - i).toISOString(),
      }));

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems.slice(0, 20),
        error: null,
        count: 20,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?limit=20'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(20);
      expect(mockSupabase.limit).toHaveBeenCalledWith(20);
    });

    it('should enforce maximum limit of 50', async () => {
      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?limit=100'
      );
      const response = await GET(request);

      // Assert - Should return validation error
      expect(response.status).toBe(400);
    });

    it('should enforce minimum limit of 1', async () => {
      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?limit=0'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should filter by single content type', async () => {
      // Arrange
      const mockItems = [
        {
          id: '1',
          title: 'Video 1',
          content_type: 'video',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Video 2',
          content_type: 'video',
          status: 'completed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 2,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?types=video'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.data.every((item: any) => item.content_type === 'video')).toBe(
        true
      );
      expect(mockSupabase.in).toHaveBeenCalledWith('content_type', ['video']);
    });

    it('should filter by multiple content types', async () => {
      // Arrange
      const mockItems = [
        {
          id: '1',
          title: 'Video',
          content_type: 'video',
          status: 'completed',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Audio',
          content_type: 'audio',
          status: 'completed',
          created_at: '2025-01-14T10:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 2,
      });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?types=video,audio'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(mockSupabase.in).toHaveBeenCalledWith('content_type', [
        'video',
        'audio',
      ]);
    });

    it('should return items sorted by created_at descending', async () => {
      // Arrange
      const mockItems = [
        {
          id: '1',
          title: 'Newest',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Middle',
          created_at: '2025-01-14T10:00:00Z',
        },
        {
          id: '3',
          title: 'Oldest',
          created_at: '2025-01-13T10:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 3,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(mockSupabase.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(data.data[0].title).toBe('Newest');
      expect(data.data[2].title).toBe('Oldest');
    });

    it('should enforce organization-level data isolation', async () => {
      // Arrange
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      await GET(request);

      // Assert
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });

    it('should exclude soft-deleted items', async () => {
      // Arrange
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      await GET(request);

      // Assert
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
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
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
        created_by: 'user-123',
      };

      mockSupabase.limit.mockResolvedValueOnce({
        data: [mockItem],
        error: null,
        count: 1,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data[0]).toMatchObject({
        id: '1',
        title: 'Test Item',
        description: 'Test description',
        content_type: 'video',
        file_type: 'mp4',
        status: 'completed',
        file_size: 10000000,
        duration_sec: 120,
        thumbnail_url: 'https://example.com/thumb.jpg',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T11:00:00Z',
        created_by: 'user-123',
      });
    });

    it('should handle empty results gracefully', async () => {
      // Arrange
      mockSupabase.limit.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabase.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(500);
    });

    it('should handle null descriptions gracefully', async () => {
      // Arrange
      const mockItem = {
        id: '1',
        title: 'Test Item',
        description: null,
        content_type: 'video',
        status: 'completed',
        created_at: '2025-01-15T10:00:00Z',
        updated_at: '2025-01-15T10:00:00Z',
        created_by: 'user-123',
      };

      mockSupabase.limit.mockResolvedValueOnce({
        data: [mockItem],
        error: null,
        count: 1,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data[0].description).toBeNull();
    });

    it('should validate invalid content types', async () => {
      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?types=invalid'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should handle mixed valid and invalid content types', async () => {
      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/recent?types=video,invalid,audio'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should return correct total count', async () => {
      // Arrange
      const mockItems = Array.from({ length: 8 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Item ${i + 1}`,
        content_type: 'video',
        status: 'completed',
        created_at: new Date(2025, 0, 15 - i).toISOString(),
      }));

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 100, // Total in database
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(8); // Returned items
      expect(data.total).toBe(100); // Total count
    });

    it('should include all content types when no filter is applied', async () => {
      // Arrange
      const mockItems = [
        { id: '1', content_type: 'recording', created_at: '2025-01-15T10:00:00Z' },
        { id: '2', content_type: 'video', created_at: '2025-01-14T10:00:00Z' },
        { id: '3', content_type: 'audio', created_at: '2025-01-13T10:00:00Z' },
        { id: '4', content_type: 'document', created_at: '2025-01-12T10:00:00Z' },
        { id: '5', content_type: 'text', created_at: '2025-01-11T10:00:00Z' },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 5,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(5);
      expect(mockSupabase.in).not.toHaveBeenCalled(); // No filter applied
    });

    it('should handle all valid content types', async () => {
      const contentTypes = ['recording', 'video', 'audio', 'document', 'text'];

      for (const type of contentTypes) {
        jest.clearAllMocks();

        mockSupabase.limit.mockResolvedValueOnce({
          data: [],
          error: null,
          count: 0,
        });

        const request = new NextRequest(
          `http://localhost:3000/api/dashboard/recent?types=${type}`
        );
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockSupabase.in).toHaveBeenCalledWith('content_type', [type]);
      }
    });

    it('should handle items in various statuses', async () => {
      // Arrange
      const mockItems = [
        {
          id: '1',
          title: 'Uploading',
          status: 'uploading',
          created_at: '2025-01-15T10:00:00Z',
        },
        {
          id: '2',
          title: 'Transcribing',
          status: 'transcribing',
          created_at: '2025-01-14T10:00:00Z',
        },
        {
          id: '3',
          title: 'Completed',
          status: 'completed',
          created_at: '2025-01-13T10:00:00Z',
        },
        {
          id: '4',
          title: 'Error',
          status: 'error',
          created_at: '2025-01-12T10:00:00Z',
        },
      ];

      mockSupabase.limit.mockResolvedValueOnce({
        data: mockItems,
        error: null,
        count: 4,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/recent');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(4);
      expect(data.data.map((item: any) => item.status)).toEqual([
        'uploading',
        'transcribing',
        'completed',
        'error',
      ]);
    });
  });
});
