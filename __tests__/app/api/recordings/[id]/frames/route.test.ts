/**
 * Frames API Route Unit Tests
 *
 * Tests GET and POST endpoints for frame management including:
 * - Frame retrieval with pagination
 * - Frame filtering by time range
 * - Presigned URL generation
 * - Frame extraction job triggering
 * - Authentication and authorization
 * - RLS policy enforcement
 * - Error handling
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/recordings/[id]/frames/route';

// Mock dependencies
jest.mock('@/lib/utils/api', () => ({
  apiHandler: jest.fn((handler) => handler),
  requireOrg: jest.fn(),
  successResponse: jest.fn((data) => ({
    status: 200,
    json: async () => ({ data }),
  })),
  errors: {
    notFound: jest.fn((resource) => ({
      status: 404,
      json: async () => ({ error: `${resource} not found` }),
    })),
    unauthorized: jest.fn(() => ({
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })),
  },
}));

jest.mock('@/lib/validations/api');

const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();

const mockSupabase = {
  from: jest.fn(() => ({
    select: mockSelect,
    insert: mockInsert,
  })),
};

const mockCreateSignedUrl = jest.fn();
const mockSupabaseAdmin = {
  storage: {
    from: jest.fn(() => ({
      createSignedUrl: mockCreateSignedUrl,
    })),
  },
};

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

describe('Frames API Route', () => {
  const mockOrgId = 'test-org-123';
  const mockUserId = 'test-user-456';
  const mockRecordingId = 'test-recording-789';

  const mockRecording = {
    id: mockRecordingId,
    org_id: mockOrgId,
    title: 'Test Recording',
    duration_sec: 120,
    metadata: {},
  };

  const mockFrames = [
    {
      id: 'frame-1',
      recording_id: mockRecordingId,
      frame_number: 1,
      frame_time_sec: 1.0,
      frame_url: `${mockOrgId}/${mockRecordingId}/frames/frame_0001.jpg`,
      visual_description: 'Code editor showing JavaScript',
      ocr_text: 'console.log("Hello")',
      scene_type: 'code',
      detected_elements: ['code editor', 'syntax highlighting'],
      metadata: { confidence: 0.95 },
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'frame-2',
      recording_id: mockRecordingId,
      frame_number: 2,
      frame_time_sec: 2.0,
      frame_url: `${mockOrgId}/${mockRecordingId}/frames/frame_0002.jpg`,
      visual_description: 'Browser showing React app',
      ocr_text: 'React Application',
      scene_type: 'browser',
      detected_elements: ['browser', 'navigation bar'],
      metadata: { confidence: 0.92 },
      created_at: '2025-01-01T00:00:01Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    const { requireOrg } = require('@/lib/utils/api');
    requireOrg.mockResolvedValue({ orgId: mockOrgId, userId: mockUserId });

    // Setup Supabase query chain
    mockRange.mockResolvedValue({ data: mockFrames, error: null, count: 10 });
    mockOrder.mockReturnValue({ range: mockRange });
    mockLte.mockReturnValue({ order: mockOrder });
    mockGte.mockReturnValue({ lte: mockLte });
    mockEq.mockReturnValue({ gte: mockGte, order: mockOrder });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockSingle.mockResolvedValue({ data: mockRecording, error: null });

    // Mock presigned URL generation
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://storage.supabase.co/signed/frame.jpg' },
      error: null,
    });
  });

  describe('GET /api/recordings/[id]/frames', () => {
    it('should retrieve frames with pagination', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?page=1&limit=50`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(mockSelect).toHaveBeenCalledWith(
        expect.stringContaining('frame_number'),
        expect.objectContaining({ count: 'exact' })
      );
      expect(data.data.frames).toHaveLength(2);
      expect(data.data.pagination).toMatchObject({
        page: 1,
        limit: 50,
        total: 10,
      });
    });

    it('should verify recording belongs to org', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      expect(mockEq).toHaveBeenCalledWith('id', mockRecordingId);
      expect(mockEq).toHaveBeenCalledWith('org_id', mockOrgId);
    });

    it('should return 404 if recording not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);

      expect(response.status).toBe(404);
    });

    it('should filter frames by time range', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?startTime=1.0&endTime=5.0`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      expect(mockGte).toHaveBeenCalledWith('frame_time_sec', 1.0);
      expect(mockLte).toHaveBeenCalledWith('frame_time_sec', 5.0);
    });

    it('should generate presigned URLs for frames', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
      expect(data.data.frames[0].frameUrl).toContain('signed');
    });

    it('should optionally include visual descriptions', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?includeDescriptions=true`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.frames[0].visualDescription).toBeDefined();
    });

    it('should exclude descriptions by default', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?includeDescriptions=false`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.frames[0].visualDescription).toBeUndefined();
    });

    it('should optionally include OCR text', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?includeOcr=true`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.frames[0].ocrText).toBeDefined();
    });

    it('should order frames by frame number', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      expect(mockOrder).toHaveBeenCalledWith('frame_number', { ascending: true });
    });

    it('should calculate pagination metadata', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?page=2&limit=5`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.pagination).toMatchObject({
        page: 2,
        limit: 5,
        total: 10,
        totalPages: 2,
        hasMore: false,
        hasPrevious: true,
      });
    });

    it('should handle frame count of zero', async () => {
      mockRange.mockResolvedValueOnce({ data: [], error: null, count: 0 });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.frames).toHaveLength(0);
      expect(data.data.pagination.total).toBe(0);
    });

    it('should handle presigned URL generation errors', async () => {
      mockCreateSignedUrl.mockResolvedValueOnce({
        data: null,
        error: new Error('Storage error'),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      // Should still return frames but with null URLs
      expect(data.data.frames[0].frameUrl).toBeNull();
    });

    it('should use correct storage bucket', async () => {
      process.env.FRAMES_STORAGE_BUCKET = 'custom-frames';

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith('custom-frames');

      delete process.env.FRAMES_STORAGE_BUCKET;
    });

    it('should require authentication', async () => {
      const { requireOrg } = require('@/lib/utils/api');
      requireOrg.mockRejectedValueOnce(new Error('Unauthorized'));

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await expect(GET(request, context as any)).rejects.toThrow('Unauthorized');
    });

    it('should enforce RLS policies via org check', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      // Verify org_id filter is applied
      expect(mockEq).toHaveBeenCalledWith('org_id', mockOrgId);
    });
  });

  describe('POST /api/recordings/[id]/frames', () => {
    beforeEach(() => {
      mockInsert.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'job-123' },
          error: null,
        }),
      });

      // Mock frame count check
      mockSelect.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
        single: mockSingle,
      });
    });

    it('should trigger frame extraction job', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await POST(request, context as any);

      expect(mockInsert).toHaveBeenCalledWith({
        type: 'extract_frames',
        status: 'pending',
        payload: {
          recordingId: mockRecordingId,
          orgId: mockOrgId,
          videoUrl: undefined,
        },
        dedupe_key: `extract_frames:${mockRecordingId}`,
      });
    });

    it('should verify recording exists and belongs to org', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await POST(request, context as any);

      expect(mockSelect).toHaveBeenCalledWith('id, video_url');
      expect(mockEq).toHaveBeenCalledWith('id', mockRecordingId);
      expect(mockEq).toHaveBeenCalledWith('org_id', mockOrgId);
    });

    it('should return error if recording not found', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await expect(POST(request, context as any)).rejects.toThrow(
        'Recording not found'
      );
    });

    it('should skip if frames already exist', async () => {
      mockSelect.mockReturnValue({
        eq: jest.fn().mockResolvedValue({ count: 10, error: null }),
        single: mockSingle,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await POST(request, context as any);
      const data = await response.json();

      expect(data.data.message).toContain('already extracted');
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should return job ID on success', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await POST(request, context as any);
      const data = await response.json();

      expect(data.data.jobId).toBe('job-123');
      expect(data.data.message).toContain('queued');
    });

    it('should handle job insertion errors', async () => {
      mockInsert.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Job insertion failed'),
        }),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await expect(POST(request, context as any)).rejects.toThrow(
        'Failed to queue frame extraction'
      );
    });

    it('should use dedupe key to prevent duplicate jobs', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await POST(request, context as any);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          dedupe_key: `extract_frames:${mockRecordingId}`,
        })
      );
    });

    it('should require authentication', async () => {
      const { requireOrg } = require('@/lib/utils/api');
      requireOrg.mockRejectedValueOnce(new Error('Unauthorized'));

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`,
        { method: 'POST' }
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await expect(POST(request, context as any)).rejects.toThrow('Unauthorized');
    });
  });

  describe('query parameter validation', () => {
    it('should validate page parameter', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?page=0`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      // Should use default page 1
      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.pagination.page).toBe(1);
    });

    it('should validate limit parameter', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?limit=500`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      // Should cap at max limit (300)
      expect(data.data.pagination.limit).toBeLessThanOrEqual(300);
    });

    it('should parse boolean query parameters correctly', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?includeDescriptions=true&includeOcr=false`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const response = await GET(request, context as any);
      const data = await response.json();

      expect(data.data.frames[0].visualDescription).toBeDefined();
      expect(data.data.frames[0].ocrText).toBeUndefined();
    });
  });

  describe('error cases', () => {
    it('should handle database query errors', async () => {
      mockRange.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error'),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await expect(GET(request, context as any)).rejects.toThrow();
    });

    it('should handle missing recording ID', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/recordings//frames'
      );
      const context = { params: Promise.resolve({ id: '' }) };

      mockSingle.mockResolvedValueOnce({ data: null, error: null });

      const response = await GET(request, context as any);

      expect(response.status).toBe(404);
    });

    it('should handle invalid time range', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?startTime=10&endTime=5`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      // Should still execute query (database will return empty results)
      const response = await GET(request, context as any);

      expect(response.status).toBe(200);
    });
  });

  describe('performance', () => {
    it('should complete GET request quickly', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      const startTime = Date.now();
      await GET(request, context as any);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should handle pagination efficiently', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/recordings/${mockRecordingId}/frames?page=100&limit=50`
      );
      const context = { params: Promise.resolve({ id: mockRecordingId }) };

      await GET(request, context as any);

      // Should use LIMIT/OFFSET for efficiency
      expect(mockRange).toHaveBeenCalled();
    });
  });
});
