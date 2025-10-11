-- Migration: Enhanced Video Transcription with Visual Context
-- Adds support for Gemini video understanding with visual descriptions
-- and improved source tracking for RAG integrity

-- =============================================================================
-- 1. Enhance transcripts table to store visual events
-- =============================================================================

-- Add columns for visual context and video metadata
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS visual_events JSONB DEFAULT '[]'::jsonb;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS video_metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS superseded BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN transcripts.visual_events IS
  'Timestamped visual events extracted from video (clicks, form inputs, screen transitions)';
COMMENT ON COLUMN transcripts.video_metadata IS
  'Video processing metadata (duration, fps, model used, etc.)';
COMMENT ON COLUMN transcripts.superseded IS
  'True if this transcript has been replaced by a newer version (for re-processing)';

-- Create index for finding superseded transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_superseded
  ON transcripts(recording_id) WHERE superseded = false;

-- =============================================================================
-- 2. Enhance transcript_chunks table for visual content tracking
-- =============================================================================

-- Add content type enum
DO $$ BEGIN
  CREATE TYPE content_type AS ENUM ('audio', 'visual', 'combined');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add content_type column (with default for existing records)
ALTER TABLE transcript_chunks
  ADD COLUMN IF NOT EXISTS content_type content_type DEFAULT 'audio';

-- Enhance metadata to include visual context indicators
-- Note: metadata is already JSONB, we just ensure it has the right structure
-- New metadata fields:
-- - source_type: 'transcript' | 'document' | 'visual'
-- - has_visual_context: boolean
-- - visual_description: string (optional)
-- - timestamp_range: string (e.g., "00:30 - 00:45")

-- Add index for content type filtering
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_content_type
  ON transcript_chunks(content_type);

-- Add index for fast deletion by recording_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_recording_id
  ON transcript_chunks(recording_id);

-- Add index for org_id + recording_id (common query pattern)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_org_recording
  ON transcript_chunks(org_id, recording_id);

-- =============================================================================
-- 3. Create function to delete chunks when recording is deleted
-- =============================================================================

CREATE OR REPLACE FUNCTION delete_recording_chunks()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all vector chunks associated with this recording
  DELETE FROM transcript_chunks WHERE recording_id = OLD.id;

  -- Log the deletion for audit
  RAISE NOTICE 'Deleted all chunks for recording %', OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-delete chunks when recording deleted
DROP TRIGGER IF EXISTS on_recording_delete ON recordings;
CREATE TRIGGER on_recording_delete
  BEFORE DELETE ON recordings
  FOR EACH ROW
  EXECUTE FUNCTION delete_recording_chunks();

-- =============================================================================
-- 4. Create function to mark transcript as superseded when re-processing
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_transcript_superseded()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new transcript is created for a recording that already has one,
  -- mark the old one as superseded
  UPDATE transcripts
  SET superseded = true, updated_at = NOW()
  WHERE recording_id = NEW.recording_id
    AND id != NEW.id
    AND superseded = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to mark old transcripts as superseded
DROP TRIGGER IF EXISTS on_new_transcript ON transcripts;
CREATE TRIGGER on_new_transcript
  AFTER INSERT ON transcripts
  FOR EACH ROW
  EXECUTE FUNCTION mark_transcript_superseded();

-- =============================================================================
-- 5. Backfill existing records with default values
-- =============================================================================

-- Ensure all existing transcripts have empty visual_events and metadata
UPDATE transcripts
SET
  visual_events = '[]'::jsonb,
  video_metadata = '{}'::jsonb,
  superseded = false
WHERE visual_events IS NULL OR video_metadata IS NULL OR superseded IS NULL;

-- Ensure all existing chunks have content_type set
UPDATE transcript_chunks
SET content_type = 'audio'
WHERE content_type IS NULL;

-- Ensure all existing chunks have proper metadata structure
UPDATE transcript_chunks
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{source_type}',
  '"transcript"'::jsonb,
  true
)
WHERE metadata IS NULL OR NOT metadata ? 'source_type';

-- =============================================================================
-- 6. Add helper view for active (non-superseded) transcripts
-- =============================================================================

CREATE OR REPLACE VIEW active_transcripts AS
SELECT * FROM transcripts WHERE superseded = false;

COMMENT ON VIEW active_transcripts IS
  'View showing only active (non-superseded) transcripts for each recording';

-- =============================================================================
-- 7. Add function to get transcript with visual context
-- =============================================================================

CREATE OR REPLACE FUNCTION get_transcript_with_visual(p_recording_id UUID)
RETURNS TABLE(
  id UUID,
  text TEXT,
  visual_events JSONB,
  video_metadata JSONB,
  combined_narrative TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.text,
    t.visual_events,
    t.video_metadata,
    -- Generate combined narrative by merging audio and visual events
    CONCAT(
      'Audio Transcript: ', t.text,
      E'\n\nVisual Events: ',
      COALESCE(
        (
          SELECT string_agg(
            CONCAT('[', v->>'timestamp', '] ', v->>'description'),
            E'\n'
          )
          FROM jsonb_array_elements(t.visual_events) AS v
        ),
        'No visual events recorded'
      )
    ) AS combined_narrative
  FROM transcripts t
  WHERE t.recording_id = p_recording_id
    AND t.superseded = false
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_transcript_with_visual(UUID) IS
  'Retrieves active transcript with visual events and generates combined narrative';

-- =============================================================================
-- 8. Add indexes for performance
-- =============================================================================

-- Index for timestamp-based queries on chunks
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_timestamps
  ON transcript_chunks(start_time_sec, end_time_sec)
  WHERE start_time_sec IS NOT NULL;

-- Index for metadata JSONB queries (GIN index for better JSONB performance)
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_metadata_gin
  ON transcript_chunks USING GIN (metadata);

-- Index for visual events in transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_visual_events_gin
  ON transcripts USING GIN (visual_events);

-- =============================================================================
-- 9. Add constraints and validation
-- =============================================================================

-- Ensure visual_events is always a valid JSON array
ALTER TABLE transcripts
  ADD CONSTRAINT visual_events_is_array
  CHECK (jsonb_typeof(visual_events) = 'array');

-- Ensure video_metadata is always a valid JSON object
ALTER TABLE transcripts
  ADD CONSTRAINT video_metadata_is_object
  CHECK (jsonb_typeof(video_metadata) = 'object');

-- =============================================================================
-- Migration Complete
-- =============================================================================

-- Add migration record
COMMENT ON SCHEMA public IS 'Migration 011: Enhanced video transcription with visual context - Applied ' || NOW()::text;
