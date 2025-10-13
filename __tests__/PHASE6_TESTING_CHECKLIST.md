# Phase 6 Pre-Deployment Testing Checklist

## Overview

Complete checklist for validating Phase 6 implementation before production deployment.

**Target Date**: [Insert deployment date]
**Responsible Team**: [Insert team/person]
**Environment**: Staging → Production

---

## Phase 1: Local Testing (Developer Machine)

### Unit Tests

- [ ] **Run all unit tests**
  ```bash
  yarn test
  ```
  - [ ] All tests pass (0 failures)
  - [ ] No skipped tests
  - [ ] No console errors/warnings

- [ ] **Run tests in watch mode** (during development)
  ```bash
  yarn test:watch
  ```
  - [ ] Tests auto-run on file changes
  - [ ] Quick feedback loop (<5s per test file)

- [ ] **Generate coverage report**
  ```bash
  yarn test:coverage
  ```
  - [ ] Overall coverage >80%
  - [ ] Critical paths >90% coverage
  - [ ] Review `coverage/index.html` in browser

### Coverage Verification

- [ ] **Caching System**
  - [ ] Multi-layer cache: >90% coverage
  - [ ] Memory cache operations tested
  - [ ] Redis fallback tested
  - [ ] Error handling tested

- [ ] **Analytics Services**
  - [ ] Search tracker: >85% coverage
  - [ ] Ranking ML: >85% coverage
  - [ ] Metrics aggregation tested
  - [ ] Popular queries tested

- [ ] **Quota Management**
  - [ ] Quota manager: >90% coverage
  - [ ] Rate limiter: >90% coverage
  - [ ] Concurrent operations tested
  - [ ] Month boundary resets tested

- [ ] **API Routes**
  - [ ] Search API: >85% coverage
  - [ ] Admin metrics API: >85% coverage
  - [ ] Admin quotas API: >90% coverage
  - [ ] Error responses tested

- [ ] **UI Components**
  - [ ] Admin dashboard: >80% coverage
  - [ ] Metrics chart: >80% coverage
  - [ ] Alerts list: >80% coverage
  - [ ] Loading/error states tested

### Type Checking

- [ ] **Run TypeScript compiler**
  ```bash
  yarn type:check
  ```
  - [ ] No type errors
  - [ ] No 'any' types in new code

### Linting

- [ ] **Run ESLint**
  ```bash
  yarn lint
  ```
  - [ ] No lint errors
  - [ ] No lint warnings (or documented exceptions)

- [ ] **Run Prettier**
  ```bash
  yarn format:check
  ```
  - [ ] All files formatted correctly

---

## Phase 2: Integration Testing (Local Environment)

### Database Setup

- [ ] **Apply Phase 6 migrations**
  ```bash
  supabase db push
  ```
  - [ ] Migration 027 applied successfully
  - [ ] All tables created
  - [ ] All indexes created
  - [ ] All RLS policies active

- [ ] **Verify database schema**
  - [ ] `search_analytics` table exists
  - [ ] `search_feedback` table exists
  - [ ] `experiments` table exists
  - [ ] `search_queries_mv` materialized view exists
  - [ ] `check_quota` function exists
  - [ ] `consume_quota` function exists

- [ ] **Test RLS policies**
  - [ ] Users can only see their org's data
  - [ ] Admins can see all data
  - [ ] Insert/update/delete permissions correct

### Redis Setup

- [ ] **Verify Redis connection**
  ```bash
  redis-cli ping
  ```
  - [ ] Redis responds with "PONG"
  - [ ] Redis version >=6.0

- [ ] **Test cache operations**
  - [ ] SET operation works
  - [ ] GET operation works
  - [ ] TTL expiration works
  - [ ] Pattern matching works (KEYS command)

### Service Integration

- [ ] **Multi-Layer Cache**
  - [ ] Memory cache populates
  - [ ] Redis cache populates
  - [ ] Fallback to source works
  - [ ] Invalidation works

- [ ] **Quota Manager**
  - [ ] checkQuota() returns correct values
  - [ ] consumeQuota() decrements correctly
  - [ ] Database transactions work
  - [ ] Concurrent consumption safe

- [ ] **Rate Limiter**
  - [ ] Sliding window enforced
  - [ ] Multiple identifiers tracked
  - [ ] Fail-open when Redis down

- [ ] **Search Tracker**
  - [ ] trackSearch() inserts records
  - [ ] trackFeedback() inserts records
  - [ ] getMetrics() aggregates correctly
  - [ ] Async tracking doesn't block

