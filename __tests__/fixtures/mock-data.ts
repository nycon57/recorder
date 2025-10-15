/**
 * Mock Data & Test Fixtures
 *
 * Reusable mock data for tests. Provides factory functions for creating
 * test data with sensible defaults and easy overrides.
 */

import type { ContentType } from '@/lib/types/database';

// ==================== Recordings ====================

export interface MockRecording {
  id: string;
  org_id: string;
  title: string;
  description: string | null;
  content_type: ContentType;
  file_type: string | null;
  status: string;
  file_size: number | null;
  duration_sec: number | null;
  thumbnail_url: string | null;
  storage_path_raw: string | null;
  storage_path_processed: string | null;
  original_filename: string | null;
  mime_type: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
}

export const mockRecording: MockRecording = {
  id: 'recording-123',
  org_id: 'org-123',
  title: 'Test Recording',
  description: 'A test recording',
  content_type: 'video',
  file_type: 'mp4',
  status: 'completed',
  file_size: 10485760, // 10MB
  duration_sec: 120,
  thumbnail_url: 'https://example.com/thumb.jpg',
  storage_path_raw: 'org-123/videos/recording-123.mp4',
  storage_path_processed: 'org-123/videos/recording-123-processed.mp4',
  original_filename: 'test-video.mp4',
  mime_type: 'video/mp4',
  created_by: 'user-123',
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T11:00:00Z',
  completed_at: '2025-01-15T11:00:00Z',
  deleted_at: null,
  error_message: null,
  metadata: {},
};

export function createMockRecording(
  overrides?: Partial<MockRecording>
): MockRecording {
  return { ...mockRecording, ...overrides };
}

export function createMockVideoRecording(
  overrides?: Partial<MockRecording>
): MockRecording {
  return createMockRecording({
    content_type: 'video',
    file_type: 'mp4',
    mime_type: 'video/mp4',
    duration_sec: 120,
    ...overrides,
  });
}

export function createMockAudioRecording(
  overrides?: Partial<MockRecording>
): MockRecording {
  return createMockRecording({
    content_type: 'audio',
    file_type: 'mp3',
    mime_type: 'audio/mpeg',
    duration_sec: 180,
    storage_path_processed: null,
    thumbnail_url: null,
    ...overrides,
  });
}

export function createMockDocumentRecording(
  overrides?: Partial<MockRecording>
): MockRecording {
  return createMockRecording({
    content_type: 'document',
    file_type: 'pdf',
    mime_type: 'application/pdf',
    duration_sec: null,
    storage_path_processed: null,
    thumbnail_url: null,
    ...overrides,
  });
}

export function createMockTextRecording(
  overrides?: Partial<MockRecording>
): MockRecording {
  return createMockRecording({
    content_type: 'text',
    file_type: 'txt',
    mime_type: 'text/plain',
    duration_sec: null,
    storage_path_raw: null,
    storage_path_processed: null,
    thumbnail_url: null,
    file_size: 1024,
    ...overrides,
  });
}

// ==================== Transcripts ====================

export interface MockTranscript {
  id: string;
  recording_id: string;
  text: string;
  language: string;
  confidence: number;
  provider: string;
  words_json: Record<string, any> | null;
  created_at: string;
}

export const mockTranscript: MockTranscript = {
  id: 'transcript-123',
  recording_id: 'recording-123',
  text: 'This is a test transcript with multiple sentences. It contains various content that would be typical in a real transcription.',
  language: 'en',
  confidence: 0.95,
  provider: 'openai-whisper',
  words_json: {
    words: [
      { text: 'This', start: 0, end: 0.5 },
      { text: 'is', start: 0.5, end: 0.7 },
      { text: 'a', start: 0.7, end: 0.8 },
      { text: 'test', start: 0.8, end: 1.2 },
    ],
  },
  created_at: '2025-01-15T10:30:00Z',
};

export function createMockTranscript(
  overrides?: Partial<MockTranscript>
): MockTranscript {
  return { ...mockTranscript, ...overrides };
}

// ==================== Documents ====================

export interface MockDocument {
  id: string;
  recording_id: string;
  content: string;
  format: string;
  provider: string;
  metadata: Record<string, any>;
  created_at: string;
}

export const mockDocument: MockDocument = {
  id: 'doc-123',
  recording_id: 'recording-123',
  content: '# Test Document\n\n## Summary\n\nThis is a test document with markdown formatting.\n\n## Key Points\n\n- Point 1\n- Point 2\n- Point 3',
  format: 'markdown',
  provider: 'openai-gpt-4',
  metadata: {
    wordCount: 50,
    sectionCount: 2,
  },
  created_at: '2025-01-15T10:45:00Z',
};

export function createMockDocument(
  overrides?: Partial<MockDocument>
): MockDocument {
  return { ...mockDocument, ...overrides };
}

// ==================== Jobs ====================

