-- Phase 4: Advanced Video Processing - Enhance video_frames table
-- Description: Extends video_frames with comprehensive frame metadata, OCR, and scene analysis
-- Dependencies: Migration 012 (video_frames table must exist)
-- Created: 2025-10-12

-- =============================================================================
-- CONTEXT
-- =============================================================================
-- Migration 012 created a basic video_frames table with:
-- - frame_time_sec, frame_url, visual_description
-- - visual_embedding vector(512) for CLIP embeddings
-- - ocr_text for basic OCR
--
-- Phase 4 enhances this with:
-- - frame_number for sequential ordering
-- - frame_url properly defined with storage path
-- - visual_embedding upgraded to vector(1536) for OpenAI embeddings
-- - OCR confidence and bounding boxes
-- - Scene classification and detected elements
-- - Full-text search on OCR text
-- - Service role bypass for background workers
-- =============================================================================

-- =============================================================================
-- 1. Add new columns to video_frames
-- =============================================================================

-- Frame metadata
ALTER TABLE video_frames
ADD COLUMN IF NOT EXISTS frame_number INTEGER;

-- OCR enhancements
ALTER TABLE video_frames
ADD COLUMN IF NOT EXISTS ocr_confidence FLOAT,
ADD COLUMN IF NOT EXISTS ocr_blocks JSONB DEFAULT '[]'::jsonb;

-- Scene analysis
ALTER TABLE video_frames
ADD COLUMN IF NOT EXISTS scene_type TEXT,
ADD COLUMN IF NOT EXISTS detected_elements JSONB DEFAULT '[]'::jsonb;

-- Processing timestamp
ALTER TABLE video_frames
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ DEFAULT now();

-- =============================================================================
-- 2. Update visual_embedding from vector(512) to vector(1536)
-- =============================================================================
-- NOTE: This is a breaking change. Existing 512-dim embeddings will be dropped.
-- Background workers should regenerate embeddings after this migration.

-- Drop existing embedding column and recreate with new dimension
ALTER TABLE video_frames
DROP COLUMN IF EXISTS visual_embedding;

ALTER TABLE video_frames
ADD COLUMN visual_embedding vector(1536);

-- Add dimension check constraint
ALTER TABLE video_frames
ADD CONSTRAINT check_visual_embedding_dims
CHECK (visual_embedding IS NULL OR vector_dims(visual_embedding) = 1536);

-- =============================================================================
-- 3. Add constraints
-- =============================================================================

-- Ensure frame_number is unique per recording
ALTER TABLE video_frames
ADD CONSTRAINT unique_recording_frame_number
UNIQUE (recording_id, frame_number);

-- Validate scene_type values
ALTER TABLE video_frames
ADD CONSTRAINT check_scene_type
CHECK (scene_type IS NULL OR scene_type IN ('ui', 'code', 'terminal', 'browser', 'editor', 'other'));

-- Validate OCR confidence range
ALTER TABLE video_frames
ADD CONSTRAINT check_ocr_confidence
CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 100));

-- =============================================================================
-- 4. Create new indexes
-- =============================================================================

-- Scene type for filtering
CREATE INDEX IF NOT EXISTS idx_video_frames_scene_type
ON video_frames(scene_type)
WHERE scene_type IS NOT NULL;

-- Full-text search on OCR text
CREATE INDEX IF NOT EXISTS idx_video_frames_ocr_text_fts
ON video_frames
USING gin(to_tsvector('english', COALESCE(ocr_text, '')))
WHERE ocr_text IS NOT NULL;

-- Frame number for sequential access
CREATE INDEX IF NOT EXISTS idx_video_frames_frame_number
ON video_frames(recording_id, frame_number);

-- Processed frames for job tracking
CREATE INDEX IF NOT EXISTS idx_video_frames_processed
ON video_frames(recording_id, processed_at)
WHERE visual_description IS NOT NULL;

-- =============================================================================
-- 5. Recreate vector similarity index with new dimension
-- =============================================================================

-- Drop old index (was created in migration 012 with vector(512))
DROP INDEX IF EXISTS idx_video_frames_embedding;

