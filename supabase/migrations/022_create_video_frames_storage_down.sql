-- Rollback: Video Frames Storage Bucket
-- Description: Removes video-frames storage bucket and related resources
-- WARNING: This will delete all stored frame images
-- Created: 2025-10-12

-- =============================================================================
-- 1. Drop trigger and function
-- =============================================================================

DROP TRIGGER IF EXISTS update_frame_storage_metadata_trigger ON video_frames;

DROP FUNCTION IF EXISTS update_frame_storage_metadata();

-- =============================================================================
-- 2. Drop view
-- =============================================================================

DROP VIEW IF EXISTS video_frames_storage_stats;

-- =============================================================================
-- 3. Drop helper functions
-- =============================================================================

DROP FUNCTION IF EXISTS cleanup_orphaned_frames();

DROP FUNCTION IF EXISTS get_frame_public_url(TEXT);

DROP FUNCTION IF EXISTS get_frame_storage_path(UUID, UUID, INTEGER);

-- =============================================================================
-- 4. Drop RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "Users can upload frames for their org" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete frames" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update frames" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload frames" ON storage.objects;
DROP POLICY IF EXISTS "Users can view frames from their org" ON storage.objects;

-- =============================================================================
-- 5. Delete storage bucket
-- =============================================================================

-- WARNING: This deletes all frame images permanently
DELETE FROM storage.buckets WHERE id = 'video-frames';

-- =============================================================================
-- 6. Clear frame_url references in database
-- =============================================================================

-- Set frame_url to NULL for all frames (storage files are already deleted)
UPDATE video_frames
SET frame_url = NULL
WHERE frame_url IS NOT NULL;

-- =============================================================================
-- 7. Verification
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== Video Frames Storage Rollback Complete ===';
  RAISE NOTICE 'Deleted bucket: video-frames';
  RAISE NOTICE 'Dropped policies: 5 storage policies';
  RAISE NOTICE 'Dropped functions: get_frame_storage_path(), get_frame_public_url(), cleanup_orphaned_frames()';
  RAISE NOTICE 'Dropped view: video_frames_storage_stats';
  RAISE NOTICE 'Dropped trigger: update_frame_storage_metadata_trigger';
  RAISE NOTICE 'Cleared frame_url references in video_frames table';
  RAISE NOTICE 'WARNING: All frame images have been permanently deleted';
END $$;