export interface MockJob {
  id: string;
  type: string;
  status: string;
  payload: Record<string, any>;
  attempt_count: number;
  max_attempts: number;
  run_after: string;
  dedupe_key: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const mockJob: MockJob = {
  id: 'job-123',
  type: 'transcribe',
  status: 'pending',
  payload: {
    recordingId: 'recording-123',
    orgId: 'org-123',
  },
  attempt_count: 0,
  max_attempts: 3,
  run_after: '2025-01-15T10:00:00Z',
  dedupe_key: 'transcribe:recording-123',
  error_message: null,
  created_at: '2025-01-15T10:00:00Z',
  updated_at: '2025-01-15T10:00:00Z',
};

export function createMockJob(overrides?: Partial<MockJob>): MockJob {
  return { ...mockJob, ...overrides };
}

export function createMockExtractAudioJob(
  recordingId: string,
  orgId: string
): MockJob {
  return createMockJob({
    type: 'extract_audio',
    payload: {
      recordingId,
      orgId,
      videoPath: `${orgId}/videos/${recordingId}.mp4`,
    },
    dedupe_key: `extract_audio:${recordingId}`,
  });
}

export function createMockTranscribeJob(
  recordingId: string,
  orgId: string
): MockJob {
  return createMockJob({
    type: 'transcribe',
    payload: {
      recordingId,
      orgId,
      storagePath: `${orgId}/audio/${recordingId}.mp3`,
    },
    dedupe_key: `transcribe:${recordingId}`,
  });
}

// ==================== Users & Organizations ====================

export interface MockUser {
  id: string;
  clerk_id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

export const mockUser: MockUser = {
  id: 'user-123',
  clerk_id: 'clerk-user-123',
  org_id: 'org-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'admin',
  created_at: '2025-01-01T00:00:00Z',
};

export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return { ...mockUser, ...overrides };
}

export interface MockOrganization {
  id: string;
  clerk_org_id: string;
  name: string;
  created_at: string;
}

export const mockOrganization: MockOrganization = {
  id: 'org-123',
  clerk_org_id: 'clerk-org-123',
  name: 'Test Organization',
  created_at: '2025-01-01T00:00:00Z',
};

export function createMockOrganization(
  overrides?: Partial<MockOrganization>
): MockOrganization {
  return { ...mockOrganization, ...overrides };
}

// ==================== Supabase Mock Helpers ====================

/**
 * Create a mock Supabase response
 */
export function createMockSupabaseResponse<T>(
  data: T | null,
  error: any = null
) {
  return {
    data,
    error,
    count: data ? (Array.isArray(data) ? data.length : 1) : 0,
  };
}

/**
 * Create a mock Supabase client with chainable methods
 */
export function createMockSupabaseClient() {
  const mockClient: any = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    or: jest.fn(),
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      download: jest.fn(),
      createSignedUrl: jest.fn(),
      remove: jest.fn(),
    },
  };

  return mockClient;
}

/**
 * Create a mock storage bucket
 */
export function createMockStorageBucket() {
  return {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    download: jest.fn(),
    createSignedUrl: jest.fn(),
    remove: jest.fn(),
    list: jest.fn(),
  };
}

// ==================== File Mock Helpers ====================

/**
 * Create a mock File object
 */
export function createMockFile(
  name: string,
  content: string,
  type: string
): File {
  return new File([content], name, { type });
}

export function createMockVideoFile(
  name = 'test-video.mp4',
  sizeMB = 10
): File {
  const content = 'x'.repeat(sizeMB * 1024 * 1024);
  return createMockFile(name, content, 'video/mp4');
}

export function createMockAudioFile(
  name = 'test-audio.mp3',
  sizeMB = 5
): File {
  const content = 'x'.repeat(sizeMB * 1024 * 1024);
  return createMockFile(name, content, 'audio/mpeg');
}

export function createMockPdfFile(name = 'test-doc.pdf', sizeMB = 2): File {
  const content = 'x'.repeat(sizeMB * 1024 * 1024);
  return createMockFile(name, content, 'application/pdf');
}

export function createMockDocxFile(name = 'test-doc.docx', sizeMB = 1): File {
  const content = 'x'.repeat(sizeMB * 1024 * 1024);
  return createMockFile(
    name,
    content,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
}

// ==================== API Response Helpers ====================

/**
 * Create a mock API success response
 */
export function createMockApiSuccess<T>(data: T, requestId = 'req-123') {
  return {
    data,
    requestId,
  };
}

/**
 * Create a mock API error response
 */
export function createMockApiError(
  message: string,
  code = 'ERROR',
  status = 400,
  requestId = 'req-123'
) {
  return {
    code,
    message,
    requestId,
    status,
  };
}

// ==================== Date/Time Helpers ====================

/**
 * Create a timestamp N hours ago
 */
export function hoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

/**
 * Create a timestamp N days ago
 */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Create a timestamp in the future
 */
export function hoursFromNow(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

// ==================== Bulk Data Generators ====================

/**
 * Create multiple mock recordings
 */
export function createMockRecordings(count: number): MockRecording[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRecording({
      id: `recording-${i}`,
      title: `Recording ${i}`,
      created_at: daysAgo(count - i),
    })
  );
}

/**
 * Create recordings with various statuses
 */
export function createMockRecordingsWithStatuses(): MockRecording[] {
  return [
    createMockRecording({ id: 'rec-1', status: 'uploading' }),
    createMockRecording({ id: 'rec-2', status: 'transcribing' }),
    createMockRecording({ id: 'rec-3', status: 'doc_generating' }),
    createMockRecording({ id: 'rec-4', status: 'embedding' }),
    createMockRecording({ id: 'rec-5', status: 'completed' }),
    createMockRecording({ id: 'rec-6', status: 'error', error_message: 'Test error' }),
  ];
}

/**
 * Create recordings with various content types
 */
export function createMockRecordingsWithTypes(): MockRecording[] {
  return [
    createMockVideoRecording({ id: 'rec-video' }),
    createMockAudioRecording({ id: 'rec-audio' }),
    createMockDocumentRecording({ id: 'rec-pdf' }),
    createMockTextRecording({ id: 'rec-text' }),
  ];
}