-- Recreate with vector(1536) and optimal lists parameter
-- Starting with lists=100 for expected 10K-1M frames
CREATE INDEX idx_video_frames_embedding
ON video_frames
USING ivfflat (visual_embedding vector_cosine_ops)
WITH (lists = 100);

COMMENT ON INDEX idx_video_frames_embedding IS
'IVFFlat index for 1536-dim OpenAI embeddings. Increase to 500-1000 as frame count grows beyond 100K';

-- =============================================================================
-- 6. Update RLS policies for Phase 4
-- =============================================================================

-- Drop old policy (created in migration 012)
DROP POLICY IF EXISTS "Users can view frames from their org" ON video_frames;

-- Recreate with corrected auth pattern (uses clerk_id, fixed in migration 016)
CREATE POLICY "Users can view frames from their org"
ON video_frames FOR SELECT
TO authenticated
USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- Add service role bypass for background workers
CREATE POLICY "Service role can manage all frames"
ON video_frames FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add INSERT policy for background workers (authenticated)
CREATE POLICY "System can insert frames"
ON video_frames FOR INSERT
TO service_role
WITH CHECK (true);

-- Add UPDATE policy for background workers
CREATE POLICY "System can update frames"
ON video_frames FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================================================
-- 7. Add helper function for frame search
-- =============================================================================

