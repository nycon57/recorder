/**
 * Phase 4 Test Fixtures
 *
 * Shared test data for frame extraction, visual indexing,
 * and multimodal search tests.
 */

import type { ExtractedFrame, FrameExtractionResult } from '@/lib/services/frame-extraction';
import type { VisualDescription } from '@/lib/services/visual-indexing';
import type { OCRResult } from '@/lib/services/ocr-service';
import type { VisualSearchResult } from '@/lib/types/video-frames';

/**
 * Mock recording data
 */
export const mockRecording = {
  id: 'test-recording-123',
  org_id: 'test-org-456',
  user_id: 'test-user-789',
  title: 'Test Recording - React Tutorial',
  description: 'A tutorial about React components and hooks',
  duration_sec: 120,
  video_url: 'org/recording/video.webm',
  status: 'completed',
  metadata: {
    width: 1920,
    height: 1080,
    fps: 30,
  },
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:05:00Z',
};

/**
 * Mock extracted frames
 */
export const mockExtractedFrames: ExtractedFrame[] = [
  {
    frameNumber: 1,
    timeSec: 0.5,
    localPath: '/tmp/frames/frame_0001.jpg',
    storagePath: 'test-org-456/test-recording-123/frames/frame_0001.jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 150000,
  },
  {
    frameNumber: 2,
    timeSec: 1.0,
    localPath: '/tmp/frames/frame_0002.jpg',
    storagePath: 'test-org-456/test-recording-123/frames/frame_0002.jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 145000,
  },
  {
    frameNumber: 3,
    timeSec: 1.5,
    localPath: '/tmp/frames/frame_0003.jpg',
    storagePath: 'test-org-456/test-recording-123/frames/frame_0003.jpg',
    width: 1920,
    height: 1080,
    sizeBytes: 148000,
  },
];

/**
 * Mock frame extraction result
 */
export const mockFrameExtractionResult: FrameExtractionResult = {
  recordingId: mockRecording.id,
  frames: mockExtractedFrames,
  duration: 5000,
  totalFrames: mockExtractedFrames.length,
};

/**
 * Mock visual descriptions from Gemini
 */
export const mockVisualDescriptions: VisualDescription[] = [
  {
    frameId: 'frame-1',
    description: 'Code editor showing JavaScript code with syntax highlighting. The editor displays a React functional component with JSX syntax.',
    sceneType: 'code',
    detectedElements: [
      'code editor',
      'line numbers',
      'syntax highlighting',
      'function definition',
      'JSX tags',
    ],
    confidence: 0.95,
  },
  {
    frameId: 'frame-2',
    description: 'Browser window displaying a React application with a navigation bar and main content area. The page shows a component gallery.',
    sceneType: 'browser',
    detectedElements: [
      'browser window',
      'navigation bar',
      'React logo',
      'component cards',
      'search input',
    ],
    confidence: 0.92,
  },
  {
    frameId: 'frame-3',
    description: 'Terminal window showing npm install output with package installation progress and dependency tree.',
    sceneType: 'terminal',
    detectedElements: [
      'terminal prompt',
      'npm command',
      'progress bar',
      'package names',
      'version numbers',
    ],
    confidence: 0.88,
  },
];

/**
 * Mock OCR results
 */
