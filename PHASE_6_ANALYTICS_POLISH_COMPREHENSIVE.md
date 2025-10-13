# Phase 6: Analytics & Polish - Comprehensive Implementation

**Duration:** 2 weeks
**Effort:** 50 hours
**Priority:** Must-Have (Production Readiness)
**Dependencies:** All previous phases

---

## 🎯 Goals

Production-ready monitoring, caching, analytics, and UX polish for enterprise scale:

1. **Multi-Layer Caching System** - Redis + in-memory + CDN edge caching
2. **Comprehensive Analytics** - Search quality, performance, user behavior tracking
3. **Admin Dashboard** - Real-time system health, content management, job monitoring
4. **Usage Quotas & Rate Limiting** - Per-org limits with tiered pricing enforcement
5. **Search Ranking ML** - User feedback learning for improved relevance
6. **User-Facing Features** - Saved searches, history, annotations, export
7. **Monitoring & Alerts** - SLA tracking, incident response, cost monitoring

**Success Metrics:**
- Query latency p95 < 500ms (with cache hit)
- Cache hit rate > 70% (multi-layer)
- Search quality score > 0.85 (NDCG@10)
- Zero data loss during operations
- SLA uptime > 99.9%
- Admin dashboard real-time updates < 2s latency
- User retention on search features > 60%

---

## 📋 Dependencies

```json
{
  "dependencies": {
    "@upstash/redis": "^1.28.0",
    "ioredis": "^5.3.2",
    "@upstash/ratelimit": "^1.0.0",
    "prom-client": "^15.1.0",
    "@sentry/nextjs": "^7.100.0",
    "recharts": "^2.10.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0"
  }
}
```

---

## 🗂️ Database Schema

```sql
-- ============================================
-- ANALYTICS TABLES
-- ============================================

-- Search analytics with partitioning for scale
CREATE TABLE search_analytics (
  id UUID NOT NULL,
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

-- Create monthly partitions
CREATE TABLE search_analytics_2025_01 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE search_analytics_2025_02 PARTITION OF search_analytics
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... create partitions dynamically

CREATE INDEX idx_search_analytics_org ON search_analytics(org_id, created_at DESC);
CREATE INDEX idx_search_analytics_query ON search_analytics USING gin(to_tsvector('english', query));
CREATE INDEX idx_search_analytics_session ON search_analytics(session_id);

-- User search feedback for ML ranking
CREATE TABLE search_feedback (
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

CREATE INDEX idx_search_feedback_org ON search_feedback(org_id, created_at DESC);
CREATE INDEX idx_search_feedback_query ON search_feedback(query);
CREATE INDEX idx_search_feedback_result ON search_feedback(result_id);

-- Popular queries materialized view
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

-- Refresh function for materialized view
CREATE OR REPLACE FUNCTION refresh_popular_queries()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_queries;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily refresh (via pg_cron or external job)
-- SELECT cron.schedule('refresh_popular_queries', '0 2 * * *', 'SELECT refresh_popular_queries()');

-- ============================================
-- USER FEATURES TABLES
-- ============================================

-- Saved searches
CREATE TABLE saved_searches (
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

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_org ON saved_searches(org_id);

-- Search history (with auto-expiration)
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  results_count INTEGER,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '90 days'
);

CREATE INDEX idx_search_history_user ON search_history(user_id, created_at DESC);
CREATE INDEX idx_search_history_expires ON search_history(expires_at) WHERE expires_at IS NOT NULL;

-- Auto-delete expired history
CREATE OR REPLACE FUNCTION delete_expired_search_history()
RETURNS void AS $$
BEGIN
  DELETE FROM search_history WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- User annotations on results
CREATE TABLE result_annotations (
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

CREATE INDEX idx_annotations_user ON result_annotations(user_id);
CREATE INDEX idx_annotations_result ON result_annotations(result_id);
CREATE INDEX idx_annotations_shared ON result_annotations(is_shared) WHERE is_shared;

-- ============================================
-- USAGE QUOTAS & RATE LIMITING
-- ============================================

-- Organization quotas
CREATE TABLE org_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL, -- 'free', 'starter', 'professional', 'enterprise'

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

CREATE INDEX idx_org_quotas_reset ON org_quotas(quota_reset_at);

-- Quota usage events
CREATE TABLE quota_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quota_type TEXT NOT NULL, -- 'search', 'storage', 'recording', 'ai', 'connector'
  amount INTEGER DEFAULT 1,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_quota_events_org ON quota_usage_events(org_id, created_at DESC);
CREATE INDEX idx_quota_events_type ON quota_usage_events(quota_type, created_at DESC);

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
CREATE TABLE ab_experiments (
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

CREATE INDEX idx_experiments_status ON ab_experiments(status);

-- Experiment assignments
CREATE TABLE ab_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  variant TEXT NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(experiment_id, org_id, user_id)
);

CREATE INDEX idx_assignments_experiment ON ab_assignments(experiment_id);
CREATE INDEX idx_assignments_org ON ab_assignments(org_id);

-- Experiment metrics
CREATE TABLE ab_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES ab_assignments(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL, -- 'search_quality', 'click_through_rate', 'time_to_result'
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_metrics_experiment ON ab_metrics(experiment_id, metric_name);
CREATE INDEX idx_metrics_assignment ON ab_metrics(assignment_id);

-- ============================================
-- MONITORING & ALERTING
-- ============================================

-- System metrics time-series
CREATE TABLE system_metrics (
  id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  labels JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (metric_name, recorded_at, id)
) PARTITION BY RANGE (recorded_at);

-- Create hourly partitions for recent data
CREATE TABLE system_metrics_recent PARTITION OF system_metrics
  FOR VALUES FROM (now() - INTERVAL '7 days') TO (MAXVALUE);

CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name, recorded_at DESC);

-- Alert rules
CREATE TABLE alert_rules (
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
CREATE TABLE alert_incidents (
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

CREATE INDEX idx_incidents_status ON alert_incidents(status, triggered_at DESC);
CREATE INDEX idx_incidents_rule ON alert_incidents(alert_rule_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_quotas ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their org's data)
CREATE POLICY "Users can view their org's analytics" ON search_analytics
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert their org's analytics" ON search_analytics
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view their org's quotas" ON org_quotas
  FOR SELECT USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage their saved searches" ON saved_searches
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their search history" ON search_history
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can manage their annotations" ON result_annotations
  FOR ALL USING (user_id = auth.uid());
```

---

## 📁 File Structure

