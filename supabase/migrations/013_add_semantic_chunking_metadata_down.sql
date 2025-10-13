-- Rollback Migration: Remove semantic chunking metadata
-- Description: Safely removes all semantic chunking columns and indexes
-- Phase: 2 - Semantic Chunking (ROLLBACK)
-- WARNING: This will permanently delete semantic chunking metadata (columns are nullable, so no data loss for core functionality)

-- =============================================================================
-- ROLLBACK PROCEDURE
-- =============================================================================

-- Step 1: Drop indexes first (they depend on columns)
DROP INDEX IF EXISTS idx_transcript_chunks_semantic_score;
DROP INDEX IF EXISTS idx_transcript_chunks_structure;
DROP INDEX IF EXISTS idx_transcript_chunks_strategy;

-- Step 2: Drop constraints (if migration 013a was applied)
ALTER TABLE transcript_chunks
  DROP CONSTRAINT IF EXISTS check_boundary_type,
  DROP CONSTRAINT IF EXISTS check_structure_type,
  DROP CONSTRAINT IF EXISTS check_semantic_score_range,
  DROP CONSTRAINT IF EXISTS check_chunking_strategy;

-- Step 3: Drop columns (CASCADE to drop any dependent views/functions)
ALTER TABLE transcript_chunks
  DROP COLUMN IF EXISTS boundary_type CASCADE,
  DROP COLUMN IF EXISTS structure_type CASCADE,
  DROP COLUMN IF EXISTS semantic_score CASCADE,
  DROP COLUMN IF EXISTS chunking_strategy CASCADE;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  remaining_columns INTEGER;
  remaining_indexes INTEGER;
BEGIN
  -- Check columns are removed
  SELECT COUNT(*) INTO remaining_columns
  FROM information_schema.columns
  WHERE table_name = 'transcript_chunks'
    AND table_schema = 'public'
    AND column_name IN ('chunking_strategy', 'semantic_score', 'structure_type', 'boundary_type');

  IF remaining_columns > 0 THEN
    RAISE EXCEPTION 'Rollback failed: % semantic chunking columns still exist', remaining_columns;
  END IF;

  -- Check indexes are removed
  SELECT COUNT(*) INTO remaining_indexes
  FROM pg_indexes
  WHERE tablename = 'transcript_chunks'
    AND indexname IN (
      'idx_transcript_chunks_strategy',
      'idx_transcript_chunks_structure',
      'idx_transcript_chunks_semantic_score'
    );

  IF remaining_indexes > 0 THEN
    RAISE EXCEPTION 'Rollback failed: % semantic chunking indexes still exist', remaining_indexes;
  END IF;

  RAISE NOTICE 'Successfully rolled back semantic chunking metadata';
  RAISE NOTICE 'Removed: 4 columns, 3 indexes, 4 constraints (if present)';
END $$;

-- Add rollback comment
COMMENT ON TABLE transcript_chunks IS
  'Last migration rollback: semantic_chunking_metadata removed at ' || NOW()::text;
