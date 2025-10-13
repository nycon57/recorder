-- ============================================
-- PHASE 6: COMPREHENSIVE SECURITY FIXES
-- Consolidated migration addressing all security vulnerabilities
-- ============================================

-- ============================================
-- 1. ADD SYSTEM ADMIN AUTHORIZATION
-- ============================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_system_admin
ON users(clerk_id) WHERE is_system_admin = TRUE;

COMMENT ON COLUMN users.is_system_admin IS
  'SECURITY: System-wide admin flag for admin dashboard access';

-- ============================================
-- 2. ENABLE RLS ON PARTITION TABLES
-- PostgreSQL partitions DO NOT inherit RLS from parent
-- ============================================

-- Enable RLS on October-January partitions
ALTER TABLE search_analytics_2025_10 ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics_2025_11 ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics_2025_12 ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics_2026_01 ENABLE ROW LEVEL SECURITY;

-- Create policies for 2025_10
DROP POLICY IF EXISTS "Users can view their org's analytics" ON search_analytics_2025_10;
CREATE POLICY "Users can view their org's analytics" ON search_analytics_2025_10
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's analytics" ON search_analytics_2025_10;
CREATE POLICY "Users can insert their org's analytics" ON search_analytics_2025_10
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Create policies for 2025_11
DROP POLICY IF EXISTS "Users can view their org's analytics" ON search_analytics_2025_11;
CREATE POLICY "Users can view their org's analytics" ON search_analytics_2025_11
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's analytics" ON search_analytics_2025_11;
CREATE POLICY "Users can insert their org's analytics" ON search_analytics_2025_11
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Create policies for 2025_12
DROP POLICY IF EXISTS "Users can view their org's analytics" ON search_analytics_2025_12;
CREATE POLICY "Users can view their org's analytics" ON search_analytics_2025_12
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's analytics" ON search_analytics_2025_12;
CREATE POLICY "Users can insert their org's analytics" ON search_analytics_2025_12
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Create policies for 2026_01
DROP POLICY IF EXISTS "Users can view their org's analytics" ON search_analytics_2026_01;
CREATE POLICY "Users can view their org's analytics" ON search_analytics_2026_01
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's analytics" ON search_analytics_2026_01;
CREATE POLICY "Users can insert their org's analytics" ON search_analytics_2026_01
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================
-- 3. ENABLE RLS ON BACKEND-ONLY TABLES
-- ============================================

-- Quota usage events
ALTER TABLE quota_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage quota events" ON quota_usage_events;
CREATE POLICY "Service role can manage quota events" ON quota_usage_events
  FOR ALL USING (true);

-- A/B Testing tables
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages experiments" ON ab_experiments;
CREATE POLICY "Service role manages experiments" ON ab_experiments
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role manages assignments" ON ab_assignments;
CREATE POLICY "Service role manages assignments" ON ab_assignments
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role manages metrics" ON ab_metrics;
CREATE POLICY "Service role manages metrics" ON ab_metrics
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view their assignment" ON ab_assignments;
CREATE POLICY "Users can view their assignment" ON ab_assignments
  FOR SELECT USING (
    user_id = auth.uid() OR
    (user_id IS NULL AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid()))
  );

-- System metrics and alerting
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages system metrics" ON system_metrics;
CREATE POLICY "Service role manages system metrics" ON system_metrics
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role manages alert rules" ON alert_rules;
CREATE POLICY "Service role manages alert rules" ON alert_rules
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Service role manages alert incidents" ON alert_incidents;
CREATE POLICY "Service role manages alert incidents" ON alert_incidents
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Admins can view incidents" ON alert_incidents;
CREATE POLICY "Admins can view incidents" ON alert_incidents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- 4. CREATE MISSING MATERIALIZED VIEW
-- ============================================

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_queries_org_query
  ON popular_queries(org_id, query);

-- ============================================
-- 5. CREATE ATOMIC QUOTA CHECK FUNCTION
-- Prevents race conditions with FOR UPDATE SKIP LOCKED
-- ============================================

DROP FUNCTION IF EXISTS check_quota_optimized;

