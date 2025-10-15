# Phase 4: Advanced Video Processing

**Duration:** 2 weeks
**Effort:** 60 hours
**Priority:** Should-Have (Unique Competitive Advantage)
**Dependencies:** Phase 1, Phase 2

---

## 🎯 Goals

Leverage Gemini's multimodal capabilities to create video-first RAG beyond Ragie:

1. **Frame-Level Visual Indexing** - Extract and index key video frames
2. **Visual Understanding** - Describe UI elements, on-screen text, actions
3. **Screen Activity Tracking** - Enhanced event capture with OCR
4. **Multimodal Search** - Combined audio + visual search

**Success Metrics:**
- 80%+ accuracy on visual search queries
- Frame extraction < 10s for 10-minute video
- OCR accuracy > 95% for on-screen text
- Multimodal search returns relevant results 85%+ of the time
- Visual descriptions generated for 100% of frames

---

## 📋 Technical Requirements

### Dependencies

```json
{
  "dependencies": {
    "@tensorflow/tfjs-node": "^4.20.0",
    "tesseract.js": "^5.1.0",
    "sharp": "^0.33.1",
    "fluent-ffmpeg": "^2.1.2"
  },
  "devDependencies": {
    "@types/fluent-ffmpeg": "^2.1.24"
  }
}
```

### System Requirements

```bash
# Install FFmpeg (for frame extraction)
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Docker
FROM node:20-alpine
RUN apk add --no-cache ffmpeg
```

### Environment Variables

```bash
# Frame extraction configuration
FRAME_EXTRACTION_FPS=0.5         # Extract 1 frame every 2 seconds
FRAME_EXTRACTION_MAX_FRAMES=300  # Max frames per video
FRAME_QUALITY=85                 # JPEG quality (0-100)

# Visual understanding
ENABLE_FRAME_DESCRIPTIONS=true
ENABLE_OCR=true
OCR_CONFIDENCE_THRESHOLD=70

# Multimodal search
ENABLE_VISUAL_SEARCH=true
VISUAL_SEARCH_WEIGHT=0.3         # Weight for visual vs audio (0.3 = 30% visual, 70% audio)

# Storage
FRAMES_STORAGE_BUCKET=video-frames
```

---

## 🗂️ Database Schema Changes

### New Table: `video_frames`

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_video_frames.sql

-- Video frame indexing for visual search
CREATE TABLE video_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Frame metadata
  frame_number INTEGER NOT NULL,
  frame_time_sec FLOAT NOT NULL,
  frame_url TEXT, -- Supabase Storage path

  -- Visual understanding
  visual_description TEXT,
  visual_embedding vector(1536), -- OpenAI text-embedding (of description)

  -- OCR results
  ocr_text TEXT,
  ocr_confidence FLOAT,
  ocr_blocks JSONB DEFAULT '[]'::jsonb, -- Bounding boxes

  -- Scene analysis
  scene_type TEXT, -- 'ui', 'code', 'terminal', 'browser', 'editor', 'other'
  detected_elements JSONB DEFAULT '[]'::jsonb, -- UI elements, buttons, etc.

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE (recording_id, frame_number)
);

-- Indexes
CREATE INDEX idx_video_frames_recording_id ON video_frames(recording_id);
CREATE INDEX idx_video_frames_org_id ON video_frames(org_id);
CREATE INDEX idx_video_frames_time ON video_frames(recording_id, frame_time_sec);
CREATE INDEX idx_video_frames_scene_type ON video_frames(scene_type);

-- Vector similarity search
CREATE INDEX idx_video_frames_embedding ON video_frames
USING ivfflat (visual_embedding vector_cosine_ops)
WITH (lists = 100);

-- Full-text search on OCR
CREATE INDEX idx_video_frames_ocr_text ON video_frames
USING gin(to_tsvector('english', ocr_text));