export const mockOCRResults: OCRResult[] = [
  {
    text: 'function MyComponent() {\n  return <div>Hello World</div>;\n}',
    confidence: 95.0,
    blocks: [
      {
        text: 'function MyComponent() {',
        confidence: 96.0,
        bbox: { x0: 50, y0: 100, x1: 300, y1: 120 },
      },
      {
        text: '  return <div>Hello World</div>;',
        confidence: 94.0,
        bbox: { x0: 50, y0: 130, x1: 350, y1: 150 },
      },
      {
        text: '}',
        confidence: 95.0,
        bbox: { x0: 50, y0: 160, x1: 70, y1: 180 },
      },
    ],
  },
  {
    text: 'React Component Gallery\nSearch components',
    confidence: 90.0,
    blocks: [
      {
        text: 'React Component Gallery',
        confidence: 92.0,
        bbox: { x0: 100, y0: 50, x1: 400, y1: 80 },
      },
      {
        text: 'Search components',
        confidence: 88.0,
        bbox: { x0: 150, y0: 100, x1: 350, y1: 130 },
      },
    ],
  },
  {
    text: '$ npm install react\n+ react@18.2.0\nadded 42 packages',
    confidence: 87.0,
    blocks: [
      {
        text: '$ npm install react',
        confidence: 90.0,
        bbox: { x0: 20, y0: 50, x1: 200, y1: 70 },
      },
      {
        text: '+ react@18.2.0',
        confidence: 85.0,
        bbox: { x0: 20, y0: 80, x1: 150, y1: 100 },
      },
      {
        text: 'added 42 packages',
        confidence: 86.0,
        bbox: { x0: 20, y0: 110, x1: 180, y1: 130 },
      },
    ],
  },
];

/**
 * Mock video frames in database
 */
export const mockVideoFrames = [
  {
    id: 'frame-1',
    recording_id: mockRecording.id,
    org_id: mockRecording.org_id,
    frame_number: 1,
    frame_time_sec: 0.5,
    frame_url: mockExtractedFrames[0].storagePath,
    visual_description: mockVisualDescriptions[0].description,
    visual_embedding: new Array(768).fill(0.5),
    ocr_text: mockOCRResults[0].text,
    ocr_confidence: mockOCRResults[0].confidence,
    ocr_blocks: mockOCRResults[0].blocks,
    scene_type: mockVisualDescriptions[0].sceneType,
    detected_elements: mockVisualDescriptions[0].detectedElements,
    metadata: {
      width: 1920,
      height: 1080,
      sizeBytes: 150000,
      confidence: mockVisualDescriptions[0].confidence,
    },
    created_at: '2025-01-01T00:05:01Z',
    updated_at: '2025-01-01T00:05:10Z',
  },
  {
    id: 'frame-2',
    recording_id: mockRecording.id,
    org_id: mockRecording.org_id,
    frame_number: 2,
    frame_time_sec: 1.0,
    frame_url: mockExtractedFrames[1].storagePath,
    visual_description: mockVisualDescriptions[1].description,
    visual_embedding: new Array(768).fill(0.4),
    ocr_text: mockOCRResults[1].text,
    ocr_confidence: mockOCRResults[1].confidence,
    ocr_blocks: mockOCRResults[1].blocks,
    scene_type: mockVisualDescriptions[1].sceneType,
    detected_elements: mockVisualDescriptions[1].detectedElements,
    metadata: {
      width: 1920,
      height: 1080,
      sizeBytes: 145000,
      confidence: mockVisualDescriptions[1].confidence,
    },
    created_at: '2025-01-01T00:05:02Z',
    updated_at: '2025-01-01T00:05:11Z',
  },
  {
    id: 'frame-3',
    recording_id: mockRecording.id,
    org_id: mockRecording.org_id,
    frame_number: 3,
    frame_time_sec: 1.5,
    frame_url: mockExtractedFrames[2].storagePath,
    visual_description: mockVisualDescriptions[2].description,
    visual_embedding: new Array(768).fill(0.3),
    ocr_text: mockOCRResults[2].text,
    ocr_confidence: mockOCRResults[2].confidence,
    ocr_blocks: mockOCRResults[2].blocks,
    scene_type: mockVisualDescriptions[2].sceneType,
    detected_elements: mockVisualDescriptions[2].detectedElements,
    metadata: {
      width: 1920,
      height: 1080,
      sizeBytes: 148000,
      confidence: mockVisualDescriptions[2].confidence,
    },
    created_at: '2025-01-01T00:05:03Z',
    updated_at: '2025-01-01T00:05:12Z',
  },
];

/**
 * Mock visual search results
 */
