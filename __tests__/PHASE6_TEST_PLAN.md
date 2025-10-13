# Phase 6 Test Plan

## Overview
Comprehensive test suite for Phase 6 analytics, caching, quotas, and admin features.

**Target Coverage**: >80% code coverage
**Test Framework**: Jest + React Testing Library + MSW
**Estimated Tests**: 150+ test cases

---

## 1. Caching System Tests

### 1.1 Multi-Layer Cache (`__tests__/lib/services/cache/multi-layer-cache.test.ts`)
**Purpose**: Verify caching hierarchy (Memory → Redis → Source)

**Test Cases**:
- ✅ `should return cached value from memory on cache hit`
- ✅ `should fallback to Redis when memory cache misses`
- ✅ `should fallback to source function when all caches miss`
- ✅ `should populate memory cache after Redis hit`
- ✅ `should populate both caches after source hit`
- ✅ `should respect TTL expiration in memory cache`
- ✅ `should handle Redis TTL expiration correctly`
- ✅ `should invalidate specific cache key`
- ✅ `should invalidate cache by pattern`
- ✅ `should track cache statistics (hits, misses, errors)`
- ✅ `should handle Redis connection errors gracefully`
- ✅ `should handle source function errors`
- ✅ `should support concurrent access without race conditions`
- ✅ `should handle cache stampede with locking`
- ✅ `should serialize/deserialize complex objects correctly`

**Mocks Required**: Redis client, source functions

**Edge Cases**:
- Redis unavailable (failover to source)
- Source function throws error
- Invalid JSON in cache
- Concurrent requests for same key

---

## 2. Analytics Tests

### 2.1 Search Tracker (`__tests__/lib/services/analytics/search-tracker.test.ts`)
**Purpose**: Verify search analytics tracking and aggregation

**Test Cases**:
- ✅ `trackSearch() should insert into search_analytics table`
- ✅ `trackSearch() should record query, latency, result_count, cache_hit`
- ✅ `trackFeedback() should insert into search_feedback table`
- ✅ `trackFeedback() should record search_id, result_id, feedback_type, rating`
- ✅ `getMetrics() should calculate P50, P95, P99 latency`
- ✅ `getMetrics() should calculate cache hit rate percentage`
- ✅ `getMetrics() should aggregate by time range (7d, 30d, 90d)`
- ✅ `getPopularQueries() should query search_queries_mv materialized view`
- ✅ `getPopularQueries() should return top queries by search count`
- ✅ `should handle missing data gracefully (empty arrays)`
- ✅ `should batch analytics writes for performance`
- ✅ `should not block search responses if analytics fails`

**Mocks Required**: Supabase client, date utilities

**Edge Cases**:
- Database insert fails (should not throw)
- Invalid search_id for feedback
- Time range with no data
- Materialized view not refreshed

---

### 2.2 Ranking ML (`__tests__/lib/services/analytics/ranking-ml.test.ts`)
**Purpose**: Verify ML-based result reranking

**Test Cases**:
- ✅ `rerank() should reorder results based on feedback scores`
- ✅ `rerank() should extract features correctly (position, similarity, freshness)`
- ✅ `rerank() should calculate weighted score from features`
- ✅ `rerank() should aggregate historical feedback by result_id`
- ✅ `rerank() should handle results with no feedback history`
- ✅ `rerank() should normalize feature vectors`
- ✅ `rerank() should apply boost for positive feedback`
- ✅ `rerank() should penalize negative feedback`
- ✅ `should handle empty results array`
- ✅ `should preserve results when feedback unavailable`

**Mocks Required**: Supabase client, feature extraction utilities

**Edge Cases**:
- No feedback data available
- All results have same score
- Feature extraction fails

---

## 3. Quota Management Tests

### 3.1 Quota Manager (`__tests__/lib/services/quotas/quota-manager.test.ts`)
**Purpose**: Verify quota checking, consumption, and reset logic