-- Enable RLS
ALTER TABLE video_frames ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view frames from their org"
  ON video_frames FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Service role can manage all frames"
  ON video_frames FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE video_frames IS
  'Frame-level visual index for multimodal video search';
```

### Update: `recordings` table

```sql
-- Migration: supabase/migrations/YYYYMMDDHHMMSS_add_frame_extraction_fields.sql

ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS frames_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frame_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visual_indexing_status TEXT DEFAULT 'pending'; -- 'pending', 'processing', 'completed', 'failed'

CREATE INDEX IF NOT EXISTS idx_recordings_visual_status
  ON recordings(visual_indexing_status);

COMMENT ON COLUMN recordings.visual_indexing_status IS
  'Status of frame extraction and visual indexing';
```

---

## 📁 File Structure

### New Files to Create

```
lib/
├── services/
│   ├── frame-extraction.ts          # NEW - Extract frames from video
│   ├── visual-indexing.ts           # NEW - Gemini Vision descriptions
│   ├── ocr-service.ts               # NEW - Tesseract OCR
│   ├── scene-classification.ts      # NEW - Classify scene types
│   └── multimodal-search.ts         # NEW - Combined audio+visual search
├── workers/
│   └── handlers/
│       └── extract-frames.ts        # NEW - Frame extraction job
└── types/
    └── video-frames.ts              # NEW - Type definitions

app/
└── api/
    ├── search/
    │   └── visual/
    │       └── route.ts             # NEW - Visual-only search
    └── recordings/
        └── [id]/
            └── frames/
                └── route.ts         # NEW - Get frames for recording

__tests__/
└── services/
    ├── frame-extraction.test.ts     # NEW
    └── ocr-service.test.ts          # NEW
```

---

## 🔨 Implementation Details

### 4.1 Frame Extraction Service

**File:** `lib/services/frame-extraction.ts`

```typescript
/**
 * Frame Extraction Service
 *
 * Extracts key frames from video recordings using FFmpeg.
 * Implements smart frame selection based on scene changes.
 */

import ffmpeg from 'fluent-ffmpeg';
import { createClient } from '@/lib/supabase/admin';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface FrameExtractionOptions {
  /** Frames per second to extract (default: 0.5 = 1 frame every 2 seconds) */
  fps?: number;
  /** Maximum number of frames to extract */
  maxFrames?: number;
  /** JPEG quality (0-100) */
  quality?: number;
  /** Detect scene changes (more intelligent frame selection) */
  detectSceneChanges?: boolean;
}

