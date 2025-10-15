-- =====================================================
-- Migration: 043_add_content_type_support.sql
-- Description: Extend recordings table to support multiple content types
--              (video uploads, audio, documents, text notes)
-- Created: 2025-10-15
-- =====================================================

-- =====================================================
-- ADD NEW COLUMNS TO RECORDINGS TABLE
-- =====================================================

-- Add content_type column to differentiate between different content types
-- Using TEXT instead of ENUM for maximum flexibility
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'recording';

-- Add file_type column for file extension tracking
-- Stores the file extension (webm, mp4, mp3, pdf, txt, etc.)
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add original_filename column to preserve user's uploaded filename
-- Important for downloads and displaying original file names
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- Add mime_type column for proper content handling
-- Used for Content-Type headers, file validation, and browser handling
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- Add file_size column for storage cost tracking
-- Stores file size in bytes for accurate usage/billing calculations
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS file_size BIGINT;

-- Add comments for documentation
COMMENT ON COLUMN recordings.content_type IS
'Type of content: recording (screen/camera recording), video (uploaded video), audio (uploaded audio), document (pdf/docx), text (notes/markdown). Determines processing pipeline and UI display.';

COMMENT ON COLUMN recordings.file_type IS
'File extension without dot (webm, mp4, mov, mp3, wav, pdf, docx, txt, md). Used for file validation and download headers.';

COMMENT ON COLUMN recordings.original_filename IS
'Original filename when uploaded by user. Preserves user context and provides meaningful names for downloads.';

COMMENT ON COLUMN recordings.mime_type IS
'MIME type for proper content handling (video/webm, audio/mp3, application/pdf, text/markdown, etc.). Used for Content-Type headers and browser display.';

COMMENT ON COLUMN recordings.file_size IS
'File size in bytes. Critical for storage quota tracking, usage billing, and displaying file sizes to users. Updated when file is finalized.';

-- =====================================================
-- BACKFILL EXISTING DATA
-- =====================================================

-- Update all existing recordings with default values
-- This ensures backwards compatibility and data consistency
UPDATE recordings
SET
  content_type = 'recording',
  file_type = 'webm',
  mime_type = 'video/webm'
WHERE content_type IS NULL
  OR file_type IS NULL
  OR mime_type IS NULL;

-- Make content_type NOT NULL after backfill
-- This ensures data integrity going forward
ALTER TABLE recordings
ALTER COLUMN content_type SET NOT NULL;

-- =====================================================
-- ADD PERFORMANCE INDEXES
-- =====================================================

-- Index on content_type for filtering by content type
-- Enables efficient queries like "show me all video uploads" or "show me all documents"
CREATE INDEX IF NOT EXISTS idx_recordings_content_type
ON recordings(content_type)
WHERE deleted_at IS NULL;

-- Composite index on org_id and content_type for org-scoped queries
-- Critical for dashboard filtering: "show all videos in my org"
-- Includes created_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_recordings_org_content_type_created
ON recordings(org_id, content_type, created_at DESC)
WHERE deleted_at IS NULL;

-- Index on file_size for storage analytics
-- Enables efficient SUM aggregations for storage quota calculations
-- Partial index only includes rows with file_size to save space
CREATE INDEX IF NOT EXISTS idx_recordings_file_size
ON recordings(file_size)
WHERE file_size IS NOT NULL
  AND deleted_at IS NULL;

-- Composite index for storage analytics by content type
-- Supports queries like "total storage used by documents in this org"
CREATE INDEX IF NOT EXISTS idx_recordings_org_content_file_size
ON recordings(org_id, content_type, file_size)
WHERE file_size IS NOT NULL
  AND deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_recordings_content_type IS
'Optimizes content type filtering queries. Enables fast "show all videos" or "show all documents" queries.';

COMMENT ON INDEX idx_recordings_org_content_type_created IS
'Optimizes org-scoped content type queries with sorting. Critical for dashboard views filtered by content type.';

COMMENT ON INDEX idx_recordings_file_size IS
'Optimizes storage analytics queries. Supports efficient SUM aggregations for quota tracking.';

COMMENT ON INDEX idx_recordings_org_content_file_size IS
'Optimizes storage breakdown by content type. Enables queries like "total video storage" or "total document storage" per org.';

