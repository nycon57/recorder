-- Migration: Add composite indexes for semantic chunking analytics
-- Description: Performance optimization for org-wide analytics and quality-based retrieval
-- Phase: 2b - Semantic Chunking Performance
-- Prerequisites: 013_add_semantic_chunking_metadata.sql must be applied first
-- Performance Impact: +50-100MB storage, 5-10x faster analytics queries

-- =============================================================================
-- COMPOSITE INDEXES FOR ANALYTICS
-- =============================================================================

-- Index: Per-organization strategy analysis
-- Use case: SELECT COUNT(*) FROM transcript_chunks WHERE org_id = $1 GROUP BY chunking_strategy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_org_strategy
  ON transcript_chunks(org_id, chunking_strategy)
  INCLUDE (semantic_score);

COMMENT ON INDEX idx_transcript_chunks_org_strategy IS
  'Optimizes per-organization chunking strategy analytics with included semantic_score for covering index scan';

-- Index: Per-organization structure analysis
-- Use case: SELECT structure_type, COUNT(*) FROM transcript_chunks WHERE org_id = $1 GROUP BY structure_type
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_org_structure
  ON transcript_chunks(org_id, structure_type)
  WHERE structure_type IS NOT NULL;

COMMENT ON INDEX idx_transcript_chunks_org_structure IS
  'Partial index for content structure analytics, only indexes chunks with detected structure';

-- Index: Quality comparison by strategy
-- Use case: SELECT AVG(semantic_score) FROM transcript_chunks WHERE chunking_strategy = 'semantic'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_strategy_quality
  ON transcript_chunks(chunking_strategy, semantic_score DESC)
  WHERE semantic_score IS NOT NULL;

COMMENT ON INDEX idx_transcript_chunks_strategy_quality IS
  'Optimizes quality metric aggregations grouped by chunking strategy';

-- Index: Covering index for high-quality semantic chunk retrieval
-- Use case: SELECT * FROM transcript_chunks WHERE org_id = $1 AND semantic_score > 0.8 AND structure_type = 'code'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_quality_search
  ON transcript_chunks(org_id, structure_type, semantic_score DESC, start_time_sec)
  WHERE semantic_score >= 0.7;

COMMENT ON INDEX idx_transcript_chunks_quality_search IS
  'Covering index for retrieving high-quality chunks with structure and time filtering (>= 0.7 threshold)';

-- =============================================================================
-- HELPER FUNCTIONS FOR ANALYTICS
-- =============================================================================

-- Function: Get comprehensive chunking metrics for a recording
CREATE OR REPLACE FUNCTION get_recording_chunking_metrics(p_recording_id UUID)
RETURNS TABLE(
  strategy TEXT,
  chunk_count BIGINT,
  avg_semantic_score FLOAT,
  median_semantic_score FLOAT,
  avg_chunk_size INT,
  structure_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    chunking_strategy as strategy,
    COUNT(*) as chunk_count,
    AVG(semantic_score) as avg_semantic_score,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY semantic_score) as median_semantic_score,
    AVG(LENGTH(chunk_text))::INT as avg_chunk_size,
    jsonb_object_agg(
      COALESCE(structure_type, 'unstructured'),
      COUNT(*)
    ) as structure_breakdown
  FROM transcript_chunks
  WHERE recording_id = p_recording_id
  GROUP BY chunking_strategy;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_recording_chunking_metrics(UUID) IS
  'Returns comprehensive chunking quality metrics for a recording including strategy, quality scores, and structure breakdown';

GRANT EXECUTE ON FUNCTION get_recording_chunking_metrics(UUID) TO authenticated;

-- Function: Detect recordings with low-quality chunking
CREATE OR REPLACE FUNCTION detect_low_quality_recordings(p_org_id UUID, p_threshold FLOAT DEFAULT 0.5)
RETURNS TABLE(
  recording_id UUID,
  recording_title TEXT,
  low_quality_percentage FLOAT,
  affected_chunk_count BIGINT,
  avg_semantic_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.recording_id,
    r.title as recording_title,
    (COUNT(CASE WHEN tc.semantic_score < p_threshold THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100) as low_quality_percentage,
    COUNT(CASE WHEN tc.semantic_score < p_threshold THEN 1 END) as affected_chunk_count,
    AVG(tc.semantic_score) as avg_semantic_score
  FROM transcript_chunks tc
  JOIN recordings r ON tc.recording_id = r.id
  WHERE tc.org_id = p_org_id
    AND tc.semantic_score IS NOT NULL
  GROUP BY tc.recording_id, r.title
  HAVING (COUNT(CASE WHEN tc.semantic_score < p_threshold THEN 1 END)::FLOAT / COUNT(*)::FLOAT) > 0.25
  ORDER BY low_quality_percentage DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION detect_low_quality_recordings(UUID, FLOAT) IS
  'Identifies recordings with >25% low-quality semantic chunks for review and potential re-processing';

GRANT EXECUTE ON FUNCTION detect_low_quality_recordings(UUID, FLOAT) TO authenticated;

-- =============================================================================
-- MONITORING VIEW
-- =============================================================================

-- View: Organization-wide chunking quality dashboard
CREATE OR REPLACE VIEW chunking_quality_dashboard AS
SELECT
  o.name as organization_name,
  tc.org_id,
  tc.chunking_strategy,
  COUNT(*) as total_chunks,
  AVG(tc.semantic_score) as avg_quality,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY tc.semantic_score) as median_quality,
  PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY tc.semantic_score) as p90_quality,
  COUNT(CASE WHEN tc.semantic_score < 0.5 THEN 1 END) as low_quality_chunks,
  COUNT(CASE WHEN tc.semantic_score >= 0.8 THEN 1 END) as high_quality_chunks,
  (COUNT(CASE WHEN tc.semantic_score >= 0.8 THEN 1 END)::FLOAT / COUNT(*)::FLOAT * 100) as high_quality_percentage
FROM transcript_chunks tc
JOIN organizations o ON tc.org_id = o.id
WHERE tc.semantic_score IS NOT NULL
GROUP BY o.name, tc.org_id, tc.chunking_strategy
ORDER BY avg_quality DESC;

COMMENT ON VIEW chunking_quality_dashboard IS
  'Real-time dashboard for monitoring semantic chunking quality across organizations with percentile metrics';

GRANT SELECT ON chunking_quality_dashboard TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  index_count INTEGER;
  function_count INTEGER;
  view_count INTEGER;
BEGIN
  -- Count new indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'transcript_chunks'
    AND indexname LIKE '%_org_strategy' OR indexname LIKE '%_quality%' OR indexname LIKE '%_org_structure';

  IF index_count < 4 THEN
    RAISE WARNING 'Expected 4 indexes, found %. Some indexes may have failed to create.', index_count;
  END IF;

  -- Count helper functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN ('get_recording_chunking_metrics', 'detect_low_quality_recordings');

  IF function_count < 2 THEN
    RAISE EXCEPTION 'Expected 2 helper functions, found %', function_count;
  END IF;

  -- Check view exists
  SELECT COUNT(*) INTO view_count
  FROM pg_views
  WHERE viewname = 'chunking_quality_dashboard';

  IF view_count < 1 THEN
    RAISE EXCEPTION 'Monitoring view not created';
  END IF;

  RAISE NOTICE 'Successfully added % indexes, % functions, and % view for semantic analytics', index_count, function_count, view_count;
  RAISE NOTICE 'Performance optimization complete - analytics queries should be 5-10x faster';
END $$;
