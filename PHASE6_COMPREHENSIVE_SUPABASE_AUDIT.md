# Phase 6 Analytics & Polish - Comprehensive Supabase Audit Report

**Project**: clpatptmumyasbypvmun
**Audit Date**: 2025-10-13
**Migration File**: 027_phase6_analytics_polish.sql
**Status**: ⚠️ CRITICAL ISSUES FOUND - IMMEDIATE ACTION REQUIRED

---

## Executive Summary

The Phase 6 migration was **partially applied** with several critical security and configuration issues:

- ✅ **11 tables created successfully**
- ⚠️ **11 CRITICAL RLS policy violations** (tables without RLS enabled)
- ❌ **Partition date mismatch** (migration defines 2025-01 to 2025-04, but database has 2025-10 to 2026-01)
- ⚠️ **1 missing function** (`refresh_popular_queries`)
- ⚠️ **Security definer views** present without proper documentation
- ⚠️ **22 functions missing search_path security**

---

## 1. Schema Validation

### ✅ Successfully Created Tables

All 13 Phase 6 tables were created:

1. **search_analytics** (partitioned parent table) - ✅ Created
2. **search_analytics_2025_10** (partition) - ✅ Created
3. **search_analytics_2025_11** (partition) - ✅ Created
4. **search_analytics_2025_12** (partition) - ✅ Created
5. **search_analytics_2026_01** (partition) - ✅ Created
6. **search_feedback** - ✅ Created
7. **saved_searches** - ✅ Created
8. **search_history** - ✅ Created
9. **result_annotations** - ✅ Created
10. **org_quotas** - ✅ Created with 1 org initialized
11. **quota_usage_events** - ✅ Created
12. **ab_experiments** - ✅ Created
13. **ab_assignments** - ✅ Created
14. **ab_metrics** - ✅ Created
15. **system_metrics** - ✅ Created
16. **alert_rules** - ✅ Created with 5 default rules
17. **alert_incidents** - ✅ Created

### ❌ CRITICAL: Partition Date Mismatch

**Issue**: Migration file defines partitions for Jan-Apr 2025, but database has Oct 2025 - Jan 2026.

**Migration File (Lines 29-36)**:
```sql
CREATE TABLE IF NOT EXISTS search_analytics_2025_01 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_02 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_03 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_04 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
```

**Actual Database State**:
```
search_analytics_2025_10: '2025-10-01' TO '2025-11-01'
search_analytics_2025_11: '2025-11-01' TO '2025-12-01'
search_analytics_2025_12: '2025-12-01' TO '2026-01-01'
search_analytics_2026_01: '2026-01-01' TO '2026-02-01'
```

**Impact**:
- ⚠️ **Data written between Jan-Sep 2025 would fail with "no partition found" error**
- Current partitions correctly cover Oct 2025 - Jan 2026
- Migration file is out of sync with database state

**Recommendation**:
1. Update migration file to match current partition scheme
2. Create missing partitions for historical months if needed
3. Establish partition management strategy (manual vs automated)

### ✅ Foreign Key Constraints

All foreign key constraints properly established:
- `search_analytics` → `organizations(id)`, `users(id)` ✅
- `search_feedback` → `organizations(id)`, `users(id)` ✅
- `saved_searches` → `organizations(id)`, `users(id)` ✅
- `search_history` → `organizations(id)`, `users(id)` ✅
- `result_annotations` → `organizations(id)`, `users(id)` ✅
- `org_quotas` → `organizations(id)` ✅
- `quota_usage_events` → `organizations(id)` ✅
- `ab_assignments` → `ab_experiments(id)`, `organizations(id)`, `users(id)` ✅
- `ab_metrics` → `ab_experiments(id)`, `ab_assignments(id)` ✅
- `alert_incidents` → `alert_rules(id)`, `users(id)` ✅

---

## 2. RLS Policy Review - CRITICAL SECURITY ISSUES

### ⚠️ CRITICAL: 11 Tables Missing RLS Policies

**These tables are PUBLIC without RLS enabled, exposing multi-tenant data:**

