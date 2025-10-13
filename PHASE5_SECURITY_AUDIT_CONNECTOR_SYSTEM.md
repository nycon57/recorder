# Phase 5 Connector System Security Audit Report

**Date:** 2025-01-13
**Auditor:** Security Specialist
**Scope:** Phase 5 Connector System Implementation
**Risk Level:** HIGH - Multiple Critical Vulnerabilities Found

## Executive Summary

The Phase 5 connector system implementation contains several critical security vulnerabilities that require immediate attention. While basic authentication and authorization patterns are in place, there are significant gaps in credential encryption, input validation, and secure data handling.

## Critical Vulnerabilities Found

### 1. CRITICAL: Plaintext Credential Storage
**Severity:** CRITICAL
**OWASP:** A02:2021 - Cryptographic Failures
**Location:** `/lib/services/connector-manager.ts`, `/app/api/connectors/auth/google/route.ts`

**Issue:**
- OAuth tokens and API credentials are stored in plaintext in the database
- No encryption at rest for sensitive authentication data
- Credentials visible in database queries and logs

**Evidence:**
```typescript
// connector-manager.ts line 101-102
credentials,  // Stored directly without encryption
settings,

// google/route.ts line 74-78
const credentials = {
  accessToken: tokens.access_token,  // Plaintext token
  refreshToken: tokens.refresh_token,  // Plaintext refresh token
  expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
};
```

**Recommendation:**
```typescript
// Implement credential encryption
import crypto from 'crypto';

class CredentialEncryption {
  private static algorithm = 'aes-256-gcm';
  private static key = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

  static encrypt(data: any): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);

    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }

  static decrypt(encryptedData: string, iv: string, authTag: string): any {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, 'hex')),
      decipher.final()
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }
}
```

### 2. HIGH: Insufficient OAuth State Validation
**Severity:** HIGH
**OWASP:** A07:2021 - Identification and Authentication Failures
**Location:** `/app/api/connectors/auth/google/route.ts`

**Issue:**
- State parameter only validates org ID match
- No CSRF token validation
- State parameter uses predictable base64 encoding
- No timestamp validation for state freshness

**Evidence:**
```typescript
// Line 44-50
const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
const { connectorId, orgId: stateOrgId, returnUrl } = stateData;

// Only validates org match, no CSRF protection
if (stateOrgId !== orgId) {
  return errors.forbidden();
}
```

**Recommendation:**
```typescript
// Implement secure state generation and validation
interface OAuthState {
  connectorId?: string;
  orgId: string;
  csrf: string;
  timestamp: number;
  returnUrl?: string;
}

class OAuthStateManager {
  static generate(data: Omit<OAuthState, 'csrf' | 'timestamp'>): string {
    const state: OAuthState = {
      ...data,
      csrf: crypto.randomBytes(32).toString('hex'),
      timestamp: Date.now()
    };

    // Store CSRF token in session/Redis
    await redis.setex(`oauth:csrf:${state.csrf}`, 600, JSON.stringify(state));

    // Encrypt state
    const encrypted = CredentialEncryption.encrypt(state);
    return Buffer.from(JSON.stringify(encrypted)).toString('base64url');
  }

  static async validate(stateParam: string, sessionCsrf?: string): Promise<OAuthState> {
    const encrypted = JSON.parse(Buffer.from(stateParam, 'base64url').toString());
    const state = CredentialEncryption.decrypt(encrypted);

    // Validate timestamp (10 minute window)
    if (Date.now() - state.timestamp > 600000) {
      throw new Error('OAuth state expired');
    }

    // Validate CSRF
    const storedState = await redis.get(`oauth:csrf:${state.csrf}`);
    if (!storedState || JSON.parse(storedState).csrf !== state.csrf) {
      throw new Error('Invalid CSRF token');
    }

    // Clean up
    await redis.del(`oauth:csrf:${state.csrf}`);

    return state;
  }
}
```

### 3. HIGH: Weak Input Validation on Credentials
**Severity:** HIGH
**OWASP:** A03:2021 - Injection
**Location:** `/lib/validations/api.ts`