### API Integration

- [ ] **Search API** (`/api/search`)
  - [ ] POST returns results
  - [ ] Rate limiting enforced (429 response)
  - [ ] Quota checked and consumed
  - [ ] Cache checked and populated
  - [ ] Analytics tracked asynchronously
  - [ ] Headers include rate limit info

- [ ] **Admin Metrics API** (`/api/admin/metrics`)
  - [ ] GET requires admin role (403 for non-admin)
  - [ ] Returns system metrics
  - [ ] Time range filtering works

- [ ] **Admin Quotas API** (`/api/admin/quotas`)
  - [ ] GET lists organizations
  - [ ] POST updates quotas
  - [ ] PUT resets usage
  - [ ] Authorization enforced

### End-to-End Local Flows

- [ ] **User Search Flow**
  - [ ] User performs search
  - [ ] Results returned
  - [ ] Quota consumed
  - [ ] Analytics tracked
  - [ ] Subsequent search hits cache

- [ ] **Rate Limit Flow**
  - [ ] User makes 100+ requests quickly
  - [ ] 429 response after limit
  - [ ] Retry-After header present

- [ ] **Quota Exceeded Flow**
  - [ ] User exhausts quota
  - [ ] 402 response returned
  - [ ] Error message helpful

- [ ] **Admin Dashboard Flow**
  - [ ] Admin navigates to /admin
  - [ ] Metrics displayed
  - [ ] Charts render
  - [ ] Data accurate

---

## Phase 3: Staging Environment Testing

### Deployment to Staging

- [ ] **Deploy code to staging**
  ```bash
  git push staging main
  ```
  - [ ] Build succeeds
  - [ ] No deployment errors

- [ ] **Verify environment variables**
  - [ ] REDIS_URL set correctly
  - [ ] SUPABASE_URL set correctly
  - [ ] SUPABASE_SERVICE_ROLE_KEY set correctly
  - [ ] All Phase 6 env vars present

- [ ] **Run database migrations**
  - [ ] Migrations applied to staging DB
  - [ ] No migration errors
  - [ ] Data integrity maintained

### Smoke Tests

- [ ] **Health check**
  ```bash
  curl https://staging.app.com/api/health
  ```
  - [ ] 200 response
  - [ ] Redis status: healthy
  - [ ] Database status: healthy

- [ ] **Search endpoint**
  ```bash
  curl -X POST https://staging.app.com/api/search \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"query": "test"}'
  ```
  - [ ] 200 response
  - [ ] Results returned
  - [ ] Cache hit status present

### Performance Testing

- [ ] **Cache performance**
  - [ ] First search: >100ms latency
  - [ ] Cached search: <50ms latency
  - [ ] Cache hit rate >50% after warmup

- [ ] **Rate limit performance**
  - [ ] 100 requests complete in <10s
  - [ ] 101st request returns 429
  - [ ] No performance degradation

- [ ] **Quota check performance**
  - [ ] checkQuota() completes in <10ms
  - [ ] consumeQuota() completes in <20ms
  - [ ] No database lock contention

### Load Testing

- [ ] **Concurrent users test**
  ```bash
  # Use Apache Bench or similar
  ab -n 1000 -c 10 https://staging.app.com/api/search
  ```
  - [ ] 1000 requests complete successfully
  - [ ] Average response time <500ms
  - [ ] No 500 errors
  - [ ] Rate limiting works correctly

- [ ] **Cache stampede test**
  - [ ] 100 concurrent requests for same uncached query
  - [ ] Source function called only once
  - [ ] All requests return same result
  - [ ] No race conditions

### E2E Testing (Playwright)

- [ ] **Run Playwright tests against staging**
  ```bash
  PLAYWRIGHT_BASE_URL=https://staging.app.com yarn test:e2e
  ```
  - [ ] All E2E tests pass
  - [ ] User workflows work
  - [ ] Admin workflows work
  - [ ] No visual regressions

### Manual Testing Scenarios

- [ ] **Scenario 1: First-time user search**
  - [ ] Sign up new user
  - [ ] Perform search
  - [ ] Verify results
  - [ ] Check quota usage updated
  - [ ] Perform same search again
  - [ ] Verify cache hit

- [ ] **Scenario 2: Hit rate limit**
  - [ ] Make rapid requests
  - [ ] Verify 429 response
  - [ ] Wait retry-after period
  - [ ] Verify requests allowed again

