-- Rollback: Frame Extraction Fields
-- Description: Removes frame extraction tracking from recordings table
-- WARNING: This will drop frame extraction status and metadata
-- Created: 2025-10-12

-- =============================================================================
-- 1. Drop view
-- =============================================================================

DROP VIEW IF EXISTS frame_extraction_stats;

-- =============================================================================
-- 2. Drop trigger and function
-- =============================================================================

DROP TRIGGER IF EXISTS auto_queue_frame_extraction ON recordings;

DROP FUNCTION IF EXISTS trigger_frame_extraction_after_transcription();

DROP FUNCTION IF EXISTS queue_frame_extraction_job(UUID);

-- =============================================================================
-- 3. Drop indexes
-- =============================================================================

DROP INDEX IF EXISTS idx_recordings_frames_extracted;
DROP INDEX IF EXISTS idx_recordings_visual_status_created;
DROP INDEX IF EXISTS idx_recordings_visual_status;

-- =============================================================================
-- 4. Drop constraints
-- =============================================================================

ALTER TABLE recordings
DROP CONSTRAINT IF EXISTS check_frame_count;

ALTER TABLE recordings
DROP CONSTRAINT IF EXISTS check_visual_indexing_status;

-- =============================================================================
-- 5. Drop columns
-- =============================================================================

ALTER TABLE recordings
DROP COLUMN IF EXISTS visual_indexing_status;

ALTER TABLE recordings
DROP COLUMN IF EXISTS frame_count;

ALTER TABLE recordings
DROP COLUMN IF EXISTS frames_extracted;

-- =============================================================================
-- 6. Note: Cannot remove job_type enum value
-- =============================================================================

-- PostgreSQL doesn't support removing enum values, so 'extract_frames' will remain
-- This is harmless and maintains backward compatibility

-- =============================================================================
-- 7. Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Frame Extraction Fields Rollback Complete ===';
  RAISE NOTICE 'Removed columns: frames_extracted, frame_count, visual_indexing_status';
  RAISE NOTICE 'Removed indexes: visual_status, visual_status_created, frames_extracted';
  RAISE NOTICE 'Removed functions: queue_frame_extraction_job(), trigger_frame_extraction_after_transcription()';
  RAISE NOTICE 'Removed trigger: auto_queue_frame_extraction';
  RAISE NOTICE 'Removed view: frame_extraction_stats';
  RAISE NOTICE 'NOTE: job_type enum value "extract_frames" cannot be removed (PostgreSQL limitation)';
END $$;