1. **search_analytics_2025_10** - ❌ RLS DISABLED
2. **search_analytics_2025_11** - ❌ RLS DISABLED
3. **search_analytics_2025_12** - ❌ RLS DISABLED
4. **search_analytics_2026_01** - ❌ RLS DISABLED
5. **quota_usage_events** - ❌ RLS DISABLED
6. **ab_experiments** - ❌ RLS DISABLED
7. **ab_assignments** - ❌ RLS DISABLED
8. **ab_metrics** - ❌ RLS DISABLED
9. **system_metrics** - ❌ RLS DISABLED
10. **alert_rules** - ❌ RLS DISABLED
11. **alert_incidents** - ❌ RLS DISABLED

### Root Cause Analysis

**1. Partition Table RLS Issue**

The migration enables RLS on the parent table (`search_analytics`) at line 365:
```sql
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
```

However, **PostgreSQL partitions do NOT inherit RLS settings from parent tables**. Each partition needs RLS enabled separately.

**2. Missing RLS Configuration**

The migration file does not include RLS settings for:
- Partition tables (intentional or oversight?)
- `quota_usage_events` (backend-only table?)
- A/B testing tables (`ab_experiments`, `ab_assignments`, `ab_metrics`)
- Monitoring tables (`system_metrics`, `alert_rules`, `alert_incidents`)

### ✅ Correctly Configured RLS Policies

**search_analytics** (parent table):
- ✅ "Users can view their org's analytics" - SELECT with org_id check
- ✅ "Users can insert their org's analytics" - INSERT with org_id check

**search_feedback**:
- ✅ "Users can view their org's feedback" - SELECT with org_id check
- ✅ "Users can insert feedback" - INSERT with org_id + user_id check

**saved_searches**:
- ✅ "Users manage saved searches" - ALL with user_id check

**search_history**:
- ✅ "Users manage history" - ALL with user_id check

**result_annotations**:
- ✅ "Users manage annotations" - ALL with user_id check
- ✅ "Users view shared annotations" - SELECT with is_shared + org_id check

**org_quotas**:
- ✅ "Users can view quotas" - SELECT with org_id check

### Policy Logic Review

All existing policies use the correct pattern:
```sql
org_id IN (SELECT org_id FROM users WHERE id = auth.uid())
```

This properly enforces organization-level isolation through the users table.

---

## 3. Index Optimization

### ✅ Well-Optimized Indexes

All Phase 6 tables have comprehensive indexing:

**search_analytics** (partitioned):
- ✅ `idx_search_analytics_org` - B-tree on (org_id, created_at DESC)
- ✅ `idx_search_analytics_query` - GIN for full-text search
- ✅ `idx_search_analytics_session` - B-tree on session_id
- ✅ Partition-local indexes automatically created

**search_feedback**:
- ✅ `idx_search_feedback_org` - (org_id, created_at DESC)
- ✅ `idx_search_feedback_query` - query lookup
- ✅ `idx_search_feedback_result` - result_id lookup

**saved_searches**:
- ✅ `idx_saved_searches_user` - user_id lookup
- ✅ `idx_saved_searches_org` - org_id lookup

**search_history**:
- ✅ `idx_search_history_user` - (user_id, created_at DESC)
- ✅ `idx_search_history_expires` - Partial index for expiration cleanup

**result_annotations**:
- ✅ `idx_annotations_user` - user_id lookup
- ✅ `idx_annotations_result` - result_id lookup
- ✅ `idx_annotations_shared` - Partial index on is_shared (efficient filtering)

**org_quotas**:
- ✅ `idx_org_quotas_reset` - quota_reset_at for auto-reset logic

**quota_usage_events**:
- ✅ `idx_quota_events_org` - (org_id, created_at DESC)
- ✅ `idx_quota_events_type` - (quota_type, created_at DESC)

**ab_experiments**:
- ✅ `idx_experiments_status` - status filtering

**ab_assignments**:
- ✅ `idx_assignments_experiment` - experiment_id lookup
- ✅ `idx_assignments_org` - org_id lookup
- ✅ Unique constraint on (experiment_id, org_id, user_id)

**ab_metrics**:
- ✅ `idx_metrics_experiment` - (experiment_id, metric_name)
- ✅ `idx_metrics_assignment` - assignment_id lookup

**system_metrics**:
- ✅ `idx_system_metrics_name` - (metric_name, recorded_at DESC)
- ✅ `idx_system_metrics_recorded` - (recorded_at DESC)

**alert_rules** & **alert_incidents**:
- ✅ `idx_incidents_status` - (status, triggered_at DESC)
- ✅ `idx_incidents_rule` - alert_rule_id lookup

