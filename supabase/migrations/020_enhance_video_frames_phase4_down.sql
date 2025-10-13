-- Rollback: Phase 4 Video Frames Enhancement
-- Description: Reverts video_frames table to post-migration-012 state
-- WARNING: This will drop Phase 4 columns and regenerated embeddings
-- Created: 2025-10-12

-- =============================================================================
-- 1. Drop helper functions
-- =============================================================================

DROP FUNCTION IF EXISTS multimodal_search(
  vector(1536),
  TEXT,
  UUID,
  INTEGER,
  FLOAT,
  FLOAT,
  FLOAT
);

DROP FUNCTION IF EXISTS search_frames_by_content(
  TEXT,
  UUID,
  INTEGER,
  BOOLEAN,
  TEXT
);

-- =============================================================================
-- 2. Drop new indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_video_frames_processed;
DROP INDEX IF EXISTS idx_video_frames_frame_number;
DROP INDEX IF EXISTS idx_video_frames_ocr_text_fts;
DROP INDEX IF EXISTS idx_video_frames_scene_type;

-- =============================================================================
-- 3. Drop RLS policies added in Phase 4
-- =============================================================================

DROP POLICY IF EXISTS "System can update frames" ON video_frames;
DROP POLICY IF EXISTS "System can insert frames" ON video_frames;
DROP POLICY IF EXISTS "Service role can manage all frames" ON video_frames;
DROP POLICY IF EXISTS "Users can view frames from their org" ON video_frames;

-- =============================================================================
-- 4. Recreate original policy from migration 012
-- =============================================================================

-- Note: Using the original pattern from migration 012
-- (Migration 016 fixed this to use clerk_id, but for true rollback we restore original)
CREATE POLICY "Users can view frames from their org"
ON video_frames FOR SELECT
USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- 5. Drop Phase 4 constraints
-- =============================================================================

ALTER TABLE video_frames
DROP CONSTRAINT IF EXISTS check_ocr_confidence;

ALTER TABLE video_frames
DROP CONSTRAINT IF EXISTS check_scene_type;

ALTER TABLE video_frames
DROP CONSTRAINT IF EXISTS unique_recording_frame_number;

ALTER TABLE video_frames
DROP CONSTRAINT IF EXISTS check_visual_embedding_dims;

-- =============================================================================
-- 6. Drop Phase 4 columns
-- =============================================================================

ALTER TABLE video_frames
DROP COLUMN IF EXISTS processed_at;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS detected_elements;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS scene_type;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS ocr_blocks;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS ocr_confidence;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS frame_number;

-- =============================================================================
-- 7. Revert visual_embedding from vector(1536) to vector(512)
-- =============================================================================

-- Drop 1536-dim embedding and index
DROP INDEX IF EXISTS idx_video_frames_embedding;

ALTER TABLE video_frames
DROP COLUMN IF EXISTS visual_embedding;

-- Recreate with original 512-dim from migration 012
ALTER TABLE video_frames
ADD COLUMN visual_embedding vector(512);

-- Add original constraint
ALTER TABLE video_frames
ADD CONSTRAINT check_visual_embedding_dims
CHECK (visual_embedding IS NULL OR vector_dims(visual_embedding) = 512);

-- Recreate original index
CREATE INDEX idx_video_frames_embedding
ON video_frames
USING ivfflat (visual_embedding vector_cosine_ops);

-- =============================================================================
-- 8. Restore original table comment
-- =============================================================================

COMMENT ON TABLE video_frames IS
'Extracted frames with visual embeddings for multimodal search';

-- =============================================================================
-- 9. Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Phase 4 Video Frames Rollback Complete ===';
  RAISE NOTICE 'Reverted to post-migration-012 state';
  RAISE NOTICE 'Removed columns: frame_number, ocr_confidence, ocr_blocks, scene_type, detected_elements, processed_at';
  RAISE NOTICE 'Reverted visual_embedding: 1536-dim → 512-dim';
  RAISE NOTICE 'WARNING: All Phase 4 frame data has been lost';
END $$;
