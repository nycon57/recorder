# Phase 6 Deployment Quick Start Guide

**Last Updated:** October 13, 2025  
**Estimated Deployment Time:** 30-45 minutes

---

## Prerequisites Checklist

- [ ] Supabase project configured and accessible
- [ ] Upstash Redis instance created
- [ ] Production environment variables ready
- [ ] Git repository up to date with Phase 6 code
- [ ] Staging environment available for testing

---

## Step 1: Database Setup (10-15 minutes)

**Option A: Automated Script (Recommended)**

```bash
# Set your Supabase database connection string
export DATABASE_URL="postgresql://..."

# Run the automated migration script
./scripts/apply-phase6-migrations.sh
```

The script will:
- Verify prerequisites
- Apply all Phase 6 migrations in correct order
- Run verification checks
- Display next steps

**Option B: Manual Application**

```bash
# Connect to your Supabase database
export DATABASE_URL="postgresql://..."

# Apply Phase 6 migrations in order
psql $DATABASE_URL -f supabase/migrations/027_phase6_analytics_polish.sql
psql $DATABASE_URL -f supabase/migrations/028_phase6_comprehensive_security_fixes.sql
psql $DATABASE_URL -f supabase/migrations/029_phase6_performance_optimizations.sql

# Verify migrations applied successfully
psql $DATABASE_URL -c "SELECT COUNT(*) FROM search_analytics LIMIT 1;"
```

**Expected Result:** All 3 migrations should complete without errors.

---

## Step 2: Initialize Data (5 minutes)

```sql
-- Connect to database
psql $DATABASE_URL

-- 1. Create default quotas for existing organizations
INSERT INTO org_quotas (org_id, plan_tier, searches_per_month, storage_gb, 
  recordings_per_month, ai_requests_per_month, connectors_allowed)
SELECT 
  id,
  'free',
  100,  -- searches
  1,    -- storage GB
  10,   -- recordings
  50,   -- AI requests
  1     -- connectors
FROM organizations
WHERE id NOT IN (SELECT org_id FROM org_quotas)
ON CONFLICT (org_id) DO NOTHING;

-- 2. Set system admin users (replace with your admin emails)
UPDATE users 
SET is_system_admin = true 
WHERE email IN ('admin@yourcompany.com');

-- Verify
SELECT COUNT(*) FROM org_quotas;
SELECT email FROM users WHERE is_system_admin = true;
```

---

## Step 3: Configure Environment Variables (5 minutes)

Add these to your `.env.local` (development) and Vercel/production environment:

```bash
# REQUIRED - Redis for caching and rate limiting
UPSTASH_REDIS_REST_URL=https://your-redis-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# OPTIONAL - Edge cache revalidation (Vercel)
VERCEL_REVALIDATE_TOKEN=your_vercel_token

# OPTIONAL - Cloudflare CDN
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_cf_token
```

**Verify Redis Connection:**
```bash
curl -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN" \
  "$UPSTASH_REDIS_REST_URL/ping"
```

Expected: `{"result":"PONG"}`

---

## Step 4: Build & Deploy (10 minutes)

### Local Testing
```bash
# Install dependencies
yarn install

# Run Phase 6 tests
yarn test --testPathPattern="phase6|cache|analytics|quotas"

# Build application
yarn build

# Start development server
yarn dev

# In another terminal, start worker
yarn worker:dev
```

### Deploy to Vercel (or your platform)

```bash
# Push to main branch (triggers deployment)
git add .
git commit -m "Deploy Phase 6: Analytics & Polish"
git push origin main

# Or manual deploy
vercel --prod
```

---

## Step 5: Verify Deployment (10-15 minutes)

### 1. Health Checks
```bash
# Test API health
curl https://your-domain.com/api/health

# Test admin metrics (requires admin token)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-domain.com/api/admin/metrics
```

### 2. Functional Tests

**Test Search with Caching:**
```bash
# First request (cache miss)
time curl -X POST https://your-domain.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search"}'

# Second request (cache hit - should be faster)
time curl -X POST https://your-domain.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test search"}'
```

**Test Quota Enforcement:**
```bash
# Make requests until quota exceeded
for i in {1..105}; do
  curl -X POST https://your-domain.com/api/search \
    -H "Content-Type: application/json" \
    -d '{"query": "test '$i'"}'
done

# Should eventually return 402 (quota exceeded)
```

**Test Admin Dashboard:**
1. Navigate to `https://your-domain.com/admin`
2. Verify you can access (system admin only)
3. Check that metrics cards display data
4. Verify auto-refresh works (wait 10 seconds)

### 3. Database Verification
```sql
-- Check analytics are being recorded
SELECT COUNT(*) FROM search_analytics WHERE created_at > now() - interval '1 hour';

-- Check quota consumption is working
SELECT org_id, searches_used FROM org_quotas LIMIT 5;

-- Check materialized view
SELECT COUNT(*) FROM popular_queries;
```