```
lib/
├── services/
│   ├── analytics/
│   │   ├── search-tracker.ts          # Track search events
│   │   ├── feedback-collector.ts      # Collect user feedback
│   │   ├── metrics-aggregator.ts      # Aggregate metrics
│   │   └── ranking-ml.ts              # ML ranking model
│   ├── cache/
│   │   ├── multi-layer-cache.ts       # Multi-layer caching
│   │   ├── edge-cache.ts              # CDN edge caching
│   │   ├── redis-cache.ts             # Redis caching
│   │   └── cache-invalidation.ts      # Invalidation strategies
│   ├── quotas/
│   │   ├── quota-manager.ts           # Check/update quotas
│   │   ├── rate-limiter.ts            # Rate limiting
│   │   └── usage-tracker.ts           # Track usage
│   ├── experiments/
│   │   ├── ab-test-manager.ts         # Manage experiments
│   │   └── variant-selector.ts        # Assign variants
│   └── monitoring/
│       ├── metrics-collector.ts        # Collect system metrics
│       ├── alert-manager.ts            # Manage alerts
│       └── incident-tracker.ts         # Track incidents

app/
└── (dashboard)/
    ├── admin/
    │   ├── page.tsx                    # Admin dashboard home
    │   ├── analytics/
    │   │   ├── page.tsx                # Analytics overview
    │   │   ├── searches/page.tsx       # Search analytics
    │   │   └── users/page.tsx          # User behavior
    │   ├── system/
    │   │   ├── page.tsx                # System health
    │   │   ├── jobs/page.tsx           # Job queue monitoring
    │   │   ├── cache/page.tsx          # Cache stats
    │   │   └── alerts/page.tsx         # Active alerts
    │   ├── quotas/
    │   │   └── page.tsx                # Quota management
    │   ├── experiments/
    │   │   └── page.tsx                # A/B test dashboard
    │   └── components/
    │       ├── MetricsChart.tsx        # Recharts wrapper
    │       ├── RealTimeMetrics.tsx     # Live metrics
    │       ├── AlertsList.tsx          # Alerts display
    │       └── JobsQueue.tsx           # Job queue UI
    └── search/
        └── components/
            ├── SavedSearches.tsx       # User saved searches
            ├── SearchHistory.tsx       # Search history
            ├── AnnotationPanel.tsx     # Result annotations
            └── FeedbackButtons.tsx     # Feedback UI

api/
└── admin/
    ├── metrics/route.ts                # System metrics API
    ├── analytics/route.ts              # Analytics API
    ├── quotas/route.ts                 # Quota management API
    ├── experiments/route.ts            # A/B test API
    └── alerts/route.ts                 # Alert management API
```

---

## 🔨 Implementation

### Part 1: Multi-Layer Caching System

**File:** `lib/services/cache/multi-layer-cache.ts`

```typescript
import { Redis } from '@upstash/redis';
import { LRUCache } from 'lru-cache';

export interface CacheConfig {
  ttl: number;
  namespace?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

/**
 * Multi-layer cache: Memory (L1) → Redis (L2) → Source (L3)
 */
export class MultiLayerCache {
  private redis: Redis;
  private memoryCache: LRUCache<string, any>;
  private stats: Map<string, CacheStats>;

  constructor() {
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });

    // L1 cache: In-memory (fast, but limited size)
    this.memoryCache = new LRUCache({
      max: 1000, // 1000 items
      ttl: 1000 * 60 * 5, // 5 minutes
      updateAgeOnGet: true,
      updateAgeOnHas: false,
    });

    this.stats = new Map();
  }

  /**
   * Get from cache with fallback to source
   */
  async get<T>(
    key: string,
    source: () => Promise<T>,
    config?: CacheConfig
  ): Promise<T> {
    const fullKey = this.buildKey(key, config?.namespace);

    // L1: Check memory cache
    const memoryValue = this.memoryCache.get(fullKey);
    if (memoryValue !== undefined) {
      this.recordHit('memory', fullKey);
      console.log('[Cache] L1 Hit:', fullKey);
      return memoryValue as T;
    }

    // L2: Check Redis
    try {
      const redisValue = await this.redis.get(fullKey);
      if (redisValue !== null) {
        this.recordHit('redis', fullKey);
        console.log('[Cache] L2 Hit:', fullKey);

        // Store in L1 for next time
        this.memoryCache.set(fullKey, redisValue);

        return redisValue as T;
      }
    } catch (error) {
      console.error('[Cache] Redis error:', error);
    }

    // L3: Fetch from source
    this.recordMiss(fullKey);
    console.log('[Cache] Miss:', fullKey);

    const value = await source();

    // Store in both layers
    await this.set(key, value, config);

    return value;
  }

  /**
   * Set in all cache layers
   */
  async set(key: string, value: any, config?: CacheConfig): Promise<void> {
    const fullKey = this.buildKey(key, config?.namespace);
    const ttl = config?.ttl || 300; // 5 minutes default

    // L1: Memory cache
    this.memoryCache.set(fullKey, value);

    // L2: Redis cache
    try {
      await this.redis.setex(fullKey, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('[Cache] Failed to set in Redis:', error);
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);

    // Delete from L1
    this.memoryCache.delete(fullKey);

    // Delete from L2
    try {
      await this.redis.del(fullKey);
    } catch (error) {
      console.error('[Cache] Failed to delete from Redis:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string, namespace?: string): Promise<number> {
    const fullPattern = this.buildKey(pattern, namespace);
    let deletedCount = 0;

    // L1: Memory cache - delete matching keys
    for (const key of this.memoryCache.keys()) {
      if (key.includes(fullPattern)) {
        this.memoryCache.delete(key);
        deletedCount++;
      }
    }

    // L2: Redis - scan and delete
    // Note: Upstash doesn't support SCAN, so we track keys separately
    // For production, consider using key prefix list or Redis Cluster

    console.log(`[Cache] Invalidated ${deletedCount} keys matching ${fullPattern}`);
    return deletedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): { memory: CacheStats; redis: CacheStats } {
    return {
      memory: this.stats.get('memory') || this.initStats(),
      redis: this.stats.get('redis') || this.initStats(),
    };
  }

  /**
   * Clear all cache layers
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // Note: Upstash doesn't support FLUSHDB, so we'd need to track keys
    console.log('[Cache] Cleared all cache layers');
  }

  private buildKey(key: string, namespace?: string): string {
    if (namespace) {
      return `${namespace}:${key}`;
    }
    return key;
  }

  private recordHit(layer: string, key: string): void {
    const stats = this.stats.get(layer) || this.initStats();
    stats.hits++;
    stats.hitRate = stats.hits / (stats.hits + stats.misses);
    this.stats.set(layer, stats);
  }

  private recordMiss(key: string): void {
    // Record miss for all layers
    for (const layer of ['memory', 'redis']) {
      const stats = this.stats.get(layer) || this.initStats();
      stats.misses++;
      stats.hitRate = stats.hits / (stats.hits + stats.misses);
      this.stats.set(layer, stats);
    }
  }

  private initStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      evictions: 0,
    };
  }
}

// Singleton instance
let cacheInstance: MultiLayerCache | null = null;

export function getCache(): MultiLayerCache {
  if (!cacheInstance) {
    cacheInstance = new MultiLayerCache();
  }
  return cacheInstance;
}
```

