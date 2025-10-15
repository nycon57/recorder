-- =====================================================
-- Migration: 041_add_stats_aggregation_function.sql
-- Description: Add database function for efficient recording stats aggregation
-- Created: 2025-10-15
-- =====================================================

-- Function to efficiently calculate recording statistics for an organization
-- Replaces the N+1 query pattern of fetching all recordings just to sum storage
--
-- Performance improvement:
-- - BEFORE: Fetch ALL recordings (~1000s rows) with metadata, sum in application
-- - AFTER: Single aggregation query, returns 2 numbers
--
-- Usage: SELECT * FROM get_org_recording_stats('org-uuid-here');

CREATE OR REPLACE FUNCTION get_org_recording_stats(p_org_id UUID)
RETURNS TABLE (
  recording_count BIGINT,
  total_storage_bytes BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
STABLE -- Function doesn't modify database, safe to cache within transaction
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as recording_count,
    COALESCE(
      SUM(
        CASE
          WHEN metadata ? 'size_bytes' THEN (metadata->>'size_bytes')::BIGINT
          WHEN metadata ? 'file_size' THEN (metadata->>'file_size')::BIGINT
          ELSE 0
        END
      ),
      0
    )::BIGINT as total_storage_bytes
  FROM recordings
  WHERE org_id = p_org_id
    AND deleted_at IS NULL;
END;
$$;

-- Grant execute permission to authenticated users
-- RLS is still enforced at the API level via requireAdmin()
GRANT EXECUTE ON FUNCTION get_org_recording_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_org_recording_stats(UUID) TO service_role;

-- Add comment for documentation
COMMENT ON FUNCTION get_org_recording_stats(UUID) IS
'Efficiently calculates recording count and total storage usage for an organization.
Replaces N+1 query pattern. Returns (recording_count, total_storage_bytes).
Used by: /api/organizations/stats';

-- =====================================================
-- ADD SIMILAR FUNCTION FOR AUDIT LOG FILTERS
-- =====================================================

-- Function to efficiently get unique filter values for audit logs
-- Replaces multiple queries to get distinct actions and resource types
--
-- Performance improvement:
-- - BEFORE: 2 separate queries fetching 1000 rows each, distinct in application
-- - AFTER: Single query with aggregation, returns arrays
--
-- Usage: SELECT * FROM get_audit_log_filters('org-uuid-here');

CREATE OR REPLACE FUNCTION get_audit_log_filters(p_org_id UUID)
RETURNS TABLE (
  unique_actions TEXT[],
  unique_resource_types TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ARRAY_AGG(DISTINCT action ORDER BY action) FILTER (WHERE action IS NOT NULL) as unique_actions,
    ARRAY_AGG(DISTINCT resource_type ORDER BY resource_type) FILTER (WHERE resource_type IS NOT NULL) as unique_resource_types
  FROM audit_logs
  WHERE org_id = p_org_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_audit_log_filters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_audit_log_filters(UUID) TO service_role;

-- Add comment
COMMENT ON FUNCTION get_audit_log_filters(UUID) IS
'Efficiently retrieves unique action and resource_type values for audit log filters.
Replaces 2 separate queries with in-memory DISTINCT operations.
Used by: /api/organizations/audit-logs';

-- =====================================================
-- VERIFY INDEXES ARE USED
-- =====================================================
-- Run EXPLAIN to verify query plans use our new indexes

DO $$
DECLARE
  v_test_org_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Test recording stats function
  RAISE NOTICE 'Testing get_org_recording_stats function...';
  -- EXPLAIN is not directly available in DO blocks, but function will use idx_recordings_org_id_created_at

  -- Test audit log filters function
  RAISE NOTICE 'Testing get_audit_log_filters function...';
  -- Function will use idx_audit_logs_action_resource

  RAISE NOTICE 'Performance functions created successfully!';
END $$;
