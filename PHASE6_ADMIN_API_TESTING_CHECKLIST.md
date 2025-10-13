# Phase 6 Admin API - Testing & Deployment Checklist

## Pre-Deployment Testing

### Unit Tests

#### Authentication & Authorization (`lib/utils/api.ts`)

- [ ] `requireAdmin()` returns context for owner role
- [ ] `requireAdmin()` returns context for admin role
- [ ] `requireAdmin()` throws error for contributor role
- [ ] `requireAdmin()` throws error for reader role
- [ ] `requireAdmin()` throws error for unauthenticated users
- [ ] Error handler catches "Admin privileges required"

#### Validation Schemas (`lib/validations/api.ts`)

##### Metrics Schema
- [ ] Valid timeRange values accepted
- [ ] Invalid timeRange values rejected
- [ ] Boolean flags work correctly

##### Analytics Schema
- [ ] All timeRange options work
- [ ] All metric types accepted
- [ ] Valid UUID for orgId accepted
- [ ] Invalid UUID rejected
- [ ] All granularity options work

##### Quota Schemas
- [ ] Valid plan tiers accepted
- [ ] Numeric ranges validated
- [ ] Required fields enforced
- [ ] Optional fields work correctly

##### Alert Schemas
- [ ] Status enum validation
- [ ] Severity enum validation
- [ ] UUID validation
- [ ] Notes field optional

##### Experiment Schemas
- [ ] Variant array validation (2-5 items)
- [ ] Traffic allocation validation
- [ ] Feature enum validation
- [ ] Config object accepts any structure

### Integration Tests

#### Metrics API (`/api/admin/metrics`)

##### Authentication
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for contributor role
- [ ] Returns 403 for reader role
- [ ] Returns 200 for admin role
- [ ] Returns 200 for owner role

##### Functionality
- [ ] Returns data with valid timeRange
- [ ] Handles 1h timeRange correctly
- [ ] Handles 24h timeRange correctly
- [ ] Handles 7d timeRange correctly
- [ ] Handles 30d timeRange correctly
- [ ] Returns correct search metrics
- [ ] Returns correct cache metrics
- [ ] Returns correct job metrics
- [ ] Returns correct quota metrics
- [ ] Returns correct alert metrics
- [ ] Handles empty database gracefully
- [ ] Response time < 1 second

#### Analytics API (`/api/admin/analytics`)

##### Authentication
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user

##### Functionality
- [ ] Time bucketing by hour works
- [ ] Time bucketing by day works
- [ ] Time bucketing by week works
- [ ] Filters by orgId correctly
- [ ] Returns search metrics
- [ ] Returns latency percentiles
- [ ] Returns cache metrics
- [ ] Returns usage metrics
- [ ] Percentile calculations accurate
- [ ] Handles empty time periods
- [ ] Response time < 2 seconds

#### Quotas API (`/api/admin/quotas`)

##### GET - List Organizations
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Lists all organizations
- [ ] Filters by plan tier
- [ ] Filters by near limit status
- [ ] Calculates usage percentages correctly
- [ ] Pagination works (page, limit)
- [ ] Returns correct total count
- [ ] hasMore flag accurate

##### POST - Update Quota
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Updates single field
- [ ] Updates multiple fields
- [ ] Validates required fields
- [ ] Validates numeric ranges
- [ ] Returns updated quota
- [ ] Rejects invalid orgId

##### PUT - Reset Usage
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Resets search usage
- [ ] Resets recording usage
- [ ] Resets AI usage
- [ ] Resets all usage types
- [ ] Requires orgId
- [ ] Returns updated quota

#### Alerts API (`/api/admin/alerts`)

##### GET - List Incidents
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Lists all incidents
- [ ] Filters by status (open)
- [ ] Filters by status (acknowledged)
- [ ] Filters by status (resolved)
- [ ] Filters by severity (critical)
- [ ] Filters by severity (warning)
- [ ] Filters by severity (info)
- [ ] Joins alert rule data
- [ ] Joins user data (acknowledged_by)
- [ ] Joins user data (resolved_by)
- [ ] Returns summary statistics
- [ ] Pagination works correctly

##### POST - Acknowledge Alert
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Updates incident status
- [ ] Sets acknowledged_at timestamp
- [ ] Sets acknowledged_by to current user
- [ ] Saves notes field
- [ ] Rejects invalid incidentId
- [ ] Returns updated incident

##### PUT - Resolve Alert
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Updates incident status
- [ ] Sets resolved_at timestamp
- [ ] Sets resolved_by to current user
- [ ] Saves notes field
- [ ] Rejects invalid incidentId
- [ ] Returns updated incident

#### Experiments API (`/api/admin/experiments`)

##### GET - List Experiments
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Lists all experiments
- [ ] Filters by status
- [ ] Filters by feature
- [ ] Returns assignment counts
- [ ] Returns metrics by variant
- [ ] Calculates averages correctly
- [ ] Handles experiments with no data
- [ ] Pagination works correctly

##### POST - Create Experiment
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 201 for admin user
- [ ] Creates experiment with valid data
- [ ] Validates traffic allocation sums to 1.0
- [ ] Validates variant names match allocation keys
- [ ] Requires 2-5 variants
- [ ] Sets status to 'draft'
- [ ] Rejects duplicate experiment name
- [ ] Returns created experiment

##### PUT - Update Experiment
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Updates status
- [ ] Updates traffic allocation
- [ ] Updates description
- [ ] Sets started_at when status becomes 'running'
- [ ] Sets ended_at when status becomes 'completed'
- [ ] Validates traffic allocation if provided
- [ ] Rejects invalid experimentId