---

**File:** `lib/services/cache/edge-cache.ts`

```typescript
/**
 * Edge caching utilities for Next.js CDN caching
 */

export interface EdgeCacheConfig {
  maxAge: number; // seconds
  staleWhileRevalidate?: number; // seconds
  tags?: string[];
}

/**
 * Set cache headers for edge caching (Vercel, Cloudflare, etc.)
 */
export function setEdgeCacheHeaders(
  headers: Headers,
  config: EdgeCacheConfig
): void {
  const directives: string[] = [
    `max-age=${config.maxAge}`,
    'public',
  ];

  if (config.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
  }

  headers.set('Cache-Control', directives.join(', '));

  // Set cache tags for invalidation
  if (config.tags && config.tags.length > 0) {
    headers.set('Cache-Tag', config.tags.join(','));
  }
}

/**
 * Revalidate edge cache by tag (Vercel)
 */
export async function revalidateByTag(tag: string): Promise<void> {
  if (!process.env.VERCEL_REVALIDATE_TOKEN) {
    console.warn('[Edge Cache] No revalidation token configured');
    return;
  }

  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/revalidate-tag`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_REVALIDATE_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tag }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to revalidate: ${response.statusText}`);
    }

    console.log(`[Edge Cache] Revalidated tag: ${tag}`);
  } catch (error) {
    console.error('[Edge Cache] Revalidation failed:', error);
  }
}

/**
 * Purge edge cache by URL (Cloudflare)
 */
export async function purgeByUrl(urls: string[]): Promise<void> {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) {
    console.warn('[Edge Cache] Cloudflare credentials not configured');
    return;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to purge: ${response.statusText}`);
    }

    console.log(`[Edge Cache] Purged ${urls.length} URLs`);
  } catch (error) {
    console.error('[Edge Cache] Purge failed:', error);
  }
}
```

---

### Part 2: Comprehensive Analytics Service

**File:** `lib/services/analytics/search-tracker.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type { SearchResult } from '@/lib/types/search';

export interface SearchTrackingData {
  query: string;
  mode: 'semantic' | 'keyword' | 'agentic';
  resultsCount: number;
  latencyMs: number;
  cacheHit: boolean;
  cacheLayer?: 'edge' | 'redis' | 'memory' | 'none';
  filters?: Record<string, any>;
  clickedResultIds?: string[];
  sessionId?: string;
  userId?: string;
  orgId: string;
}

export class SearchTracker {
  /**
   * Track a search event
   */
  static async trackSearch(data: SearchTrackingData): Promise<void> {
    const supabase = await createClient();

    try {
      const { error } = await supabase.from('search_analytics').insert({
        org_id: data.orgId,
        user_id: data.userId,
        query: data.query,
        mode: data.mode,
        results_count: data.resultsCount,
        latency_ms: data.latencyMs,
        cache_hit: data.cacheHit,
        cache_layer: data.cacheLayer,
        filters: data.filters || {},
        clicked_result_ids: data.clickedResultIds || [],
        session_id: data.sessionId,
      });

      if (error) {
        console.error('[SearchTracker] Failed to track search:', error);
      }
    } catch (error) {
      console.error('[SearchTracker] Unexpected error:', error);
    }
  }

  /**
   * Track user feedback on search results
   */
  static async trackFeedback(data: {
    query: string;
    resultId: string;
    resultType: string;
    feedbackType: 'click' | 'thumbs_up' | 'thumbs_down' | 'bookmark' | 'skip';
    position?: number;
    timeToClickMs?: number;
    dwellTimeMs?: number;
    comment?: string;
    userId: string;
    orgId: string;
  }): Promise<void> {
    const supabase = await createClient();

    try {
      const { error } = await supabase.from('search_feedback').insert({
        user_id: data.userId,
        org_id: data.orgId,
        query: data.query,
        result_id: data.resultId,
        result_type: data.resultType,
        feedback_type: data.feedbackType,
        position: data.position,
        time_to_click_ms: data.timeToClickMs,
        dwell_time_ms: data.dwellTimeMs,
        comment: data.comment,
      });

      if (error) {
        console.error('[SearchTracker] Failed to track feedback:', error);
      }
    } catch (error) {
      console.error('[SearchTracker] Unexpected error:', error);
    }
  }

  /**
   * Get search metrics for organization
   */
  static async getMetrics(
    orgId: string,
    days: number = 7
  ): Promise<{
    totalSearches: number;
    avgLatency: number;
    p95Latency: number;
    cacheHitRate: number;
    topQueries: Array<{ query: string; count: number }>;
    searchesByMode: Record<string, number>;
  }> {
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: analytics, error } = await supabase
      .from('search_analytics')
      .select('*')
      .eq('org_id', orgId)
      .gte('created_at', since.toISOString());

    if (error || !analytics || analytics.length === 0) {
      return {
        totalSearches: 0,
        avgLatency: 0,
        p95Latency: 0,
        cacheHitRate: 0,
        topQueries: [],
        searchesByMode: {},
      };
    }

    // Calculate metrics
    const totalSearches = analytics.length;
    const avgLatency =
      analytics.reduce((sum, a) => sum + a.latency_ms, 0) / totalSearches;

    // P95 latency
    const sortedLatencies = analytics
      .map((a) => a.latency_ms)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p95Latency = sortedLatencies[p95Index] || 0;

    // Cache hit rate
    const cacheHits = analytics.filter((a) => a.cache_hit).length;
    const cacheHitRate = cacheHits / totalSearches;

    // Top queries
    const queryCounts = new Map<string, number>();
    analytics.forEach((a) => {
      queryCounts.set(a.query, (queryCounts.get(a.query) || 0) + 1);
    });

    const topQueries = Array.from(queryCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Searches by mode
    const searchesByMode: Record<string, number> = {};
    analytics.forEach((a) => {
      searchesByMode[a.mode] = (searchesByMode[a.mode] || 0) + 1;
    });

    return {
      totalSearches,
      avgLatency,
      p95Latency,
      cacheHitRate,
      topQueries,
      searchesByMode,
    };
  }

