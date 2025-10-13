-- ============================================
-- PHASE 6: PERFORMANCE OPTIMIZATIONS
-- Consolidated migration for database performance improvements
-- ============================================

-- ============================================
-- 1. PARTITION INDEXES
-- Indexes must be created on each partition explicitly
-- ============================================

-- January 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_01_org
  ON search_analytics_2025_01(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_01_query
  ON search_analytics_2025_01 USING gin(to_tsvector('english', query));

-- February 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_02_org
  ON search_analytics_2025_02(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_02_query
  ON search_analytics_2025_02 USING gin(to_tsvector('english', query));

-- March 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_03_org
  ON search_analytics_2025_03(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_03_query
  ON search_analytics_2025_03 USING gin(to_tsvector('english', query));

-- April 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_04_org
  ON search_analytics_2025_04(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_04_query
  ON search_analytics_2025_04 USING gin(to_tsvector('english', query));

-- May 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_05_org
  ON search_analytics_2025_05(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_05_query
  ON search_analytics_2025_05 USING gin(to_tsvector('english', query));

-- June 2025
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_06_org
  ON search_analytics_2025_06(org_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_analytics_2025_06_query
  ON search_analytics_2025_06 USING gin(to_tsvector('english', query));

-- ============================================
-- 2. OPTIMIZED QUOTA INDEXES
-- ============================================

-- Covering index for frequent quota lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_quotas_lookup
  ON org_quotas(org_id, plan_tier, quota_reset_at)
  INCLUDE (
    searches_per_month, searches_used,
    recordings_per_month, recordings_used,
    ai_requests_per_month, ai_requests_used,
    storage_gb, storage_used_gb
  ) WHERE deleted_at IS NULL;

-- Partial index for active quotas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_quotas_active
  ON org_quotas(org_id)
  WHERE quota_reset_at > now();

-- Index for quota reset check
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_org_quotas_reset
  ON org_quotas(quota_reset_at)
  WHERE quota_reset_at <= now();

-- ============================================
-- 3. ANALYTICS INDEXES
-- ============================================

-- Composite index for usage events
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quota_events_composite
  ON quota_usage_events(org_id, quota_type, created_at DESC);

-- Index for search feedback aggregation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_search_feedback_composite
  ON search_feedback(org_id, query, created_at DESC);

-- ============================================
-- 4. MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Org-level analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS org_analytics_summary AS
SELECT
  org_id,
  COUNT(*) as total_searches,
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate,
  COUNT(DISTINCT user_id) as unique_users,
  DATE(created_at) as date
FROM search_analytics
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY org_id, DATE(created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_analytics_summary_unique
  ON org_analytics_summary(org_id, date);

COMMENT ON MATERIALIZED VIEW org_analytics_summary IS
  'PERFORMANCE: Aggregated analytics per org per day. Refresh hourly via cron.';

-- ============================================
-- 5. OPTIMIZED SEARCH FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION search_chunks_optimized(
  p_org_id UUID,
  p_embedding vector(3072),
  p_limit INTEGER DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.7
) RETURNS TABLE (
  chunk_id UUID,
  recording_id UUID,
  content TEXT,
  similarity FLOAT
) AS $$
BEGIN
  -- Use parallel scan for large tables
  SET LOCAL max_parallel_workers_per_gather = 4;
  SET LOCAL parallel_tuple_cost = 0.01;
  SET LOCAL parallel_setup_cost = 100;

  RETURN QUERY
  WITH ranked_chunks AS (
    SELECT
      tc.id AS chunk_id,
      tc.recording_id,
      tc.content,
      1 - (tc.embedding <=> p_embedding) AS similarity
    FROM transcript_chunks tc
    JOIN recordings r ON tc.recording_id = r.id
    WHERE r.org_id = p_org_id
      AND r.deleted_at IS NULL
      AND tc.deleted_at IS NULL
      AND 1 - (tc.embedding <=> p_embedding) > p_threshold
    ORDER BY tc.embedding <=> p_embedding
    LIMIT p_limit
  )
  SELECT * FROM ranked_chunks;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

COMMENT ON FUNCTION search_chunks_optimized IS
  'PERFORMANCE: Parallel-enabled vector search with similarity threshold';

-- ============================================
-- 6. BATCH OPERATIONS
-- ============================================

-- Batch insert for analytics events
CREATE OR REPLACE FUNCTION batch_insert_analytics(
  p_events JSONB
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  INSERT INTO search_analytics (
    org_id, user_id, query, mode, results_count,
    latency_ms, cache_hit, cache_layer, filters,
    clicked_result_ids, session_id
  )
  SELECT
    (event->>'org_id')::UUID,
    (event->>'user_id')::UUID,
    event->>'query',
    event->>'mode',
    (event->>'results_count')::INTEGER,
    (event->>'latency_ms')::INTEGER,
    (event->>'cache_hit')::BOOLEAN,
    event->>'cache_layer',
    event->'filters',
    ARRAY(SELECT jsonb_array_elements_text(event->'clicked_result_ids')),
    (event->>'session_id')::UUID
  FROM jsonb_array_elements(p_events) AS event;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. AUTO-MAINTENANCE FUNCTIONS
-- ============================================

-- Create future partitions automatically
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
  v_start_date DATE;
  v_end_date DATE;
  v_partition_name TEXT;
BEGIN
  -- Create partitions for next 3 months
  FOR i IN 1..3 LOOP
    v_start_date := date_trunc('month', now() + (i || ' months')::INTERVAL);
    v_end_date := v_start_date + INTERVAL '1 month';
    v_partition_name := 'search_analytics_' || to_char(v_start_date, 'YYYY_MM');

    IF NOT EXISTS (
      SELECT 1 FROM pg_class WHERE relname = v_partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE %I PARTITION OF search_analytics FOR VALUES FROM (%L) TO (%L)',
        v_partition_name, v_start_date, v_end_date
      );

      -- Create indexes on new partition
      EXECUTE format(
        'CREATE INDEX %I ON %I(org_id, created_at DESC)',
        'idx_' || v_partition_name || '_org', v_partition_name
      );

      EXECUTE format(
        'CREATE INDEX %I ON %I USING gin(to_tsvector(''english'', query))',
        'idx_' || v_partition_name || '_query', v_partition_name
      );

      -- Enable RLS on new partition
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', v_partition_name);

      -- Create RLS policies
      EXECUTE format(
        'CREATE POLICY "Users can view their org''s analytics" ON %I FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))',
        v_partition_name
      );

      EXECUTE format(
        'CREATE POLICY "Users can insert their org''s analytics" ON %I FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))',
        v_partition_name
      );

      RAISE NOTICE 'Created partition %', v_partition_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Drop old partitions (older than 6 months)
CREATE OR REPLACE FUNCTION drop_old_partitions()
RETURNS void AS $$
DECLARE
  v_cutoff_date DATE;
  v_partition_name TEXT;
BEGIN
  v_cutoff_date := date_trunc('month', now() - INTERVAL '6 months');

  FOR v_partition_name IN
    SELECT tablename FROM pg_tables
    WHERE tablename LIKE 'search_analytics_%'
    AND tablename < 'search_analytics_' || to_char(v_cutoff_date, 'YYYY_MM')
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS %I', v_partition_name);
    RAISE NOTICE 'Dropped old partition %', v_partition_name;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-analyze hot tables
CREATE OR REPLACE FUNCTION auto_analyze_hot_tables()
RETURNS void AS $$
BEGIN
  ANALYZE org_quotas;
  ANALYZE quota_usage_events;
  ANALYZE search_analytics;
  ANALYZE transcript_chunks;
  ANALYZE recordings;

  VACUUM (ANALYZE, SKIP_LOCKED) org_quotas;
  VACUUM (ANALYZE, SKIP_LOCKED) quota_usage_events;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. MONITORING VIEWS
-- ============================================

-- Quota usage efficiency
CREATE OR REPLACE VIEW quota_usage_efficiency AS
SELECT
  plan_tier,
  COUNT(*) as org_count,
  AVG(searches_used::FLOAT / NULLIF(searches_per_month, 0)) as avg_search_usage,
  AVG(recordings_used::FLOAT / NULLIF(recordings_per_month, 0)) as avg_recording_usage,
  AVG(ai_requests_used::FLOAT / NULLIF(ai_requests_per_month, 0)) as avg_ai_usage,
  AVG(storage_used_gb / NULLIF(storage_gb, 0)) as avg_storage_usage
FROM org_quotas
GROUP BY plan_tier;

-- Slow queries monitoring
CREATE OR REPLACE VIEW slow_queries AS
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time,
  stddev_exec_time
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Cache effectiveness
CREATE OR REPLACE VIEW cache_effectiveness AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_searches,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
  ROUND(100.0 * SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) / COUNT(*), 2) as cache_hit_rate,
  AVG(latency_ms) as avg_latency_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) as p50_latency_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency_ms,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency_ms
FROM search_analytics
WHERE created_at > now() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Slow quota checks
CREATE OR REPLACE VIEW slow_quota_checks AS
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%check_quota%'
  AND mean_exec_time > 10
ORDER BY mean_exec_time DESC;

-- ============================================
-- 9. PERFORMANCE BASELINE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_performance_baseline()
RETURNS TABLE (
  metric TEXT,
  value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  -- Average quota check time
  SELECT 'avg_quota_check_ms'::TEXT,
         ROUND(AVG(mean_exec_time)::NUMERIC, 2)
  FROM pg_stat_statements
  WHERE query LIKE '%check_quota%'
  UNION ALL
  -- Search query P95 latency
  SELECT 'search_p95_latency_ms'::TEXT,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::NUMERIC
  FROM search_analytics
  WHERE created_at > now() - INTERVAL '1 hour'
  UNION ALL
  -- Cache hit rate
  SELECT 'cache_hit_rate_pct'::TEXT,
         ROUND(100.0 * SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) / COUNT(*), 2)::NUMERIC
  FROM search_analytics
  WHERE created_at > now() - INTERVAL '1 hour'
  UNION ALL
  -- Active connections
  SELECT 'active_connections'::TEXT,
         COUNT(*)::NUMERIC
  FROM pg_stat_activity
  WHERE state != 'idle'
  UNION ALL
  -- Database size
  SELECT 'database_size_gb'::TEXT,
         ROUND(pg_database_size(current_database()) / 1073741824.0, 2)::NUMERIC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. CONNECTION POOLING OPTIMIZATIONS
-- ============================================

-- Optimize for Supabase/PgBouncer
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET lock_timeout = '10s';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'all';

-- ============================================
-- 11. GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION search_chunks_optimized TO service_role;
GRANT EXECUTE ON FUNCTION batch_insert_analytics TO service_role;
GRANT EXECUTE ON FUNCTION create_monthly_partitions TO service_role;
GRANT EXECUTE ON FUNCTION drop_old_partitions TO service_role;
GRANT EXECUTE ON FUNCTION auto_analyze_hot_tables TO service_role;
GRANT EXECUTE ON FUNCTION get_performance_baseline TO service_role;

GRANT SELECT ON slow_queries TO service_role;
GRANT SELECT ON slow_quota_checks TO service_role;
GRANT SELECT ON cache_effectiveness TO service_role;
GRANT SELECT ON quota_usage_efficiency TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'search_chunks_optimized') AND
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_monthly_partitions') THEN
        RAISE NOTICE '✓ Performance functions created successfully';
    ELSE
        RAISE EXCEPTION 'Performance functions not found';
    END IF;
END $$;

-- Check materialized view exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'org_analytics_summary') THEN
        RAISE NOTICE '✓ Materialized views created successfully';
    ELSE
        RAISE EXCEPTION 'org_analytics_summary materialized view not found';
    END IF;
END $$;

-- ============================================
-- NOTES FOR PRODUCTION DEPLOYMENT
-- ============================================

-- After applying this migration, schedule the following cron jobs:

-- 1. Create future partitions (runs monthly on the 1st)
-- SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions()');

-- 2. Drop old partitions (runs monthly on the 2nd)
-- SELECT cron.schedule('drop-old-partitions', '0 1 1 * *', 'SELECT drop_old_partitions()');

-- 3. Refresh popular queries (runs hourly)
-- SELECT cron.schedule('refresh-popular-queries', '0 * * * *', 'SELECT refresh_popular_queries()');

-- 4. Refresh org analytics (runs hourly at :05)
-- SELECT cron.schedule('refresh-org-analytics', '5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY org_analytics_summary');

-- 5. Auto-analyze hot tables (runs hourly at :10)
-- SELECT cron.schedule('auto-analyze-hot-tables', '10 * * * *', 'SELECT auto_analyze_hot_tables()');

-- 6. Cleanup expired data (runs daily at 2 AM)
-- SELECT cron.schedule('cleanup-expired', '0 2 * * *', 'SELECT delete_expired_search_history()');