- [ ] **Scenario 3: Exhaust quota**
  - [ ] Use test account with low quota
  - [ ] Exhaust quota via API
  - [ ] Verify 402 response
  - [ ] Admin increases quota
  - [ ] Verify user can search again

- [ ] **Scenario 4: Admin dashboard**
  - [ ] Sign in as admin
  - [ ] Navigate to /admin
  - [ ] Verify metrics display
  - [ ] Switch time ranges
  - [ ] View popular queries
  - [ ] Update organization quota
  - [ ] Verify changes applied

- [ ] **Scenario 5: Feedback and reranking**
  - [ ] Perform search
  - [ ] Provide positive feedback
  - [ ] Repeat multiple times
  - [ ] Clear cache
  - [ ] Perform search again
  - [ ] Verify highly-rated result ranked higher

### Error Scenario Testing

- [ ] **Redis failure simulation**
  - [ ] Stop Redis temporarily
  - [ ] Perform search
  - [ ] Verify request succeeds (fails open)
  - [ ] No cache, direct database query
  - [ ] Start Redis
  - [ ] Verify cache works again

- [ ] **Database slow response**
  - [ ] Simulate slow query (pg_sleep)
  - [ ] Verify request doesn't hang
  - [ ] Timeout enforced
  - [ ] Error message helpful

- [ ] **Analytics failure**
  - [ ] Break analytics table temporarily
  - [ ] Perform search
  - [ ] Verify search still works
  - [ ] Analytics error logged but not thrown

### Security Testing

- [ ] **RLS policy enforcement**
  - [ ] User A cannot see User B's data
  - [ ] Org A cannot see Org B's data
  - [ ] Direct database access blocked

- [ ] **API authentication**
  - [ ] Unauthenticated request returns 401
  - [ ] Invalid token returns 401
  - [ ] Expired token returns 401