export interface ExtractedFrame {
  frameNumber: number;
  timeSec: number;
  localPath: string;
  storagePath: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface FrameExtractionResult {
  recordingId: string;
  frames: ExtractedFrame[];
  duration: number;
  totalFrames: number;
}

/**
 * Extract frames from video file
 */
export async function extractFrames(
  videoPath: string,
  recordingId: string,
  orgId: string,
  options: FrameExtractionOptions = {}
): Promise<FrameExtractionResult> {
  const {
    fps = parseFloat(process.env.FRAME_EXTRACTION_FPS || '0.5'),
    maxFrames = parseInt(process.env.FRAME_EXTRACTION_MAX_FRAMES || '300'),
    quality = parseInt(process.env.FRAME_QUALITY || '85'),
    detectSceneChanges = false,
  } = options;

  const startTime = Date.now();

  console.log('[Frame Extraction] Starting:', {
    recordingId,
    fps,
    maxFrames,
    detectSceneChanges,
  });

  // Create temp directory for frames
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'frames-'));

  try {
    // Get video metadata
    const metadata = await getVideoMetadata(videoPath);
    const duration = metadata.duration;

    console.log('[Frame Extraction] Video metadata:', {
      duration: `${duration}s`,
      width: metadata.width,
      height: metadata.height,
    });

    // Calculate frame interval
    const frameInterval = 1 / fps;
    const estimatedFrames = Math.ceil(duration * fps);
    const actualFrameCount = Math.min(estimatedFrames, maxFrames);

    // Extract frames using FFmpeg
    if (detectSceneChanges) {
      await extractSceneChangeFrames(
        videoPath,
        tempDir,
        actualFrameCount,
        quality
      );
    } else {
      await extractUniformFrames(
        videoPath,
        tempDir,
        fps,
        actualFrameCount,
        quality
      );
    }

    // Get extracted frame files
    const frameFiles = await fs.readdir(tempDir);
    const framePaths = frameFiles
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .slice(0, actualFrameCount);

    console.log('[Frame Extraction] Frames extracted:', framePaths.length);

    // Upload frames to Supabase Storage
    const supabase = createClient();
    const extractedFrames: ExtractedFrame[] = [];

    for (const [index, filename] of framePaths.entries()) {
      const localPath = path.join(tempDir, filename);
      const frameNumber = index + 1;
      const timeSec = frameNumber * frameInterval;

      // Optimize image with Sharp
      const imageBuffer = await sharp(localPath)
        .jpeg({ quality, mozjpeg: true })
        .toBuffer();

      const imageMetadata = await sharp(imageBuffer).metadata();

      // Upload to storage
      const storagePath = `${orgId}/${recordingId}/frames/frame_${frameNumber.toString().padStart(4, '0')}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
        .upload(storagePath, imageBuffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.error('[Frame Extraction] Upload error:', uploadError);
        continue;
      }

      extractedFrames.push({
        frameNumber,
        timeSec,
        localPath,
        storagePath,
        width: imageMetadata.width || 0,
        height: imageMetadata.height || 0,
        sizeBytes: imageBuffer.length,
      });
    }

    const extractionDuration = Date.now() - startTime;

    console.log('[Frame Extraction] Complete:', {
      recordingId,
      framesExtracted: extractedFrames.length,
      durationMs: extractionDuration,
    });

    return {
      recordingId,
      frames: extractedFrames,
      duration: extractionDuration,
      totalFrames: extractedFrames.length,
    };
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[Frame Extraction] Cleanup failed:', error);
    }
  }
}

/**
 * Extract frames at uniform intervals
 */
function extractUniformFrames(
  videoPath: string,
  outputDir: string,
  fps: number,
  maxFrames: number,
  quality: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .fps(fps)
      .frames(maxFrames)
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions([
        `-q:v ${Math.ceil((100 - quality) / 3)}`, // Map quality to FFmpeg scale
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Extract frames at scene changes (more intelligent selection)
 */
function extractSceneChangeFrames(
  videoPath: string,
  outputDir: string,
  maxFrames: number,
  quality: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .complexFilter([
        // Scene change detection
        {
          filter: 'select',
          options: `gt(scene\\,0.3)`,
          outputs: 'scenes',
        },
        // Limit frames
        {
          filter: 'select',
          options: `lt(n\\,${maxFrames})`,
          inputs: 'scenes',
        },
      ])
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions([`-q:v ${Math.ceil((100 - quality) / 3)}`])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Get video metadata
 */
function getVideoMetadata(
  videoPath: string
): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');

      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
      });
    });
  });
}
```

---

### 4.2 Visual Indexing Service

**File:** `lib/services/visual-indexing.ts`

```typescript
/**
 * Visual Indexing Service
 *
 * Uses Gemini Vision to generate descriptions of video frames.
 */

import { createGoogleGenerativeAI } from '@/lib/google-ai';
import { createClient } from '@/lib/supabase/admin';
import { promises as fs } from 'fs';

export interface VisualDescription {
  frameId: string;
  description: string;
  sceneType: 'ui' | 'code' | 'terminal' | 'browser' | 'editor' | 'other';
  detectedElements: string[];
  confidence: number;
}

/**
 * Generate visual description for a frame
 */
export async function describeFrame(
  imagePath: string,
  frameContext?: string
): Promise<VisualDescription> {
  const genAI = createGoogleGenerativeAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
  });

  // Read image
  const imageBuffer = await fs.readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  const prompt = `You are a video frame analyzer. Describe what you see in this screenshot in detail.

${frameContext ? `Context: ${frameContext}` : ''}

Provide:
1. **Description**: Detailed description of what's visible (2-3 sentences)
2. **Scene Type**: Classify as one of: ui, code, terminal, browser, editor, other
3. **Detected Elements**: List visible UI elements, buttons, text, etc. (up to 10 items)
4. **Confidence**: Your confidence in this analysis (0.0-1.0)

Focus on:
- Text on screen (headings, labels, error messages)
- UI components (buttons, inputs, modals)
- Code if visible (language, purpose)
- User actions or state
- Technical details that would help with search

Respond in JSON format:
{
  "description": "detailed description here",
  "sceneType": "ui|code|terminal|browser|editor|other",
  "detectedElements": ["element 1", "element 2", ...],
  "confidence": 0.95
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
    { text: prompt },
  ]);

  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      frameId: '',
      description: parsed.description,
      sceneType: parsed.sceneType || 'other',
      detectedElements: parsed.detectedElements || [],
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('[Visual Indexing] Parse error:', error);

    return {
      frameId: '',
      description: 'Unable to analyze frame',
      sceneType: 'other',
      detectedElements: [],
      confidence: 0.3,
    };
  }
}