**Issue:**
- Credentials field accepts `z.record(z.any())` allowing any data
- No validation of credential structure
- Settings field also accepts any data without validation

**Evidence:**
```typescript
// Line 204-205
credentials: z.record(z.any()),
settings: z.record(z.any()).optional().default({}),
```

**Recommendation:**
```typescript
// Implement strict credential validation
const googleCredentialsSchema = z.object({
  accessToken: z.string().min(1).max(2048),
  refreshToken: z.string().min(1).max(512).optional(),
  expiresAt: z.string().datetime(),
  scope: z.string().optional()
});

const notionCredentialsSchema = z.object({
  accessToken: z.string().min(1).max(256),
  workspaceId: z.string().uuid().optional()
});

const credentialsSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('google_drive'), data: googleCredentialsSchema }),
  z.object({ type: z.literal('notion'), data: notionCredentialsSchema }),
  // ... other connector types
]);

export const createConnectorSchema = z.object({
  connectorType: z.enum([...]),
  credentials: credentialsSchema,
  settings: z.object({
    syncInterval: z.number().min(3600).optional(),
    maxFileSize: z.number().max(100 * 1024 * 1024).optional(),
    allowedMimeTypes: z.array(z.string()).optional()
  }).strict().optional()
});
```

### 4. HIGH: SSRF Vulnerability in URL Import
**Severity:** HIGH
**OWASP:** A10:2021 - Server-Side Request Forgery
**Location:** `/lib/connectors/url-import.ts`

**Issue:**
- No validation against internal network addresses
- No blocklist for sensitive domains
- Can be used to scan internal network
- No restriction on redirect following

**Evidence:**
```typescript
// Line 169-183
try {
  parsedUrl = new URL(url);
} catch {
  return { success: false, error: 'Invalid URL format' };
}

// Only checks protocol, not destination
if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
  return { success: false, error: 'Only HTTP and HTTPS URLs are supported' };
}
```

**Recommendation:**
```typescript
import { isIP } from 'net';
import dns from 'dns/promises';

class URLValidator {
  private static BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    'metadata.google.internal',
    '169.254.169.254' // AWS metadata
  ];

  private static BLOCKED_RANGES = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    'fc00::/7'
  ];

  static async validate(url: string): Promise<boolean> {
    const parsed = new URL(url);

    // Check blocked hosts
    if (this.BLOCKED_HOSTS.includes(parsed.hostname)) {
      throw new Error('Blocked host');
    }

    // Resolve hostname to IP
    try {
      const addresses = await dns.resolve4(parsed.hostname);

      for (const ip of addresses) {
        // Check if private IP
        if (this.isPrivateIP(ip)) {
          throw new Error('Private network access denied');
        }
      }
    } catch (error) {
      throw new Error('DNS resolution failed');
    }

    return true;
  }

  private static isPrivateIP(ip: string): boolean {
    // Implementation to check against BLOCKED_RANGES
    return false; // Placeholder
  }
}

// In fetchAndExtract method:
await URLValidator.validate(url);

const response = await axios.get(url, {
  timeout: REQUEST_TIMEOUT,
  maxContentLength: MAX_CONTENT_SIZE,
  maxRedirects: 5, // Limit redirects
  validateStatus: (status) => status >= 200 && status < 400,
  // Prevent following redirects to internal IPs
  beforeRedirect: async (options, { headers }) => {
    await URLValidator.validate(options.href);
  }
});
```

### 5. MEDIUM: Insufficient File Type Validation
**Severity:** MEDIUM
**OWASP:** A04:2021 - Insecure Design
**Location:** `/app/api/connectors/upload/route.ts`, `/app/api/connectors/upload/batch/route.ts`

**Issue:**
- File type validation relies on client-provided MIME type
- No magic number validation
- No content scanning for malicious payloads
- Could allow upload of executable files

**Evidence:**
```typescript
// Line 142-143 in batch/route.ts
contentType: file.type,  // Trusts client-provided type
upsert: false,
```

