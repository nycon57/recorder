# Security Testing Checklist

**Security Fixes**: 2025-10-15
**Tester**: ___________________
**Date**: ___________________

---

## Pre-Testing Setup

- [ ] Environment variables configured:
  - [ ] `UPSTASH_REDIS_REST_URL` set
  - [ ] `UPSTASH_REDIS_REST_TOKEN` set
- [ ] Database migration 040 applied successfully
- [ ] Application deployed and running
- [ ] Test user accounts created in different organizations

---

## Critical Issue #1: API Key Storage (bcrypt)

### Test 1.1: Create API Key
**Steps**:
1. Login as admin/owner
2. Navigate to Settings → API Keys
3. Create new API key with name "Test Key"
4. Copy the displayed API key (only shown once)

**Expected**:
- [ ] API key format: `sk_live_XXXXXXXXXX`
- [ ] Key is displayed only once
- [ ] Success message shown

**Verify in Database**:
```sql
SELECT key_prefix, key_hash, created_at
FROM api_keys
WHERE name = 'Test Key'
ORDER BY created_at DESC LIMIT 1;
```

**Expected**:
- [ ] `key_hash` starts with `$2a$` or `$2b$` (bcrypt)
- [ ] `key_hash` length is 60 characters
- [ ] `key_prefix` matches first 19 chars of API key

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 1.2: Validate API Key
**Steps**:
1. Use the API key from Test 1.1
2. Make API request with header: `Authorization: Bearer sk_live_XXXXXXXXXX`

**cURL Command**:
```bash
curl -H "Authorization: Bearer sk_live_XXXXXXXXXX" \
     https://your-app.com/api/recordings
```

**Expected**:
- [ ] Request succeeds with 200 status
- [ ] API key validated successfully
- [ ] `last_used_at` updated in database

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 1.3: Invalid API Key
**Steps**:
1. Modify API key slightly (change one character)
2. Make API request with invalid key

**Expected**:
- [ ] Request fails with 401 Unauthorized
- [ ] Error message: "Invalid or expired API key"
- [ ] `last_used_at` NOT updated

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 1.4: Timing Attack Resistance
**Steps**:
1. Make 100 requests with valid API key
2. Make 100 requests with invalid API key
3. Measure response times

**Expected**:
- [ ] Both sets have similar average response times (within 10%)
- [ ] No significant timing difference reveals validation result
- [ ] bcrypt.compare() provides constant-time comparison

**Pass/Fail**: ☐ Pass ☐ Fail

---

## Critical Issue #2: RLS Cross-Organization Leakage

### Test 2.1: Cross-Org Department Access
**Setup**:
- User A in Organization 1
- User B in Organization 2
- Both orgs have departments created

**Steps**:
1. Login as User A
2. Query departments table
3. Verify only Organization 1 departments visible

**SQL Test** (run as User A):
```sql
-- Should return 0 rows
SELECT * FROM departments
WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
```

**Expected**:
- [ ] Returns 0 rows
- [ ] No Organization 2 departments visible
- [ ] RLS policy blocks cross-org access

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 2.2: Cross-Org Audit Log Access
**Steps**:
1. Login as admin in Organization 1
2. Attempt to query audit logs from Organization 2

**SQL Test**:
```sql
-- Should return 0 rows
SELECT * FROM audit_logs
WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
```

**Expected**:
- [ ] Returns 0 rows
- [ ] Cannot see other organization's audit logs
- [ ] RLS policy enforced

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 2.3: Cross-Org Invitation Access
**Steps**:
1. Create invitation in Organization 1
2. Login as admin in Organization 2
3. Attempt to view Organization 1's invitations

**Expected**:
- [ ] Returns 0 rows
- [ ] Cannot see other organization's invitations
- [ ] RLS policy enforced

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 2.4: Cross-Org API Key Access
**Steps**:
1. Create API key in Organization 1
2. Login as admin in Organization 2
3. Attempt to list API keys

**Expected**:
- [ ] Only Organization 2 keys visible
- [ ] Cannot see Organization 1's API keys
- [ ] RLS policy enforced

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 2.5: Deleted User Access Prevention
**Setup**:
1. Create test user in Organization 1
2. Soft delete user (set `deleted_at = NOW()`)

**Steps**:
1. Attempt to authenticate as deleted user
2. Check if RLS policies still grant access

**SQL Test**:
```sql
-- Set user as deleted
UPDATE users SET deleted_at = NOW() WHERE id = 'test-user-id';

-- Try to query (should return 0 rows for deleted user)
SELECT * FROM departments WHERE org_id = 'org-id';
```

**Expected**:
- [ ] Deleted user cannot access any data
- [ ] RLS policies check `deleted_at IS NULL`
- [ ] Authentication fails for deleted user

**Pass/Fail**: ☐ Pass ☐ Fail

---

## Critical Issue #3: Rate Limiting

### Test 3.1: Normal Usage (Within Limits)
**Steps**:
1. Make 10 requests to `/api/profile` (limit: 100/min)
2. Check response headers

**Expected Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 90
X-RateLimit-Reset: 1697389260000
```

**Expected**:
- [ ] All requests succeed (200 status)
- [ ] Rate limit headers present
- [ ] Remaining count decreases with each request

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.2: Rate Limit Exceeded
**Steps**:
1. Make 101 requests to `/api/profile` (limit: 100/min)
2. Check 101st response

**Expected 101st Response**:
```json
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1697389260000
Retry-After: 42