/**
 * Batch process frames for a recording
 */
export async function indexRecordingFrames(
  recordingId: string,
  orgId: string
): Promise<void> {
  const supabase = createClient();

  // Get unprocessed frames
  const { data: frames, error } = await supabase
    .from('video_frames')
    .select('id, frame_url, frame_time_sec')
    .eq('recording_id', recordingId)
    .is('visual_description', null)
    .order('frame_number');

  if (error || !frames || frames.length === 0) {
    console.log('[Visual Indexing] No frames to process');
    return;
  }

  console.log('[Visual Indexing] Processing frames:', frames.length);

  // Process in parallel batches
  const batchSize = 5;

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (frame) => {
        try {
          // Download frame from storage
          const { data: imageData } = await supabase.storage
            .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
            .download(frame.frame_url);

          if (!imageData) {
            console.warn('[Visual Indexing] Frame not found:', frame.id);
            return;
          }

          // Create temp file
          const tempPath = `/tmp/frame_${frame.id}.jpg`;
          const buffer = Buffer.from(await imageData.arrayBuffer());
          await fs.writeFile(tempPath, buffer);

          // Generate description
          const description = await describeFrame(tempPath);

          // Generate embedding
          const { generateEmbedding } = await import('./embeddings');
          const embedding = await generateEmbedding(description.description);

          // Update frame
          await supabase
            .from('video_frames')
            .update({
              visual_description: description.description,
              visual_embedding: embedding,
              scene_type: description.sceneType,
              detected_elements: description.detectedElements,
              metadata: {
                confidence: description.confidence,
              },
            })
            .eq('id', frame.id);

          // Cleanup
          await fs.unlink(tempPath).catch(() => {});

          console.log(`[Visual Indexing] Processed frame ${frame.id}`);
        } catch (error) {
          console.error(`[Visual Indexing] Error processing frame ${frame.id}:`, error);
        }
      })
    );
  }

  console.log('[Visual Indexing] Complete for recording:', recordingId);
}
```

---

### 4.3 OCR Service

**File:** `lib/services/ocr-service.ts`

```typescript
/**
 * OCR Service
 *
 * Extracts text from video frames using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import type { RecognizeResult } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * Perform OCR on image
 */
