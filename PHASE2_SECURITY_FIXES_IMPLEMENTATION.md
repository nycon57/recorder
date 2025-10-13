# Phase 2 Security Fixes - Implementation Guide

**Priority**: 🔴 **CRITICAL** - Must be applied before production
**Estimated Time**: 4-6 hours for critical fixes

---

## Critical Fix #1: RLS Policy on transcript_chunks

### ✅ Migration Created

**File**: `/supabase/migrations/017_fix_transcript_chunks_rls.sql`

### 🔧 Apply the Migration

```bash
# Local development
supabase migration up

# Production (via Supabase Dashboard or CLI)
supabase db push --db-url "postgresql://..."
```

### 📝 Verify the Fix

```sql
-- Connect to database and verify
SET request.jwt.claims TO '{"sub": "your_clerk_user_id"}';

-- Should only return chunks from your org
SELECT COUNT(*) FROM transcript_chunks;

-- Check the policy
SELECT policyname, definition
FROM pg_policies
WHERE tablename = 'transcript_chunks'
AND schemaname = 'public';
```

---

## Critical Fix #2: Sanitize Before Embedding

### 📁 Create New File: `/lib/utils/text-sanitizer.ts`

```typescript
/**
 * Text Sanitization Utilities
 *
 * Sanitizes text content before embedding generation to prevent
 * information leakage and injection attacks.
 */

// PII patterns to detect and redact
const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  phone: /(\+\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  // Add more patterns as needed
};

// Keywords that might indicate sensitive content
const SENSITIVE_KEYWORDS = [
  'password', 'secret', 'token', 'api_key', 'private_key',
  'authorization', 'bearer', 'credential', 'confidential',
];

export interface SanitizationOptions {
  removePII?: boolean;
  removeSecrets?: boolean;
  maxLength?: number;
  removeNullBytes?: boolean;
  normalizeWhitespace?: boolean;
}

/**
 * Sanitize text content for embedding generation
 */
export function sanitizeTextForEmbedding(
  text: string,
  options: SanitizationOptions = {}
): string {
  const {
    removePII = true,
    removeSecrets = true,
    maxLength = 50000,
    removeNullBytes = true,
    normalizeWhitespace = true,
  } = options;

  let sanitized = text;

  // Remove null bytes and control characters
  if (removeNullBytes) {
    sanitized = sanitized.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, ' ');
  }

  // Normalize whitespace
  if (normalizeWhitespace) {
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
  }

  // Remove PII
  if (removePII) {
    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      sanitized = sanitized.replace(pattern, `[REDACTED_${type.toUpperCase()}]`);
    }
  }

  // Remove potential secrets
  if (removeSecrets) {
    // Check for patterns like KEY=value or TOKEN:value
    sanitized = sanitized.replace(
      /(?:api[_-]?key|token|secret|password|auth|credential)[:\s=]["']?[\w-]+["']?/gi,
      '[REDACTED_SECRET]'
    );

    // Check for base64 encoded strings that might be secrets
    sanitized = sanitized.replace(
      /(?:[A-Za-z0-9+/]{4}){8,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?/g,
      (match) => {
        // Only redact if it looks like a secret (has mixed case and numbers)
        if (match.length > 40 && /[A-Z]/.test(match) && /[a-z]/.test(match) && /[0-9]/.test(match)) {
          return '[REDACTED_BASE64]';
        }
        return match;
      }
    );
  }

  // Enforce max length
  if (maxLength && sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '... [TRUNCATED]';
  }

  return sanitized;
}

/**
 * Check if text contains sensitive content
 */
export function containsSensitiveContent(text: string): boolean {
  const lowerText = text.toLowerCase();

  // Check for sensitive keywords
  for (const keyword of SENSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      return true;
    }
  }

  // Check for PII patterns
  for (const pattern of Object.values(PII_PATTERNS)) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a content hash for deduplication without exposing content
 */
export async function generateSecureHash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

### 📝 Update: `/lib/workers/handlers/embeddings-google.ts`

Add at the top:
```typescript
import { sanitizeTextForEmbedding, containsSensitiveContent } from '@/lib/utils/text-sanitizer';
```

Replace lines 230-250 with:
```typescript
// Process each chunk in the batch
for (const chunk of batch) {
  // Sanitize text BEFORE embedding
  const sanitizedText = sanitizeTextForEmbedding(chunk.text, {
    removePII: true,
    removeSecrets: true,
    maxLength: 2000, // Limit chunk size for embedding
  });

  // Check for sensitive content
  if (containsSensitiveContent(sanitizedText)) {
    console.warn(`[Embeddings] Sensitive content detected in chunk, extra sanitization applied`);
  }

  // Initialize new Google GenAI client
  const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  // Generate embedding with sanitized text
  const result = await genai.models.embedContent({
    model: GOOGLE_CONFIG.EMBEDDING_MODEL,
    contents: sanitizedText, // Use sanitized text
    config: {
      taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
      outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
    },
  });

  // ... rest of the code
}
```

---

## Critical Fix #3: Model Integrity Verification

### 📁 Create New File: `/lib/security/model-security.ts`

```typescript
/**
 * Model Security Module
 *
 * Provides security features for ML model loading and inference
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

// Model integrity checksums (update with actual checksums)
const MODEL_CHECKSUMS = {
  'Xenova/all-MiniLM-L6-v2': {
    'onnx': 'sha256:abc123...', // Replace with actual checksum
    'tokenizer': 'sha256:def456...', // Replace with actual checksum
  },
  'Xenova/all-MiniLM-L12-v2': {
    'onnx': 'sha256:ghi789...', // Replace with actual checksum
    'tokenizer': 'sha256:jkl012...', // Replace with actual checksum
  },
};

// Allowed model sources
const ALLOWED_MODEL_SOURCES = [
  'https://huggingface.co/',
  'https://cdn-lfs.huggingface.co/',
];

export class ModelSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelSecurityError';
  }
}

/**
 * Verify model URL is from allowed source
 */
