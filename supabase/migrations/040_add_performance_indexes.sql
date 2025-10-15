-- =====================================================
-- Migration: 040_add_performance_indexes.sql
-- Description: Add critical performance indexes for API optimization
-- Created: 2025-10-15
-- =====================================================

-- CRITICAL PERFORMANCE INDEXES
-- These indexes address N+1 queries and slow aggregations

-- 1. Recordings: Optimize org-based queries with time-based ordering
-- Used by: /api/organizations/stats, dashboard views, recordings list
CREATE INDEX IF NOT EXISTS idx_recordings_org_id_created_at
ON recordings(org_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 2. Audit Logs: Optimize org-based queries with time-based ordering
-- Used by: /api/organizations/audit-logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id_created_at
ON audit_logs(org_id, created_at DESC);

-- 3. Audit Logs: Optimize filter aggregation queries
-- Used by: Fetching unique action/resource types for filter dropdowns
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_resource
ON audit_logs(org_id, action, resource_type)
WHERE org_id IS NOT NULL;

-- 4. User Sessions: Optimize active session queries
-- Used by: /api/organizations/stats for activity metrics
CREATE INDEX IF NOT EXISTS idx_user_sessions_org_id_expires
ON user_sessions(org_id, expires_at, last_active_at)
WHERE revoked_at IS NULL;

-- 5. Recordings: Optimize JSONB metadata queries for storage calculations
-- Used by: /api/organizations/stats for storage aggregation
-- GIN index supports JSONB operators for efficient metadata filtering
CREATE INDEX IF NOT EXISTS idx_recordings_metadata_file_size
ON recordings USING gin (metadata)
WHERE (metadata->>'file_size') IS NOT NULL
  AND deleted_at IS NULL;

-- 6. Audit Logs: Support text search on action and resource_type
-- Used by: Search functionality in audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_search
ON audit_logs USING gin (
  to_tsvector('english', coalesce(action, '') || ' ' || coalesce(resource_type, ''))
)
WHERE org_id IS NOT NULL;

-- 7. Departments: Optimize org-based queries
-- Used by: /api/organizations/stats, department management
CREATE INDEX IF NOT EXISTS idx_departments_org_id
ON departments(org_id)
WHERE deleted_at IS NULL;

-- 8. Users: Optimize role-based and status queries
-- Used by: /api/organizations/stats, user management
CREATE INDEX IF NOT EXISTS idx_users_org_status_role
ON users(org_id, status, role)
WHERE deleted_at IS NULL;

-- =====================================================
-- ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- =====================================================
-- Update statistics to help PostgreSQL choose optimal query plans

ANALYZE recordings;
ANALYZE audit_logs;
ANALYZE user_sessions;
ANALYZE departments;
ANALYZE users;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON INDEX idx_recordings_org_id_created_at IS
'Optimizes recordings queries filtered by org_id and sorted by created_at DESC. Critical for dashboard and stats APIs.';

COMMENT ON INDEX idx_audit_logs_org_id_created_at IS
'Optimizes audit log pagination queries. Prevents full table scans when fetching recent logs.';

COMMENT ON INDEX idx_audit_logs_action_resource IS
'Optimizes filter aggregation queries. Enables efficient DISTINCT queries for action and resource_type dropdowns.';

COMMENT ON INDEX idx_user_sessions_org_id_expires IS
'Optimizes active session counting. Supports efficient queries for sessions within time ranges.';

COMMENT ON INDEX idx_recordings_metadata_file_size IS
'Optimizes JSONB metadata queries for storage calculations. Supports efficient SUM aggregations on file_size.';

COMMENT ON INDEX idx_audit_logs_search IS
'Optimizes full-text search on audit logs. Supports fast ILIKE queries on action and resource_type.';

COMMENT ON INDEX idx_departments_org_id IS
'Optimizes department counting and listing queries. Simple covering index for org-filtered queries.';

COMMENT ON INDEX idx_users_org_status_role IS
'Optimizes user counting queries. Supports efficient filtering by status (active/inactive) and role.';