### Performance Observations

1. **GIN indexes** properly used for full-text search on `query` field
2. **Composite indexes** efficiently ordered (org_id + created_at DESC) for pagination
3. **Partial indexes** on conditional columns (is_shared, expires_at) reduce index size
4. **Unique constraints** prevent duplicate experiment assignments

---

## 4. Functions & Triggers

### ✅ Successfully Created Functions

**check_quota(p_org_id, p_quota_type, p_amount)**:
- ✅ Created and tested
- ✅ Handles quota reset logic
- ✅ Atomic updates with FOR UPDATE lock
- ⚠️ Missing `SET search_path = ''` (security warning)

**delete_expired_search_history()**:
- ✅ Created successfully
- ✅ Simple DELETE for expired rows
- ⚠️ Missing `SET search_path = ''` (security warning)

### ❌ MISSING: refresh_popular_queries() Function

**Status**: Function not found in database

**Expected Definition** (from migration file, lines 83-88):
```sql
CREATE OR REPLACE FUNCTION refresh_popular_queries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_queries;
END;
$$ LANGUAGE plpgsql;
```

**Impact**: Cannot refresh `popular_queries` materialized view programmatically

**Recommendation**: Run the migration again or manually create the function

### ❌ MISSING: popular_queries Materialized View

**Status**: Materialized view not found in database

**Expected Definition** (from migration, lines 65-78):
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_queries AS
SELECT
  org_id,
  query,
  COUNT(*) as query_count,
  AVG(latency_ms) as avg_latency,
  AVG(results_count) as avg_results,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