**Test Cases**:
- ✅ `checkQuota() should return available quota for API calls`
- ✅ `checkQuota() should return available quota for storage`
- ✅ `checkQuota() should return false when quota exceeded`
- ✅ `consumeQuota() should decrement API calls counter`
- ✅ `consumeQuota() should decrement storage counter`
- ✅ `consumeQuota() should fail when quota exhausted`
- ✅ `consumeQuota() should handle concurrent consumption (race conditions)`
- ✅ `initializeQuota() should set limits for starter plan`
- ✅ `initializeQuota() should set limits for pro plan`
- ✅ `initializeQuota() should set limits for enterprise plan`
- ✅ `should reset quota at month boundary`
- ✅ `should handle quota reset for multiple orgs`
- ✅ `updateStorageUsage() should calculate correct usage`
- ✅ `getUsage() should return current and limit`
- ✅ `should create usage_counters row if missing`

**Mocks Required**: Supabase client, date utilities

**Edge Cases**:
- Quota record doesn't exist (auto-create)
- Concurrent consumption race condition
- Month boundary edge cases (timezone handling)
- Negative remaining quota

---

### 3.2 Rate Limiter (`__tests__/lib/services/quotas/rate-limiter.test.ts`)
**Purpose**: Verify sliding window rate limiting

**Test Cases**:
- ✅ `checkLimit() should allow requests within limit`
- ✅ `checkLimit() should block requests exceeding limit`
- ✅ `checkLimit() should use sliding window algorithm`
- ✅ `checkLimit() should track per-user limits`
- ✅ `checkLimit() should track per-org limits`
- ✅ `checkLimit() should track per-IP limits`
- ✅ `resetLimit() should clear rate limit counters`
- ✅ `should expire old entries outside window`
- ✅ `should handle burst traffic correctly`
- ✅ `should fail open when Redis unavailable`
- ✅ `should return retry-after header value`

**Mocks Required**: Redis client, time utilities

**Edge Cases**:
- Redis connection failure (fail open)
- Clock skew
- Window boundary conditions
- Multiple identifiers (user + org)

---

## 4. A/B Testing Tests

### 4.1 A/B Test Manager (`__tests__/lib/services/experiments/ab-test-manager.test.ts`)
**Purpose**: Verify experiment assignment and metric tracking

**Test Cases**:
- ✅ `getAssignment() should assign consistent variant for user`
- ✅ `getAssignment() should respect traffic allocation percentages`
- ✅ `getAssignment() should use hash-based assignment`
- ✅ `getAssignment() should return control for inactive experiments`
- ✅ `recordMetric() should save metric value for variant`
- ✅ `getResults() should aggregate metrics by variant`
- ✅ `getResults() should calculate mean, stddev, confidence intervals`
- ✅ `should create new experiment`
- ✅ `should activate/deactivate experiment`
- ✅ `should handle invalid experiment_id`
- ✅ `should ensure traffic allocation sums to 100%`

**Mocks Required**: Supabase client, crypto utilities

**Edge Cases**:
- Experiment not found
- Invalid traffic allocation
- User already assigned to different variant

---

## 5. API Integration Tests

### 5.1 Admin Metrics API (`__tests__/app/api/admin/metrics/route.test.ts`)
**Purpose**: Verify admin metrics endpoint

**Test Cases**:
- ✅ `GET should require admin role`
- ✅ `GET should return 403 for non-admin users`
- ✅ `GET should return system metrics structure`
- ✅ `GET should aggregate search analytics`
- ✅ `GET should aggregate quota usage`
- ✅ `GET should calculate cache hit rates`
- ✅ `GET should handle time_range parameter`
- ✅ `should handle database errors gracefully`

**Mocks Required**: Clerk auth, Supabase client

**Edge Cases**:
- User not authenticated
- User not admin
- Database query fails

---

### 5.2 Admin Quotas API (`__tests__/app/api/admin/quotas/route.test.ts`)
**Purpose**: Verify quota management API