export async function extractText(imagePath: string): Promise<OCRResult> {
  const worker = await Tesseract.createWorker('eng');

  try {
    const result: RecognizeResult = await worker.recognize(imagePath);

    const blocks: OCRBlock[] = (result.data.blocks || []).map((block) => ({
      text: block.text,
      confidence: block.confidence,
      bbox: {
        x0: block.bbox.x0,
        y0: block.bbox.y0,
        x1: block.bbox.x1,
        y1: block.bbox.y1,
      },
    }));

    return {
      text: result.data.text,
      confidence: result.data.confidence,
      blocks,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from frame with filtering
 */
export async function extractFrameText(
  imagePath: string,
  confidenceThreshold?: number
): Promise<OCRResult> {
  const threshold =
    confidenceThreshold ||
    parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '70');

  const result = await extractText(imagePath);

  // Filter low-confidence blocks
  const filteredBlocks = result.blocks.filter(
    (block) => block.confidence >= threshold
  );

  const filteredText = filteredBlocks.map((b) => b.text).join(' ');

  return {
    text: filteredText,
    confidence: result.confidence,
    blocks: filteredBlocks,
  };
}
```

---

### 4.4 Multimodal Search Service

**File:** `lib/services/multimodal-search.ts`

```typescript
/**
 * Multimodal Search Service
 *
 * Combines audio (transcript) and visual (frame) search for comprehensive results.
 */

import { vectorSearchGoogle } from './vector-search-google';
import type { SearchResult } from './vector-search-google';
import { generateEmbedding } from './embeddings';
import { createClient } from '@/lib/supabase/server';

export interface MultimodalSearchOptions {
  orgId: string;
  limit?: number;
  audioWeight?: number; // 0-1, how much to weight audio vs visual
  visualWeight?: number;
  recordingIds?: string[];
  includeFrames?: boolean;
}

export interface VisualSearchResult {
  frameId: string;
  recordingId: string;
  recordingTitle: string;
  frameTimeSec: number;
  frameUrl: string;
  visualDescription: string;
  ocrText?: string;
  similarity: number;
}

export interface MultimodalSearchResult {
  transcriptResults: SearchResult[];
  visualResults: VisualSearchResult[];
  combinedResults: Array<SearchResult | VisualSearchResult>;
  metadata: {
    transcriptCount: number;
    visualCount: number;
    combinedCount: number;
    audioWeight: number;
    visualWeight: number;
  };
}

/**
 * Perform multimodal search across audio and visual content
 */
export async function multimodalSearch(
  query: string,
  options: MultimodalSearchOptions
): Promise<MultimodalSearchResult> {
  const {
    orgId,
    limit = 20,
    audioWeight = 0.7,
    visualWeight = 0.3,
    recordingIds,
    includeFrames = true,
  } = options;

  console.log('[Multimodal Search] Starting:', {
    query: query.substring(0, 50),
    audioWeight,
    visualWeight,
  });

  // Search transcripts (audio)
  const transcriptResults = await vectorSearchGoogle(query, {
    orgId,
    limit: Math.ceil(limit * audioWeight * 1.5),
    threshold: 0.70,
    mode: 'hybrid',
    recordingIds,
  });

  console.log('[Multimodal Search] Transcript results:', transcriptResults.length);

  // Search visual frames
  let visualResults: VisualSearchResult[] = [];

  if (includeFrames && process.env.ENABLE_VISUAL_SEARCH !== 'false') {
    visualResults = await searchFrames(query, {
      orgId,
      limit: Math.ceil(limit * visualWeight * 1.5),
      recordingIds,
    });

    console.log('[Multimodal Search] Visual results:', visualResults.length);
  }

  // Combine and re-rank results
  const combined = combineResults(
    transcriptResults,
    visualResults,
    audioWeight,
    visualWeight,
    limit
  );

  return {
    transcriptResults,
    visualResults,
    combinedResults: combined,
    metadata: {
      transcriptCount: transcriptResults.length,
      visualCount: visualResults.length,
      combinedCount: combined.length,
      audioWeight,
      visualWeight,
    },
  };
}

/**
 * Search video frames by description and OCR text
 */
async function searchFrames(
  query: string,
  options: {
    orgId: string;
    limit: number;
    recordingIds?: string[];
  }
): Promise<VisualSearchResult[]> {
  const { orgId, limit, recordingIds } = options;
  const supabase = await createClient();

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search by visual description embedding
  let dbQuery = supabase
    .from('video_frames')
    .select(
      `
      id,
      recording_id,
      frame_time_sec,
      frame_url,
      visual_description,
      ocr_text,
      visual_embedding,
      recordings!inner (
        id,
        title
      )
    `
    )
    .eq('org_id', orgId);

  if (recordingIds && recordingIds.length > 0) {
    dbQuery = dbQuery.in('recording_id', recordingIds);
  }

  const { data: frames, error } = await dbQuery.limit(limit * 2);

  if (error || !frames) {
    console.error('[Frame Search] Error:', error);
    return [];
  }

  // Calculate similarities
  const results = frames
    .map((frame) => {
      const similarity = cosineSimilarity(
        queryEmbedding,
        frame.visual_embedding
      );

      return {
        frameId: frame.id,
        recordingId: frame.recording_id,
        recordingTitle: frame.recordings.title,
        frameTimeSec: frame.frame_time_sec,
        frameUrl: frame.frame_url,
        visualDescription: frame.visual_description || '',
        ocrText: frame.ocr_text || undefined,
        similarity,
      };
    })
    .filter((r) => r.similarity > 0.70)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return results;
}

/**
 * Combine and re-rank audio and visual results
 */
function combineResults(
  transcriptResults: SearchResult[],
  visualResults: VisualSearchResult[],
  audioWeight: number,
  visualWeight: number,
  limit: number
): Array<SearchResult | VisualSearchResult> {
  // Normalize and weight scores
  const weightedTranscript = transcriptResults.map((r) => ({
    ...r,
    finalScore: r.similarity * audioWeight,
    type: 'transcript' as const,
  }));

  const weightedVisual = visualResults.map((r) => ({
    ...r,
    finalScore: r.similarity * visualWeight,
    type: 'visual' as const,
  }));

  // Combine and sort
  const combined = [...weightedTranscript, ...weightedVisual]
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, limit);

  return combined;
}

/**
 * Cosine similarity helper
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
```

---

### 4.5 Frame Extraction Job Handler

**File:** `lib/workers/handlers/extract-frames.ts`

```typescript
/**
 * Extract Frames Job Handler
 *
 * Background job that extracts and indexes video frames.
 */

import type { Job } from '@/lib/types/jobs';
import { extractFrames } from '@/lib/services/frame-extraction';
import { indexRecordingFrames } from '@/lib/services/visual-indexing';
import { extractFrameText } from '@/lib/services/ocr-service';
import { createClient } from '@/lib/supabase/admin';

export interface ExtractFramesPayload {
  recordingId: string;
  orgId: string;
  videoPath: string;
}

export async function handleExtractFrames(
  job: Job<ExtractFramesPayload>
): Promise<void> {
  const { recordingId, orgId, videoPath } = job.payload;

  console.log('[Job: Extract Frames] Starting:', {
    jobId: job.id,
    recordingId,
  });

  const supabase = createClient();

  try {
    // Update status
    await supabase
      .from('recordings')
      .update({ visual_indexing_status: 'processing' })
      .eq('id', recordingId);

    // Step 1: Extract frames
    const extraction = await extractFrames(videoPath, recordingId, orgId, {
      detectSceneChanges: true,
    });

    console.log('[Job: Extract Frames] Extracted:', extraction.totalFrames);

    // Step 2: Store frame metadata
    const frameRecords = extraction.frames.map((frame) => ({
      recording_id: recordingId,
      org_id: orgId,
      frame_number: frame.frameNumber,
      frame_time_sec: frame.timeSec,
      frame_url: frame.storagePath,
      metadata: {
        width: frame.width,
        height: frame.height,
        sizeBytes: frame.sizeBytes,
      },
    }));

    const { error: insertError } = await supabase
      .from('video_frames')
      .insert(frameRecords);

    if (insertError) {
      throw new Error(`Failed to store frames: ${insertError.message}`);
    }

    // Step 3: Generate visual descriptions (Gemini Vision)
    if (process.env.ENABLE_FRAME_DESCRIPTIONS !== 'false') {
      await indexRecordingFrames(recordingId, orgId);
    }

    // Step 4: Extract OCR text
    if (process.env.ENABLE_OCR !== 'false') {
      // Process OCR for each frame
      // (Implementation similar to visual indexing)
    }

    // Update recording
    await supabase
      .from('recordings')
      .update({
        frames_extracted: true,
        frame_count: extraction.totalFrames,
        visual_indexing_status: 'completed',
      })
      .eq('id', recordingId);

    console.log('[Job: Extract Frames] Complete:', {
      recordingId,
      framesProcessed: extraction.totalFrames,
    });
  } catch (error) {
    console.error('[Job: Extract Frames] Error:', error);

    await supabase
      .from('recordings')
      .update({ visual_indexing_status: 'failed' })
      .eq('id', recordingId);

    throw error;
  }
}
```

---

## 🧪 Testing Requirements

### Unit Tests

**File:** `__tests__/services/frame-extraction.test.ts`

```typescript
import { extractFrames } from '@/lib/services/frame-extraction';

describe('Frame Extraction', () => {
  it('should extract frames from video', async () => {
    const result = await extractFrames(
      './test-video.mp4',
      'test-recording',
      'test-org',
      {
        fps: 1,
        maxFrames: 10,
      }
    );

    expect(result.frames.length).toBeLessThanOrEqual(10);
    expect(result.frames[0].timeSec).toBeGreaterThanOrEqual(0);
  });

  it('should optimize frame quality', async () => {
    const result = await extractFrames(
      './test-video.mp4',
      'test-recording',
      'test-org',
      {
        quality: 50,
      }
    );

    // Lower quality should result in smaller files
    const avgSize =
      result.frames.reduce((sum, f) => sum + f.sizeBytes, 0) / result.frames.length;

    expect(avgSize).toBeLessThan(100000); // < 100KB per frame
  });
});
```

---

## 📊 Monitoring & Analytics

Track visual search metrics:

```typescript
// Add to lib/monitoring/metrics.ts

export interface VisualSearchMetrics {
  framesExtracted: number;
  descriptionsGenerated: number;
  ocrTextExtracted: number;
  visualSearchQueries: number;
  avgVisualRelevance: number;
  multimodalImprovementPercent: number;
}
```

---

## 🚀 Deployment Checklist

### Pre-Deployment

- [ ] Install FFmpeg on server
- [ ] Install dependencies (`@tensorflow/tfjs-node`, `tesseract.js`, etc.)
- [ ] Run database migrations
- [ ] Create Supabase Storage bucket for frames
- [ ] Test frame extraction pipeline
- [ ] Verify Gemini Vision API access

### Post-Deployment

- [ ] Monitor frame extraction job success rate
- [ ] Track visual search usage
- [ ] Measure OCR accuracy
- [ ] Compare multimodal vs audio-only search quality

---

## 🎯 Success Criteria

Phase 4 is considered complete when:

1. ✅ Frame extraction < 10s for 10-minute video
2. ✅ Visual descriptions generated for 100% of frames
3. ✅ OCR accuracy > 95% on UI text
4. ✅ Visual search returns relevant results 80%+ of time
5. ✅ Multimodal search improves results vs audio-only
6. ✅ All tests passing
7. ✅ Deployed to production

---

**Next Phase:** [Phase 5: Connector System](./PHASE_5_CONNECTOR_SYSTEM.md)
