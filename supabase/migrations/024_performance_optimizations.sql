-- Migration: Performance Optimizations for Phase 4
-- Description: Batch operations, optimized indexes, and performance improvements
-- Created: 2025-01-12

-- =============================================================================
-- 1. Batch Operations Functions
-- =============================================================================

-- Batch update function for frame descriptions
CREATE OR REPLACE FUNCTION batch_update_frame_descriptions(
  updates JSONB
)
RETURNS void AS $$
DECLARE
  update_record JSONB;
BEGIN
  FOR update_record IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE video_frames
    SET
      visual_description = (update_record->>'description')::TEXT,
      visual_embedding = (update_record->>'embedding')::vector(512),
      scene_type = (update_record->>'scene_type')::TEXT,
      detected_elements = ARRAY(SELECT jsonb_array_elements_text(update_record->'detected_elements')),
      metadata = COALESCE(metadata, '{}'::jsonb) || (update_record->'metadata'),
      updated_at = NOW()
    WHERE id = (update_record->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_update_frame_descriptions IS 'Batch update frame descriptions for improved performance';

-- Batch insert for video frames with COPY-like performance
CREATE OR REPLACE FUNCTION batch_insert_video_frames(
  frames JSONB
)
RETURNS void AS $$
BEGIN
  INSERT INTO video_frames (
    recording_id, org_id, frame_number, frame_time_sec,
    frame_url, metadata, created_at
  )
  SELECT
    (f->>'recording_id')::UUID,
    (f->>'org_id')::UUID,
    (f->>'frame_number')::INTEGER,
    (f->>'frame_time_sec')::NUMERIC,
    f->>'frame_url',
    COALESCE(f->'metadata', '{}'::jsonb),
    NOW()
  FROM jsonb_array_elements(frames) f
  ON CONFLICT (recording_id, frame_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_insert_video_frames IS 'Batch insert frames with conflict handling';

-- Batch update OCR results
CREATE OR REPLACE FUNCTION batch_update_ocr_results(
  updates JSONB
)
RETURNS void AS $$
DECLARE
  update_record JSONB;
BEGIN
  FOR update_record IN SELECT * FROM jsonb_array_elements(updates)
  LOOP
    UPDATE video_frames
    SET
      ocr_text = (update_record->>'text')::TEXT,
      ocr_confidence = (update_record->>'confidence')::NUMERIC,
      ocr_blocks = COALESCE(update_record->'blocks', '[]'::jsonb),
      updated_at = NOW()
    WHERE id = (update_record->>'id')::UUID;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_update_ocr_results IS 'Batch update OCR results for improved performance';

-- =============================================================================
-- 2. Optimize IVFFlat Indexes
-- =============================================================================

-- Drop existing suboptimal indexes
DROP INDEX IF EXISTS idx_video_frames_embedding;

-- Create optimized ivfflat index with better lists parameter
-- lists = sqrt(expected_rows) / 10 (for ~100K frames, use 316)
CREATE INDEX idx_video_frames_embedding_optimized
  ON video_frames
  USING ivfflat (visual_embedding vector_cosine_ops)
  WITH (lists = 316)
  WHERE visual_embedding IS NOT NULL;

COMMENT ON INDEX idx_video_frames_embedding_optimized IS
  'Optimized IVFFlat index for ~100K vectors. Adjust lists parameter as data grows: sqrt(rows)/10';

-- Create partial index for recent frames (better performance for hot data)
CREATE INDEX idx_video_frames_embedding_recent
  ON video_frames
  USING ivfflat (visual_embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE visual_embedding IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days';

COMMENT ON INDEX idx_video_frames_embedding_recent IS
  'Partial index for recent frames to optimize hot path queries';

-- =============================================================================
-- 3. Composite and Specialized Indexes
-- =============================================================================

-- Composite index for multimodal search
CREATE INDEX idx_video_frames_multimodal
  ON video_frames(recording_id, frame_time_sec)
  WHERE visual_embedding IS NOT NULL;

-- Index for OCR text search using GIN
CREATE INDEX idx_video_frames_ocr_gin
  ON video_frames
  USING gin(to_tsvector('english', ocr_text))
  WHERE ocr_text IS NOT NULL;

-- Index for scene type filtering
CREATE INDEX idx_video_frames_scene_type
  ON video_frames(org_id, scene_type)
  WHERE scene_type IS NOT NULL;

-- Index for unprocessed frames (worker queries)
CREATE INDEX idx_video_frames_unprocessed
  ON video_frames(recording_id, frame_number)
  WHERE visual_description IS NULL;

-- =============================================================================
-- 4. Query Cache Optimization
-- =============================================================================

-- Add index for cache expiration
CREATE INDEX idx_query_cache_expiry
  ON query_cache(expires_at)
  WHERE expires_at IS NOT NULL;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM query_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic cleanup (if using pg_cron)
-- SELECT cron.schedule('clean-query-cache', '*/5 * * * *', 'SELECT clean_expired_cache()');

-- =============================================================================
-- 5. Performance Monitoring Functions
-- =============================================================================

-- Get index usage statistics
CREATE OR REPLACE FUNCTION get_vector_index_stats()
RETURNS TABLE(
  index_name TEXT,
  table_name TEXT,
  index_size TEXT,
  index_scans BIGINT,
  tuples_read BIGINT,
  tuples_fetched BIGINT,
  efficiency NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    indexrelname::TEXT AS index_name,
    tablename::TEXT AS table_name,
    pg_size_pretty(pg_relation_size(indexrelid))::TEXT AS index_size,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    CASE
      WHEN idx_tup_read > 0 THEN
        ROUND((idx_tup_fetch::NUMERIC / idx_tup_read::NUMERIC) * 100, 2)
      ELSE 0
    END AS efficiency
  FROM pg_stat_user_indexes
  WHERE indexrelname LIKE '%embedding%' OR indexrelname LIKE '%video_frames%'
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_vector_index_stats IS 'Monitor vector index usage and efficiency';

-- Get slow query patterns
CREATE OR REPLACE FUNCTION analyze_slow_queries(
  threshold_ms INTEGER DEFAULT 1000
)
RETURNS TABLE(
  query_pattern TEXT,
  avg_duration_ms NUMERIC,
  call_count BIGINT,
  total_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    substring(query FROM 1 FOR 100) AS query_pattern,
    ROUND(mean_exec_time, 2) AS avg_duration_ms,
    calls AS call_count,
    ROUND(total_exec_time, 2) AS total_time_ms
  FROM pg_stat_statements
  WHERE mean_exec_time > threshold_ms
    AND query LIKE '%video_frames%'
  ORDER BY mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 6. Connection Pooling Configuration
-- =============================================================================

-- Recommended connection pool settings (apply at application level):
COMMENT ON DATABASE current_database IS
  'Recommended pool settings: max_connections=100, pool_size=20, statement_timeout=30s';

-- Set statement timeout for long-running queries
ALTER DATABASE current_database SET statement_timeout = '30s';

-- =============================================================================
-- 7. Parallel Query Configuration
-- =============================================================================

-- Enable parallel query execution for large scans
ALTER TABLE video_frames SET (parallel_workers = 4);
ALTER TABLE transcript_chunks SET (parallel_workers = 2);

-- =============================================================================
-- 8. Statistics and Vacuum Configuration
-- =============================================================================

-- Update statistics for better query planning
ANALYZE video_frames;
ANALYZE transcript_chunks;
ANALYZE recordings;

-- Configure autovacuum for high-update tables
ALTER TABLE video_frames SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- =============================================================================
-- 9. Materialized View for Common Queries
-- =============================================================================

-- Create materialized view for recording statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS recording_stats AS
SELECT
  r.id AS recording_id,
  r.org_id,
  r.title,
  r.duration_sec,
  COUNT(DISTINCT vf.id) AS frame_count,
  COUNT(DISTINCT vf.id) FILTER (WHERE vf.visual_description IS NOT NULL) AS indexed_frames,
  COUNT(DISTINCT vf.id) FILTER (WHERE vf.ocr_text IS NOT NULL) AS ocr_frames,
  AVG(vf.ocr_confidence) AS avg_ocr_confidence,
  MAX(vf.created_at) AS last_frame_processed
FROM recordings r
LEFT JOIN video_frames vf ON r.id = vf.recording_id
GROUP BY r.id, r.org_id, r.title, r.duration_sec
WITH DATA;

-- Create index on materialized view
CREATE INDEX idx_recording_stats_org ON recording_stats(org_id);
CREATE INDEX idx_recording_stats_recording ON recording_stats(recording_id);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_recording_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY recording_stats;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 10. Performance Baseline Capture
-- =============================================================================

-- Create table to track performance metrics
CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT NOT NULL,
  recording_id UUID REFERENCES recordings(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_ms INTEGER GENERATED ALWAYS AS (
    EXTRACT(MILLISECONDS FROM (end_time - start_time))::INTEGER
  ) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance analysis
CREATE INDEX idx_performance_metrics_operation ON performance_metrics(operation, created_at DESC);
CREATE INDEX idx_performance_metrics_recording ON performance_metrics(recording_id, operation);

-- Function to track operation performance
CREATE OR REPLACE FUNCTION track_performance(
  p_operation TEXT,
  p_recording_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO performance_metrics (operation, recording_id, start_time, end_time, metadata)
  VALUES (p_operation, p_recording_id, p_start_time, p_end_time, p_metadata)
  RETURNING id INTO metric_id;

  RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- Verification
-- =============================================================================

DO $$
DECLARE
  frame_count BIGINT;
  optimal_lists INTEGER;
BEGIN
  -- Get current frame count
  SELECT COUNT(*) INTO frame_count FROM video_frames;

  -- Calculate optimal lists parameter
  optimal_lists := GREATEST(LEAST(sqrt(frame_count)::INTEGER / 10, 1000), 10);

  RAISE NOTICE '=== Performance Optimization Report ===';
  RAISE NOTICE 'Video frames: % rows', frame_count;
  RAISE NOTICE 'Current lists parameter: 316';
  RAISE NOTICE 'Optimal lists parameter: %', optimal_lists;
  RAISE NOTICE '';
  RAISE NOTICE 'Indexes created:';
  RAISE NOTICE '  - idx_video_frames_embedding_optimized (ivfflat with lists=316)';
  RAISE NOTICE '  - idx_video_frames_embedding_recent (partial for recent data)';
  RAISE NOTICE '  - idx_video_frames_multimodal (composite for searches)';
  RAISE NOTICE '  - idx_video_frames_ocr_gin (GIN for text search)';
  RAISE NOTICE '';
  RAISE NOTICE 'Batch functions created:';
  RAISE NOTICE '  - batch_insert_video_frames()';
  RAISE NOTICE '  - batch_update_frame_descriptions()';
  RAISE NOTICE '  - batch_update_ocr_results()';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring functions:';
  RAISE NOTICE '  - get_vector_index_stats()';
  RAISE NOTICE '  - analyze_slow_queries()';
  RAISE NOTICE '  - track_performance()';
  RAISE NOTICE '';
  RAISE NOTICE 'Run SELECT get_vector_index_stats() to monitor index usage';
END $$;