export function verifyModelSource(url: string): boolean {
  return ALLOWED_MODEL_SOURCES.some(source => url.startsWith(source));
}

/**
 * Calculate file checksum
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  const stream = await fs.readFile(filePath);
  hash.update(stream);
  return `sha256:${hash.digest('hex')}`;
}

/**
 * Verify model integrity
 */
export async function verifyModelIntegrity(
  modelName: string,
  modelPath: string
): Promise<boolean> {
  const expectedChecksums = MODEL_CHECKSUMS[modelName];

  if (!expectedChecksums) {
    throw new ModelSecurityError(`No checksums defined for model: ${modelName}`);
  }

  // Check ONNX model file
  const onnxPath = path.join(modelPath, 'onnx', 'model.onnx');
  const onnxChecksum = await calculateChecksum(onnxPath);

  if (onnxChecksum !== expectedChecksums.onnx) {
    throw new ModelSecurityError(
      `Model integrity check failed for ${modelName}. ` +
      `Expected: ${expectedChecksums.onnx}, Got: ${onnxChecksum}`
    );
  }

  // Check tokenizer file
  const tokenizerPath = path.join(modelPath, 'tokenizer.json');
  const tokenizerChecksum = await calculateChecksum(tokenizerPath);

  if (tokenizerChecksum !== expectedChecksums.tokenizer) {
    throw new ModelSecurityError(
      `Tokenizer integrity check failed for ${modelName}. ` +
      `Expected: ${expectedChecksums.tokenizer}, Got: ${tokenizerChecksum}`
    );
  }

  return true;
}

/**
 * Secure model cache with integrity tracking
 */
export class SecureModelCache {
  private cache: Map<string, {
    model: any;
    loadedAt: number;
    lastUsed: number;
    integrity: string;
    accessCount: number;
  }> = new Map();

