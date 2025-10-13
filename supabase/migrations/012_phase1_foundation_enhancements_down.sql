-- Rollback Migration: Phase 1 Foundation Enhancements
-- Description: Removes all tables, functions, and job types added in migration 012
-- WARNING: This will permanently delete all data in these tables:
--   - recording_summaries (LLM summaries)
--   - video_frames (extracted frames)
--   - connector_configs (external integrations)
--   - imported_documents (synced documents)
--   - search_analytics (query logs)
--   - query_cache (cached results)
-- Created: 2025-10-12

-- =============================================================================
-- SAFETY CHECK
-- =============================================================================

DO $$
BEGIN
  RAISE WARNING '=== ROLLING BACK PHASE 1 FOUNDATION ENHANCEMENTS ===';
  RAISE WARNING 'This will DELETE ALL DATA from 6 tables';
  RAISE WARNING 'Proceeding in 5 seconds... (Cancel with Ctrl+C)';
  PERFORM pg_sleep(5);
END $$;

-- =============================================================================
-- Drop helper views and functions (from migrations 017-019)
-- =============================================================================

DROP VIEW IF EXISTS vector_index_stats CASCADE;
DROP FUNCTION IF EXISTS calculate_optimal_lists(TEXT, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS index_usage_report(TEXT) CASCADE;

-- =============================================================================
-- Drop database functions (from migration 012)
-- =============================================================================

DROP FUNCTION IF EXISTS hierarchical_search(
  vector(1536),
  vector(3072),
  UUID,
  INTEGER,
  INTEGER,
  FLOAT
) CASCADE;

DROP FUNCTION IF EXISTS search_chunks_with_recency(
  vector(1536),
  UUID,
  INTEGER,
  FLOAT,
  FLOAT,
  INTEGER
) CASCADE;

DROP FUNCTION IF EXISTS cleanup_expired_cache() CASCADE;

RAISE NOTICE 'Dropped database functions';

-- =============================================================================
-- Drop tables (CASCADE will drop policies, indexes, triggers)
-- =============================================================================

-- Drop in reverse order of dependencies

DROP TABLE IF EXISTS query_cache CASCADE;
RAISE NOTICE 'Dropped query_cache table';

DROP TABLE IF EXISTS search_analytics CASCADE;
RAISE NOTICE 'Dropped search_analytics table';

DROP TABLE IF EXISTS imported_documents CASCADE;
RAISE NOTICE 'Dropped imported_documents table';

DROP TABLE IF EXISTS connector_configs CASCADE;
RAISE NOTICE 'Dropped connector_configs table';

DROP TABLE IF EXISTS video_frames CASCADE;
RAISE NOTICE 'Dropped video_frames table';

DROP TABLE IF EXISTS recording_summaries CASCADE;
RAISE NOTICE 'Dropped recording_summaries table';

-- =============================================================================
-- Note about job types
-- =============================================================================

-- PostgreSQL does not support removing values from ENUMs directly
-- The following job types were added but cannot be removed without recreating the enum:
--   - generate_summary
--   - extract_frames
--   - sync_connector
--
-- These values will remain in the job_type enum but will be unused.
-- If you need to clean up the enum, you must:
--   1. Create a new enum without these values
--   2. Alter the jobs table to use the new enum
--   3. Drop the old enum
--
-- This is not done automatically to avoid affecting existing jobs.

RAISE WARNING 'Job types (generate_summary, extract_frames, sync_connector) remain in job_type enum';
RAISE WARNING 'These types are now unused but cannot be easily removed from enums';

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
  remaining_tables INTEGER;
BEGIN
  -- Check that all tables are dropped
  SELECT COUNT(*) INTO remaining_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'recording_summaries',
      'video_frames',
      'connector_configs',
      'imported_documents',
      'search_analytics',
      'query_cache'
    );

  IF remaining_tables > 0 THEN
    RAISE EXCEPTION 'Rollback failed: % tables still exist', remaining_tables;
  END IF;

  RAISE NOTICE '=== ROLLBACK COMPLETE ===';
  RAISE NOTICE 'All Phase 1 tables have been dropped';
  RAISE NOTICE 'Database functions removed';
  RAISE NOTICE 'Job types remain in enum (cannot be removed)';
END $$;
