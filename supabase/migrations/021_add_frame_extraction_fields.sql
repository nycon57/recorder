-- Phase 4: Advanced Video Processing - Add frame extraction fields to recordings
-- Description: Tracks frame extraction status and metadata for video processing pipeline
-- Dependencies: Migration 020 (enhanced video_frames table)
-- Created: 2025-10-12

-- =============================================================================
-- CONTEXT
-- =============================================================================
-- Adds tracking fields to recordings table to support Phase 4 frame extraction:
-- - frames_extracted: Boolean flag for completion
-- - frame_count: Number of extracted frames
-- - visual_indexing_status: Pipeline status tracking
--
-- These fields enable:
-- - Background job processing workflow
-- - UI indicators for frame extraction progress
-- - Analytics on frame extraction performance
-- =============================================================================

-- =============================================================================
-- 1. Add frame extraction columns
-- =============================================================================

ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS frames_extracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frame_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS visual_indexing_status TEXT DEFAULT 'pending';

-- =============================================================================
-- 2. Add constraints
-- =============================================================================

-- Validate status values
ALTER TABLE recordings
ADD CONSTRAINT IF NOT EXISTS check_visual_indexing_status
CHECK (visual_indexing_status IN ('pending', 'processing', 'completed', 'failed'));

-- Frame count must be non-negative
ALTER TABLE recordings
ADD CONSTRAINT IF NOT EXISTS check_frame_count
CHECK (frame_count >= 0);

-- Logical consistency: if frames_extracted is true, must have status='completed'
-- (Enforced at application level to allow for race conditions during processing)

-- =============================================================================
-- 3. Create indexes for job processing
-- =============================================================================

-- Index for finding pending frame extraction jobs
CREATE INDEX IF NOT EXISTS idx_recordings_visual_status
ON recordings(visual_indexing_status)
WHERE visual_indexing_status IN ('pending', 'processing');

-- Compound index for efficient job queries
CREATE INDEX IF NOT EXISTS idx_recordings_visual_status_created
ON recordings(visual_indexing_status, created_at)
WHERE visual_indexing_status = 'pending';

-- Index for analytics on frame extraction
CREATE INDEX IF NOT EXISTS idx_recordings_frames_extracted
ON recordings(frames_extracted, created_at)
WHERE frames_extracted = true;

-- =============================================================================
-- 4. Update job type enum to include extract_frames
-- =============================================================================

-- Note: extract_frames was added in migration 012, but we ensure it exists here
DO $$ BEGIN
  ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'extract_frames';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- 5. Add helper function to queue frame extraction jobs
-- =============================================================================

CREATE OR REPLACE FUNCTION queue_frame_extraction_job(
  recording_uuid UUID
)
RETURNS UUID AS $$
DECLARE
  job_id UUID;
  recording_org_id UUID;
  video_url TEXT;
BEGIN
  -- Get recording details
  SELECT org_id, file_url INTO recording_org_id, video_url
  FROM recordings
  WHERE id = recording_uuid;

  IF recording_org_id IS NULL THEN
    RAISE EXCEPTION 'Recording not found: %', recording_uuid;
  END IF;

  -- Check if already extracted
  IF EXISTS (
    SELECT 1 FROM recordings
    WHERE id = recording_uuid
      AND frames_extracted = true
  ) THEN
    RAISE NOTICE 'Frames already extracted for recording %', recording_uuid;
    RETURN NULL;
  END IF;

  -- Update status to pending
  UPDATE recordings
  SET visual_indexing_status = 'pending'
  WHERE id = recording_uuid;

  -- Create job
  INSERT INTO jobs (
    type,
    payload,
    org_id,
    status,
    attempt_count,
    run_after,
    created_at
  )
  VALUES (
    'extract_frames',
    jsonb_build_object(
      'recordingId', recording_uuid,
      'orgId', recording_org_id,
      'videoPath', video_url
    ),
    recording_org_id,
    'pending',
    0,
    now(),
    now()
  )
  RETURNING id INTO job_id;

  RAISE NOTICE 'Queued frame extraction job % for recording %', job_id, recording_uuid;

  RETURN job_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION queue_frame_extraction_job IS
'Queues a background job to extract frames from a recording video';

