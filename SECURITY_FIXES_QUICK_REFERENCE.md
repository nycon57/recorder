# Security Fixes - Quick Reference

**Date**: 2025-10-15
**Severity**: Critical
**Status**: ✅ Implemented

---

## Files Modified/Created

### ✅ Created (4 files)
1. `/lib/middleware/rate-limit.ts` - Rate limiting middleware
2. `/lib/utils/api-key-validation.ts` - API key validation utilities
3. `/supabase/migrations/040_fix_rls_cross_org_leakage.sql` - RLS policy fixes
4. `/SECURITY_FIXES_2025_10_15.md` - Full documentation

### ✏️ Modified (3 files)
1. `/app/api/organizations/api-keys/route.ts` - bcrypt hashing + rate limiting
2. `/app/api/profile/route.ts` - Rate limiting
3. `/app/api/organizations/members/route.ts` - Rate limiting

---

## Summary of Fixes

### 🔴 Critical Issue #1: API Key Storage Vulnerability
**Problem**: SHA-256 hashing (vulnerable to brute force)
**Fix**: bcrypt with cost factor 12
**Impact**: API keys now computationally infeasible to crack

### 🔴 Critical Issue #2: Cross-Organization Data Leakage
**Problem**: `IN (SELECT ...)` pattern allows data leakage
**Fix**: Replaced with secure `EXISTS` pattern + deleted user checks
**Impact**: 11 RLS policies secured across 5 tables

### 🔴 Critical Issue #3: Missing Rate Limiting
**Problem**: No rate limiting on API endpoints
**Fix**: Upstash Redis sliding window algorithm
**Impact**: Protected against brute force, DDoS, and API abuse

---

## Deployment Steps

### 1. Pre-Deployment
```bash
# Verify Redis credentials are set
echo $UPSTASH_REDIS_REST_URL
echo $UPSTASH_REDIS_REST_TOKEN
```

### 2. Apply Database Migration
```bash
# Backup first
supabase db dump -f backup_$(date +%Y%m%d).sql

# Apply migration
supabase db push
```

### 3. Deploy Code
```bash
git push origin main
```

### 4. Verify
```bash
# Test rate limiting
for i in {1..10}; do
  curl -H "Authorization: Bearer $TOKEN" https://your-app.com/api/profile
done

# Should see X-RateLimit-* headers and eventually 429 response
```

---

## Testing Checklist

- [ ] Create new API key → verify bcrypt hash in database
- [ ] Validate API key → verify bcrypt.compare() works
- [ ] Trigger rate limit → verify 429 response with Retry-After header
- [ ] Attempt cross-org access → should fail (0 rows returned)
- [ ] Check audit_logs → verify rate limit violations logged
- [ ] Test deleted user → should not have access
- [ ] Monitor Upstash Redis → verify requests being tracked

---

## Rate Limit Tiers

| Tier | Limit | Use Case |
|------|-------|----------|
| AUTH | 5 req/min | Authentication endpoints |
| API | 100 req/min | Standard API endpoints |
| PUBLIC | 20 req/min | Unauthenticated endpoints |
| ADMIN | 500 req/min | Admin operations |

---

## Breaking Changes

**None** - All changes are backward compatible

---

## Rollback Plan

```bash
# If critical issues occur (NOT RECOMMENDED)
git revert <commit-hash>
git push origin main

# Disable rate limiting temporarily
unset UPSTASH_REDIS_REST_URL
unset UPSTASH_REDIS_REST_TOKEN
```

**WARNING**: Only rollback if production-breaking issues occur. Security fixes should not be rolled back unless absolutely necessary.

---

## Monitoring

### Key Metrics
- **429 response rate**: Should be <1% of total requests
- **Failed API key validations**: Monitor for suspicious activity
- **Cross-org access attempts**: Should be 0
- **Rate limit violations**: Track in audit_logs table

### Alerts
- 🚨 **Critical**: >100 rate limit violations from single IP in 1 hour
- ⚠️ **Warning**: >10 failed API key validations in 5 minutes
- ℹ️ **Info**: Rate limit exceeded for legitimate users (adjust limits)

---

## Quick Commands

### Verify RLS Policies
```sql
-- Should return 0 rows (no cross-org access)
SELECT * FROM departments WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
SELECT * FROM audit_logs WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
SELECT * FROM user_invitations WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
SELECT * FROM api_keys WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
```

### Check API Key Hash
```sql
SELECT key_prefix, key_hash, created_at
FROM api_keys
WHERE org_id = 'your-org-id'
ORDER BY created_at DESC
LIMIT 1;

-- Hash should start with $2a$ or $2b$ (bcrypt)
```

### Monitor Rate Limits
```sql
SELECT
  action,
  COUNT(*) as violations,
  metadata->>'identifier' as identifier
FROM audit_logs
WHERE action = 'rate_limit.violated'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY action, metadata->>'identifier'
ORDER BY violations DESC;
```

---

## Support

- **Full Documentation**: `/SECURITY_FIXES_2025_10_15.md`
- **Security Issues**: security@example.com
- **Emergency**: Create P0 ticket + page on-call

---

**✅ All critical security issues have been resolved**