CREATE OR REPLACE FUNCTION search_frames_by_content(
  query_text TEXT,
  match_org_id UUID,
  match_count INTEGER DEFAULT 10,
  include_ocr BOOLEAN DEFAULT true,
  scene_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  recording_id UUID,
  frame_number INTEGER,
  frame_time_sec FLOAT,
  frame_url TEXT,
  visual_description TEXT,
  ocr_text TEXT,
  scene_type TEXT,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vf.id,
    vf.recording_id,
    vf.frame_number,
    vf.frame_time_sec,
    vf.frame_url,
    vf.visual_description,
    vf.ocr_text,
    vf.scene_type,
    CASE
      WHEN include_ocr THEN
        ts_rank(
          to_tsvector('english', COALESCE(vf.visual_description, '') || ' ' || COALESCE(vf.ocr_text, '')),
          plainto_tsquery('english', query_text)
        )
      ELSE
        ts_rank(
          to_tsvector('english', COALESCE(vf.visual_description, '')),
          plainto_tsquery('english', query_text)
        )
    END AS relevance_score
  FROM video_frames vf
  WHERE vf.org_id = match_org_id
    AND (scene_filter IS NULL OR vf.scene_type = scene_filter)
    AND (
      CASE
        WHEN include_ocr THEN
          to_tsvector('english', COALESCE(vf.visual_description, '') || ' ' || COALESCE(vf.ocr_text, '')) @@
          plainto_tsquery('english', query_text)
        ELSE
          to_tsvector('english', COALESCE(vf.visual_description, '')) @@
          plainto_tsquery('english', query_text)
      END
    )
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_frames_by_content IS
'Full-text search across video frames visual descriptions and OCR text';

-- =============================================================================
-- 8. Add multimodal search function (audio + visual)
-- =============================================================================

CREATE OR REPLACE FUNCTION multimodal_search(
  query_embedding_1536 vector(1536),
  query_text TEXT,
  match_org_id UUID,
  match_count INTEGER DEFAULT 20,
  audio_weight FLOAT DEFAULT 0.7,
  visual_weight FLOAT DEFAULT 0.3,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  result_type TEXT,
  result_id UUID,
  recording_id UUID,
  recording_title TEXT,
  content TEXT,
  similarity FLOAT,
  final_score FLOAT,
  time_sec FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  -- Audio results from transcript_chunks
  SELECT
    'audio'::TEXT AS result_type,
    tc.id AS result_id,
    tc.recording_id,
    r.title AS recording_title,
    tc.chunk_text AS content,
    (1 - (tc.embedding <=> query_embedding_1536)) AS similarity,
    (1 - (tc.embedding <=> query_embedding_1536)) * audio_weight AS final_score,
    NULL::FLOAT AS time_sec,
    tc.metadata
  FROM transcript_chunks tc
  INNER JOIN recordings r ON tc.recording_id = r.id
  WHERE tc.org_id = match_org_id
    AND (1 - (tc.embedding <=> query_embedding_1536)) >= match_threshold

  UNION ALL

  -- Visual results from video_frames
  SELECT
    'visual'::TEXT AS result_type,
    vf.id AS result_id,
    vf.recording_id,
    r.title AS recording_title,
    COALESCE(vf.visual_description, '') || ' ' || COALESCE(vf.ocr_text, '') AS content,
    (1 - (vf.visual_embedding <=> query_embedding_1536)) AS similarity,
    (1 - (vf.visual_embedding <=> query_embedding_1536)) * visual_weight AS final_score,
    vf.frame_time_sec AS time_sec,
    vf.metadata
  FROM video_frames vf
  INNER JOIN recordings r ON vf.recording_id = r.id
  WHERE vf.org_id = match_org_id
    AND vf.visual_embedding IS NOT NULL
    AND (1 - (vf.visual_embedding <=> query_embedding_1536)) >= match_threshold

  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION multimodal_search IS
'Combined audio (transcript) and visual (frame) search with configurable weighting';

-- =============================================================================
-- 9. Update table comments
-- =============================================================================

COMMENT ON TABLE video_frames IS
'Frame-level visual index for multimodal video search with OCR and scene analysis. Updated in Phase 4 for advanced video processing.';

COMMENT ON COLUMN video_frames.frame_number IS
'Sequential frame number within recording for ordering';

COMMENT ON COLUMN video_frames.visual_embedding IS
'OpenAI text-embedding-3-small (1536-dim) of visual_description';

COMMENT ON COLUMN video_frames.ocr_confidence IS
'OCR confidence score (0-100) from Tesseract';

COMMENT ON COLUMN video_frames.ocr_blocks IS
'Array of OCR text blocks with bounding boxes: [{"text": "...", "confidence": 95, "bbox": {"x0": 10, "y0": 20, "x1": 100, "y1": 50}}]';

COMMENT ON COLUMN video_frames.scene_type IS
'Scene classification: ui, code, terminal, browser, editor, other';

COMMENT ON COLUMN video_frames.detected_elements IS
'Array of detected UI elements, buttons, components: ["button", "modal", "form", "error message"]';

-- =============================================================================
-- 10. Grant permissions to service role
-- =============================================================================

GRANT ALL ON video_frames TO service_role;

-- =============================================================================
-- 11. Verification
-- =============================================================================

DO $$
DECLARE
  frame_count BIGINT;
  with_embeddings BIGINT;
  with_ocr BIGINT;
BEGIN
  SELECT COUNT(*) INTO frame_count FROM video_frames;
  SELECT COUNT(*) INTO with_embeddings FROM video_frames WHERE visual_embedding IS NOT NULL;
  SELECT COUNT(*) INTO with_ocr FROM video_frames WHERE ocr_text IS NOT NULL;

  RAISE NOTICE '=== Phase 4 Video Frames Enhancement Report ===';
  RAISE NOTICE 'Total frames: %', frame_count;
  RAISE NOTICE 'Frames with embeddings (1536-dim): %', with_embeddings;
  RAISE NOTICE 'Frames with OCR text: %', with_ocr;
  RAISE NOTICE '';

  IF frame_count > 0 AND with_embeddings = 0 THEN
    RAISE WARNING 'Existing frames need embeddings regeneration after dimension change (512→1536)';
  END IF;

  RAISE NOTICE 'New columns added: frame_number, ocr_confidence, ocr_blocks, scene_type, detected_elements, processed_at';
  RAISE NOTICE 'New indexes: scene_type, ocr_text FTS, frame_number, processed_at';
  RAISE NOTICE 'New functions: search_frames_by_content(), multimodal_search()';
  RAISE NOTICE 'RLS policies: Updated with clerk_id pattern + service role bypass';
END $$;