FROM search_analytics
WHERE created_at > now() - INTERVAL '30 days'
GROUP BY org_id, query
HAVING COUNT(*) > 3
ORDER BY query_count DESC;
```

**Why It Failed**:
- Materialized views require data to exist in the source table
- `search_analytics` is currently empty (0 rows)
- PostgreSQL may fail silently if the view creation encounters issues

**Recommendation**:
1. Manually create the materialized view
2. Run initial refresh once search data exists
3. Set up cron job to refresh periodically

### ⚠️ Security: Function search_path Warnings

**22 functions detected with mutable search_path**:

These functions from previous phases lack the security hardening:
```sql
SET search_path = ''
```

**Affected Functions** (sample):
- `mark_transcript_superseded`
- `multimodal_search`
- `get_frame_storage_path`
- `cleanup_orphaned_frames`
- `delete_recording_chunks`
- `hierarchical_search`
- `check_quota` ⚠️
- `delete_expired_search_history` ⚠️

**Risk**: Search path injection attacks in multi-tenant environment

**Remediation**: Add `SET search_path = ''` to all function definitions:
```sql
CREATE OR REPLACE FUNCTION check_quota(...)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- If using elevated privileges
SET search_path = ''  -- Prevent injection
AS $$
...
$$;
```

### ⚠️ Security: SECURITY DEFINER Views

**3 views with SECURITY DEFINER**:
1. `active_transcripts`
2. `frame_extraction_stats`
3. `video_frames_storage_stats`

**Risk**: Views run with creator's privileges, bypassing RLS

**Recommendation**:
- Document why SECURITY DEFINER is needed
- Audit view definitions for sensitive data exposure
- Consider converting to SECURITY INVOKER where possible

### No Triggers Found

No triggers were created on Phase 6 tables. The migration does not include trigger definitions.

---

## 5. Data Integrity

### ✅ Constraint Validation

All tables have proper constraints:

**NOT NULL Constraints**:
- All primary keys enforced ✅
- Required foreign keys enforced ✅
- Critical business fields enforced ✅

**UNIQUE Constraints**:
- `org_quotas.org_id` - One quota per org ✅
- `ab_experiments.name` - Unique experiment names ✅
- `ab_assignments(experiment_id, org_id, user_id)` - No duplicate assignments ✅
- `alert_rules.name` - Unique alert names ✅

**CHECK Constraints**:
- None defined (acceptable for these tables)

### ✅ Default Values

Appropriate defaults set:

**Timestamps**:
- `created_at` defaults to `now()` ✅
- `quota_reset_at` defaults to next month ✅

**Counters**:
- Usage counters default to 0 ✅
- `run_count`, `amount` default to appropriate values ✅

**Booleans**:
- `cache_hit` defaults to `false` ✅
- `notification_enabled` defaults to `false` ✅
- `is_active` defaults to `true` ✅

**JSON**:
- `filters`, `metadata` default to `'{}'::jsonb` ✅

### ✅ JSONB Schema Expectations

JSONB columns documented with expected schemas:

**ab_experiments.variants**:
```json
[
  {"name": "control", "config": {...}},
  {"name": "variant_a", "config": {...}}
]
```

**ab_experiments.traffic_allocation**:
```json
{"control": 0.5, "variant_a": 0.5}
```

**alert_rules.notification_channels**:
```sql
TEXT[] -- ['email', 'slack', 'pagerduty']
```

All JSONB fields have appropriate comments in migration file ✅

---

## 6. Migration Issues & Data Validation

### ✅ Quota Initialization

**Status**: Successfully initialized

**Query Results**:
```
org_id: bdca3343-182b-4325-bb67-cca2eb17a937
name: DemoCo
plan: free
quota_status: initialized
plan_tier: free
searches_used: 0
recordings_used: 0
ai_requests_used: 0
```

**However**: Migration defines different default values than what was inserted:

**Migration File (Line 419-427)**:
```sql
INSERT INTO org_quotas (...) VALUES (
  id,
  'free',
  100,      -- searches_per_month
  1,        -- storage_gb
  10,       -- recordings_per_month
  50,       -- ai_requests_per_month
  1         -- connectors_allowed
)
```

**Schema Definition (Line 164-182)**:
```sql
searches_per_month INTEGER NOT NULL DEFAULT 1000,  -- Migration uses 100
storage_gb INTEGER NOT NULL DEFAULT 10,            -- Migration uses 1
recordings_per_month INTEGER NOT NULL DEFAULT 50,  -- Migration uses 10
ai_requests_per_month INTEGER NOT NULL DEFAULT 500,-- Migration uses 50
connectors_allowed INTEGER NOT NULL DEFAULT 2,     -- Migration uses 1
```

**Recommendation**: Align migration INSERT values with schema defaults or vice versa.

### ✅ Alert Rules Initialization

**Status**: 5 default alert rules created successfully

**Created Rules**:
1. High P95 Latency (>1000ms) - Warning
2. Critical P95 Latency (>2000ms) - Critical
3. Low Cache Hit Rate (<50%) - Warning
4. High Job Queue (>1000 pending) - Warning
5. Job Failures (>10/hour) - Critical

All rules active and properly configured ✅

---

## 7. Supabase Advisor Findings

### 🔴 CRITICAL Security Issues (ERROR Level)

**11 Tables Without RLS** (detailed in Section 2):
- search_analytics partitions (4)
- quota_usage_events
- ab_experiments, ab_assignments, ab_metrics
- system_metrics, alert_rules, alert_incidents

### ⚠️ Security Warnings

**22 Functions with Mutable search_path**:
- All require `SET search_path = ''` for injection protection
- Includes new Phase 6 functions

**3 SECURITY DEFINER Views**:
- May bypass RLS policies
- Require audit and documentation

**1 Extension in Public Schema**:
- `vector` extension in public schema
- Best practice: Move to `extensions` schema
- Low priority - common pattern in Supabase

---

## Priority Action Items

### 🔴 CRITICAL (Immediate Action Required)

1. **Enable RLS on Partition Tables**
   ```sql
   ALTER TABLE search_analytics_2025_10 ENABLE ROW LEVEL SECURITY;
   ALTER TABLE search_analytics_2025_11 ENABLE ROW LEVEL SECURITY;
   ALTER TABLE search_analytics_2025_12 ENABLE ROW LEVEL SECURITY;
   ALTER TABLE search_analytics_2026_01 ENABLE ROW LEVEL SECURITY;
   ```

2. **Create RLS Policies for Partitions**
   ```sql
   -- Copy parent table policies to each partition
   CREATE POLICY "Users can view their org's analytics" ON search_analytics_2025_10
     FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

   CREATE POLICY "Users can insert their org's analytics" ON search_analytics_2025_10
     FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

   -- Repeat for other partitions...
   ```

3. **Decide RLS Strategy for System Tables**

   **Option A: Enable RLS** (recommended for multi-tenant)
   ```sql
   ALTER TABLE quota_usage_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ab_assignments ENABLE ROW LEVEL SECURITY;
   ALTER TABLE ab_metrics ENABLE ROW LEVEL SECURITY;
   ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
   ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
   ALTER TABLE alert_incidents ENABLE ROW LEVEL SECURITY;
   ```

   **Option B: Mark as Backend-Only**
   - Add comment: `COMMENT ON TABLE ... IS 'Backend-only table. RLS intentionally disabled.'`
   - Document why RLS is not needed
   - Ensure PostgREST doesn't expose these tables

### ⚠️ HIGH Priority

4. **Create Missing Materialized View**
   ```sql
   CREATE MATERIALIZED VIEW popular_queries AS
   SELECT
     org_id,
     query,
     COUNT(*) as query_count,
     AVG(latency_ms) as avg_latency,
     AVG(results_count) as avg_results,
     COUNT(DISTINCT user_id) as unique_users,
     SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as cache_hit_rate
   FROM search_analytics
   WHERE created_at > now() - INTERVAL '30 days'
   GROUP BY org_id, query
   HAVING COUNT(*) > 3
   ORDER BY query_count DESC;

   CREATE UNIQUE INDEX idx_popular_queries_org_query ON popular_queries(org_id, query);
   ```

5. **Create Missing Refresh Function**
   ```sql
   CREATE OR REPLACE FUNCTION refresh_popular_queries()
   RETURNS void
   LANGUAGE plpgsql
   SET search_path = ''
   AS $$
   BEGIN
     REFRESH MATERIALIZED VIEW CONCURRENTLY popular_queries;
   END;
   $$;
   ```

6. **Fix Partition Date Mismatch**
   - Update migration file to reflect Oct 2025 - Jan 2026 partitions
   - Document partition management strategy
   - Consider creating partitions for past months if historical data needed

### 📋 Medium Priority

7. **Add search_path Security to Functions**
   ```sql
   ALTER FUNCTION check_quota(uuid, text, integer) SET search_path = '';
   ALTER FUNCTION delete_expired_search_history() SET search_path = '';
   -- Apply to all 22 functions identified
   ```

8. **Align Quota Defaults**
   - Decide on correct default quota values
   - Update either schema defaults or migration INSERT
   - Document quota tiers

9. **Audit SECURITY DEFINER Views**
   - Review `active_transcripts`, `frame_extraction_stats`, `video_frames_storage_stats`
   - Document security implications
   - Consider converting to SECURITY INVOKER

### 📝 Low Priority

10. **Move vector Extension**
    ```sql
    -- Future enhancement
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION vector SET SCHEMA extensions;
    ```

11. **Set Up Materialized View Refresh**
    - Create cron job or pg_cron task
    - Schedule: `REFRESH MATERIALIZED VIEW CONCURRENTLY popular_queries` daily

---

## Recommendations for Future Migrations

1. **Always enable RLS on partitions**: PostgreSQL does not inherit RLS from parent
2. **Include search_path in functions**: Add `SET search_path = ''` to all functions
3. **Test materialized views**: Ensure source data exists before creating MVs
4. **Document partition strategy**: Manual vs automated partition management
5. **Review advisor warnings**: Run `get_advisors` before marking migration complete
6. **Test with empty database**: Verify migration runs cleanly on fresh instance
7. **Align defaults**: Ensure schema defaults match initial data inserts

---

## Summary

### What Worked ✅
- All 17 tables created successfully
- Foreign key relationships properly established
- Comprehensive indexing strategy
- RLS policies on 6 primary tables
- Quota initialization for existing orgs
- Alert rules seeded with defaults
- Partition scheme active (though dates mismatched)

### What Needs Fixing ❌
- **11 tables without RLS** (CRITICAL SECURITY ISSUE)
- **Missing materialized view** (popular_queries)
- **Missing refresh function** (refresh_popular_queries)
- **Partition date mismatch** in migration file
- **22 functions missing search_path** security
- **Quota default value inconsistency**

### Migration Status
**Partially Complete** - Core schema deployed but with critical security gaps.

**Recommended Next Steps**:
1. Apply RLS fixes immediately (Critical Priority #1-3)
2. Create missing materialized view and function (High Priority #4-5)
3. Schedule function security hardening (Medium Priority #7)
4. Document partition management strategy

---

**Audit Completed By**: Claude (Supabase Specialist)
**Tools Used**: Supabase MCP Server, execute_sql, list_tables, get_advisors
**Total Issues Found**: 37 (11 Critical, 3 High, 23 Medium)
