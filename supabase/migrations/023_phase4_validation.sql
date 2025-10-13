-- Phase 4: Advanced Video Processing - Validation Script
-- Description: Comprehensive validation of Phase 4 migrations (020, 021, 022)
-- Usage: Run after deploying migrations 020-022 to verify correctness
-- Created: 2025-10-12

-- =============================================================================
-- This script performs non-destructive validation checks
-- Safe to run in production - no data modifications
-- =============================================================================

DO $$
DECLARE
  validation_errors TEXT[] := ARRAY[]::TEXT[];
  validation_warnings TEXT[] := ARRAY[]::TEXT[];
  check_result BOOLEAN;
  row_count BIGINT;
  index_count INTEGER;
  policy_count INTEGER;
  bucket_exists BOOLEAN;

BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Phase 4 Migration Validation Report';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 1: TABLE STRUCTURE VALIDATION
  -- ==========================================================================

  RAISE NOTICE '1. TABLE STRUCTURE CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check video_frames table exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_frames') THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames table does not exist');
  ELSE
    RAISE NOTICE '✓ video_frames table exists';
  END IF;

  -- Check new columns in video_frames
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'frame_number'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.frame_number column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.frame_number exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'ocr_confidence'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.ocr_confidence column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.ocr_confidence exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'ocr_blocks'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.ocr_blocks column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.ocr_blocks exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'scene_type'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.scene_type column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.scene_type exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'detected_elements'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.detected_elements column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.detected_elements exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_frames' AND column_name = 'processed_at'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video_frames.processed_at column missing');
  ELSE
    RAISE NOTICE '✓ video_frames.processed_at exists';
  END IF;

  -- Check new columns in recordings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 'frames_extracted'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: recordings.frames_extracted column missing');
  ELSE
    RAISE NOTICE '✓ recordings.frames_extracted exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 'frame_count'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: recordings.frame_count column missing');
  ELSE
    RAISE NOTICE '✓ recordings.frame_count exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'recordings' AND column_name = 'visual_indexing_status'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: recordings.visual_indexing_status column missing');
  ELSE
    RAISE NOTICE '✓ recordings.visual_indexing_status exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 2: CONSTRAINT VALIDATION
  -- ==========================================================================

  RAISE NOTICE '2. CONSTRAINT CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check unique constraint on video_frames
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_recording_frame_number'
      AND conrelid = 'video_frames'::regclass
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: unique_recording_frame_number constraint missing');
  ELSE
    RAISE NOTICE '✓ unique_recording_frame_number constraint exists';
  END IF;

  -- Check scene_type constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_scene_type'
      AND conrelid = 'video_frames'::regclass
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: check_scene_type constraint missing');
  ELSE
    RAISE NOTICE '✓ check_scene_type constraint exists';
  END IF;

  -- Check visual_indexing_status constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_visual_indexing_status'
      AND conrelid = 'recordings'::regclass
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: check_visual_indexing_status constraint missing');
  ELSE
    RAISE NOTICE '✓ check_visual_indexing_status constraint exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 3: INDEX VALIDATION
  -- ==========================================================================

  RAISE NOTICE '3. INDEX CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Count video_frames indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'video_frames';

  RAISE NOTICE 'video_frames has % indexes', index_count;

  -- Check specific indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'video_frames' AND indexname = 'idx_video_frames_embedding'
  ) THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: idx_video_frames_embedding missing');
  ELSE
    RAISE NOTICE '✓ idx_video_frames_embedding exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'video_frames' AND indexname = 'idx_video_frames_scene_type'
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: idx_video_frames_scene_type missing');
  ELSE
    RAISE NOTICE '✓ idx_video_frames_scene_type exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'video_frames' AND indexname = 'idx_video_frames_ocr_text_fts'
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: idx_video_frames_ocr_text_fts missing');
  ELSE
    RAISE NOTICE '✓ idx_video_frames_ocr_text_fts exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'recordings' AND indexname = 'idx_recordings_visual_status'
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: idx_recordings_visual_status missing');
  ELSE
    RAISE NOTICE '✓ idx_recordings_visual_status exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 4: RLS POLICY VALIDATION
  -- ==========================================================================

  RAISE NOTICE '4. RLS POLICY CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check RLS enabled on video_frames
  SELECT relrowsecurity INTO check_result
  FROM pg_class
  WHERE relname = 'video_frames';

  IF NOT check_result THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: RLS not enabled on video_frames');
  ELSE
    RAISE NOTICE '✓ RLS enabled on video_frames';
  END IF;

  -- Count video_frames policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'video_frames';

  RAISE NOTICE 'video_frames has % RLS policies', policy_count;

  IF policy_count < 2 THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: Expected at least 2 policies on video_frames');
  END IF;

  -- Check for service role policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'video_frames'
      AND policyname LIKE '%service%'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: Service role policy missing on video_frames');
  ELSE
    RAISE NOTICE '✓ Service role policy exists on video_frames';
  END IF;

  -- Check storage policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%frame%';

  RAISE NOTICE 'Storage has % frame-related policies', policy_count;

  IF policy_count < 2 THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: Expected multiple storage policies for frames');
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 5: FUNCTION VALIDATION
  -- ==========================================================================

  RAISE NOTICE '5. FUNCTION CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check for Phase 4 functions
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'search_frames_by_content'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: search_frames_by_content() function missing');
  ELSE
    RAISE NOTICE '✓ search_frames_by_content() exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'multimodal_search'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: multimodal_search() function missing');
  ELSE
    RAISE NOTICE '✓ multimodal_search() exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'queue_frame_extraction_job'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: queue_frame_extraction_job() function missing');
  ELSE
    RAISE NOTICE '✓ queue_frame_extraction_job() exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_frame_storage_path'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: get_frame_storage_path() function missing');
  ELSE
    RAISE NOTICE '✓ get_frame_storage_path() exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'get_frame_public_url'
  ) THEN
    validation_errors := array_append(validation_errors, 'ERROR: get_frame_public_url() function missing');
  ELSE
    RAISE NOTICE '✓ get_frame_public_url() exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 6: TRIGGER VALIDATION
  -- ==========================================================================

  RAISE NOTICE '6. TRIGGER CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check auto_queue_frame_extraction trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'auto_queue_frame_extraction'
      AND tgrelid = 'recordings'::regclass
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: auto_queue_frame_extraction trigger missing');
  ELSE
    RAISE NOTICE '✓ auto_queue_frame_extraction trigger exists';
  END IF;

  -- Check update_frame_storage_metadata_trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_frame_storage_metadata_trigger'
      AND tgrelid = 'video_frames'::regclass
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: update_frame_storage_metadata_trigger missing');
  ELSE
    RAISE NOTICE '✓ update_frame_storage_metadata_trigger exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 7: VIEW VALIDATION
  -- ==========================================================================

  RAISE NOTICE '7. VIEW CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check frame_extraction_stats view
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'frame_extraction_stats'
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: frame_extraction_stats view missing');
  ELSE
    RAISE NOTICE '✓ frame_extraction_stats view exists';
  END IF;

  -- Check video_frames_storage_stats view
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = 'video_frames_storage_stats'
  ) THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: video_frames_storage_stats view missing');
  ELSE
    RAISE NOTICE '✓ video_frames_storage_stats view exists';
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 8: STORAGE BUCKET VALIDATION
  -- ==========================================================================

  RAISE NOTICE '8. STORAGE BUCKET CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Check video-frames bucket exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'video-frames'
  ) INTO bucket_exists;

  IF NOT bucket_exists THEN
    validation_errors := array_append(validation_errors, 'CRITICAL: video-frames storage bucket does not exist');
  ELSE
    RAISE NOTICE '✓ video-frames bucket exists';

    -- Check bucket configuration
    DECLARE
      bucket_size_limit BIGINT;
      bucket_public BOOLEAN;
    BEGIN
      SELECT file_size_limit, public INTO bucket_size_limit, bucket_public
      FROM storage.buckets
      WHERE id = 'video-frames';

      RAISE NOTICE '  - File size limit: % bytes (% MB)', bucket_size_limit, bucket_size_limit / 1024 / 1024;
      RAISE NOTICE '  - Public: %', bucket_public;

      IF bucket_size_limit != 5242880 THEN
        validation_warnings := array_append(validation_warnings, 'WARNING: video-frames bucket size limit unexpected');
      END IF;

      IF bucket_public THEN
        validation_warnings := array_append(validation_warnings, 'WARNING: video-frames bucket should not be public');
      END IF;
    END;
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 9: DATA VALIDATION
  -- ==========================================================================

  RAISE NOTICE '9. DATA INTEGRITY CHECKS';
  RAISE NOTICE '----------------------------------------';

  -- Count video_frames records
  SELECT COUNT(*) INTO row_count FROM video_frames;
  RAISE NOTICE 'video_frames has % records', row_count;

  -- Check for frames with 1536-dim embeddings
  SELECT COUNT(*) INTO row_count
  FROM video_frames
  WHERE visual_embedding IS NOT NULL
    AND vector_dims(visual_embedding) = 1536;
  RAISE NOTICE 'video_frames has % records with 1536-dim embeddings', row_count;

  -- Check for frames with 512-dim embeddings (should be 0 after migration)
  SELECT COUNT(*) INTO row_count
  FROM video_frames
  WHERE visual_embedding IS NOT NULL
    AND vector_dims(visual_embedding) = 512;

  IF row_count > 0 THEN
    validation_warnings := array_append(validation_warnings, 'WARNING: Found ' || row_count || ' frames with 512-dim embeddings (should be 0)');
  ELSE
    RAISE NOTICE '✓ No frames with old 512-dim embeddings';
  END IF;

  -- Check recordings with frame extraction status
  SELECT COUNT(*) INTO row_count
  FROM recordings
  WHERE visual_indexing_status = 'completed';
  RAISE NOTICE 'recordings has % completed frame extractions', row_count;

  SELECT COUNT(*) INTO row_count
  FROM recordings
  WHERE visual_indexing_status = 'pending';
  RAISE NOTICE 'recordings has % pending frame extractions', row_count;

  SELECT COUNT(*) INTO row_count
  FROM recordings
  WHERE visual_indexing_status = 'failed';
  IF row_count > 0 THEN
    validation_warnings := array_append(validation_warnings, 'INFO: ' || row_count || ' recordings with failed frame extraction');
  END IF;

  RAISE NOTICE '';

  -- ==========================================================================
  -- SECTION 10: SUMMARY
  -- ==========================================================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VALIDATION SUMMARY';
  RAISE NOTICE '========================================';

  IF array_length(validation_errors, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'ERRORS FOUND (%):',array_length(validation_errors, 1);
    RAISE NOTICE '----------------------------------------';
    FOR i IN 1..array_length(validation_errors, 1) LOOP
      RAISE NOTICE '%', validation_errors[i];
    END LOOP;
  END IF;

  IF array_length(validation_warnings, 1) > 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'WARNINGS (%):',array_length(validation_warnings, 1);
    RAISE NOTICE '----------------------------------------';
    FOR i IN 1..array_length(validation_warnings, 1) LOOP
      RAISE NOTICE '%', validation_warnings[i];
    END LOOP;
  END IF;

  RAISE NOTICE '';

  IF array_length(validation_errors, 1) IS NULL AND array_length(validation_warnings, 1) IS NULL THEN
    RAISE NOTICE '✅ ALL VALIDATIONS PASSED';
    RAISE NOTICE 'Phase 4 migrations are correctly applied.';
  ELSIF array_length(validation_errors, 1) IS NULL THEN
    RAISE NOTICE '⚠️  VALIDATIONS PASSED WITH WARNINGS';
    RAISE NOTICE 'Phase 4 migrations are applied but review warnings above.';
  ELSE
    RAISE EXCEPTION '❌ VALIDATION FAILED - Phase 4 migrations incomplete or incorrect';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';

END $$;