**Test Cases**:
- ✅ `GET should list all organizations with quotas`
- ✅ `GET should require admin role`
- ✅ `POST should update organization quota limits`
- ✅ `POST should validate quota structure`
- ✅ `PUT should reset usage counters`
- ✅ `PUT should preserve limits when resetting`
- ✅ `should handle invalid org_id`
- ✅ `should validate quota limits are positive`

**Mocks Required**: Clerk auth, Supabase client

**Edge Cases**:
- Organization not found
- Invalid quota values (negative, zero)
- Concurrent quota updates

---

### 5.3 Enhanced Search API (`__tests__/app/api/search/route.test.ts`)
**Purpose**: Verify search with caching, rate limiting, quotas, analytics

**Test Cases**:
- ✅ `POST should enforce rate limiting`
- ✅ `POST should return 429 when rate limited`
- ✅ `POST should consume API quota`
- ✅ `POST should return 402 when quota exceeded`
- ✅ `POST should check cache before searching`
- ✅ `POST should populate cache after search`
- ✅ `POST should track analytics asynchronously`
- ✅ `POST should not block response if analytics fails`
- ✅ `POST should include cache hit status in response`
- ✅ `POST should participate in A/B test`
- ✅ `should handle Redis cache failure gracefully`

**Mocks Required**: Clerk auth, Supabase client, Redis, OpenAI

**Edge Cases**:
- Rate limit exceeded
- Quota exceeded
- Cache unavailable
- Analytics tracking fails
- A/B test assignment fails

---

## 6. Admin Dashboard Tests

### 6.1 Admin Dashboard Page (`__tests__/app/(dashboard)/admin/page.test.tsx`)
**Purpose**: Verify admin dashboard rendering and functionality

**Test Cases**:
- ✅ `should render metric cards`
- ✅ `should display total searches count`
- ✅ `should display cache hit rate`
- ✅ `should display quota usage percentage`
- ✅ `should handle loading state`
- ✅ `should handle error state`
- ✅ `should auto-refresh metrics every 30s`
- ✅ `should allow manual refresh`
- ✅ `should redirect non-admin users`
- ✅ `should fetch data on mount`

**Mocks Required**: Next.js router, fetch, Clerk

**Edge Cases**:
- User not admin
- Fetch fails
- Empty metrics data

---

### 6.2 Metrics Chart Component (`__tests__/app/(dashboard)/admin/components/MetricsChart.test.tsx`)
**Purpose**: Verify chart rendering

**Test Cases**:
- ✅ `should render chart with data`
- ✅ `should handle empty data array`
- ✅ `should switch time ranges (7d, 30d, 90d)`
- ✅ `should display correct axis labels`
- ✅ `should format dates correctly`
- ✅ `should show tooltip on hover`

**Mocks Required**: Recharts

**Edge Cases**:
- Empty dataset
- Single data point
- Missing timestamps

---

### 6.3 Alerts List Component (`__tests__/app/(dashboard)/admin/components/AlertsList.test.tsx`)
**Purpose**: Verify alerts management

**Test Cases**:
- ✅ `should render alerts grouped by severity`
- ✅ `should display critical alerts first`
- ✅ `should acknowledge alert on button click`
- ✅ `should resolve alert on button click`
- ✅ `should filter by severity`
- ✅ `should handle empty alerts array`

**Mocks Required**: fetch

**Edge Cases**:
- No alerts
- All alerts acknowledged
- API call fails

---

## 7. Database Tests

### 7.1 Migration Test (`__tests__/supabase/migrations/027_test.ts`)
**Purpose**: Verify Phase 6 migration executed correctly

**Test Cases**:
- ✅ `should create search_analytics table`
- ✅ `should create search_feedback table`
- ✅ `should create experiments table`
- ✅ `should create experiment_assignments table`
- ✅ `should create experiment_metrics table`
- ✅ `should create search_queries_mv materialized view`
- ✅ `should create indexes on search_analytics`
- ✅ `should enable RLS on all new tables`
- ✅ `should create check_quota PostgreSQL function`
- ✅ `should create consume_quota PostgreSQL function`
- ✅ `should create partitions for search_analytics`
- ✅ `should create partitions for search_feedback`

