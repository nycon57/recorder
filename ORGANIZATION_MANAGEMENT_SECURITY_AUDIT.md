# Organization Management System - Security Audit Report

**Audit Date:** 2025-10-14
**Scope:** Database, API Routes, RLS Policies, Authentication, Data Handling
**Auditor:** Security Specialist

## Executive Summary

The organization management system demonstrates several good security practices but contains **critical vulnerabilities** that require immediate attention. The most severe issues involve:
1. **API key storage vulnerability** (storing in plain SHA-256 instead of bcrypt)
2. **Insufficient RLS policy validation** for cross-organization data access
3. **Missing CSRF protection** on state-changing operations
4. **Potential privilege escalation** through role manipulation

---

## Critical Issues (Immediate Fix Required)

### 1. API Key Storage Vulnerability
**Location:** `app/api/organizations/api-keys/route.ts:62`
**Risk Level:** CRITICAL
**Description:** API keys are stored using SHA-256 hash instead of proper password hashing (bcrypt/argon2)

```typescript
// VULNERABLE CODE:
const keyHash = createHash('sha256').update(apiKey).digest('hex');
```

**Impact:** SHA-256 is not suitable for password/key storage. An attacker with database access can perform rainbow table attacks.

**Recommended Fix:**
```typescript
import bcrypt from 'bcrypt';

// Generate and hash the API key
const apiKey = `sk_live_${keyBytes.toString('base64url')}`;
const keyHash = await bcrypt.hash(apiKey, 12);

// For validation
const isValid = await bcrypt.compare(providedKey, storedHash);
```

### 2. Cross-Organization Data Leakage Risk
**Location:** Multiple RLS policies
**Risk Level:** CRITICAL
**Description:** Several RLS policies use subqueries without proper isolation

**Example - Vulnerable Policy:** `migrations/031_create_departments_table.sql:63-69`
```sql
CREATE POLICY "Users can read departments in their org"
  ON departments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );
```

**Impact:** If a user has records in multiple organizations (edge case), they could access data from wrong org.

**Recommended Fix:**
```sql
CREATE POLICY "Users can read departments in their org"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = departments.org_id
      AND deleted_at IS NULL
      LIMIT 1
    )
  );
```

### 3. Missing Rate Limiting Implementation
**Location:** All API routes
**Risk Level:** HIGH
**Description:** No rate limiting middleware implemented despite schema definitions

**Impact:** APIs vulnerable to brute force, DoS attacks, and resource exhaustion

**Recommended Fix:**
```typescript
// lib/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
});

export async function rateLimitMiddleware(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new Error('Rate limit exceeded');
  }

  return { limit, reset, remaining };
}
```

---

## High Priority Issues

### 4. Insufficient Input Validation for File Uploads
**Location:** `app/api/profile/avatar/route.ts:55-58`
**Risk Level:** HIGH
**Description:** File type validation only checks MIME type from client

**Impact:** Malicious files can be uploaded by spoofing MIME types

**Recommended Fix:**
```typescript
import fileType from 'file-type';

// Verify actual file type from buffer
const actualType = await fileType.fromBuffer(buffer);
if (!actualType || !allowedTypes.includes(actualType.mime)) {
  return errors.badRequest('Invalid file type detected');
}

// Additional: Check for malicious content
const metadata = await sharp(buffer).metadata();
if (metadata.width > 10000 || metadata.height > 10000) {
  return errors.badRequest('Image dimensions exceed limits');
}
```

### 5. Privilege Escalation Through Role Manipulation
**Location:** `app/api/organizations/members/[id]/route.ts:111-120`
**Risk Level:** HIGH
**Description:** Role validation happens after database fetch, creating race condition

**Impact:** Timing attack could allow privilege escalation

**Recommended Fix:**
```typescript
// Add database-level constraint
ALTER TABLE users ADD CONSTRAINT check_role_hierarchy
CHECK (
  (role != 'owner' OR created_by IS NULL) AND
  (role != 'admin' OR created_by IN (
    SELECT id FROM users WHERE role = 'owner'
  ))
);
```

