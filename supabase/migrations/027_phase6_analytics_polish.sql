-- ============================================
-- PHASE 6: ANALYTICS & POLISH
-- Comprehensive analytics, caching, quotas, and monitoring
-- ============================================

-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Search analytics with partitioning for scale
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  mode TEXT, -- 'semantic', 'keyword', 'agentic'
  results_count INTEGER,
  latency_ms INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  cache_layer TEXT, -- 'edge', 'redis', 'memory', 'none'
  filters JSONB DEFAULT '{}'::jsonb,
  clicked_result_ids TEXT[],
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, created_at, id)
) PARTITION BY RANGE (created_at);

-- Create partitions for next 3 months
CREATE TABLE IF NOT EXISTS search_analytics_2025_01 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_02 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_03 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE IF NOT EXISTS search_analytics_2025_04 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

-- Indexes on partitioned table
CREATE INDEX IF NOT EXISTS idx_search_analytics_org ON search_analytics(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics USING gin(to_tsvector('english', query));
CREATE INDEX IF NOT EXISTS idx_search_analytics_session ON search_analytics(session_id);

-- User search feedback for ML ranking
CREATE TABLE IF NOT EXISTS search_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  result_id TEXT NOT NULL,
  result_type TEXT, -- 'recording', 'document', 'chunk'
  feedback_type TEXT NOT NULL, -- 'click', 'thumbs_up', 'thumbs_down', 'bookmark', 'skip'
  position INTEGER, -- rank position in results
  time_to_click_ms INTEGER,
  dwell_time_ms INTEGER,
  comment TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_feedback_org ON search_feedback(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_feedback_query ON search_feedback(query);
CREATE INDEX IF NOT EXISTS idx_search_feedback_result ON search_feedback(result_id);

-- Popular queries materialized view
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_popular_queries_org_query ON popular_queries(org_id, query);

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_popular_queries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_queries;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USER FEATURES TABLES
-- ============================================

-- Saved searches
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  notification_enabled BOOLEAN DEFAULT false,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_org ON saved_searches(org_id);

-- Search history (with auto-expiration)
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '90 days'
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_expires ON search_history(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-delete expired history
CREATE OR REPLACE FUNCTION delete_expired_search_history()
RETURNS void AS $$
BEGIN
  DELETE FROM search_history WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- User annotations on results
CREATE TABLE IF NOT EXISTS result_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  result_id TEXT NOT NULL,
  result_type TEXT NOT NULL,
  annotation TEXT NOT NULL,
  tags TEXT[],
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annotations_user ON result_annotations(user_id);
CREATE INDEX IF NOT EXISTS idx_annotations_result ON result_annotations(result_id);
CREATE INDEX IF NOT EXISTS idx_annotations_shared ON result_annotations(is_shared) WHERE is_shared;

-- ============================================
-- USAGE QUOTAS & RATE LIMITING
-- ============================================

-- Organization quotas
CREATE TABLE IF NOT EXISTS org_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'starter', 'professional', 'enterprise'

  -- Search quotas
  searches_per_month INTEGER NOT NULL DEFAULT 1000,
  searches_used INTEGER DEFAULT 0,

  -- Storage quotas
  storage_gb INTEGER NOT NULL DEFAULT 10,
  storage_used_gb NUMERIC(10,2) DEFAULT 0,

  -- Recording quotas
  recordings_per_month INTEGER NOT NULL DEFAULT 50,
  recordings_used INTEGER DEFAULT 0,

  -- AI quotas
  ai_requests_per_month INTEGER NOT NULL DEFAULT 500,
  ai_requests_used INTEGER DEFAULT 0,

  -- Connector quotas
  connectors_allowed INTEGER NOT NULL DEFAULT 2,
  connectors_used INTEGER DEFAULT 0,

  -- Rate limits (per second)
  api_rate_limit INTEGER NOT NULL DEFAULT 10,
  search_rate_limit INTEGER NOT NULL DEFAULT 5,

  quota_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now()) + INTERVAL '1 month',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_quotas_reset ON org_quotas(quota_reset_at);

-- Quota usage events
CREATE TABLE IF NOT EXISTS quota_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL, -- 'search', 'storage', 'recording', 'ai', 'connector'
  amount INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quota_events_org ON quota_usage_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quota_events_type ON quota_usage_events(quota_type, created_at DESC);

-- Function to check and update quota
CREATE OR REPLACE FUNCTION check_quota(
  p_org_id UUID,
  p_quota_type TEXT,
  p_amount INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  v_quota org_quotas%ROWTYPE;
  v_available INTEGER;
BEGIN
  -- Get current quota
  SELECT * INTO v_quota FROM org_quotas WHERE org_id = p_org_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quota not found for org %', p_org_id;
  END IF;

  -- Check if quota needs reset
  IF v_quota.quota_reset_at < now() THEN
    UPDATE org_quotas SET
      searches_used = 0,
      recordings_used = 0,
      ai_requests_used = 0,
      quota_reset_at = date_trunc('month', now()) + INTERVAL '1 month'
    WHERE org_id = p_org_id;

    SELECT * INTO v_quota FROM org_quotas WHERE org_id = p_org_id;
  END IF;

  -- Check available quota based on type
  CASE p_quota_type
    WHEN 'search' THEN
      v_available := v_quota.searches_per_month - v_quota.searches_used;
      IF v_available >= p_amount THEN
        UPDATE org_quotas SET searches_used = searches_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    WHEN 'recording' THEN
      v_available := v_quota.recordings_per_month - v_quota.recordings_used;
      IF v_available >= p_amount THEN
        UPDATE org_quotas SET recordings_used = recordings_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    WHEN 'ai' THEN
      v_available := v_quota.ai_requests_per_month - v_quota.ai_requests_used;
      IF v_available >= p_amount THEN
        UPDATE org_quotas SET ai_requests_used = ai_requests_used + p_amount WHERE org_id = p_org_id;
        RETURN TRUE;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown quota type: %', p_quota_type;
  END CASE;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- A/B TESTING FRAMEWORK
-- ============================================

-- Experiments
CREATE TABLE IF NOT EXISTS ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  feature TEXT NOT NULL, -- 'search_ranking', 'chunking', 'reranking'
  variants JSONB NOT NULL, -- [{"name": "control", "config": {...}}, {"name": "variant_a", "config": {...}}]
  traffic_allocation JSONB NOT NULL, -- {"control": 0.5, "variant_a": 0.5}
  status TEXT DEFAULT 'draft', -- 'draft', 'running', 'paused', 'completed'
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiments_status ON ab_experiments(status);

-- Experiment assignments
CREATE TABLE IF NOT EXISTS ab_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(experiment_id, org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_experiment ON ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org ON ab_assignments(org_id);

-- Experiment metrics
CREATE TABLE IF NOT EXISTS ab_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES ab_assignments(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- 'search_quality', 'click_through_rate', 'time_to_result'
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_experiment ON ab_metrics(experiment_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_assignment ON ab_metrics(assignment_id);

-- ============================================
-- MONITORING & ALERTING
-- ============================================

-- System metrics time-series (simplified - not using partitioning for now)
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  labels JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded ON system_metrics(recorded_at DESC);

-- Alert rules
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  metric_name TEXT NOT NULL,
  condition TEXT NOT NULL, -- 'greater_than', 'less_than', 'equals'
  threshold NUMERIC NOT NULL,
  duration_seconds INTEGER DEFAULT 300, -- Alert if condition persists for N seconds
  severity TEXT DEFAULT 'warning', -- 'info', 'warning', 'critical'
  notification_channels TEXT[], -- ['email', 'slack', 'pagerduty']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Alert incidents
CREATE TABLE IF NOT EXISTS alert_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'open', -- 'open', 'acknowledged', 'resolved'
  triggered_at TIMESTAMPTZ DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved_by UUID REFERENCES users(id),
  metric_value NUMERIC,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON alert_incidents(status, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_rule ON alert_incidents(alert_rule_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_quotas ENABLE ROW LEVEL SECURITY;

-- Analytics policies (users can only access their org's data)
DROP POLICY IF EXISTS "Users can view their org's analytics" ON search_analytics;
CREATE POLICY "Users can view their org's analytics" ON search_analytics
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's analytics" ON search_analytics;
CREATE POLICY "Users can insert their org's analytics" ON search_analytics
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Feedback policies
DROP POLICY IF EXISTS "Users can view their org's feedback" ON search_feedback;
CREATE POLICY "Users can view their org's feedback" ON search_feedback
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their org's feedback" ON search_feedback;
CREATE POLICY "Users can insert their org's feedback" ON search_feedback
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()) AND user_id = auth.uid());

-- Quota policies
DROP POLICY IF EXISTS "Users can view their org's quotas" ON org_quotas;
CREATE POLICY "Users can view their org's quotas" ON org_quotas
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Saved searches policies
DROP POLICY IF EXISTS "Users can manage their saved searches" ON saved_searches;
CREATE POLICY "Users can manage their saved searches" ON saved_searches
  FOR ALL USING (user_id = auth.uid());

-- Search history policies
DROP POLICY IF EXISTS "Users can manage their search history" ON search_history;
CREATE POLICY "Users can manage their search history" ON search_history
  FOR ALL USING (user_id = auth.uid());

-- Annotations policies
DROP POLICY IF EXISTS "Users can manage their annotations" ON result_annotations;
CREATE POLICY "Users can manage their annotations" ON result_annotations
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view shared annotations" ON result_annotations;
CREATE POLICY "Users can view shared annotations" ON result_annotations
  FOR SELECT USING (is_shared AND org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- ============================================
-- INITIALIZE DEFAULT QUOTAS
-- ============================================

-- Create default quotas for existing organizations without quotas
INSERT INTO org_quotas (org_id, plan_tier, searches_per_month, storage_gb, recordings_per_month, ai_requests_per_month, connectors_allowed)
SELECT
  id,
  'free',
  100,
  1,
  10,
  50,
  1
FROM organizations
WHERE id NOT IN (SELECT org_id FROM org_quotas)
ON CONFLICT (org_id) DO NOTHING;

-- ============================================
-- SAMPLE ALERT RULES
-- ============================================

INSERT INTO alert_rules (name, description, metric_name, condition, threshold, duration_seconds, severity, notification_channels)
VALUES
  ('High P95 Latency', 'P95 search latency exceeds 1000ms', 'search.latency.p95', 'greater_than', 1000, 300, 'warning', ARRAY['email']),
  ('Critical P95 Latency', 'P95 search latency exceeds 2000ms', 'search.latency.p95', 'greater_than', 2000, 180, 'critical', ARRAY['email', 'slack']),
  ('Low Cache Hit Rate', 'Cache hit rate below 50%', 'cache.hit_rate.overall', 'less_than', 0.5, 600, 'warning', ARRAY['email']),
  ('High Job Queue', 'Job queue exceeds 1000 pending jobs', 'jobs.pending', 'greater_than', 1000, 300, 'warning', ARRAY['slack']),
  ('Job Failures', 'Failed jobs exceed 10 per hour', 'jobs.failed', 'greater_than', 10, 3600, 'critical', ARRAY['email', 'slack'])
ON CONFLICT (name) DO NOTHING;
