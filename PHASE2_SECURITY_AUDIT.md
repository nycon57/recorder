# Phase 2 Semantic Chunking - Security Audit Report

**Audit Date:** October 12, 2025
**Auditor:** Security Specialist
**Scope:** Phase 2 Semantic Chunking Implementation
**Risk Level:** MEDIUM-HIGH

## Executive Summary

The Phase 2 semantic chunking implementation introduces several security concerns ranging from input validation issues to potential resource exhaustion attacks. While the core functionality is well-structured, there are critical vulnerabilities that must be addressed before production deployment.

## Critical Findings

### 1. **[CRITICAL] Environment Variable Injection via parseInt/parseFloat**
**Severity:** HIGH
**Files Affected:**
- `lib/services/semantic-chunker.ts` (lines 31-36)
- `lib/services/semantic-chunker-improved.ts` (lines 109-114)

**Issue:**
```typescript
minSize: parseInt(process.env.SEMANTIC_CHUNK_MIN_SIZE || '200'),
maxSize: parseInt(process.env.SEMANTIC_CHUNK_MAX_SIZE || '800'),
```

Environment variables are parsed without validation. Malformed values could cause:
- NaN propagation leading to unexpected behavior
- Integer overflow/underflow
- Negative values breaking chunk logic

**Remediation:**
```typescript
const parseEnvInt = (key: string, defaultValue: number, min: number, max: number): number => {
  const value = parseInt(process.env[key] || String(defaultValue));
  if (isNaN(value) || value < min || value > max) {
    console.warn(`Invalid ${key}, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Usage
minSize: parseEnvInt('SEMANTIC_CHUNK_MIN_SIZE', 200, 10, 10000),
```

### 2. **[HIGH] Regular Expression Denial of Service (ReDoS)**
**Severity:** HIGH
**Files Affected:**
- `lib/services/semantic-chunker.ts` (lines 134, 156-180)
- `lib/services/content-classifier.ts` (lines 90-92)

**Issue:**
Multiple regex patterns with potential catastrophic backtracking:
```typescript
// Vulnerable pattern
const codeBlockPattern = /```[\s\S]*?```/g;  // Unbounded quantifier
const listPattern = /(?:^|\n)((?:[*\-+]\s+.+\n?)+)/g;  // Nested quantifiers
```

**Attack Vector:**
Large inputs with specific patterns could cause CPU exhaustion:
```
```````````````... (thousands of backticks)
```

**Remediation:**
```typescript
// Add input size limits
const MAX_INPUT_SIZE = 1_000_000; // 1MB
if (text.length > MAX_INPUT_SIZE) {
  throw new Error('Input exceeds maximum size limit');
}

// Use safer patterns with bounded quantifiers
const codeBlockPattern = /```[\s\S]{0,50000}?```/g;  // Limit content size

// Add timeout wrapper
const withTimeout = async (fn: Function, timeout: number) => {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeout)
    )
  ]);
};
```

### 3. **[HIGH] Memory Exhaustion via Embedding Generation**
**Severity:** HIGH
**Files Affected:**
- `lib/services/semantic-chunker.ts` (lines 206-236)
- `lib/workers/handlers/embeddings-google.ts` (lines 215-276)

**Issue:**
Unbounded parallel embedding generation could exhaust memory:
```typescript
// Processing all sentences in parallel
const results = await Promise.all(
  batch.map(async (sentence) => {
    const output = await this.embedder!(sentence, {...});
    return Array.from(output.data as Float32Array);
  })
);
```

**Attack Vector:**
- Document with thousands of sentences
- Each embedding ~1.5KB (384 dimensions × 4 bytes)
- 10,000 sentences = ~15MB just for embeddings

**Remediation:**
```typescript
// Add memory monitoring
const getMemoryUsage = () => process.memoryUsage().heapUsed / 1024 / 1024;
const MAX_MEMORY_MB = 500;

// Process with memory checks
for (let i = 0; i < sentences.length; i += batchSize) {
  if (getMemoryUsage() > MAX_MEMORY_MB) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (global.gc) global.gc();
  }
  // Process batch...
}
```