- [ ] **Admin authorization**
  - [ ] Non-admin cannot access /api/admin/*
  - [ ] Non-admin redirected from /admin pages
  - [ ] Admin role properly checked

- [ ] **Rate limit bypass attempts**
  - [ ] Changing IP doesn't reset limit
  - [ ] Changing user agent doesn't reset limit
  - [ ] Multiple identifiers all checked

---

## Phase 4: Production Deployment

### Pre-Deployment Checklist

- [ ] **All staging tests passed**
- [ ] **Performance benchmarks met**
- [ ] **Security audit passed**
- [ ] **Database backup created**
- [ ] **Rollback plan documented**
- [ ] **On-call team notified**
- [ ] **Deploy window scheduled**

### Deployment Steps

- [ ] **1. Database migrations**
  ```bash
  # Run against production DB
  supabase db push --project-ref YOUR_PROJECT_REF
  ```
  - [ ] Migrations complete
  - [ ] No errors

- [ ] **2. Deploy application**
  ```bash
  git push production main
  ```
  - [ ] Build succeeds
  - [ ] Deploy completes
  - [ ] Health check passes

- [ ] **3. Verify environment**
  - [ ] Redis connection works
  - [ ] Database connection works
  - [ ] All env vars set

- [ ] **4. Smoke test production**
  ```bash
  curl https://app.com/api/health
  ```
  - [ ] 200 response
  - [ ] All systems healthy

### Post-Deployment Verification

- [ ] **Monitor error rates**
  - [ ] Check error tracking (Sentry/etc)
  - [ ] No spike in errors
  - [ ] Error rate <1%

- [ ] **Monitor performance**
  - [ ] Check APM dashboard
  - [ ] Response times normal
  - [ ] Cache hit rate increasing

- [ ] **Monitor database**
  - [ ] Query performance normal
  - [ ] Connection pool healthy
  - [ ] No long-running queries

- [ ] **Monitor Redis**
  - [ ] Memory usage normal
  - [ ] Hit rate increasing
  - [ ] No connection errors

- [ ] **Check logs**
  - [ ] No unexpected errors
  - [ ] Analytics tracking working
  - [ ] Rate limiting working

### User Acceptance Testing

- [ ] **Test with real users**
  - [ ] Select 5-10 beta users
  - [ ] Have them perform searches
  - [ ] Gather feedback
  - [ ] Monitor their quota usage

- [ ] **Admin testing**
  - [ ] Admin views dashboard
  - [ ] Metrics accurate
  - [ ] Quota management works
  - [ ] No issues reported

---

## Phase 5: Ongoing Monitoring (First 7 Days)

### Daily Checks

- [ ] **Day 1: Launch day**
  - [ ] Monitor error rates every hour
  - [ ] Check cache hit rates
  - [ ] Verify analytics tracking
  - [ ] Review user feedback

- [ ] **Day 2-3: Stabilization**
  - [ ] Monitor twice daily
  - [ ] Check quota consumption patterns
  - [ ] Review rate limit hits
  - [ ] Analyze slow queries

- [ ] **Day 4-7: Optimization**
  - [ ] Daily monitoring
  - [ ] Optimize cache TTLs if needed
  - [ ] Adjust rate limits if needed
  - [ ] Fine-tune quota allocations

### Metrics to Track

- [ ] **Performance Metrics**
  - [ ] Average search latency
  - [ ] P95 latency
  - [ ] P99 latency
  - [ ] Cache hit rate
  - [ ] Database query time

- [ ] **Usage Metrics**
  - [ ] Total searches per day
  - [ ] Unique users per day
  - [ ] Quota consumption rate
  - [ ] Rate limit violations
  - [ ] Popular queries

- [ ] **Error Metrics**
  - [ ] 4xx error rate
  - [ ] 5xx error rate
  - [ ] 429 (rate limit) count
  - [ ] 402 (quota exceeded) count
  - [ ] Cache errors

- [ ] **Business Metrics**
  - [ ] User retention
  - [ ] Feature adoption
  - [ ] Plan upgrades (quota related)
  - [ ] User feedback sentiment

### Alerts to Configure

- [ ] **Critical Alerts** (Page immediately)
  - [ ] Error rate >5%
  - [ ] Database connection failures
  - [ ] Redis connection failures
  - [ ] API response time >5s

- [ ] **Warning Alerts** (Slack notification)
  - [ ] Cache hit rate <30%
  - [ ] Error rate >1%
  - [ ] Slow query detected (>1s)
  - [ ] Organizations near quota limits

- [ ] **Info Alerts** (Email digest)
  - [ ] Daily usage summary
  - [ ] Popular queries report
  - [ ] Quota consumption trends

---

## Rollback Plan

### Conditions for Rollback

Rollback immediately if:
- [ ] Error rate >10%
- [ ] Database corruption detected
- [ ] Critical security issue found
- [ ] Data loss occurring
- [ ] System completely unusable

Consider rollback if:
- [ ] Error rate >5% for >1 hour
- [ ] Performance degradation >50%
- [ ] Multiple user complaints
- [ ] Cache system not working

### Rollback Steps

1. [ ] **Revert application code**
   ```bash
   git revert HEAD
   git push production main
   ```

2. [ ] **Rollback database migrations**
   ```bash
   supabase db push --file migrations/027_phase6_down.sql
   ```

3. [ ] **Clear Redis cache**
   ```bash
   redis-cli FLUSHDB
   ```

4. [ ] **Verify rollback successful**
   - [ ] Health check passes
   - [ ] Users can search
   - [ ] No errors

5. [ ] **Notify stakeholders**
   - [ ] Send incident report
   - [ ] Document issues found
   - [ ] Plan remediation

---

## Sign-Off

### Testing Sign-Off

- [ ] **QA Lead**: ___________________ Date: ___________
  - All test suites passed
  - Coverage targets met
  - No critical bugs

- [ ] **Tech Lead**: ___________________ Date: ___________
  - Code reviewed
  - Architecture sound
  - Performance acceptable

- [ ] **DevOps Lead**: ___________________ Date: ___________
  - Infrastructure ready
  - Monitoring configured
  - Alerts set up

- [ ] **Product Manager**: ___________________ Date: ___________
  - Features meet requirements
  - User experience acceptable
  - Ready for launch

### Production Deployment Approval

- [ ] **Engineering Manager**: ___________________ Date: ___________
  - Team prepared for deployment
  - On-call scheduled
  - Rollback plan reviewed

- [ ] **CTO/VP Engineering**: ___________________ Date: ___________
  - Final approval to deploy
  - Risk assessment complete
  - Go/no-go decision: **GO** ✅

---

## Notes & Issues

### Issues Found During Testing

| Issue | Severity | Status | Resolution |
|-------|----------|--------|------------|
| | | | |
| | | | |

### Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Cache hit rate | >50% | ___ | |
| P95 latency | <300ms | ___ | |
| Error rate | <1% | ___ | |
| Uptime | >99.9% | ___ | |

### Outstanding Tasks

- [ ] Task 1: ___________________________
- [ ] Task 2: ___________________________
- [ ] Task 3: ___________________________

---

**Last Updated**: [Date]
**Next Review**: [Date]