**Recommendation:**
```typescript
import fileType from 'file-type';

class FileValidator {
  private static ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'video/mp4'
  ];

  static async validate(buffer: ArrayBuffer, claimedType: string): Promise<boolean> {
    // Check magic numbers
    const detected = await fileType.fromBuffer(Buffer.from(buffer));

    if (!detected) {
      throw new Error('Unable to detect file type');
    }

    // Verify claimed type matches detected
    if (detected.mime !== claimedType) {
      throw new Error('File type mismatch');
    }

    // Check against allowlist
    if (!this.ALLOWED_MIME_TYPES.includes(detected.mime)) {
      throw new Error(`File type ${detected.mime} not allowed`);
    }

    // Additional content scanning for executables
    if (this.containsExecutableSignatures(buffer)) {
      throw new Error('Executable content detected');
    }

    return true;
  }

  private static containsExecutableSignatures(buffer: ArrayBuffer): boolean {
    const view = new Uint8Array(buffer);

    // Check for PE header (Windows executables)
    if (view[0] === 0x4D && view[1] === 0x5A) return true;

    // Check for ELF header (Linux executables)
    if (view[0] === 0x7F && view[1] === 0x45 && view[2] === 0x4C && view[3] === 0x46) return true;

    // Check for shell scripts
    if (view[0] === 0x23 && view[1] === 0x21) return true; // #!

    return false;
  }
}
```

### 6. MEDIUM: Weak Webhook Signature Verification
**Severity:** MEDIUM
**OWASP:** A08:2021 - Software and Data Integrity Failures
**Location:** `/app/api/connectors/webhooks/zoom/route.ts`

**Issue:**
- No replay attack protection
- No timestamp validation for webhook freshness
- Signature verification but no nonce validation

**Evidence:**
```typescript
// Line 42-47
const timestamp = request.headers.get('x-zm-request-timestamp');
const signature = request.headers.get('x-zm-signature');

if (!timestamp || !signature) {
  return errors.badRequest('Missing webhook signature headers');
}
// No timestamp freshness check
```

**Recommendation:**
```typescript
class WebhookValidator {
  private static MAX_TIMESTAMP_AGE = 300000; // 5 minutes

  static async validateZoomWebhook(
    body: string,
    timestamp: string,
    signature: string,
    secret: string
  ): Promise<boolean> {
    // Validate timestamp freshness
    const webhookTime = parseInt(timestamp) * 1000;
    const currentTime = Date.now();

    if (Math.abs(currentTime - webhookTime) > this.MAX_TIMESTAMP_AGE) {
      throw new Error('Webhook timestamp too old or in future');
    }

    // Check for replay attacks
    const webhookId = crypto.createHash('sha256')
      .update(`${timestamp}:${body}`)
      .digest('hex');

    const isReplay = await redis.get(`webhook:replay:${webhookId}`);
    if (isReplay) {
      throw new Error('Webhook replay detected');
    }

    // Store for replay protection
    await redis.setex(`webhook:replay:${webhookId}`, 3600, '1');

    // Verify signature
    const message = `v0:${timestamp}:${body}`;
    const expectedSig = `v0=${crypto.createHmac('sha256', secret)
      .update(message)
      .digest('hex')}`;

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      throw new Error('Invalid webhook signature');
    }

    return true;
  }
}
```

### 7. MEDIUM: Missing Rate Limiting
**Severity:** MEDIUM
**OWASP:** A04:2021 - Insecure Design
**Location:** All connector API routes

**Issue:**
- No rate limiting on file uploads
- No rate limiting on sync operations
- Could lead to resource exhaustion
- No per-org quotas enforced

**Recommendation:**
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const rateLimits = {
  upload: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 uploads per minute
    analytics: true
  }),
  sync: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '5 m'), // 5 syncs per 5 minutes
    analytics: true
  }),
  oauth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 OAuth attempts per 15 min
    analytics: true
  })
};

// In API route:
const { success, limit, reset, remaining } = await rateLimits.upload.limit(
  `upload:${orgId}`
);

