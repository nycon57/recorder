/**
 * API Tests for Dashboard Stats Endpoint
 *
 * Tests: GET /api/dashboard/stats
 *
 * Validates:
 * - Stats calculation accuracy
 * - Content type breakdowns
 * - Status breakdowns
 * - Time period filtering
 * - Organization-level data isolation
 * - Query parameter validation
 * - Error handling
 */

import { GET } from '@/app/api/dashboard/stats/route';
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

describe('Dashboard Stats API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    };

    (supabaseAdmin.from as jest.Mock) = mockSupabase.from;
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return comprehensive dashboard statistics', async () => {
      // Arrange
      const mockRecordings = [
        {
          id: '1',
          content_type: 'video',
          file_size: 10000000,
          status: 'completed',
        },
        {
          id: '2',
          content_type: 'audio',
          file_size: 5000000,
          status: 'completed',
        },
        {
          id: '3',
          content_type: 'document',
          file_size: 2000000,
          status: 'transcribing',
        },
      ];

      // Mock total count
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        count: 3,
        error: null,
      });

      // Mock storage data
      mockSupabase.select.mockReturnValueOnce({
        data: mockRecordings,
        error: null,
      });

      // Mock weekly count
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        count: 2,
        error: null,
      });

      // Mock processing count
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        count: 1,
        error: null,
      });

      // Mock status data (second call to storage query)
      mockSupabase.select.mockReturnValueOnce({
        data: mockRecordings,
        error: null,
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.totalItems).toBe(3);
      expect(data.storageUsedBytes).toBe(17000000); // Sum of all file sizes
      expect(data.itemsThisWeek).toBe(2);
      expect(data.processingCount).toBe(1);
      expect(data.breakdown).toBeDefined();
      expect(data.statusBreakdown).toBeDefined();
    });

    it('should calculate correct content type breakdown', async () => {
      // Arrange
      const mockRecordings = [
        { content_type: 'video', file_size: 10000000 },
        { content_type: 'video', file_size: 15000000 },
        { content_type: 'audio', file_size: 5000000 },
        { content_type: 'document', file_size: 2000000 },
        { content_type: 'text', file_size: 100000 },
      ];

      // Mock counts
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: mockRecordings, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 3, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: mockRecordings, error: null });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?includeBreakdown=true'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.breakdown).toBeDefined();
      expect(data.breakdown.video.count).toBe(2);
      expect(data.breakdown.video.storageBytes).toBe(25000000);
      expect(data.breakdown.audio.count).toBe(1);
      expect(data.breakdown.audio.storageBytes).toBe(5000000);
      expect(data.breakdown.document.count).toBe(1);
      expect(data.breakdown.document.storageBytes).toBe(2000000);
      expect(data.breakdown.text.count).toBe(1);
      expect(data.breakdown.text.storageBytes).toBe(100000);
    });

    it('should calculate correct status breakdown', async () => {
      // Arrange
      const mockStatuses = [
        { status: 'completed' },
        { status: 'completed' },
        { status: 'transcribing' },
        { status: 'uploading' },
        { status: 'error' },
      ];

      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 3, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: mockStatuses, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.statusBreakdown).toBeDefined();
      expect(data.statusBreakdown.completed).toBe(2);
      expect(data.statusBreakdown.transcribing).toBe(1);
      expect(data.statusBreakdown.uploading).toBe(1);
      expect(data.statusBreakdown.error).toBe(1);
      expect(data.statusBreakdown.uploaded).toBe(0);
    });

    it('should filter by time period: week', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 10, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?period=week'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.itemsThisWeek).toBe(5);
      expect(data.itemsThisMonth).toBeUndefined(); // Week period shouldn't include month
    });

    it('should filter by time period: month', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 50, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 10, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 25, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?period=month'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.itemsThisWeek).toBe(10);
      expect(data.itemsThisMonth).toBe(25);
    });

    it('should respect includeStorage parameter', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 2, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?includeStorage=true'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.storageUsedBytes).toBeDefined();
      expect(typeof data.storageUsedBytes).toBe('number');
    });

    it('should respect includeBreakdown parameter', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 2, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act - Request WITHOUT breakdown
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?includeBreakdown=false'
      );
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.breakdown).toBeUndefined();
    });

    it('should enforce organization-level data isolation', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 2, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      await GET(request);

      // Assert - Verify org_id filter is applied
      expect(mockSupabase.eq).toHaveBeenCalledWith('org_id', 'test-org-id');
    });

    it('should exclude soft-deleted items', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 2, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      await GET(request);

      // Assert - Verify deleted_at filter is applied
      expect(mockSupabase.is).toHaveBeenCalledWith('deleted_at', null);
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockSupabase.select.mockReturnValueOnce({
        ...mockSupabase,
        count: null,
        error: { message: 'Database connection failed' },
      });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert - Should still return stats with default values
      expect(response.status).toBe(200);
      expect(data.totalItems).toBe(0);
    });

    it('should handle missing data gracefully', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: null, error: null })
        .mockReturnValueOnce({ data: null, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: null, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: null, error: null })
        .mockReturnValueOnce({ data: null, error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.totalItems).toBe(0);
      expect(data.storageUsedBytes).toBe(0);
      expect(data.itemsThisWeek).toBe(0);
      expect(data.processingCount).toBe(0);
    });

    it('should validate invalid period parameter', async () => {
      // Act
      const request = new NextRequest(
        'http://localhost:3000/api/dashboard/stats?period=invalid'
      );
      const response = await GET(request);

      // Assert
      expect(response.status).toBe(400);
    });

    it('should handle zero items gracefully', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.totalItems).toBe(0);
      expect(data.storageUsedBytes).toBe(0);
      expect(data.itemsThisWeek).toBe(0);
      expect(data.processingCount).toBe(0);
    });

    it('should calculate storage correctly with null file sizes', async () => {
      // Arrange
      const mockRecordings = [
        { content_type: 'video', file_size: 10000000 },
        { content_type: 'audio', file_size: null }, // Missing size
        { content_type: 'document', file_size: 2000000 },
      ];

      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 3, error: null })
        .mockReturnValueOnce({ data: mockRecordings, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 1, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 0, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.storageUsedBytes).toBe(12000000); // Should skip null
    });

    it('should return all stats with default parameters', async () => {
      // Arrange
      mockSupabase.select
        .mockReturnValueOnce({ ...mockSupabase, count: 10, error: null })
        .mockReturnValueOnce({ data: [], error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 5, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 8, error: null })
        .mockReturnValueOnce({ ...mockSupabase, count: 2, error: null })
        .mockReturnValueOnce({ data: [], error: null });

      // Act - No query parameters
      const request = new NextRequest('http://localhost:3000/api/dashboard/stats');
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalItems');
      expect(data).toHaveProperty('storageUsedBytes');
      expect(data).toHaveProperty('itemsThisWeek');
      expect(data).toHaveProperty('itemsThisMonth');
      expect(data).toHaveProperty('processingCount');
      expect(data).toHaveProperty('breakdown');
      expect(data).toHaveProperty('statusBreakdown');
    });
  });
});