### 6. Session Token Storage Without Encryption
**Location:** `migrations/034_create_user_sessions_table.sql:12`
**Risk Level:** HIGH
**Description:** Session tokens stored in plaintext

**Impact:** Database breach exposes all active sessions

**Recommended Fix:**
```sql
-- Add encrypted column
ALTER TABLE user_sessions
ADD COLUMN session_token_encrypted TEXT,
ADD COLUMN session_token_hash TEXT UNIQUE;

-- Store hash for lookups, encrypted value for validation
```

---

## Medium Priority Issues

### 7. Missing CSRF Protection
**Location:** All state-changing API routes
**Risk Level:** MEDIUM
**Description:** No CSRF token validation on POST/PUT/DELETE operations

**Recommended Fix:**
```typescript
// Add to apiHandler wrapper
import { csrf } from '@/lib/security/csrf';

export function apiHandler(handler) {
  return async (request, context) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      await csrf.verify(request);
    }
    // ... existing code
  };
}
```

### 8. Webhook Secret Storage Issue
**Location:** `migrations/038_create_org_webhooks_table.sql:14`
**Risk Level:** MEDIUM
**Description:** Webhook secrets stored in plaintext

**Impact:** Database access reveals webhook signing secrets

**Recommended Fix:**
```sql
-- Encrypt webhook secrets
ALTER TABLE org_webhooks
ADD COLUMN secret_encrypted TEXT,
ADD COLUMN secret_key_id TEXT;

-- Use envelope encryption with KMS
```

### 9. Insufficient Audit Log Protection
**Location:** `migrations/033_create_audit_logs_table.sql:68-73`
**Risk Level:** MEDIUM
**Description:** Audit logs can be modified by service role

**Impact:** Compromised service account can tamper with audit trail

**Recommended Fix:**
```sql
-- Make audit logs append-only
CREATE POLICY "Audit logs are append-only"
  ON audit_logs
  FOR UPDATE
  USING (false);

CREATE POLICY "Audit logs cannot be deleted"
  ON audit_logs
  FOR DELETE
  USING (false);
```

### 10. Department Hierarchy Circular Reference Check
**Location:** `migrations/031_create_departments_table.sql:154-172`
**Risk Level:** MEDIUM
**Description:** `is_descendant_of` function vulnerable to infinite loops

**Impact:** DoS through circular department references

**Recommended Fix:**
```sql
CREATE OR REPLACE FUNCTION is_descendant_of(child_id UUID, ancestor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_id UUID;
  max_depth INTEGER := 20; -- Prevent infinite loops
  depth INTEGER := 0;
BEGIN
  current_id := child_id;

  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    IF current_id = ancestor_id THEN
      RETURN TRUE;
    END IF;

    SELECT parent_id INTO current_id FROM departments WHERE id = current_id;
    depth := depth + 1;
  END LOOP;

  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Maximum hierarchy depth exceeded';
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## Low Priority Issues

### 11. Information Disclosure in Error Messages
**Location:** `lib/utils/api.ts:154`
**Risk Level:** LOW
**Description:** Detailed error messages reveal system internals

**Impact:** Information leakage aids attackers

**Recommended Fix:**
```typescript
// Log detailed error, return generic message
if (error?.code === 'PGRST116') {
  console.error(`User ${user.userId} not found in database`);
  throw new Error('Authentication failed'); // Generic message
}
```

### 12. Missing Content-Type Validation
**Location:** API routes accepting JSON
**Risk Level:** LOW
**Description:** No explicit Content-Type header validation

**Recommended Fix:**
```typescript
export async function parseBody<T>(request: NextRequest, schema: any): Promise<T> {
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    throw new Error('Invalid content type');
  }
  // ... existing code
}
```

### 13. Weak Password Requirements for Shares
**Location:** `lib/validations/api.ts:61`
**Risk Level:** LOW
**Description:** Share password minimum 6 characters is weak

**Recommended Fix:**
```typescript
password: z.string()
  .min(12)
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain uppercase, lowercase, number and special character')
```

---

## Best Practices Recommendations

### 1. Implement Security Headers
Add security headers middleware:
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}
```