### 4. **[MEDIUM] Unsafe Model Loading from Remote Source**
**Severity:** MEDIUM
**Files Affected:**
- `lib/services/semantic-chunker.ts` (lines 45-58)
- `lib/services/semantic-chunker-improved.ts` (lines 50-68)

**Issue:**
Model loaded from HuggingFace without integrity verification:
```typescript
this.embedder = await pipeline('feature-extraction', modelName, {
  quantized: true,
});
```

**Risks:**
- Supply chain attack via compromised model
- Model substitution attack
- Malicious model execution

**Remediation:**
```typescript
// Whitelist allowed models
const ALLOWED_MODELS = new Set([
  'Xenova/all-MiniLM-L6-v2',
  'Xenova/all-MiniLM-L12-v2'
]);

const modelName = process.env.SENTENCE_TRANSFORMER_MODEL || 'Xenova/all-MiniLM-L6-v2';
if (!ALLOWED_MODELS.has(modelName)) {
  throw new Error(`Model ${modelName} not in allowed list`);
}

// Add CSP headers for model downloads
env.remoteURL = 'https://huggingface.co/';
env.allowLocalModels = false;
```

### 5. **[MEDIUM] Cross-Organization Data Leakage Risk**
**Severity:** MEDIUM
**Files Affected:**
- `lib/workers/handlers/embeddings-google.ts` (lines 249-269)

**Issue:**
Metadata stored without proper sanitization:
```typescript
embeddingRecords.push({
  metadata: {
    source: chunk.source,
    ...chunk.metadata,  // Unvalidated spread
  },
});
```

**Risk:**
Metadata could contain sensitive information from other organizations if job processing is compromised.

**Remediation:**
```typescript
// Sanitize metadata before storage
const sanitizeMetadata = (metadata: any): Record<string, any> => {
  const allowed = ['chunkIndex', 'startTime', 'endTime', 'contentType'];
  const sanitized: Record<string, any> = {};

  for (const key of allowed) {
    if (key in metadata && typeof metadata[key] !== 'object') {
      sanitized[key] = metadata[key];
    }
  }
  return sanitized;
};
```

### 6. **[MEDIUM] Type Confusion with 'any' Usage**
**Severity:** MEDIUM
**Files Affected:**
- `lib/services/semantic-chunker.ts` (line 26: `private embedder: any`)

**Issue:**
Using 'any' type bypasses TypeScript safety:
```typescript
private embedder: any | null = null;
```

**Remediation:**
Use proper typing as shown in improved version:
```typescript
type FeatureExtractionPipeline = Awaited<ReturnType<typeof pipeline>>;
private embedder: FeatureExtractionPipeline | null = null;
```

## Additional Security Concerns

### 7. **[LOW] Missing Rate Limiting**
**Severity:** LOW
**Impact:** DoS via repeated chunking requests

**Remediation:**
Add rate limiting at the API layer:
```typescript
const rateLimiter = new Map<string, number[]>();
const RATE_LIMIT = 10; // requests
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(orgId: string): boolean {
  const now = Date.now();
  const requests = rateLimiter.get(orgId) || [];
  const recent = requests.filter(t => now - t < RATE_WINDOW);

  if (recent.length >= RATE_LIMIT) {
    return false;
  }

  recent.push(now);
  rateLimiter.set(orgId, recent);
  return true;
}
```

### 8. **[LOW] Insufficient Input Validation**
**Severity:** LOW
**Files:** All service files

**Issue:**
No Zod schemas for input validation.

**Remediation:**
Add validation schemas:
```typescript
import { z } from 'zod';

const ChunkingInputSchema = z.object({
  text: z.string().min(1).max(1_000_000),
  metadata: z.record(z.unknown()).optional(),
});

// Validate before processing
const validated = ChunkingInputSchema.parse(input);
```

## Security Best Practices to Implement

### 1. Input Validation Layer
```typescript
class InputValidator {
  static validateText(text: string): string {
    // Size limits
    if (text.length > 1_000_000) {
      throw new Error('Text exceeds maximum size');
    }

    // Sanitize null bytes
    text = text.replace(/\0/g, '');

    // Check for binary content
    if (!/^[\x20-\x7E\s]*$/.test(text.substring(0, 1000))) {
      throw new Error('Binary content detected');
    }

    return text;
  }
}
```