{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again in 42 seconds.",
  "retry_after": 42
}
```

**Expected**:
- [ ] 101st request returns 429 status
- [ ] `Retry-After` header present
- [ ] Error message includes seconds to wait
- [ ] Rate limit violation logged to audit_logs

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.3: Rate Limit Reset
**Steps**:
1. Trigger rate limit (101 requests)
2. Wait for reset time (check `Retry-After` header)
3. Make another request after reset

**Expected**:
- [ ] Request succeeds after reset time
- [ ] `X-RateLimit-Remaining` back to 100
- [ ] Counter properly reset

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.4: User-Based Rate Limiting
**Setup**:
- User A and User B (different users)

**Steps**:
1. User A makes 100 requests (hits limit)
2. User B makes 1 request

**Expected**:
- [ ] User A gets 429 on 101st request
- [ ] User B's request succeeds (200 status)
- [ ] Rate limits are per-user, not global

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.5: IP-Based Rate Limiting (Unauthenticated)
**Steps**:
1. Make 21 unauthenticated requests to public endpoint (limit: 20/min)
2. Check 21st response

**Expected**:
- [ ] 21st request returns 429 status
- [ ] Rate limit by IP address (no userId)
- [ ] `Retry-After` header present

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.6: Rate Limit Audit Logging
**Steps**:
1. Trigger rate limit violation
2. Check audit_logs table

**SQL Query**:
```sql
SELECT
  action,
  metadata->>'tier' as tier,
  metadata->>'identifier' as identifier,
  created_at
FROM audit_logs
WHERE action = 'rate_limit.violated'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**:
- [ ] Violation logged in audit_logs
- [ ] `action` = 'rate_limit.violated'
- [ ] Metadata includes tier and identifier
- [ ] IP address and user agent captured

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.7: Different Tier Limits
**Test Each Tier**:

| Tier | Endpoint | Limit | Test |
|------|----------|-------|------|
| AUTH | `/api/auth/*` | 5/min | ☐ Pass ☐ Fail |
| API | `/api/profile` | 100/min | ☐ Pass ☐ Fail |
| PUBLIC | Public endpoints | 20/min | ☐ Pass ☐ Fail |
| ADMIN | Admin endpoints | 500/min | ☐ Pass ☐ Fail |

**Expected**:
- [ ] Each tier enforces correct limit
- [ ] Limits are independent per tier

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 3.8: Redis Unavailable (Graceful Degradation)
**Steps**:
1. Stop Redis or set invalid credentials
2. Make API requests

**Expected**:
- [ ] Warning logged: "Redis not configured - skipping rate limit"
- [ ] Requests succeed without rate limiting
- [ ] Application continues to function
- [ ] Fail-open behavior (availability over security)

**Pass/Fail**: ☐ Pass ☐ Fail

---

## Integration Tests

### Test 4.1: End-to-End API Key Flow
**Steps**:
1. Create API key (should use bcrypt)
2. Make 100 requests with API key (should be rate limited)
3. Exceed rate limit (should get 429)
4. Verify audit logs (should log violation)

**Expected**:
- [ ] All components work together
- [ ] bcrypt validation + rate limiting + audit logging

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 4.2: Multi-Org Isolation
**Steps**:
1. Create resources in Org 1 (departments, invitations, API keys)
2. Login as admin in Org 2
3. Attempt to access Org 1 resources via:
   - API endpoints
   - Direct database queries
   - Foreign key relationships

**Expected**:
- [ ] Complete isolation between organizations
- [ ] No cross-org data leakage at any level

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 4.3: Performance Impact
**Steps**:
1. Measure response time before security fixes
2. Measure response time after security fixes
3. Compare average latency

**Expected**:
- [ ] Rate limiting overhead: <10ms per request
- [ ] bcrypt hashing: ~100-200ms (only on key creation)
- [ ] RLS policy overhead: <5ms per query
- [ ] Overall performance degradation: <5%

**Pass/Fail**: ☐ Pass ☐ Fail

---

## Security Verification

### Test 5.1: Brute Force Protection
**Steps**:
1. Attempt 10 failed logins within 1 minute
2. Check if rate limit blocks further attempts

**Expected**:
- [ ] 6th attempt blocked (AUTH tier: 5/min)
- [ ] 429 response returned
- [ ] Brute force attack mitigated

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 5.2: API Key Brute Force
**Steps**:
1. Generate 1000 random API keys
2. Attempt to validate each one
3. Measure success rate and performance

**Expected**:
- [ ] 0 successful validations (unless extremely lucky)
- [ ] Each validation takes ~100-200ms (bcrypt cost)
- [ ] Brute force computationally infeasible

**Pass/Fail**: ☐ Pass ☐ Fail

---

### Test 5.3: SQL Injection via RLS
**Steps**:
1. Attempt SQL injection in auth.uid() context
2. Try to bypass RLS with malicious input

**Example**:
```sql
-- Attempt to inject via user context
SELECT * FROM departments WHERE org_id = 'malicious-input' OR 1=1--
```

**Expected**:
- [ ] SQL injection blocked by RLS
- [ ] Parameterized queries prevent injection
- [ ] No data leakage

**Pass/Fail**: ☐ Pass ☐ Fail

---

## Final Verification

### Deployment Checklist
- [ ] All tests passed
- [ ] No breaking changes observed
- [ ] Performance acceptable
- [ ] Audit logs functioning
- [ ] Rate limiting working
- [ ] RLS policies enforced
- [ ] API keys secured with bcrypt

### Sign-Off
- [ ] QA Team: ___________________
- [ ] Security Team: ___________________
- [ ] DevOps Team: ___________________
- [ ] CTO Approval: ___________________

---

## Notes & Issues

**Issues Found**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

**Resolutions**:
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

---

## Test Summary

**Total Tests**: 30
**Passed**: _____
**Failed**: _____
**Blocked**: _____
**Pass Rate**: _____%

**Overall Status**: ☐ PASS ☐ FAIL ☐ PARTIAL

---

**Tester Signature**: ___________________
**Date**: ___________________
**Time**: ___________________
