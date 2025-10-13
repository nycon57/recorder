-- Migration: Add indexes for common query patterns
-- Description: Improves performance for connector management and error tracking
-- Impact: Faster queries for sync status, error debugging, and cache eviction
-- Created: 2025-10-12

-- =============================================================================
-- 1. connector_configs: Track sync status and failures
-- =============================================================================

-- Partial index for active/failed syncs
-- Use case: Dashboard showing "Syncing" and "Error" connectors
-- Query: SELECT * FROM connector_configs WHERE sync_status IN ('syncing', 'error') ORDER BY last_sync_at DESC;
CREATE INDEX idx_connector_configs_sync_status
  ON connector_configs(sync_status, last_sync_at DESC)
  WHERE sync_status IN ('syncing', 'error');

COMMENT ON INDEX idx_connector_configs_sync_status IS
  'Partial index for tracking active and failed syncs. Speeds up connector dashboard queries.';

-- =============================================================================
-- 2. imported_documents: Error tracking and debugging
-- =============================================================================

-- Partial index for documents with sync errors
-- Use case: Error reporting page showing failed imports per connector
-- Query: SELECT * FROM imported_documents WHERE sync_status = 'error' ORDER BY updated_at DESC;
CREATE INDEX idx_imported_documents_sync_errors
  ON imported_documents(connector_id, sync_status, updated_at DESC)
  WHERE sync_status = 'error';

COMMENT ON INDEX idx_imported_documents_sync_errors IS
  'Partial index for error reporting and debugging failed imports. Helps identify problematic connectors.';

-- =============================================================================
-- 3. query_cache: LRU eviction support
-- =============================================================================

-- Index for LRU (Least Recently Used) eviction
-- Use case: When cache reaches size limit, evict least recently accessed entries
-- Query: DELETE FROM query_cache WHERE id IN (SELECT id FROM query_cache WHERE ttl > now() ORDER BY last_accessed_at ASC LIMIT 100);
CREATE INDEX idx_query_cache_lru
  ON query_cache(last_accessed_at ASC)
  WHERE ttl > now();

COMMENT ON INDEX idx_query_cache_lru IS
  'Support LRU eviction when cache reaches size limit. Only indexes non-expired entries.';

-- =============================================================================
-- 4. search_analytics: Time-series aggregations
-- =============================================================================

-- Composite index for analytics dashboard
-- Use case: "Average query latency by mode over last 7 days"
-- Query: SELECT mode, AVG(latency_ms) FROM search_analytics WHERE org_id = X AND created_at > now() - interval '7 days' GROUP BY mode;
CREATE INDEX idx_search_analytics_org_time_mode
  ON search_analytics(org_id, created_at DESC, mode)
  WHERE latency_ms IS NOT NULL;

COMMENT ON INDEX idx_search_analytics_org_time_mode IS
  'Support time-series analytics queries grouped by search mode. Partial index excludes null latencies.';

-- =============================================================================
-- 5. imported_documents: Connector-specific queries
-- =============================================================================

-- Index for "show me all completed imports from connector X"
-- Query: SELECT * FROM imported_documents WHERE connector_id = X AND sync_status = 'completed' ORDER BY last_synced_at DESC;
CREATE INDEX idx_imported_documents_connector_completed
  ON imported_documents(connector_id, last_synced_at DESC)
  WHERE sync_status = 'completed';

COMMENT ON INDEX idx_imported_documents_connector_completed IS
  'Optimize queries for successfully synced documents per connector. Useful for sync history views.';

-- =============================================================================
-- 6. video_frames: Frame browser queries
-- =============================================================================

-- Index for "get frames from recording X between timestamps Y and Z"
-- Already exists: idx_video_frames_time (recording_id, frame_time_sec)
-- But add index for OCR text search within recording

CREATE INDEX idx_video_frames_recording_ocr
  ON video_frames(recording_id)
  WHERE ocr_text IS NOT NULL;

COMMENT ON INDEX idx_video_frames_recording_ocr IS
  'Partial index for frames with OCR text. Speeds up "find frames with text in recording X" queries.';

-- Full-text search index for OCR text (optional, for advanced search)
-- Uncomment if OCR search becomes a common feature
-- CREATE INDEX idx_video_frames_ocr_text_search
--   ON video_frames USING gin(to_tsvector('english', ocr_text))
--   WHERE ocr_text IS NOT NULL;

-- =============================================================================
-- Helper function: Index usage report
-- =============================================================================

CREATE OR REPLACE FUNCTION index_usage_report(
  schema_name TEXT DEFAULT 'public'
)
RETURNS TABLE(
  table_name TEXT,
  index_name TEXT,
  scans BIGINT,
  tuples_read BIGINT,
  tuples_fetched BIGINT,
  index_size TEXT,
  usage_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    stat.relname::TEXT AS table_name,
    stat.indexrelname::TEXT AS index_name,
    stat.idx_scan AS scans,
    stat.idx_tup_read AS tuples_read,
    stat.idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(stat.indexrelid)) AS index_size,
    CASE
      WHEN stat.idx_scan = 0 THEN 0
      ELSE ROUND(100.0 * stat.idx_scan / NULLIF(SUM(stat.idx_scan) OVER (PARTITION BY stat.relname), 0), 2)
    END AS usage_pct
  FROM pg_stat_user_indexes stat
  WHERE stat.schemaname = schema_name
  ORDER BY stat.relname, stat.idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION index_usage_report IS
  'Generate index usage report to identify hot indexes and unused indexes. Run periodically to optimize index strategy.';

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
  new_indexes INTEGER;
BEGIN
  -- Count new indexes added by this migration
  SELECT COUNT(*) INTO new_indexes
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_connector_configs_sync_status',
      'idx_imported_documents_sync_errors',
      'idx_query_cache_lru',
      'idx_search_analytics_org_time_mode',
      'idx_imported_documents_connector_completed',
      'idx_video_frames_recording_ocr'
    );

  IF new_indexes < 6 THEN
    RAISE WARNING 'Expected 6 new indexes, found %', new_indexes;
  END IF;

  RAISE NOTICE '=== Index Optimization Complete ===';
  RAISE NOTICE 'Added % performance indexes for common query patterns', new_indexes;
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes added:';
  RAISE NOTICE '  1. connector_configs: sync_status tracking';
  RAISE NOTICE '  2. imported_documents: error debugging';
  RAISE NOTICE '  3. query_cache: LRU eviction';
  RAISE NOTICE '  4. search_analytics: time-series aggregations';
  RAISE NOTICE '  5. imported_documents: completed imports';
  RAISE NOTICE '  6. video_frames: OCR text filtering';
  RAISE NOTICE '';
  RAISE NOTICE 'Run index_usage_report() periodically to monitor effectiveness:';
  RAISE NOTICE '  SELECT * FROM index_usage_report() WHERE table_name LIKE ''%connector%'';';
END $$;

-- =============================================================================
-- Performance notes
-- =============================================================================

-- All indexes are either partial (WHERE clause) or composite (multiple columns)
-- to minimize index size and maximize query performance.
--
-- Partial indexes are especially useful for:
-- - Filtering by status (only index 'error' or 'syncing', not 'idle')
-- - Filtering by boolean (only index 'is_active = true')
-- - Filtering by time (only index non-expired cache entries)
--
-- Monitor index usage with:
--   SELECT * FROM index_usage_report();
--
-- Identify unused indexes (candidates for removal):
--   SELECT * FROM index_usage_report() WHERE scans = 0;
--
-- Identify hot indexes (candidates for further optimization):
--   SELECT * FROM index_usage_report() WHERE usage_pct > 50;