---

## Step 6: Monitoring Setup (5 minutes)

### Set Up Alerts (via Admin Dashboard)

The following alert rules are pre-configured:
- High P95 Latency (>1000ms)
- Critical P95 Latency (>2000ms)
- Low Cache Hit Rate (<50%)
- High Job Queue (>1000 pending)
- Job Failures (>10/hour)

**Verify Alerts:**
```sql
SELECT name, metric_name, threshold, severity 
FROM alert_rules 
WHERE is_active = true;
```

### Monitor Key Metrics

```bash
# Watch cache performance
while true; do
  curl -s https://your-domain.com/api/admin/metrics | \
    jq '.data.system.cacheHitRate'
  sleep 5
done

# Expected: >0.5 (50% hit rate)
```

---

## Troubleshooting

### Issue: "Cache not working"

**Diagnosis:**
```bash
# Check Redis connectivity
redis-cli -u $UPSTASH_REDIS_REST_URL ping

# Check environment variables
echo $UPSTASH_REDIS_REST_URL
```

**Solution:**
- Verify Redis credentials are correct
- Check Redis instance is running
- Ensure environment variables are set in production

### Issue: "Admin dashboard shows 'Unauthorized'"

**Diagnosis:**
```sql
SELECT email, is_system_admin FROM users WHERE email = 'your@email.com';
```

**Solution:**
```sql
UPDATE users SET is_system_admin = true WHERE email = 'your@email.com';
```

### Issue: "Quota not enforcing"

**Diagnosis:**
```sql
-- Check if quotas exist
SELECT COUNT(*) FROM org_quotas;

-- Check specific org
SELECT * FROM org_quotas WHERE org_id = 'your-org-id';
```

**Solution:**
```sql
-- Initialize missing quotas
INSERT INTO org_quotas (org_id, plan_tier, ...) VALUES (...);
```

### Issue: "High latency on search"

**Diagnosis:**
```sql
-- Check recent search analytics
SELECT 
  AVG(latency_ms) as avg_latency,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM search_analytics 
WHERE created_at > now() - interval '1 hour';
```

**Solution:**
- Check database performance
- Verify cache is working (hit rate >50%)
- Consider scaling database or Redis

---

## Rollback Procedure (If Needed)

If you encounter critical issues:

```bash
# 1. Revert code deployment
git revert HEAD
git push origin main

# 2. Rollback database migrations (in reverse order)
# Note: Down migrations not provided - manual cleanup required
# Contact support or manually drop Phase 6 tables/functions if needed

# 3. Clear cache
redis-cli -u $UPSTASH_REDIS_REST_URL FLUSHDB
```

**Note:** Analytics data will be lost. Consider exporting before rollback.

---

## Post-Deployment Checklist

After deployment, verify:

- [x] All database migrations applied successfully
- [x] Environment variables configured correctly
- [x] Redis connection working
- [x] Search caching operational (cache hit rate >50%)
- [x] Quota enforcement active (test with multiple requests)
- [x] Rate limiting functional (test rapid requests)
- [x] Admin dashboard accessible and displaying data
- [x] Analytics events being recorded in database
- [x] System admin users configured
- [x] Alert rules active
- [x] No errors in production logs

---

## Next Steps

1. **Monitor for 24-48 hours** - Watch metrics, cache hit rates, error logs
2. **Review analytics** - Check search patterns, quota usage trends
3. **Optimize** - Fine-tune cache TTLs, quota limits based on usage
4. **Scale if needed** - Add Redis replicas, scale database
5. **User communication** - Inform users about new quota limits (if applicable)

---

## Success Criteria

You know deployment was successful when:

✅ Search requests complete in <200ms (P95)  
✅ Cache hit rate consistently >70%  
✅ No quota or rate limit errors in normal usage  
✅ Admin dashboard loads without errors  
✅ Analytics data flowing into search_analytics table  
✅ Zero 500 errors from Phase 6 endpoints  

---

## Support Resources

- **Full Documentation:** `PHASE6_COMPLETE.md`
- **API Reference:** `PHASE6_ADMIN_API_QUICK_REFERENCE.md`
- **Security Audit:** `PHASE6_SECURITY_AUDIT_REPORT.md`
- **Performance Guide:** `PERFORMANCE_OPTIMIZATIONS_APPLIED.md`
- **Testing Guide:** `__tests__/PHASE6_README.md`

---

**Questions or Issues?**  
Create an issue in the GitHub repository with:
- Deployment step where issue occurred
- Error messages
- Environment (staging/production)
- Relevant logs

---

**Phase 6 Deployment - Production Ready! 🚀**