**Mocks Required**: Direct Supabase admin client

**Edge Cases**:
- Migration already applied
- Partial migration failure

---

## 8. End-to-End Tests

### 8.1 Phase 6 Workflow (`__tests__/e2e/phase6-workflow.test.ts`)
**Purpose**: Verify complete Phase 6 user flows

**Test Cases**:
- ✅ `User performs search → quota consumed → analytics tracked`
- ✅ `User performs same search → cache hit → faster response`
- ✅ `User hits rate limit → receives 429 with retry-after`
- ✅ `User exceeds monthly quota → receives 402`
- ✅ `Admin views dashboard → sees accurate metrics`
- ✅ `Admin updates quota → user can search again`
- ✅ `Admin views popular queries → sees aggregated data`
- ✅ `Admin provides feedback → ranking improves`
- ✅ `Cache works across multiple requests`
- ✅ `A/B test assignments are consistent`

**Mocks Required**: MSW for API mocking

**Edge Cases**:
- Multiple concurrent users
- Quota reset at month boundary
- Cache invalidation propagation

---

## Test Execution Strategy

### Unit Tests (Run First)
1. Services (caching, analytics, quotas)
2. Utilities and helpers
3. Validation schemas

### Integration Tests (Run Second)
1. API routes with mocked Supabase
2. Database operations with test DB
3. React components with MSW

### E2E Tests (Run Last)
1. Complete user workflows
2. Admin workflows
3. Error recovery scenarios

### CI/CD Pipeline
```yaml
- Run unit tests (parallel)
- Run integration tests (sequential)
- Generate coverage report
- Run E2E tests (if coverage > 80%)
- Deploy if all pass
```

---

## Coverage Targets

| Component | Target Coverage |
|-----------|----------------|
| Caching System | 90% |
| Analytics Services | 85% |
| Quota Management | 90% |
| Rate Limiting | 85% |
| A/B Testing | 80% |
| API Routes | 85% |
| Admin Components | 80% |
| Overall | >80% |

---

## Test Data Fixtures

Create fixtures in `__tests__/fixtures/phase6/`:
- `cache-data.ts` - Sample cache entries
- `analytics-data.ts` - Sample search analytics
- `quota-data.ts` - Sample usage counters
- `experiment-data.ts` - Sample A/B test data
- `admin-metrics.ts` - Sample aggregated metrics

---

## Mocking Strategy

### Supabase Client
- Mock all `from()` calls with chainable `.select()`, `.insert()`, `.update()`, `.delete()`
- Return realistic data structures
- Simulate errors for error handling tests

### Redis Client
- Mock `get()`, `set()`, `del()`, `keys()` methods
- Simulate connection failures
- Track method call counts

### Clerk Auth
- Mock `auth()` to return test user/org IDs
- Mock `currentUser()` for user data
- Simulate unauthorized scenarios

### OpenAI Client
- Mock embeddings generation
- Mock chat completions
- Simulate rate limit errors

---

## Test Utilities

Create helpers in `__tests__/utils/`:
- `mock-supabase.ts` - Supabase client factory
- `mock-redis.ts` - Redis client factory
- `mock-clerk.ts` - Clerk auth helpers
- `test-data.ts` - Common test data generators
- `assertions.ts` - Custom Jest matchers

---

## Pre-Deployment Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] Coverage >80% overall
- [ ] Coverage >85% for critical paths (quotas, caching)
- [ ] No skipped or disabled tests
- [ ] All TypeScript types validated
- [ ] ESLint passes
- [ ] Performance benchmarks meet targets
- [ ] Database migrations tested
- [ ] RLS policies verified
- [ ] Error scenarios tested
- [ ] Edge cases covered
- [ ] Documentation updated

---

## Next Steps

1. Implement test files in priority order
2. Create fixtures and mocks
3. Run tests locally
4. Integrate into CI/CD
5. Review coverage reports
6. Address gaps
7. Deploy to staging
8. Run E2E tests against staging
9. Deploy to production
