import { GET, POST } from '@/app/api/recordings/route';
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
  }),
}));

describe('Recordings API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      storage: {
        from: jest.fn().mockReturnThis(),
        createSignedUploadUrl: jest.fn(),
      },
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/recordings', () => {
    it('should return recordings for org', async () => {
      const mockRecordings = [
        { id: '1', title: 'Recording 1', org_id: 'test-org-id' },
        { id: '2', title: 'Recording 2', org_id: 'test-org-id' },
      ];

      mockSupabase.single.mockResolvedValue({
        data: mockRecordings,
        error: null,
        count: 2,
      });

      const request = new NextRequest('http://localhost:3000/api/recordings?limit=10&offset=0');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
    });

    it('should respect pagination params', async () => {
      mockSupabase.single.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const request = new NextRequest('http://localhost:3000/api/recordings?limit=50&offset=100');
      await GET(request);

      expect(mockSupabase.range).toHaveBeenCalledWith(100, 149);
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = new NextRequest('http://localhost:3000/api/recordings');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/recordings', () => {
    it('should create recording and return upload URL', async () => {
      const mockRecording = {
        id: 'new-recording-id',
        org_id: 'test-org-id',
        created_by: 'test-user-id',
        status: 'uploading',
      };

      mockSupabase.single.mockResolvedValue({
        data: mockRecording,
        error: null,
      });

      mockSupabase.storage.createSignedUploadUrl.mockResolvedValue({
        data: {
          signedUrl: 'https://supabase.co/upload/signed-url',
          path: 'org_test-org-id/recordings/new-recording-id/raw.webm',
          token: 'upload-token',
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/recordings', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Recording',
          description: 'Test description',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.recording.id).toBe('new-recording-id');
      expect(data.uploadUrl).toBeDefined();
    });

    it('should handle missing title/description', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'test-id' },
        error: null,
      });

      mockSupabase.storage.createSignedUploadUrl.mockResolvedValue({
        data: { signedUrl: 'url', path: 'path', token: 'token' },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/recordings', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      expect(response.status).toBe(201);
    });
  });
});