##### DELETE - Delete Experiment
- [ ] Returns 401 for unauthenticated request
- [ ] Returns 403 for non-admin user
- [ ] Returns 200 for admin user
- [ ] Deletes draft experiment
- [ ] Deletes completed experiment
- [ ] Rejects deletion of running experiment
- [ ] Cascades to assignments and metrics
- [ ] Rejects invalid experimentId

### Load Testing

#### Metrics API
- [ ] 100 concurrent requests < 2s
- [ ] 1000 requests in 1 minute succeeds
- [ ] Response time consistent under load
- [ ] No memory leaks

#### Analytics API
- [ ] 50 concurrent requests < 5s
- [ ] Handles large time ranges (90d)
- [ ] Handles high data volume
- [ ] No database connection exhaustion

#### Quotas API
- [ ] 100 concurrent list requests < 2s
- [ ] 50 concurrent update requests < 3s
- [ ] No race conditions on updates

#### Alerts API
- [ ] 100 concurrent list requests < 2s
- [ ] Handles large incident lists

#### Experiments API
- [ ] 50 concurrent list requests < 3s
- [ ] Handles experiments with many metrics

### Security Testing

#### Authentication
- [ ] Clerk token validation works
- [ ] Expired tokens rejected
- [ ] Invalid tokens rejected
- [ ] Missing tokens rejected

#### Authorization
- [ ] Admin role required for all routes
- [ ] Owner role has access
- [ ] Contributor role denied
- [ ] Reader role denied
- [ ] Other org admins can't access

#### Input Validation
- [ ] SQL injection attempts blocked
- [ ] XSS attempts sanitized
- [ ] Invalid UUIDs rejected
- [ ] Out-of-range values rejected
- [ ] Type coercion safe

#### Data Access
- [ ] Admin sees all organizations
- [ ] No data leakage between requests
- [ ] Sensitive data not logged

### Error Handling

#### Network Errors
- [ ] Handles database timeout
- [ ] Handles connection failures
- [ ] Returns appropriate error codes

#### Application Errors
- [ ] Validation errors clear
- [ ] Database errors caught
- [ ] Request IDs in responses
- [ ] No stack traces exposed

#### Edge Cases
- [ ] Empty database handled
- [ ] Missing foreign keys handled
- [ ] Null values handled
- [ ] Large payloads handled

## Deployment Checklist

### Pre-Deployment

#### Code Quality
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Prettier formatting applied
- [ ] No console.log statements (except logging)
- [ ] Comments are clear and helpful

#### Configuration
- [ ] Environment variables documented
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] Indexes created

#### Documentation
- [ ] API routes documented
- [ ] Request/response examples provided
- [ ] Error codes documented
- [ ] Quick reference guide complete

### Deployment Steps

#### 1. Database
- [ ] Backup production database
- [ ] Test migrations on staging
- [ ] Apply migrations to production
- [ ] Verify schema changes

#### 2. Application
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Check logs for errors
- [ ] Deploy to production
- [ ] Monitor deployment

#### 3. Monitoring
- [ ] Configure error tracking (Sentry)
- [ ] Set up logging (Datadog/CloudWatch)
- [ ] Create dashboard for metrics
- [ ] Configure alerts

### Post-Deployment

#### Smoke Tests
- [ ] Health check endpoint works
- [ ] Each admin route accessible
- [ ] Authentication works
- [ ] Authorization enforced

#### Monitoring
- [ ] Check error rates
- [ ] Monitor response times
- [ ] Watch database connections
- [ ] Review logs for issues

#### Performance
- [ ] Response times acceptable
- [ ] Database query performance
- [ ] Memory usage stable
- [ ] CPU usage reasonable

## Rollback Plan

### Triggers for Rollback
- Error rate > 5%
- Response time > 5s
- Database connection issues
- Authentication failures
- Authorization bypassed

### Rollback Steps
1. [ ] Revert application deployment
2. [ ] Verify rollback successful
3. [ ] Check error rates normalized
4. [ ] Investigate root cause
5. [ ] Plan fix deployment

## Performance Benchmarks

### Target Metrics
- Metrics API: < 500ms (p95)
- Analytics API: < 2s (p95)
- Quotas API: < 300ms (p95)
- Alerts API: < 200ms (p95)
- Experiments API: < 800ms (p95)

### Database Queries
- Single query < 100ms
- Joined queries < 300ms
- Aggregations < 500ms

### Error Rates
- Target: < 0.1%
- Warning: > 1%
- Critical: > 5%

## Monitoring Dashboards

### Metrics to Track
- [ ] Request count by endpoint
- [ ] Response time percentiles
- [ ] Error rate by endpoint
- [ ] Authentication failures
- [ ] Authorization denials
- [ ] Database query performance
- [ ] Cache hit rates

### Alerts to Configure
- [ ] Error rate > 1%
- [ ] Response time > 5s
- [ ] Database connections > 80%
- [ ] Memory usage > 90%

## Documentation Updates

- [ ] API documentation complete
- [ ] Quick reference guide published
- [ ] Testing guide available
- [ ] Troubleshooting guide created
- [ ] Change log updated

## Training & Communication

- [ ] Admin team trained on new APIs
- [ ] Documentation shared with team
- [ ] Support team notified
- [ ] Runbook created

## Success Criteria

✅ All unit tests passing
✅ All integration tests passing
✅ Load tests meet benchmarks
✅ Security tests passing
✅ Error handling comprehensive
✅ Documentation complete
✅ Deployed to production
✅ Monitoring configured
✅ No critical issues in 24h

## Sign-Off

**Developer**: _______________________
**QA Lead**: _______________________
**Tech Lead**: _______________________
**Date**: _______________________

---

## Notes

Use this checklist to ensure thorough testing and safe deployment of Phase 6 Admin APIs.

Track progress by checking off items as they are completed.

For any failures, document issues and create follow-up tasks before proceeding.