### 2. Add Request Signing for Internal APIs
Implement HMAC signing for service-to-service communication:
```typescript
import { createHmac } from 'crypto';

function signRequest(payload: any, secret: string): string {
  const timestamp = Date.now();
  const message = `${timestamp}.${JSON.stringify(payload)}`;
  const signature = createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  return `t=${timestamp},sig=${signature}`;
}
```

### 3. Implement Field-Level Encryption
For sensitive data like API keys and tokens:
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

class FieldEncryption {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  encrypt(text: string): { encrypted: string, iv: string, tag: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex')
    };
  }
}
```

### 4. Add Database Query Parameterization Verification
Ensure all queries use parameterized statements:
```typescript
// Good
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('email', userInput); // Parameterized

// Bad - Never do this
const query = `SELECT * FROM users WHERE email = '${userInput}'`; // SQL injection risk
```

### 5. Implement Secrets Rotation
Add support for key rotation:
```typescript
interface RotatableSecret {
  current: string;
  previous?: string;
  rotatedAt: Date;
  expiresAt: Date;
}

async function validateWithRotation(token: string, secrets: RotatableSecret): Promise<boolean> {
  // Try current secret
  if (await validate(token, secrets.current)) return true;

  // Try previous secret if within grace period
  if (secrets.previous && Date.now() < secrets.rotatedAt.getTime() + GRACE_PERIOD) {
    return validate(token, secrets.previous);
  }

  return false;
}
```

---

## Security Checklist

- [ ] Replace SHA-256 with bcrypt for API key hashing
- [ ] Fix RLS policies to prevent cross-org data access
- [ ] Implement rate limiting on all API endpoints
- [ ] Add file content validation for uploads
- [ ] Add database-level role hierarchy constraints
- [ ] Encrypt session tokens at rest
- [ ] Implement CSRF protection
- [ ] Encrypt webhook secrets
- [ ] Make audit logs immutable
- [ ] Add circular reference protection for departments
- [ ] Sanitize error messages
- [ ] Validate Content-Type headers
- [ ] Strengthen password requirements
- [ ] Add security headers
- [ ] Implement request signing
- [ ] Add field-level encryption
- [ ] Verify query parameterization
- [ ] Implement secrets rotation

---

## Compliance Considerations

### GDPR Compliance
- ✅ Soft delete implementation preserves audit trail
- ✅ User data isolation per organization
- ⚠️ Need to implement data export functionality
- ⚠️ Need to implement permanent deletion after retention period

### SOC 2 Requirements
- ✅ Audit logging implemented
- ✅ Role-based access control
- ⚠️ Need to make audit logs tamper-proof
- ⚠️ Need to implement session timeout

### OWASP Top 10 Coverage
1. **Broken Access Control** - Partially addressed, needs RLS fixes
2. **Cryptographic Failures** - Critical issues with key storage
3. **Injection** - Well protected with Zod validation
4. **Insecure Design** - Some architectural improvements needed
5. **Security Misconfiguration** - Missing security headers
6. **Vulnerable Components** - Dependency scanning needed
7. **Authentication Failures** - Clerk handles well, session storage needs work
8. **Data Integrity Failures** - Need CSRF protection
9. **Logging Failures** - Good audit logs, need immutability
10. **SSRF** - Not applicable to current implementation

---

## Conclusion

The organization management system has a solid foundation but requires immediate attention to critical security issues, particularly around API key storage and RLS policies. Implementing the recommended fixes will significantly improve the security posture and bring the system closer to compliance with security best practices and regulatory requirements.

**Priority Action Items:**
1. Fix API key hashing immediately (use bcrypt)
2. Update RLS policies to prevent cross-org access
3. Implement rate limiting before production
4. Add CSRF protection to all state-changing operations
5. Encrypt sensitive data at rest

**Estimated Effort:**
- Critical fixes: 2-3 days
- High priority fixes: 3-4 days
- Medium/Low priority: 1 week
- Best practices implementation: 2 weeks

---

*Generated by Security Audit Tool v1.0*