-- =====================================================
-- ADD CONSTRAINTS FOR DATA VALIDATION
-- =====================================================

-- Add check constraint to validate content_type values
-- Ensures only valid content types are inserted
ALTER TABLE recordings
ADD CONSTRAINT check_recordings_content_type
CHECK (content_type IN ('recording', 'video', 'audio', 'document', 'text'));

-- Add check constraint to ensure file_size is positive
-- Prevents negative or zero file sizes
ALTER TABLE recordings
ADD CONSTRAINT check_recordings_file_size_positive
CHECK (file_size IS NULL OR file_size > 0);

-- Add comment for constraints
COMMENT ON CONSTRAINT check_recordings_content_type ON recordings IS
'Validates content_type against allowed values. Using CHECK constraint instead of ENUM for easier extensibility.';

COMMENT ON CONSTRAINT check_recordings_file_size_positive ON recordings IS
'Ensures file_size is always positive when set. Prevents data integrity issues.';

-- =====================================================
-- UPDATE USAGE TRACKING
-- =====================================================

-- Add comment to usage_counters.storage_gb column
-- Clarifies that this should be calculated from recordings.file_size
COMMENT ON COLUMN usage_counters.storage_gb IS
'Total storage used in GB. Calculate by SUM(file_size) from recordings table and converting bytes to GB. Should include all content types.';

-- =====================================================
-- ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- =====================================================

-- Update statistics to help PostgreSQL choose optimal query plans
ANALYZE recordings;

-- =====================================================
-- VERIFY MIGRATION
-- =====================================================

DO $$
BEGIN
  -- Check that content_type column exists and is NOT NULL
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'content_type'
    AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Column recordings.content_type was not created or is not NOT NULL';
  END IF;

  -- Check that file_type column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'file_type'
  ) THEN
    RAISE EXCEPTION 'Column recordings.file_type was not created';
  END IF;

  -- Check that original_filename column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'original_filename'
  ) THEN
    RAISE EXCEPTION 'Column recordings.original_filename was not created';
  END IF;

  -- Check that mime_type column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'mime_type'
  ) THEN
    RAISE EXCEPTION 'Column recordings.mime_type was not created';
  END IF;

  -- Check that file_size column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'file_size'
  ) THEN
    RAISE EXCEPTION 'Column recordings.file_size was not created';
  END IF;

  -- Check that indexes exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'recordings'
    AND indexname = 'idx_recordings_content_type'
  ) THEN
    RAISE EXCEPTION 'Index idx_recordings_content_type was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'recordings'
    AND indexname = 'idx_recordings_org_content_type_created'
  ) THEN
    RAISE EXCEPTION 'Index idx_recordings_org_content_type_created was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'recordings'
    AND indexname = 'idx_recordings_file_size'
  ) THEN
    RAISE EXCEPTION 'Index idx_recordings_file_size was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'recordings'
    AND indexname = 'idx_recordings_org_content_file_size'
  ) THEN
    RAISE EXCEPTION 'Index idx_recordings_org_content_file_size was not created';
  END IF;

  -- Check that constraints exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_recordings_content_type'
  ) THEN
    RAISE EXCEPTION 'Constraint check_recordings_content_type was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_recordings_file_size_positive'
  ) THEN
    RAISE EXCEPTION 'Constraint check_recordings_file_size_positive was not created';
  END IF;

  -- Check that all existing recordings have been backfilled
  IF EXISTS (
    SELECT 1
    FROM recordings
    WHERE content_type IS NULL
       OR (content_type = 'recording' AND file_type IS NULL)
       OR (content_type = 'recording' AND mime_type IS NULL)
  ) THEN
    RAISE EXCEPTION 'Some recordings were not properly backfilled with default values';
  END IF;

  RAISE NOTICE 'Migration 043_add_content_type_support completed successfully!';
  RAISE NOTICE 'Added columns: content_type, file_type, original_filename, mime_type, file_size';
  RAISE NOTICE 'Added indexes: idx_recordings_content_type, idx_recordings_org_content_type_created, idx_recordings_file_size, idx_recordings_org_content_file_size';
  RAISE NOTICE 'Added constraints: check_recordings_content_type, check_recordings_file_size_positive';
  RAISE NOTICE 'Backfilled % existing recordings with default values', (SELECT COUNT(*) FROM recordings WHERE content_type = 'recording');
END $$;