### 2. Resource Monitoring
```typescript
class ResourceMonitor {
  private startTime = Date.now();
  private maxDuration = 30000; // 30 seconds

  checkTimeout(): void {
    if (Date.now() - this.startTime > this.maxDuration) {
      throw new Error('Operation timeout');
    }
  }

  checkMemory(): void {
    const used = process.memoryUsage().heapUsed / 1024 / 1024;
    if (used > 500) {
      throw new Error('Memory limit exceeded');
    }
  }
}
```

### 3. Secure Configuration
```typescript
// config/security.ts
export const SECURITY_CONFIG = {
  MAX_INPUT_SIZE: 1_000_000,
  MAX_CHUNK_COUNT: 1000,
  MAX_PROCESSING_TIME: 30000,
  MAX_MEMORY_MB: 500,
  ALLOWED_MODELS: ['Xenova/all-MiniLM-L6-v2'],
  RATE_LIMIT: {
    requests: 10,
    window: 60000,
  },
} as const;
```

### 4. Error Handling
```typescript
class SecureError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    // Don't leak internal details
    this.stack = undefined;
  }
}

// Usage
throw new SecureError('Invalid input', 'INVALID_INPUT', 400);
```

## Testing Requirements

### Security Test Cases
```typescript
describe('Security Tests', () => {
  test('should handle ReDoS attack patterns', async () => {
    const malicious = '```' + '`'.repeat(10000);
    await expect(chunker.chunk(malicious)).rejects.toThrow('timeout');
  });

  test('should prevent memory exhaustion', async () => {
    const large = 'sentence. '.repeat(100000);
    await expect(chunker.chunk(large)).rejects.toThrow('Memory limit');
  });

  test('should validate environment variables', () => {
    process.env.SEMANTIC_CHUNK_MIN_SIZE = 'not-a-number';
    const config = new ChunkingConfig();
    expect(config.minSize).toBe(200); // default
  });

  test('should sanitize metadata', () => {
    const metadata = {
      safe: 'value',
      unsafe: { nested: 'object' },
      script: '<script>alert(1)</script>'
    };
    const sanitized = sanitizeMetadata(metadata);
    expect(sanitized.unsafe).toBeUndefined();
  });
});
```

## Immediate Action Items

1. **[CRITICAL]** Fix environment variable parsing with validation
2. **[CRITICAL]** Add input size limits and timeout protection
3. **[HIGH]** Implement regex timeout protection
4. **[HIGH]** Add memory monitoring for embedding generation
5. **[MEDIUM]** Whitelist allowed models
6. **[MEDIUM]** Sanitize metadata before storage
7. **[LOW]** Add rate limiting
8. **[LOW]** Implement comprehensive input validation

## Compliance Checklist

- [ ] **OWASP Top 10 Coverage**
  - [x] A03:2021 - Injection (regex, env vars)
  - [x] A04:2021 - Insecure Design (resource limits)
  - [x] A05:2021 - Security Misconfiguration (model loading)
  - [x] A06:2021 - Vulnerable Components (@xenova/transformers)
  - [x] A08:2021 - Software and Data Integrity Failures (model verification)

- [ ] **Security Headers** (for model downloading)
  - [ ] Content-Security-Policy
  - [ ] X-Content-Type-Options
  - [ ] X-Frame-Options

- [ ] **Data Protection**
  - [x] Organization isolation via RLS
  - [ ] Input sanitization
  - [ ] Output encoding

## Conclusion

The Phase 2 semantic chunking implementation has a solid foundation but requires immediate security hardening before production deployment. The most critical issues are around input validation, resource exhaustion protection, and regex safety. The improved version (`semantic-chunker-improved.ts`) addresses some concerns but still needs the security enhancements outlined above.

**Recommendation:** DO NOT DEPLOY to production until at least all CRITICAL and HIGH severity issues are resolved.

## References

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Regular Expression Denial of Service](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [Node.js Security Best Practices](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)