if (!success) {
  return new Response('Rate limit exceeded', {
    status: 429,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': new Date(reset).toISOString()
    }
  });
}
```

### 8. LOW: Insufficient Error Handling
**Severity:** LOW
**OWASP:** A09:2021 - Security Logging and Monitoring Failures
**Location:** Multiple files

**Issue:**
- Generic error messages expose internal details
- Stack traces potentially leaked in responses
- Insufficient error logging for security events

**Recommendation:**
- Implement structured error logging
- Sanitize error messages before sending to client
- Log security-relevant events (failed auth, validation errors)

## Security Checklist

### Authentication & Authorization
- [ ] ❌ Encrypt OAuth tokens and credentials at rest
- [ ] ❌ Implement CSRF protection for OAuth flows
- [ ] ✅ RLS policies implemented for connector tables
- [ ] ✅ requireOrg() used in API routes
- [ ] ❌ Token refresh mechanism needs security review
- [ ] ❌ Implement token rotation on refresh

### Input Validation
- [ ] ❌ Strict validation for credentials field
- [ ] ❌ File type validation using magic numbers
- [ ] ❌ URL validation to prevent SSRF
- [ ] ✅ File size limits implemented
- [ ] ❌ Path traversal protection needed
- [ ] ✅ Webhook signature verification (needs improvement)

### Data Security
- [ ] ❌ Credential encryption not implemented
- [ ] ❌ Sensitive data logging prevention needed
- [ ] ✅ SQL injection prevention (using Supabase)
- [ ] ⚠️ XSS prevention (partial - needs review)
- [ ] ❌ PII detection not implemented for imported documents
- [ ] ✅ Content hash for deduplication

### API Security
- [ ] ❌ Rate limiting not implemented
- [ ] ✅ CORS configuration (inherited from Next.js)
- [ ] ⚠️ Webhook verification (needs replay protection)
- [ ] ✅ File upload size limits
- [ ] ❌ API quotas per organization needed
- [ ] ❌ Request signing for internal services

## Recommended Security Headers

Add to `next.config.js`:

```javascript
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com https://*.supabase.co; frame-ancestors 'none';"
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  }
];
```

## Priority Action Items

1. **IMMEDIATE (Critical)**:
   - Implement credential encryption at rest
   - Add CSRF protection to OAuth flows
   - Fix SSRF vulnerability in URL import

2. **HIGH (Within 48 hours)**:
   - Implement strict input validation for credentials
   - Add file type validation using magic numbers
   - Implement rate limiting on all connector endpoints

3. **MEDIUM (Within 1 week)**:
   - Add replay protection to webhooks
   - Implement PII detection for imported documents
   - Add comprehensive error logging

4. **LOW (Within 2 weeks)**:
   - Implement API quotas per organization
   - Add request signing for internal services
   - Improve error message sanitization

## Testing Recommendations

1. **Security Testing**:
   ```bash
   # OWASP ZAP scan
   docker run -t owasp/zap2docker-stable zap-baseline.py -t https://your-app.com

   # Dependency scanning
   npm audit
   yarn audit

   # Secret scanning
   trufflehog filesystem /path/to/repo
   ```

2. **Penetration Testing Focus Areas**:
   - OAuth flow manipulation
   - File upload bypass attempts
   - SSRF exploitation
   - Credential extraction
   - Rate limit bypass

3. **Unit Tests Needed**:
   - Credential encryption/decryption
   - OAuth state validation
   - File type validation
   - URL validation
   - Webhook signature verification

## Compliance Considerations

1. **GDPR/CCPA**:
   - Implement PII detection and redaction
   - Add audit logging for data access
   - Implement data retention policies

2. **SOC 2**:
   - Implement comprehensive logging
   - Add monitoring and alerting
   - Document security controls

3. **ISO 27001**:
   - Implement access control matrix
   - Add security awareness training
   - Regular security reviews

## Conclusion

The Phase 5 connector system has significant security vulnerabilities that must be addressed before production deployment. The most critical issues are the plaintext storage of credentials and the SSRF vulnerability in URL imports. Implementing the recommended fixes will significantly improve the security posture of the application.

**Overall Security Score: 3/10**
**Production Readiness: NOT READY**
**Estimated Remediation Time: 2-3 weeks**

## References

- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OAuth 2.0 Security Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)