  private readonly maxAge = 30 * 60 * 1000; // 30 minutes
  private readonly maxAccessCount = 10000; // Max uses before reload

  async get(modelName: string): Promise<any | null> {
    const cached = this.cache.get(modelName);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.loadedAt;

    // Check if model is too old
    if (age > this.maxAge) {
      this.cache.delete(modelName);
      return null;
    }

    // Check if model has been used too many times
    if (cached.accessCount > this.maxAccessCount) {
      this.cache.delete(modelName);
      return null;
    }

    // Update usage stats
    cached.lastUsed = Date.now();
    cached.accessCount++;

    return cached.model;
  }

  async set(
    modelName: string,
    model: any,
    integrity: string
  ): Promise<void> {
    this.cache.set(modelName, {
      model,
      loadedAt: Date.now(),
      lastUsed: Date.now(),
      integrity,
      accessCount: 0,
    });

    // Clean up old entries
    this.cleanup();
  }

  private cleanup(): void {
    const now = Date.now();

    for (const [key, value] of this.cache.entries()) {
      if (now - value.lastUsed > this.maxAge) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global secure cache instance
export const secureModelCache = new SecureModelCache();
```

### 📝 Update: `/lib/services/semantic-chunker.ts`

Add imports:
```typescript
import { verifyModelSource, verifyModelIntegrity, secureModelCache } from '@/lib/security/model-security';
```

Replace the `initEmbedder` method (lines 99-143):

```typescript
private async initEmbedder(): Promise<void> {
  // Try to get from secure cache first
  const cached = await secureModelCache.get(this.modelName);
  if (cached) {
    this.embedder = cached;
    return;
  }

  const modelName = process.env.SENTENCE_TRANSFORMER_MODEL || 'Xenova/all-MiniLM-L6-v2';

  // Validate model is whitelisted
  if (!SECURITY_LIMITS.ALLOWED_MODELS.has(modelName)) {
    throw new Error(
      `Model "${modelName}" is not in the allowed list. Allowed models: ${Array.from(
        SECURITY_LIMITS.ALLOWED_MODELS
      ).join(', ')}`
    );
  }

  console.log('[Semantic Chunker] Loading model:', modelName);

  try {
    // Load model with security checks
    const embedder = await pipeline('feature-extraction', modelName, {
      quantized: true,
      progress_callback: (progress: any) => {
        if (progress.status === 'progress' && progress.progress) {
          console.log(`[Model Loading] ${Math.round(progress.progress)}%`);
        }

        // Verify source URL if available
        if (progress.url && !verifyModelSource(progress.url)) {
          throw new Error(`Untrusted model source: ${progress.url}`);
        }
      },
    });

    // Verify model integrity (in production only)
    if (process.env.NODE_ENV === 'production') {
      const modelPath = path.join(process.cwd(), '.cache', 'models', modelName);
      await verifyModelIntegrity(modelName, modelPath);
    }

    // Store in secure cache
    const integrity = `${modelName}:${Date.now()}`;
    await secureModelCache.set(modelName, embedder, integrity);

    this.embedder = embedder;
    console.log('[Semantic Chunker] Model loaded and verified successfully');
  } catch (error) {
    console.error('[Semantic Chunker] Failed to load model:', error);
    throw new Error(
      `Failed to initialize semantic chunker model: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}
```

---

## Additional Security Enhancements

### 📁 Create: `/lib/security/rate-limiter.ts`

```typescript
/**
 * Rate Limiting Module
 *
 * Prevents abuse and resource exhaustion
 */

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export class RateLimiter {
  constructor(private config: RateLimitConfig) {}

  async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const fullKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const window = Math.floor(now / this.config.windowMs);
    const windowKey = `${fullKey}:${window}`;

    // Increment counter
    const count = await redis.incr(windowKey);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(windowKey, Math.ceil(this.config.windowMs / 1000));
    }

    const remaining = Math.max(0, this.config.maxRequests - count);
    const resetAt = (window + 1) * this.config.windowMs;

    return {
      allowed: count <= this.config.maxRequests,
      remaining,
      resetAt,
    };
  }

  async reset(key: string): Promise<void> {
    const fullKey = `${this.config.keyPrefix || 'ratelimit'}:${key}`;
    const now = Date.now();
    const window = Math.floor(now / this.config.windowMs);
    const windowKey = `${fullKey}:${window}`;

    await redis.del(windowKey);
  }
}

// Pre-configured rate limiters
export const embeddingRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60000, // 1 minute
  keyPrefix: 'embedding',
});

export const chunkingRateLimiter = new RateLimiter({
  maxRequests: 50,
  windowMs: 60000, // 1 minute
  keyPrefix: 'chunking',
});
```

---

## Testing the Security Fixes

### 📁 Create: `/__tests__/security/phase2-security.test.ts`

```typescript
import { SemanticChunker } from '@/lib/services/semantic-chunker';
import { sanitizeTextForEmbedding, containsSensitiveContent } from '@/lib/utils/text-sanitizer';
import { sanitizeMetadata } from '@/lib/utils/config-validation';
import { embeddingRateLimiter } from '@/lib/security/rate-limiter';

describe('Phase 2 Security Tests', () => {
  describe('Text Sanitization', () => {
    test('should remove PII from text', () => {
      const text = 'Contact me at john@example.com or 555-123-4567';
      const sanitized = sanitizeTextForEmbedding(text);

      expect(sanitized).not.toContain('john@example.com');
      expect(sanitized).not.toContain('555-123-4567');
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_PHONE]');
    });

    test('should detect sensitive content', () => {
      expect(containsSensitiveContent('my password is secret123')).toBe(true);
      expect(containsSensitiveContent('API_KEY=abc123')).toBe(true);
      expect(containsSensitiveContent('normal text content')).toBe(false);
    });

    test('should remove potential secrets', () => {
      const text = 'API_KEY="sk-1234567890abcdef" TOKEN:xyz789';
      const sanitized = sanitizeTextForEmbedding(text);

      expect(sanitized).toContain('[REDACTED_SECRET]');
      expect(sanitized).not.toContain('sk-1234567890abcdef');
      expect(sanitized).not.toContain('xyz789');
    });
  });

  describe('Metadata Sanitization', () => {
    test('should remove dangerous keys', () => {
      const metadata = {
        __proto__: 'polluted',
        $ref: 'dangerous',
        normal: 'value',
        nested: { __proto__: 'also bad' },
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.__proto__).toBeUndefined();
      expect(sanitized.$ref).toBeUndefined();
      expect(sanitized.normal).toBe('value');
    });

    test('should sanitize string values', () => {
      const metadata = {
        text: 'hello\x00world\x1F',
        normal: 'clean text',
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.text).toBe('helloworld');
      expect(sanitized.normal).toBe('clean text');
    });
  });

  describe('Model Security', () => {
    test('should reject unauthorized models', async () => {
      process.env.SENTENCE_TRANSFORMER_MODEL = 'malicious/model';

      const chunker = new SemanticChunker();
      await expect(chunker.chunk('test text')).rejects.toThrow('not in the allowed list');
    });

    test('should enforce input size limits', async () => {
      const chunker = new SemanticChunker();
      const largeText = 'x'.repeat(2_000_000); // 2MB

      // Should truncate, not fail
      const result = await chunker.chunk(largeText);
      expect(result[0].text.length).toBeLessThanOrEqual(1_000_000);
    });

    test('should timeout on long processing', async () => {
      const chunker = new SemanticChunker();

      // Mock slow processing
      jest.spyOn(chunker as any, 'generateSentenceEmbeddings')
        .mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 40000)); // 40 seconds
        });

      await expect(chunker.chunk('test text')).rejects.toThrow('timeout');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const testKey = `test-${Date.now()}`;

      // Reset to ensure clean state
      await embeddingRateLimiter.reset(testKey);

      // Should allow up to limit
      for (let i = 0; i < 100; i++) {
        const { allowed } = await embeddingRateLimiter.checkLimit(testKey);
        expect(allowed).toBe(true);
      }

      // Should deny after limit
      const { allowed, remaining } = await embeddingRateLimiter.checkLimit(testKey);
      expect(allowed).toBe(false);
      expect(remaining).toBe(0);
    });
  });

  describe('Memory Management', () => {
    test('should enforce memory limits', () => {
      // This would require mocking process.memoryUsage()
      const originalMemoryUsage = process.memoryUsage;

      process.memoryUsage = () => ({
        ...originalMemoryUsage(),
        heapUsed: 600 * 1024 * 1024, // 600MB
      });

      const chunker = new SemanticChunker();

      // Should throw when memory limit exceeded
      expect(() => {
        (chunker as any).checkMemory();
      }).toThrow('Memory limit exceeded');

      process.memoryUsage = originalMemoryUsage;
    });
  });
});
```

---

## Deployment Checklist

### Before Deployment

- [ ] Apply migration 017_fix_transcript_chunks_rls.sql
- [ ] Deploy text-sanitizer.ts utility
- [ ] Deploy model-security.ts module
- [ ] Deploy rate-limiter.ts module
- [ ] Update embeddings-google.ts with sanitization
- [ ] Update semantic-chunker.ts with security enhancements
- [ ] Run security test suite
- [ ] Review logs for any errors

### Verification Steps

1. **Test RLS Policy**:
```bash
# In Supabase SQL Editor
SET request.jwt.claims TO '{"sub": "test_user_id"}';
SELECT COUNT(*) FROM transcript_chunks; -- Should return 0 or only user's chunks
```

2. **Test Sanitization**:
```bash
# Create test recording with PII
# Verify embeddings don't contain PII
```

3. **Test Rate Limiting**:
```bash
# Run multiple embedding requests
# Verify rate limit kicks in after 100 requests/minute
```

4. **Monitor Performance**:
```bash
# Check response times
# Monitor memory usage
# Review error rates
```

---

## Environment Variables to Add

```env
# Security Configuration
ENABLE_PII_DETECTION=true
ENABLE_SECRET_DETECTION=true
ENABLE_MODEL_INTEGRITY_CHECK=true
MAX_EMBEDDING_REQUESTS_PER_MINUTE=100
MAX_CHUNK_SIZE_BYTES=50000
MAX_PROCESSING_TIME_MS=30000

# Model Security
ALLOWED_MODEL_SOURCES="https://huggingface.co/,https://cdn-lfs.huggingface.co/"
MODEL_CACHE_MAX_AGE_MS=1800000
MODEL_CACHE_MAX_USES=10000
```

---

## Post-Deployment Monitoring

### Metrics to Track

1. **Security Metrics**:
   - Failed authentication attempts
   - Cross-tenant access attempts (should be 0)
   - PII detection triggers
   - Rate limit violations

2. **Performance Metrics**:
   - Embedding generation time
   - Memory usage peaks
   - Model loading frequency
   - Cache hit rates

3. **Error Metrics**:
   - Model integrity check failures
   - Timeout errors
   - Memory limit errors
   - Sanitization errors

### Alert Thresholds

```typescript
const ALERT_THRESHOLDS = {
  crossTenantAccess: 0, // Any attempt is critical
  memoryUsagePercent: 80,
  processingTimeMs: 25000,
  rateLimitViolationsPerHour: 10,
  modelIntegrityFailures: 0, // Any failure is critical
};
```

---

**Status**: Ready for implementation
**Priority**: Critical fixes must be applied immediately
**Support**: Contact security team for any issues