CREATE OR REPLACE FUNCTION check_quota_optimized(
    p_org_id UUID,
    p_quota_type TEXT,
    p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_quota RECORD;
    v_allowed BOOLEAN := FALSE;
    v_current_usage INTEGER;
    v_limit INTEGER;
BEGIN
    -- SECURITY: Use FOR UPDATE SKIP LOCKED to prevent race conditions
    SELECT * INTO v_quota
    FROM public.org_quotas
    WHERE org_id = p_org_id
    FOR UPDATE SKIP LOCKED;

    -- If no quota found or locked, deny access (fail-closed)
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Check if quota needs reset
    IF v_quota.quota_reset_at < NOW() THEN
        UPDATE public.org_quotas
        SET
            searches_used = 0,
            recordings_used = 0,
            ai_requests_used = 0,
            quota_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month')
        WHERE org_id = p_org_id;

        -- Refetch after reset
        SELECT * INTO v_quota
        FROM public.org_quotas
        WHERE org_id = p_org_id;
    END IF;

    -- Check and consume quota based on type
    CASE p_quota_type
        WHEN 'search' THEN
            v_current_usage := v_quota.searches_used;
            v_limit := v_quota.searches_per_month;

            IF (v_current_usage + p_amount) <= v_limit THEN
                UPDATE public.org_quotas
                SET searches_used = searches_used + p_amount
                WHERE org_id = p_org_id;
                v_allowed := TRUE;
            END IF;

        WHEN 'recording' THEN
            v_current_usage := v_quota.recordings_used;
            v_limit := v_quota.recordings_per_month;

            IF (v_current_usage + p_amount) <= v_limit THEN
                UPDATE public.org_quotas
                SET recordings_used = recordings_used + p_amount
                WHERE org_id = p_org_id;
                v_allowed := TRUE;
            END IF;

        WHEN 'ai' THEN
            v_current_usage := v_quota.ai_requests_used;
            v_limit := v_quota.ai_requests_per_month;

            IF (v_current_usage + p_amount) <= v_limit THEN
                UPDATE public.org_quotas
                SET ai_requests_used = ai_requests_used + p_amount
                WHERE org_id = p_org_id;
                v_allowed := TRUE;
            END IF;

        WHEN 'connector' THEN
            v_current_usage := v_quota.connectors_used;
            v_limit := v_quota.connectors_allowed;

            IF (v_current_usage + p_amount) <= v_limit THEN
                UPDATE public.org_quotas
                SET connectors_used = connectors_used + p_amount
                WHERE org_id = p_org_id;
                v_allowed := TRUE;
            END IF;

        WHEN 'storage' THEN
            v_current_usage := CEIL(v_quota.storage_used_gb);
            v_limit := v_quota.storage_gb;
            v_allowed := (v_current_usage + p_amount) <= v_limit;

        ELSE
            v_allowed := FALSE;
    END CASE;

    RETURN v_allowed;
END;
$$;

COMMENT ON FUNCTION check_quota_optimized IS
  'SECURITY: Atomic quota check and consume to prevent race conditions. Uses SKIP LOCKED for fail-fast behavior.';

-- ============================================
-- 6. ADD SECURITY FUNCTIONS
-- ============================================

-- UUID validation for SQL injection prevention
CREATE OR REPLACE FUNCTION is_valid_uuid(input_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    PERFORM input_text::UUID;
    RETURN TRUE;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN FALSE;
END;
$$;

-- Refresh function with search_path security
CREATE OR REPLACE FUNCTION refresh_popular_queries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.popular_queries;
END;
$$;

-- Cleanup function with search_path security
CREATE OR REPLACE FUNCTION delete_expired_search_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.search_history WHERE expires_at < now();
END;
$$;

-- Update check_quota with search_path security
CREATE OR REPLACE FUNCTION check_quota(
  p_org_id UUID,
  p_quota_type TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_quota public.org_quotas%ROWTYPE;
  v_available INTEGER;
BEGIN
  SELECT * INTO v_quota FROM public.org_quotas WHERE org_id = p_org_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota not found for org %', p_org_id;
  END IF;

  IF v_quota.quota_reset_at < now() THEN
    UPDATE public.org_quotas SET
      searches_used = 0,
      recordings_used = 0,
      ai_requests_used = 0,
      quota_reset_at = date_trunc('month', now()) + INTERVAL '1 month'
    WHERE org_id = p_org_id;

    SELECT * INTO v_quota FROM public.org_quotas WHERE org_id = p_org_id;
  END IF;

  CASE p_quota_type
    WHEN 'search' THEN
      v_available := v_quota.searches_per_month - v_quota.searches_used;
      IF v_available >= p_amount THEN
        UPDATE public.org_quotas SET searches_used = searches_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    WHEN 'recording' THEN
      v_available := v_quota.recordings_per_month - v_quota.recordings_used;
      IF v_available >= p_amount THEN
        UPDATE public.org_quotas SET recordings_used = recordings_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    WHEN 'ai' THEN
      v_available := v_quota.ai_requests_per_month - v_quota.ai_requests_used;
      IF v_available >= p_amount THEN
        UPDATE public.org_quotas SET ai_requests_used = ai_requests_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown quota type: %', p_quota_type;
  END CASE;

  RETURN FALSE;
END;
$$;

-- ============================================
-- 7. CREATE SECURITY AUDIT LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    severity TEXT DEFAULT 'info',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT security_audit_log_event_type_check
        CHECK (event_type IN ('unauthorized_access', 'rate_limit_exceeded', 'quota_exceeded',
                              'invalid_input', 'system_admin_access', 'suspicious_activity')),
    CONSTRAINT security_audit_log_severity_check
        CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user
  ON security_audit_log(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_org
  ON security_audit_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_severity
  ON security_audit_log(severity, created_at DESC)
  WHERE severity IN ('error', 'critical');

-- Enable RLS
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

-- System admins can view all audit logs
DROP POLICY IF EXISTS "System admins can view all audit logs" ON security_audit_log;
CREATE POLICY "System admins can view all audit logs"
ON security_audit_log FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE clerk_id = auth.jwt() ->> 'sub'
        AND is_system_admin = TRUE
    )
);

-- ============================================
-- 8. ADD DATA INTEGRITY CONSTRAINTS
-- ============================================

ALTER TABLE org_quotas
ADD CONSTRAINT IF NOT EXISTS check_positive_limits CHECK (
    searches_per_month >= 0 AND
    storage_gb >= 0 AND
    recordings_per_month >= 0 AND
    ai_requests_per_month >= 0 AND
    connectors_allowed >= 0
);

ALTER TABLE org_quotas
ADD CONSTRAINT IF NOT EXISTS check_usage_not_negative CHECK (
    searches_used >= 0 AND
    storage_used_gb >= 0 AND
    recordings_used >= 0 AND
    ai_requests_used >= 0 AND
    connectors_used >= 0
);

-- ============================================
-- 9. UPDATE QUOTA DEFAULTS
-- ============================================

UPDATE org_quotas SET
  searches_per_month = 1000,
  storage_gb = 10,
  recordings_per_month = 50,
  ai_requests_per_month = 500,
  connectors_allowed = 2
WHERE plan_tier = 'free';

-- ============================================
-- 10. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION check_quota_optimized TO authenticated;
GRANT EXECUTE ON FUNCTION check_quota TO authenticated;
GRANT EXECUTE ON FUNCTION is_valid_uuid TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_popular_queries TO service_role;
GRANT EXECUTE ON FUNCTION delete_expired_search_history TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  missing_rls TEXT[];
BEGIN
  SELECT array_agg(tablename)
  INTO missing_rls
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'search_analytics', 'search_analytics_2025_10', 'search_analytics_2025_11',
      'search_analytics_2025_12', 'search_analytics_2026_01',
      'search_feedback', 'saved_searches', 'search_history', 'result_annotations',
      'org_quotas', 'quota_usage_events', 'ab_experiments', 'ab_assignments',
      'ab_metrics', 'system_metrics', 'alert_rules', 'alert_incidents', 'security_audit_log'
    )
    AND tablename NOT IN (
      SELECT tablename FROM pg_tables t
      JOIN pg_class c ON c.relname = t.tablename
      WHERE c.relrowsecurity = true
    );

  IF array_length(missing_rls, 1) > 0 THEN
    RAISE WARNING 'Tables without RLS: %', missing_rls;
  ELSE
    RAISE NOTICE '✓ All Phase 6 tables have RLS enabled';
  END IF;
END $$;

-- Verify functions created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_quota_optimized') AND
       EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_valid_uuid') THEN
        RAISE NOTICE '✓ Security functions created successfully';
    ELSE
        RAISE EXCEPTION 'Security functions not found';
    END IF;
END $$;