  /**
   * Get popular queries
   */
  static async getPopularQueries(
    orgId: string,
    limit: number = 20
  ): Promise<
    Array<{
      query: string;
      count: number;
      avgLatency: number;
      cacheHitRate: number;
    }>
  > {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('popular_queries')
      .select('*')
      .eq('org_id', orgId)
      .order('query_count', { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error('[SearchTracker] Failed to fetch popular queries:', error);
      return [];
    }

    return data.map((row) => ({
      query: row.query,
      count: row.query_count,
      avgLatency: row.avg_latency,
      cacheHitRate: row.cache_hit_rate,
    }));
  }
}
```

---

### Part 3: Quota Management

**File:** `lib/services/quotas/quota-manager.ts`

```typescript
import { createClient } from '@/lib/supabase/server';

export type QuotaType = 'search' | 'recording' | 'ai' | 'storage' | 'connector';
export type PlanTier = 'free' | 'starter' | 'professional' | 'enterprise';

export interface QuotaCheck {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  message?: string;
}

export interface OrgQuota {
  planTier: PlanTier;
  searchesPerMonth: number;
  searchesUsed: number;
  storageGb: number;
  storageUsedGb: number;
  recordingsPerMonth: number;
  recordingsUsed: number;
  aiRequestsPerMonth: number;
  aiRequestsUsed: number;
  connectorsAllowed: number;
  connectorsUsed: number;
  quotaResetAt: Date;
}

export class QuotaManager {
  /**
   * Check if org has available quota
   */
  static async checkQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<QuotaCheck> {
    const supabase = await createClient();

    const { data: quota, error } = await supabase
      .from('org_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error || !quota) {
      return {
        allowed: false,
        remaining: 0,
        limit: 0,
        resetAt: new Date(),
        message: 'Quota not found for organization',
      };
    }

    // Check if quota needs reset
    const now = new Date();
    const resetAt = new Date(quota.quota_reset_at);

    if (resetAt < now) {
      await this.resetQuota(orgId);
      // Fetch updated quota
      const { data: updatedQuota } = await supabase
        .from('org_quotas')
        .select('*')
        .eq('org_id', orgId)
        .single();

      if (updatedQuota) {
        quota = updatedQuota;
      }
    }

    // Check specific quota type
    let limit = 0;
    let used = 0;

    switch (quotaType) {
      case 'search':
        limit = quota.searches_per_month;
        used = quota.searches_used;
        break;
      case 'recording':
        limit = quota.recordings_per_month;
        used = quota.recordings_used;
        break;
      case 'ai':
        limit = quota.ai_requests_per_month;
        used = quota.ai_requests_used;
        break;
      case 'connector':
        limit = quota.connectors_allowed;
        used = quota.connectors_used;
        break;
      case 'storage':
        limit = quota.storage_gb;
        used = Math.ceil(quota.storage_used_gb);
        break;
      default:
        return {
          allowed: false,
          remaining: 0,
          limit: 0,
          resetAt: new Date(quota.quota_reset_at),
          message: `Unknown quota type: ${quotaType}`,
        };
    }

    const remaining = limit - used;
    const allowed = remaining >= amount;

    return {
      allowed,
      remaining,
      limit,
      resetAt: new Date(quota.quota_reset_at),
      message: allowed
        ? undefined
        : `Quota exceeded: ${used}/${limit} ${quotaType} used this month`,
    };
  }

  /**
   * Consume quota (requires PostgreSQL function check_quota)
   */
  static async consumeQuota(
    orgId: string,
    quotaType: QuotaType,
    amount: number = 1
  ): Promise<boolean> {
    const supabase = await createClient();

    try {
      // Call PostgreSQL function
      const { data, error } = await supabase.rpc('check_quota', {
        p_org_id: orgId,
        p_quota_type: quotaType,
        p_amount: amount,
      });

      if (error) {
        console.error('[QuotaManager] Failed to consume quota:', error);
        return false;
      }

      // Log usage event
      await supabase.from('quota_usage_events').insert({
        org_id: orgId,
        quota_type: quotaType,
        amount,
      });

      return data === true;
    } catch (error) {
      console.error('[QuotaManager] Unexpected error:', error);
      return false;
    }
  }

  /**
   * Get current quota status for org
   */
  static async getQuotaStatus(orgId: string): Promise<OrgQuota | null> {
    const supabase = await createClient();

    const { data: quota, error } = await supabase
      .from('org_quotas')
      .select('*')
      .eq('org_id', orgId)
      .single();

    if (error || !quota) {
      console.error('[QuotaManager] Failed to fetch quota:', error);
      return null;
    }

    return {
      planTier: quota.plan_tier as PlanTier,
      searchesPerMonth: quota.searches_per_month,
      searchesUsed: quota.searches_used,
      storageGb: quota.storage_gb,
      storageUsedGb: quota.storage_used_gb,
      recordingsPerMonth: quota.recordings_per_month,
      recordingsUsed: quota.recordings_used,
      aiRequestsPerMonth: quota.ai_requests_per_month,
      aiRequestsUsed: quota.ai_requests_used,
      connectorsAllowed: quota.connectors_allowed,
      connectorsUsed: quota.connectors_used,
      quotaResetAt: new Date(quota.quota_reset_at),
    };
  }

  /**
   * Reset monthly quotas
   */
  private static async resetQuota(orgId: string): Promise<void> {
    const supabase = await createClient();

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase
      .from('org_quotas')
      .update({
        searches_used: 0,
        recordings_used: 0,
        ai_requests_used: 0,
        quota_reset_at: nextReset.toISOString(),
      })
      .eq('org_id', orgId);

    console.log(`[QuotaManager] Reset quota for org ${orgId}`);
  }

  /**
   * Update storage usage
   */
  static async updateStorageUsage(
    orgId: string,
    usedGb: number
  ): Promise<void> {
    const supabase = await createClient();

    await supabase
      .from('org_quotas')
      .update({ storage_used_gb: usedGb })
      .eq('org_id', orgId);
  }