export const mockVisualSearchResults: VisualSearchResult[] = mockVideoFrames.map((frame) => ({
  id: frame.id,
  recordingId: frame.recording_id,
  frameTimeSec: frame.frame_time_sec,
  frameUrl: `https://storage.supabase.co/signed/${frame.frame_url}`,
  visualDescription: frame.visual_description,
  ocrText: frame.ocr_text,
  similarity: 0.92,
  metadata: frame.metadata,
  recording: {
    id: mockRecording.id,
    title: mockRecording.title,
    duration_sec: mockRecording.duration_sec,
    created_at: mockRecording.created_at,
  },
}));

/**
 * Mock embeddings (768 dimensions for text-embedding-3-small)
 */
export function createMockEmbedding(seed: number = 0.5): number[] {
  return new Array(768).fill(0).map((_, i) => Math.sin(i * seed) * 0.5 + 0.5);
}

/**
 * Mock FFmpeg metadata
 */
export const mockVideoMetadata = {
  format: {
    duration: 120,
    size: 50000000,
    bit_rate: 3333333,
  },
  streams: [
    {
      codec_type: 'video',
      width: 1920,
      height: 1080,
      r_frame_rate: '30/1',
      avg_frame_rate: '30/1',
      duration: 120,
    },
    {
      codec_type: 'audio',
      sample_rate: 48000,
      channels: 2,
      duration: 120,
    },
  ],
};

/**
 * Mock Gemini API response
 */
export const mockGeminiResponse = {
  response: {
    text: () => JSON.stringify({
      description: mockVisualDescriptions[0].description,
      sceneType: mockVisualDescriptions[0].sceneType,
      detectedElements: mockVisualDescriptions[0].detectedElements,
      confidence: mockVisualDescriptions[0].confidence,
    }),
  },
};

/**
 * Mock Tesseract worker response
 */
export const mockTesseractResponse = {
  data: {
    text: mockOCRResults[0].text,
    confidence: mockOCRResults[0].confidence,
    blocks: mockOCRResults[0].blocks,
  },
};

/**
 * Mock job payload for extract frames worker
 */
export const mockExtractFramesJob = {
  id: 'job-123',
  type: 'extract_frames' as const,
  status: 'pending' as const,
  payload: {
    recordingId: mockRecording.id,
    orgId: mockRecording.org_id,
    videoUrl: mockRecording.video_url,
  },
  org_id: mockRecording.org_id,
  attempt_count: 0,
  max_attempts: 3,
  run_after: '2025-01-01T00:00:00Z',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
};

/**
 * Helper to create mock frame with custom properties
 */
export function createMockFrame(overrides: Partial<typeof mockVideoFrames[0]> = {}) {
  return {
    ...mockVideoFrames[0],
    ...overrides,
  };
}

/**
 * Helper to create mock search query
 */
export function createMockSearchQuery(query: string, orgId: string = mockRecording.org_id) {
  return {
    query,
    orgId,
    limit: 20,
    threshold: 0.7,
    includeOcr: true,
  };
}

/**
 * Helper to create batch of mock frames
 */
export function createMockFrameBatch(count: number, recordingId: string = mockRecording.id) {
  return Array.from({ length: count }, (_, i) => ({
    id: `frame-${i + 1}`,
    recording_id: recordingId,
    org_id: mockRecording.org_id,
    frame_number: i + 1,
    frame_time_sec: (i + 1) * 0.5,
    frame_url: `org/recording/frames/frame_${String(i + 1).padStart(4, '0')}.jpg`,
    visual_description: `Frame ${i + 1} description`,
    visual_embedding: createMockEmbedding(i * 0.1),
    ocr_text: `Frame ${i + 1} text`,
    ocr_confidence: 90,
    ocr_blocks: [],
    scene_type: ['code', 'browser', 'terminal', 'ui', 'other'][i % 5],
    detected_elements: [`element-${i}-1`, `element-${i}-2`],
    metadata: {
      width: 1920,
      height: 1080,
      sizeBytes: 150000,
      confidence: 0.9,
    },
    created_at: new Date(Date.now() + i * 1000).toISOString(),
    updated_at: new Date(Date.now() + i * 1000 + 5000).toISOString(),
  }));
}