-- =============================================================================
-- 6. Add trigger to auto-queue frame extraction after transcription
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_frame_extraction_after_transcription()
RETURNS TRIGGER AS $$
BEGIN
  -- When a recording moves to 'completed' status, queue frame extraction
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Only queue if frame extraction is pending or failed
    IF NEW.visual_indexing_status IN ('pending', 'failed') THEN
      PERFORM queue_frame_extraction_job(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS auto_queue_frame_extraction ON recordings;

-- Create trigger
CREATE TRIGGER auto_queue_frame_extraction
AFTER UPDATE ON recordings
FOR EACH ROW
WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
EXECUTE FUNCTION trigger_frame_extraction_after_transcription();

COMMENT ON TRIGGER auto_queue_frame_extraction ON recordings IS
'Automatically queues frame extraction job when recording transcription completes';

-- =============================================================================
-- 7. Add view for frame extraction analytics
-- =============================================================================

CREATE OR REPLACE VIEW frame_extraction_stats AS
SELECT
  visual_indexing_status AS status,
  COUNT(*) AS recording_count,
  AVG(frame_count) FILTER (WHERE frames_extracted = true) AS avg_frames_per_recording,
  MIN(frame_count) FILTER (WHERE frames_extracted = true) AS min_frames,
  MAX(frame_count) FILTER (WHERE frames_extracted = true) AS max_frames,
  COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS last_24h_count,
  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7d_count
FROM recordings
WHERE status = 'completed'
GROUP BY visual_indexing_status
ORDER BY
  CASE visual_indexing_status
    WHEN 'pending' THEN 1
    WHEN 'processing' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'failed' THEN 4
  END;

COMMENT ON VIEW frame_extraction_stats IS
'Analytics dashboard for frame extraction pipeline health';

-- =============================================================================
-- 8. Add column comments
-- =============================================================================

COMMENT ON COLUMN recordings.frames_extracted IS
'Boolean flag indicating if frame extraction has completed successfully';

COMMENT ON COLUMN recordings.frame_count IS
'Number of frames extracted from this recording (0 if not yet extracted)';

COMMENT ON COLUMN recordings.visual_indexing_status IS
'Status of frame extraction and visual indexing: pending, processing, completed, failed';

-- =============================================================================
-- 9. Backfill existing recordings
-- =============================================================================

-- Set visual_indexing_status based on current recording status
UPDATE recordings
SET visual_indexing_status = CASE
  WHEN status = 'completed' AND frame_count = 0 THEN 'pending'
  WHEN status = 'completed' AND frame_count > 0 THEN 'completed'
  WHEN status IN ('uploading', 'transcribing', 'processing') THEN 'pending'
  WHEN status = 'failed' THEN 'failed'
  ELSE 'pending'
END
WHERE visual_indexing_status IS NULL OR visual_indexing_status = 'pending';

-- Set frames_extracted flag
UPDATE recordings
SET frames_extracted = (frame_count > 0)
WHERE frames_extracted IS NULL OR frames_extracted = false;

-- =============================================================================
-- 10. Verification
-- =============================================================================

DO $$
DECLARE
  total_recordings BIGINT;
  pending_extraction BIGINT;
  processing_extraction BIGINT;
  completed_extraction BIGINT;
  failed_extraction BIGINT;
BEGIN
  SELECT COUNT(*) INTO total_recordings FROM recordings;
  SELECT COUNT(*) INTO pending_extraction FROM recordings WHERE visual_indexing_status = 'pending';
  SELECT COUNT(*) INTO processing_extraction FROM recordings WHERE visual_indexing_status = 'processing';
  SELECT COUNT(*) INTO completed_extraction FROM recordings WHERE visual_indexing_status = 'completed';
  SELECT COUNT(*) INTO failed_extraction FROM recordings WHERE visual_indexing_status = 'failed';

  RAISE NOTICE '=== Phase 4 Frame Extraction Fields Report ===';
  RAISE NOTICE 'Total recordings: %', total_recordings;
  RAISE NOTICE 'Pending extraction: %', pending_extraction;
  RAISE NOTICE 'Processing extraction: %', processing_extraction;
  RAISE NOTICE 'Completed extraction: %', completed_extraction;
  RAISE NOTICE 'Failed extraction: %', failed_extraction;
  RAISE NOTICE '';
  RAISE NOTICE 'New columns: frames_extracted, frame_count, visual_indexing_status';
  RAISE NOTICE 'New indexes: visual_status, visual_status_created, frames_extracted';
  RAISE NOTICE 'New function: queue_frame_extraction_job()';
  RAISE NOTICE 'New trigger: auto_queue_frame_extraction';
  RAISE NOTICE 'New view: frame_extraction_stats';
END $$;