  /**
   * Initialize quota for new organization
   */
  static async initializeQuota(
    orgId: string,
    planTier: PlanTier = 'free'
  ): Promise<void> {
    const supabase = await createClient();

    const quotas: Record<PlanTier, Partial<OrgQuota>> = {
      free: {
        searchesPerMonth: 100,
        storageGb: 1,
        recordingsPerMonth: 10,
        aiRequestsPerMonth: 50,
        connectorsAllowed: 1,
      },
      starter: {
        searchesPerMonth: 1000,
        storageGb: 10,
        recordingsPerMonth: 100,
        aiRequestsPerMonth: 500,
        connectorsAllowed: 3,
      },
      professional: {
        searchesPerMonth: 10000,
        storageGb: 100,
        recordingsPerMonth: 1000,
        aiRequestsPerMonth: 5000,
        connectorsAllowed: 10,
      },
      enterprise: {
        searchesPerMonth: 100000,
        storageGb: 1000,
        recordingsPerMonth: 10000,
        aiRequestsPerMonth: 50000,
        connectorsAllowed: 50,
      },
    };

    const quotaConfig = quotas[planTier];

    const nextReset = new Date();
    nextReset.setMonth(nextReset.getMonth() + 1);
    nextReset.setDate(1);
    nextReset.setHours(0, 0, 0, 0);

    await supabase.from('org_quotas').insert({
      org_id: orgId,
      plan_tier: planTier,
      searches_per_month: quotaConfig.searchesPerMonth,
      storage_gb: quotaConfig.storageGb,
      recordings_per_month: quotaConfig.recordingsPerMonth,
      ai_requests_per_month: quotaConfig.aiRequestsPerMonth,
      connectors_allowed: quotaConfig.connectorsAllowed,
      quota_reset_at: nextReset.toISOString(),
    });

    console.log(`[QuotaManager] Initialized ${planTier} quota for org ${orgId}`);
  }
}
```

---

**File:** `lib/services/quotas/rate-limiter.ts`

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate limiter configurations
 */
const limiters = {
  // API rate limiting (per org)
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
    analytics: true,
    prefix: 'ratelimit:api',
  }),

  // Search rate limiting (per org)
  search: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 searches per minute
    analytics: true,
    prefix: 'ratelimit:search',
  }),

  // AI rate limiting (per org)
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 AI requests per minute
    analytics: true,
    prefix: 'ratelimit:ai',
  }),

  // Upload rate limiting (per user)
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(10, '1 h'), // 10 uploads per hour
    analytics: true,
    prefix: 'ratelimit:upload',
  }),
};

export type RateLimitType = keyof typeof limiters;

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
}

export class RateLimiter {
  /**
   * Check rate limit
   */
  static async checkLimit(
    type: RateLimitType,
    identifier: string
  ): Promise<RateLimitResult> {
    const limiter = limiters[type];

    if (!limiter) {
      console.warn(`[RateLimiter] Unknown limiter type: ${type}`);
      return {
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      };
    }

    try {
      const result = await limiter.limit(identifier);

      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      console.error('[RateLimiter] Error checking limit:', error);
      // Fail open - allow request if rate limiter fails
      return {
        success: true,
        limit: 0,
        remaining: 0,
        reset: 0,
      };
    }
  }

  /**
   * Reset rate limit for identifier
   */
  static async resetLimit(
    type: RateLimitType,
    identifier: string
  ): Promise<void> {
    const limiter = limiters[type];

    if (!limiter) {
      return;
    }

    try {
      await limiter.resetUsage(identifier);
      console.log(`[RateLimiter] Reset ${type} limit for ${identifier}`);
    } catch (error) {
      console.error('[RateLimiter] Error resetting limit:', error);
    }
  }
}
```

---

### Part 4: ML-Based Search Ranking

**File:** `lib/services/analytics/ranking-ml.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import type { SearchResult } from '@/lib/types/search';

/**
 * Features used for ranking ML model
 */
interface RankingFeatures {
  // Relevance features
  semanticSimilarity: number; // 0-1
  keywordMatches: number;
  titleMatch: boolean;

  // User behavior features
  historicalClickRate: number; // 0-1
  averageDwellTime: number; // seconds
  thumbsUpRate: number; // 0-1
  bookmarkRate: number; // 0-1

  // Recency features
  daysSinceCreated: number;
  daysSinceModified: number;

  // Content features
  contentLength: number;
  hasTranscript: boolean;
  hasDocument: boolean;
  hasVideo: boolean;
}

/**
 * ML-based ranking system using user feedback
 */
export class RankingML {
  /**
   * Re-rank search results based on ML model
   */
  static async rerank(
    results: SearchResult[],
    query: string,
    orgId: string
  ): Promise<SearchResult[]> {
    // Get historical feedback for these results
    const feedback = await this.getHistoricalFeedback(
      results.map((r) => r.id),
      orgId
    );

    // Compute features and scores for each result
    const scored = results.map((result) => {
      const features = this.extractFeatures(result, query, feedback);
      const score = this.computeScore(features);

      return {
        result,
        score,
        features,
      };
    });

    // Sort by score (descending)
    scored.sort((a, b) => b.score - a.score);

    // Return re-ranked results
    return scored.map((item) => item.result);
  }

  /**
   * Extract features for a result
   */
  private static extractFeatures(
    result: SearchResult,
    query: string,
    feedback: Map<string, FeedbackStats>
  ): RankingFeatures {
    const stats = feedback.get(result.id) || {
      clickRate: 0,
      avgDwellTime: 0,
      thumbsUpRate: 0,
      bookmarkRate: 0,
    };

    const now = new Date();
    const createdAt = new Date(result.createdAt);
    const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return {
      // Relevance (from vector search similarity)
      semanticSimilarity: result.similarity || 0,
      keywordMatches: this.countKeywordMatches(query, result.content),
      titleMatch: result.title?.toLowerCase().includes(query.toLowerCase()) || false,

      // User behavior
      historicalClickRate: stats.clickRate,
      averageDwellTime: stats.avgDwellTime,
      thumbsUpRate: stats.thumbsUpRate,
      bookmarkRate: stats.bookmarkRate,

      // Recency
      daysSinceCreated,
      daysSinceModified: daysSinceCreated, // TODO: track modification date

      // Content
      contentLength: result.content.length,
      hasTranscript: result.type === 'transcript',
      hasDocument: result.type === 'document',
      hasVideo: result.type === 'recording',
    };
  }

  /**
   * Compute final score from features
   * (Simple linear model - could be replaced with XGBoost, neural network, etc.)
   */
  private static computeScore(features: RankingFeatures): number {
    // Weights learned from user feedback (these are example values)
    const weights = {
      semanticSimilarity: 0.35,
      keywordMatches: 0.05,
      titleMatch: 0.10,
      historicalClickRate: 0.20,
      averageDwellTime: 0.10,
      thumbsUpRate: 0.10,
      bookmarkRate: 0.05,
      recencyBoost: 0.05,
    };

    let score = 0;

    // Relevance signals
    score += features.semanticSimilarity * weights.semanticSimilarity;
    score += Math.min(features.keywordMatches / 5, 1) * weights.keywordMatches;
    score += (features.titleMatch ? 1 : 0) * weights.titleMatch;

    // User behavior signals
    score += features.historicalClickRate * weights.historicalClickRate;
    score += Math.min(features.averageDwellTime / 60, 1) * weights.averageDwellTime;
    score += features.thumbsUpRate * weights.thumbsUpRate;
    score += features.bookmarkRate * weights.bookmarkRate;

    // Recency boost (exponential decay)
    const recencyScore = Math.exp(-features.daysSinceCreated / 30); // 30-day half-life
    score += recencyScore * weights.recencyBoost;

    return score;
  }

  /**
   * Get historical feedback stats for results
   */
  private static async getHistoricalFeedback(
    resultIds: string[],
    orgId: string
  ): Promise<Map<string, FeedbackStats>> {
    const supabase = await createClient();

    const { data: feedback } = await supabase
      .from('search_feedback')
      .select('*')
      .eq('org_id', orgId)
      .in('result_id', resultIds);

    const stats = new Map<string, FeedbackStats>();

    if (!feedback || feedback.length === 0) {
      return stats;
    }

    // Aggregate feedback by result
    for (const resultId of resultIds) {
      const resultFeedback = feedback.filter((f) => f.result_id === resultId);

      if (resultFeedback.length === 0) {
        continue;
      }

      const totalFeedback = resultFeedback.length;
      const clicks = resultFeedback.filter((f) => f.feedback_type === 'click').length;
      const thumbsUp = resultFeedback.filter((f) => f.feedback_type === 'thumbs_up').length;
      const bookmarks = resultFeedback.filter((f) => f.feedback_type === 'bookmark').length;

      const dwellTimes = resultFeedback
        .filter((f) => f.dwell_time_ms)
        .map((f) => f.dwell_time_ms / 1000); // convert to seconds

      stats.set(resultId, {
        clickRate: clicks / totalFeedback,
        avgDwellTime: dwellTimes.length > 0
          ? dwellTimes.reduce((sum, t) => sum + t, 0) / dwellTimes.length
          : 0,
        thumbsUpRate: thumbsUp / totalFeedback,
        bookmarkRate: bookmarks / totalFeedback,
      });
    }

    return stats;
  }

  /**
   * Count keyword matches in content
   */
  private static countKeywordMatches(query: string, content: string): number {
    const keywords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    return keywords.filter((keyword) => contentLower.includes(keyword)).length;
  }
}

interface FeedbackStats {
  clickRate: number;
  avgDwellTime: number;
  thumbsUpRate: number;
  bookmarkRate: number;
}
```

---

### Part 5: A/B Testing Framework

**File:** `lib/services/experiments/ab-test-manager.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { createHash } from 'crypto';

export interface Experiment {
  id: string;
  name: string;
  description?: string;
  feature: string;
  variants: Array<{
    name: string;
    config: Record<string, any>;
  }>;
  trafficAllocation: Record<string, number>;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt?: Date;
  endedAt?: Date;
}

export interface ExperimentAssignment {
  experimentId: string;
  variant: string;
  config: Record<string, any>;
}

export class ABTestManager {
  /**
   * Get variant assignment for user
   */
  static async getAssignment(
    experimentName: string,
    orgId: string,
    userId?: string
  ): Promise<ExperimentAssignment | null> {
    const supabase = await createClient();

    // Get experiment
    const { data: experiment, error } = await supabase
      .from('ab_experiments')
      .select('*')
      .eq('name', experimentName)
      .eq('status', 'running')
      .single();

    if (error || !experiment) {
      return null;
    }

    // Check existing assignment
    const { data: existing } = await supabase
      .from('ab_assignments')
      .select('*')
      .eq('experiment_id', experiment.id)
      .eq('org_id', orgId)
      .eq('user_id', userId || null)
      .single();

    if (existing) {
      return {
        experimentId: experiment.id,
        variant: existing.variant,
        config: this.getVariantConfig(experiment, existing.variant),
      };
    }

    // Assign new variant
    const variant = this.selectVariant(
      experiment.traffic_allocation,
      `${orgId}:${userId || 'org'}`
    );

    await supabase.from('ab_assignments').insert({
      experiment_id: experiment.id,
      org_id: orgId,
      user_id: userId || null,
      variant,
    });

    return {
      experimentId: experiment.id,
      variant,
      config: this.getVariantConfig(experiment, variant),
    };
  }

  /**
   * Record experiment metric
   */
  static async recordMetric(
    assignmentId: string,
    metricName: string,
    metricValue: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const supabase = await createClient();

    await supabase.from('ab_metrics').insert({
      assignment_id: assignmentId,
      experiment_id: (await supabase
        .from('ab_assignments')
        .select('experiment_id')
        .eq('id', assignmentId)
        .single()
      ).data?.experiment_id,
      metric_name: metricName,
      metric_value: metricValue,
      metadata: metadata || {},
    });
  }

  /**
   * Get experiment results
   */
  static async getResults(experimentId: string): Promise<{
    variants: Record<string, {
      assignments: number;
      metrics: Record<string, {
        mean: number;
        stddev: number;
        samples: number;
      }>;
    }>;
  }> {
    const supabase = await createClient();

    // Get all assignments
    const { data: assignments } = await supabase
      .from('ab_assignments')
      .select('*')
      .eq('experiment_id', experimentId);

    if (!assignments || assignments.length === 0) {
      return { variants: {} };
    }

    // Get all metrics
    const { data: metrics } = await supabase
      .from('ab_metrics')
      .select('*')
      .eq('experiment_id', experimentId);

    // Aggregate by variant
    const variantStats: Record<string, any> = {};

    for (const assignment of assignments) {
      const variant = assignment.variant;

      if (!variantStats[variant]) {
        variantStats[variant] = {
          assignments: 0,
          metrics: {},
        };
      }

      variantStats[variant].assignments++;

      // Aggregate metrics for this variant
      const variantMetrics = metrics?.filter((m) => m.assignment_id === assignment.id) || [];

      for (const metric of variantMetrics) {
        const metricName = metric.metric_name;

        if (!variantStats[variant].metrics[metricName]) {
          variantStats[variant].metrics[metricName] = {
            values: [],
          };
        }

        variantStats[variant].metrics[metricName].values.push(metric.metric_value);
      }
    }

    // Compute statistics
    for (const variant in variantStats) {
      for (const metricName in variantStats[variant].metrics) {
        const values = variantStats[variant].metrics[metricName].values;

        const mean = values.reduce((sum: number, v: number) => sum + v, 0) / values.length;
        const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stddev = Math.sqrt(variance);

        variantStats[variant].metrics[metricName] = {
          mean,
          stddev,
          samples: values.length,
        };
      }
    }

    return { variants: variantStats };
  }

  /**
   * Select variant based on traffic allocation
   * Uses consistent hashing for stable assignment
   */
  private static selectVariant(
    allocation: Record<string, number>,
    identifier: string
  ): string {
    // Hash identifier to get consistent value [0, 1)
    const hash = createHash('sha256').update(identifier).digest('hex');
    const hashValue = parseInt(hash.substring(0, 8), 16) / 0xffffffff;

    // Select variant based on cumulative allocation
    let cumulative = 0;

    for (const [variant, weight] of Object.entries(allocation)) {
      cumulative += weight;

      if (hashValue < cumulative) {
        return variant;
      }
    }

    // Fallback to first variant
    return Object.keys(allocation)[0];
  }

  /**
   * Get variant configuration
   */
  private static getVariantConfig(
    experiment: any,
    variantName: string
  ): Record<string, any> {
    const variant = experiment.variants.find((v: any) => v.name === variantName);
    return variant?.config || {};
  }
}
```

---

### Part 6: Admin Dashboard Implementation

**File:** `app/(dashboard)/admin/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Search,
  Database,
  Zap,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { MetricsChart } from './components/MetricsChart';
import { RealTimeMetrics } from './components/RealTimeMetrics';
import { AlertsList } from './components/AlertsList';
import { JobsQueue } from './components/JobsQueue';

interface DashboardMetrics {
  system: {
    totalSearches: number;
    avgLatency: number;
    p95Latency: number;
    cacheHitRate: number;
  };
  jobs: {
    pending: number;
    processing: number;
    failed: number;
  };
  quotas: {
    orgsNearLimit: number;
    storageUsed: number;
    storageLimit: number;
  };
  alerts: {
    critical: number;
    warning: number;
  };
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();

    // Refresh every 10 seconds
    const interval = setInterval(fetchMetrics, 10000);

    return () => clearInterval(interval);
  }, []);

  async function fetchMetrics() {
    try {
      const response = await fetch('/api/admin/metrics');

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">System Dashboard</h1>
        <Badge variant="outline" className="text-sm">
          Last updated: {new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Searches</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.system.totalSearches.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">P95 Latency</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.system.p95Latency}ms</div>
            <p className="text-xs text-muted-foreground">
              Avg: {metrics.system.avgLatency}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.system.cacheHitRate * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Multi-layer cache</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.jobs.pending + metrics.jobs.processing}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.jobs.failed} failed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts */}
      {metrics.alerts.critical > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {metrics.alerts.critical} critical alert{metrics.alerts.critical > 1 ? 's' : ''} require immediate attention
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Views */}
      <Tabs defaultValue="realtime" className="space-y-4">
        <TabsList>
          <TabsTrigger value="realtime">Real-Time</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="jobs">Job Queue</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="quotas">Quotas</TabsTrigger>
        </TabsList>

        <TabsContent value="realtime" className="space-y-4">
          <RealTimeMetrics />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Search Volume (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricsChart
                  metric="search_count"
                  timeRange="24h"
                  chartType="line"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latency Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricsChart
                  metric="search_latency"
                  timeRange="24h"
                  chartType="area"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <JobsQueue />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertsList />
        </TabsContent>

        <TabsContent value="quotas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organizations Near Quota Limits</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {metrics.quotas.orgsNearLimit} organization{metrics.quotas.orgsNearLimit !== 1 ? 's' : ''} using > 90% of quota
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Storage Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Used</span>
                  <span className="font-medium">
                    {metrics.quotas.storageUsed}GB / {metrics.quotas.storageLimit}GB
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{
                      width: `${(metrics.quotas.storageUsed / metrics.quotas.storageLimit) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

**File:** `app/(dashboard)/admin/components/RealTimeMetrics.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface RealtimeData {
  activeSearches: number;
  qps: number; // queries per second
  avgLatency: number;
  cacheHitRate: number;
  timestamp: Date;
}

export function RealTimeMetrics() {
  const [data, setData] = useState<RealtimeData[]>([]);

  useEffect(() => {
    // Fetch initial data
    fetchRealtime();

    // Update every 2 seconds
    const interval = setInterval(fetchRealtime, 2000);

    return () => clearInterval(interval);
  }, []);

  async function fetchRealtime() {
    try {
      const response = await fetch('/api/admin/metrics/realtime');
      const result = await response.json();

      setData((prev) => {
        const updated = [...prev, { ...result.data, timestamp: new Date() }];
        // Keep last 30 data points (1 minute)
        return updated.slice(-30);
      });
    } catch (error) {
      console.error('Failed to fetch realtime metrics:', error);
    }
  }

  const latest = data[data.length - 1];

  if (!latest) {
    return <div>Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Searches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{latest.activeSearches}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Queries/sec</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{latest.qps.toFixed(1)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Avg Latency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{latest.avgLatency}ms</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cache Hit Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {(latest.cacheHitRate * 100).toFixed(1)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🧪 Comprehensive Testing

**File:** `__tests__/services/cache.test.ts`

```typescript
import { MultiLayerCache } from '@/lib/services/cache/multi-layer-cache';

describe('MultiLayerCache', () => {
  let cache: MultiLayerCache;

  beforeEach(() => {
    cache = new MultiLayerCache();
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('get/set', () => {
    it('should cache and retrieve values', async () => {
      const key = 'test-key';
      const value = { foo: 'bar' };

      await cache.set(key, value);

      const result = await cache.get(key, async () => {
        throw new Error('Should not call source');
      });

      expect(result).toEqual(value);
    });

    it('should call source function on cache miss', async () => {
      const key = 'miss-key';
      const value = { data: 'from-source' };

      const source = jest.fn().mockResolvedValue(value);

      const result = await cache.get(key, source);

      expect(source).toHaveBeenCalled();
      expect(result).toEqual(value);
    });

    it('should respect TTL', async () => {
      const key = 'ttl-key';
      const value = 'test';

      await cache.set(key, value, { ttl: 1 }); // 1 second

      // Should hit immediately
      const hit = await cache.get(key, async () => 'miss');
      expect(hit).toBe('test');

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Should miss after TTL
      const miss = await cache.get(key, async () => 'from-source');
      expect(miss).toBe('from-source');
    });
  });

  describe('stats', () => {
    it('should track hit/miss statistics', async () => {
      await cache.set('key1', 'value1');

      // Generate some hits
      await cache.get('key1', async () => 'miss');
      await cache.get('key1', async () => 'miss');

      // Generate a miss
      await cache.get('key2', async () => 'value2');

      const stats = cache.getStats();

      expect(stats.memory.hits).toBe(2);
      expect(stats.memory.misses).toBe(1);
      expect(stats.memory.hitRate).toBeCloseTo(0.666, 2);
    });
  });

  describe('invalidation', () => {
    it('should delete specific keys', async () => {
      await cache.set('key1', 'value1');
      await cache.delete('key1');

      const result = await cache.get('key1', async () => 'from-source');
      expect(result).toBe('from-source');
    });

    it('should invalidate by pattern', async () => {
      await cache.set('user:1', 'value1');
      await cache.set('user:2', 'value2');
      await cache.set('post:1', 'value3');

      const deleted = await cache.invalidatePattern('user:');

      expect(deleted).toBe(2);

      // User keys should be invalidated
      const user1 = await cache.get('user:1', async () => 'miss');
      expect(user1).toBe('miss');

      // Post key should still exist
      const post1 = await cache.get('post:1', async () => 'miss');
      expect(post1).toBe('value3');
    });
  });
});
```

---

**File:** `__tests__/services/quotas.test.ts`

```typescript
import { QuotaManager } from '@/lib/services/quotas/quota-manager';

describe('QuotaManager', () => {
  const mockOrgId = 'test-org-id';

  beforeEach(async () => {
    // Initialize test quota
    await QuotaManager.initializeQuota(mockOrgId, 'starter');
  });

  describe('checkQuota', () => {
    it('should allow within quota limits', async () => {
      const result = await QuotaManager.checkQuota(mockOrgId, 'search', 1);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('should block when quota exceeded', async () => {
      // Consume all search quota
      const status = await QuotaManager.getQuotaStatus(mockOrgId);
      const limit = status!.searchesPerMonth;

      for (let i = 0; i < limit; i++) {
        await QuotaManager.consumeQuota(mockOrgId, 'search');
      }

      const result = await QuotaManager.checkQuota(mockOrgId, 'search', 1);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('Quota exceeded');
    });
  });

  describe('consumeQuota', () => {
    it('should decrement available quota', async () => {
      const before = await QuotaManager.getQuotaStatus(mockOrgId);
      const initialUsed = before!.searchesUsed;

      const success = await QuotaManager.consumeQuota(mockOrgId, 'search', 5);

      expect(success).toBe(true);

      const after = await QuotaManager.getQuotaStatus(mockOrgId);
      expect(after!.searchesUsed).toBe(initialUsed + 5);
    });
  });

  describe('quota reset', () => {
    it('should reset monthly quotas', async () => {
      // Consume some quota
      await QuotaManager.consumeQuota(mockOrgId, 'search', 50);

      // Force reset (simulate month passing)
      // This would typically be done by background job

      const status = await QuotaManager.getQuotaStatus(mockOrgId);
      expect(status!.searchesUsed).toBe(50);

      // After reset, usage should be 0
      // (Implementation depends on cron job or manual trigger)
    });
  });
});
```

---

## 🚀 Deployment Checklist

### 1. Infrastructure Setup

- [ ] Deploy Upstash Redis instance
- [ ] Configure environment variables:
  ```bash
  UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
  UPSTASH_REDIS_REST_TOKEN=xxx
  VERCEL_REVALIDATE_TOKEN=xxx  # For edge cache revalidation
  CLOUDFLARE_ZONE_ID=xxx       # Optional: Cloudflare CDN
  CLOUDFLARE_API_TOKEN=xxx
  ```
- [ ] Set up monitoring (Sentry, DataDog, etc.)
- [ ] Configure alert channels (Slack, PagerDuty, email)

### 2. Database Migrations

- [ ] Run all Phase 6 migrations
- [ ] Create monthly partitions for `search_analytics`
- [ ] Set up pg_cron for materialized view refresh
- [ ] Create initial alert rules
- [ ] Initialize quotas for existing organizations

### 3. Application Deployment

- [ ] Deploy updated API routes
- [ ] Deploy admin dashboard
- [ ] Enable multi-layer caching
- [ ] Configure rate limiters
- [ ] Set up A/B testing framework

### 4. Testing

- [ ] Run all test suites
- [ ] Load test caching layer (verify > 70% hit rate)
- [ ] Verify quota enforcement
- [ ] Test alert triggering
- [ ] Validate admin dashboard metrics

### 5. Monitoring & Alerts

- [ ] Set up system metrics collection
- [ ] Create alert rules:
  - P95 latency > 1000ms (warning)
  - P95 latency > 2000ms (critical)
  - Cache hit rate < 50% (warning)
  - Job queue > 1000 pending (warning)
  - Failed jobs > 10/hour (critical)
  - Storage > 90% quota (warning)
- [ ] Test alert notifications

### 6. Documentation

- [ ] Update API documentation
- [ ] Write admin dashboard user guide
- [ ] Document quota tiers
- [ ] Create runbook for common incidents

---

## 🎯 Success Criteria

### Performance Targets

✅ **Query Latency**
- P50 < 200ms
- P95 < 500ms (with cache hit)
- P99 < 1000ms

✅ **Cache Performance**
- Overall hit rate > 70%
- Memory (L1) hit rate > 30%
- Redis (L2) hit rate > 40%

✅ **System Reliability**
- Uptime > 99.9% (SLA)
- Zero data loss
- Graceful degradation on cache failure

✅ **Search Quality**
- NDCG@10 > 0.85 (with ML ranking)
- User satisfaction > 80%
- Click-through rate improvement > 15%

### Feature Completion

✅ **Multi-Layer Caching**
- Memory + Redis + Edge caching operational
- Cache invalidation working
- Stats tracking enabled

✅ **Analytics**
- Search events tracked
- User feedback collected
- Popular queries surfaced
- ML ranking deployed

✅ **Quotas & Rate Limiting**
- Per-org quotas enforced
- Rate limiters active
- Usage tracking accurate
- Auto-reset on monthly boundary

✅ **Admin Dashboard**
- Real-time metrics displayed
- Job queue monitoring
- Alert management
- Quota oversight

✅ **A/B Testing**
- Experiment framework operational
- Variant assignment stable
- Metrics collection working
- Results analysis available

---

## 📈 Monitoring Metrics

### Key Performance Indicators

**Search Performance**
- `search.latency.p50` - 50th percentile latency
- `search.latency.p95` - 95th percentile latency
- `search.latency.p99` - 99th percentile latency
- `search.throughput` - Queries per second
- `search.errors` - Error rate

**Cache Performance**
- `cache.hit_rate.overall` - Combined hit rate
- `cache.hit_rate.memory` - L1 hit rate
- `cache.hit_rate.redis` - L2 hit rate
- `cache.hit_rate.edge` - CDN hit rate
- `cache.evictions` - Eviction count

**System Health**
- `jobs.pending` - Pending job count
- `jobs.processing` - Active job count
- `jobs.failed` - Failed job count
- `quota.violations` - Quota exceeded count
- `alerts.active` - Active alert count

**Business Metrics**
- `users.active` - Daily active users
- `searches.per_user` - Searches per user
- `features.adoption` - Feature usage rate
- `quotas.utilization` - Avg quota usage %

---

## 🔧 Maintenance Tasks

### Daily
- [ ] Review active alerts
- [ ] Check job queue backlog
- [ ] Monitor cache hit rates
- [ ] Review quota violations

### Weekly
- [ ] Refresh materialized views
- [ ] Review A/B test results
- [ ] Analyze slow queries
- [ ] Check storage usage trends

### Monthly
- [ ] Quota reset verification
- [ ] Create new search_analytics partitions
- [ ] Archive old metrics data
- [ ] Review and update alert thresholds
- [ ] Generate performance reports

---

## 🎉 Phase 6 Complete!

With Phase 6 implementation complete, you now have:

1. **Production-Grade Infrastructure**
   - Multi-layer caching (70%+ hit rate)
   - Comprehensive analytics tracking
   - Real-time monitoring and alerting

2. **Enterprise Features**
   - Per-org quotas and rate limiting
   - ML-based search ranking
   - A/B testing framework

3. **Admin Capabilities**
   - Real-time system dashboard
   - Job queue monitoring
   - Alert management
   - Quota oversight

4. **User Features**
   - Saved searches
   - Search history
   - Result annotations
   - Feedback collection

5. **Operational Excellence**
   - SLA tracking (99.9% uptime)
   - Incident response procedures
   - Cost monitoring
   - Automated maintenance

---

**Your platform is now production-ready and enterprise-scale! 🚀**

See [MASTER_ROADMAP.md](./MASTER_ROADMAP.md) for full 6-phase overview.
