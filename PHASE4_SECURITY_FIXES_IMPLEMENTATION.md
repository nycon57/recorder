# Phase 4 Security Fixes - Implementation Guide

**Priority**: P0 CRITICAL - Must be fixed immediately
**Estimated Time**: 5-6 hours for critical fixes, 2-3 days for all P0/P1 issues

---

## P0 CRITICAL FIXES (Do These First!)

### Fix #1: FFmpeg Command Injection (30 minutes)

**File**: `/lib/services/frame-extraction.ts`

Replace the vulnerable `extractUniformFrames` function (lines 184-203):

```typescript
/**
 * Extract frames at uniform intervals - SECURE VERSION
 */
function extractUniformFrames(
  videoPath: string,
  outputDir: string,
  fps: number,
  maxFrames: number,
  quality: number
): Promise<void> {
  // Input validation
  if (!Number.isFinite(fps) || fps <= 0 || fps > 30) {
    throw new Error('Invalid fps: must be between 0 and 30');
  }
  if (!Number.isInteger(maxFrames) || maxFrames <= 0 || maxFrames > 1000) {
    throw new Error('Invalid maxFrames: must be between 1 and 1000');
  }
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    throw new Error('Invalid quality: must be between 0 and 100');
  }

  // Sanitize paths
  if (videoPath.includes('..') || outputDir.includes('..')) {
    throw new Error('Path traversal detected');
  }

  const qualityParam = Math.ceil((100 - quality) / 3);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .fps(fps)
      .frames(maxFrames)
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions([
        '-q:v', qualityParam.toString() // Pass as separate arguments, not interpolated
      ])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
```

Replace the vulnerable `extractSceneChangeFrames` function (lines 208-236):

```typescript
/**
 * Extract frames at scene changes - SECURE VERSION
 */
function extractSceneChangeFrames(
  videoPath: string,
  outputDir: string,
  maxFrames: number,
  quality: number
): Promise<void> {
  // Input validation
  if (!Number.isInteger(maxFrames) || maxFrames <= 0 || maxFrames > 1000) {
    throw new Error('Invalid maxFrames: must be between 1 and 1000');
  }
  if (!Number.isInteger(quality) || quality < 0 || quality > 100) {
    throw new Error('Invalid quality: must be between 0 and 100');
  }

  // Sanitize paths
  if (videoPath.includes('..') || outputDir.includes('..')) {
    throw new Error('Path traversal detected');
  }

  const qualityParam = Math.ceil((100 - quality) / 3);

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .complexFilter([
        {
          filter: 'select',
          options: 'gt(scene\\,0.3)', // Use string, not template literal
          outputs: 'scenes',
        },
        {
          filter: 'select',
          options: `lt(n\\,${maxFrames})`, // Safe - maxFrames is validated
          inputs: 'scenes',
        },
      ])
      .output(path.join(outputDir, 'frame_%04d.jpg'))
      .outputOptions(['-q:v', qualityParam.toString()])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
```

### Fix #2: PII Sanitization in OCR (45 minutes)

**Step 1**: Create `/lib/security/pii-sanitizer.ts`:

```typescript
/**
 * PII Sanitization for OCR and Text Content
 */

export interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

export class PIISanitizer {
  private patterns: PIIPattern[] = [
    // US Social Security Number
    {
      name: 'SSN',
      pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
      replacement: '[REDACTED_SSN]'
    },
    // Credit Card Numbers
    {
      name: 'CREDIT_CARD',
      pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
      replacement: '[REDACTED_CARD]'
    },
    // Email Addresses
    {
      name: 'EMAIL',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[REDACTED_EMAIL]'
    },
    // Phone Numbers (US format)
    {
      name: 'PHONE',
      pattern: /\b(?:\+1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      replacement: '[REDACTED_PHONE]'
    },
    // API Keys and Tokens
    {
      name: 'API_KEY',
      pattern: /\b(?:api[_-]?key|token|secret|password|auth|bearer)[\s:=]["']?[\w-]{20,}["']?/gi,
      replacement: '[REDACTED_SECRET]'
    },
    // AWS Keys
    {
      name: 'AWS_KEY',
      pattern: /\b(?:AKIA|ASIA|AROA|AIDA)[A-Z0-9]{16}\b/g,
      replacement: '[REDACTED_AWS_KEY]'
    },
    // JWT Tokens
    {
      name: 'JWT',
      pattern: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
      replacement: '[REDACTED_JWT]'
    },
    // Private Keys
    {
      name: 'PRIVATE_KEY',
      pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/g,
      replacement: '[REDACTED_PRIVATE_KEY]'
    },
    // IP Addresses
    {
      name: 'IP_ADDRESS',
      pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
      replacement: '[REDACTED_IP]'
    }
  ];

  /**
   * Sanitize text by removing PII
   */
  sanitize(text: string): {
    sanitized: string;
    detectedTypes: string[];
    count: number;
  } {
    let sanitized = text;
    const detectedTypes = new Set<string>();
    let totalCount = 0;

    for (const { name, pattern, replacement } of this.patterns) {
      const matches = text.match(pattern);
      if (matches) {
        detectedTypes.add(name);
        totalCount += matches.length;
        sanitized = sanitized.replace(pattern, replacement);
      }
    }

    return {
      sanitized,
      detectedTypes: Array.from(detectedTypes),
      count: totalCount
    };
  }

  /**
   * Check if text contains PII
   */
  containsPII(text: string): boolean {
    for (const { pattern } of this.patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: PIIPattern): void {
    this.patterns.push(pattern);
  }
}

// Export singleton instance
export const piiSanitizer = new PIISanitizer();
```

**Step 2**: Update `/lib/services/ocr-service.ts`:

```typescript
import Tesseract from 'tesseract.js';
import type { RecognizeResult } from 'tesseract.js';
import { piiSanitizer } from '@/lib/security/pii-sanitizer';

export interface OCRResult {
  text: string;
  originalText?: string; // Store original for debugging (dev only)
  confidence: number;
  blocks: OCRBlock[];
  piiDetected: boolean;
  piiTypes?: string[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
}

/**
 * Perform OCR on image with PII sanitization
 */
export async function extractText(imagePath: string): Promise<OCRResult> {
  const worker = await Tesseract.createWorker('eng');

  try {
    const result: RecognizeResult = await worker.recognize(imagePath);

    // Sanitize main text
    const { sanitized, detectedTypes, count } = piiSanitizer.sanitize(result.data.text);

    // Log if PII detected (without exposing the actual PII)
    if (count > 0) {
      console.warn('[OCR] PII detected and sanitized:', {
        types: detectedTypes,
        count,
        // Only log in development
        ...(process.env.NODE_ENV === 'development' && {
          sample: result.data.text.substring(0, 100) + '...'
        })
      });
    }

    // Sanitize blocks
    const blocks: OCRBlock[] = (result.data.blocks || []).map((block) => ({
      text: piiSanitizer.sanitize(block.text).sanitized,
      confidence: block.confidence,
      bbox: {
        x0: block.bbox.x0,
        y0: block.bbox.y0,
        x1: block.bbox.x1,
        y1: block.bbox.y1,
      },
    }));

    return {
      text: sanitized,
      originalText: process.env.NODE_ENV === 'development' ? result.data.text : undefined,
      confidence: result.data.confidence,
      blocks,
      piiDetected: count > 0,
      piiTypes: count > 0 ? detectedTypes : undefined
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Extract text from frame with filtering and sanitization
 */
export async function extractFrameText(
  imagePath: string,
  confidenceThreshold?: number
): Promise<OCRResult> {
  const threshold =
    confidenceThreshold ||
    parseInt(process.env.OCR_CONFIDENCE_THRESHOLD || '70');

  const result = await extractText(imagePath);

  // Filter low-confidence blocks
  const filteredBlocks = result.blocks.filter(
    (block) => block.confidence >= threshold
  );

  const filteredText = filteredBlocks.map((b) => b.text).join(' ');

  return {
    ...result,
    text: filteredText,
    blocks: filteredBlocks,
  };
}
```

---

## P1 HIGH PRIORITY FIXES

### Fix #3: Input Validation on API Routes (1 hour)

**File**: `/app/api/recordings/[id]/frames/route.ts`

Already partially fixed based on the modified file. Add additional validation:

```typescript
import { z } from 'zod';

// Add at top of file
const uuidSchema = z.string().uuid();

// In GET handler, validate the recording ID
export const GET = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { orgId } = await requireOrg();
  const params = await context.params;

  // Validate recording ID format
  const recordingId = uuidSchema.parse(params.id);

  // Rest of implementation...
});

// In POST handler, add rate limiting
export const POST = apiHandler(async (request: NextRequest, context: RouteContext) => {
  const { orgId, userId } = await requireOrg();
  const params = await context.params;
  const recordingId = uuidSchema.parse(params.id);

  // Rate limiting
  const rateLimitKey = `frame-extraction:${orgId}`;
  const { allowed, remaining } = await frameExtractionRateLimiter.checkLimit(rateLimitKey);

  if (!allowed) {
    return errors.tooManyRequests(
      'Frame extraction rate limit exceeded. Please try again later.',
      { remaining, resetIn: 60000 }
    );
  }

  // Rest of implementation...
});
```

### Fix #4: Remove SQL Injection Risk (1.5 hours)

**File**: `/lib/services/multimodal-search.ts`

Replace the raw SQL with Supabase query builder:

```typescript
export async function visualSearch(
  query: string,
  options: VisualSearchOptions
): Promise<VisualSearchResult[]> {
  const {
    orgId,
    limit = 20,
    threshold = 0.7,
    recordingIds,
    includeOcr = true,
    dateFrom,
    dateTo,
  } = options;

  // Input validation
  const validOrgId = z.string().uuid().parse(orgId);
  const validLimit = z.number().int().min(1).max(100).parse(limit);
  const validThreshold = z.number().min(0).max(1).parse(threshold);

  // Generate embedding for query
  const queryEmbedding = await generateEmbedding(query);

  // Use Supabase query builder instead of raw SQL
  let queryBuilder = supabaseAdmin
    .from('video_frames')
    .select(`
      id,
      recording_id,
      frame_time_sec,
      frame_url,
      visual_description,
      ocr_text,
      metadata,
      created_at,
      recordings!inner (
        id,
        title,
        duration_sec,
        created_at
      )
    `)
    .eq('org_id', validOrgId)
    .not('visual_embedding', 'is', null);

  // Apply filters
  if (recordingIds && recordingIds.length > 0) {
    const validRecordingIds = recordingIds.map(id => z.string().uuid().parse(id));
    queryBuilder = queryBuilder.in('recording_id', validRecordingIds);
  }

  if (dateFrom) {
    queryBuilder = queryBuilder.gte('recordings.created_at', dateFrom.toISOString());
  }

  if (dateTo) {
    queryBuilder = queryBuilder.lte('recordings.created_at', dateTo.toISOString());
  }

  // Execute query
  const { data: frames, error } = await queryBuilder.limit(validLimit);

  if (error) {
    console.error('[visualSearch] Error:', error);
    throw new Error(`Visual search failed: ${error.message}`);
  }

  // Calculate similarities in application layer
  const results = frames
    .map(frame => ({
      ...frame,
      similarity: cosineSimilarity(queryEmbedding, frame.visual_embedding)
    }))
    .filter(frame => frame.similarity >= validThreshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, validLimit);

  // Generate presigned URLs for frames
  for (const result of results) {
    if (result.frame_url) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('frames')
        .createSignedUrl(result.frame_url, 3600);

      if (urlData?.signedUrl) {
        result.frameUrl = urlData.signedUrl;
      }
    }
  }

  return results;
}

// Helper function for cosine similarity
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same dimension');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}
```

### Fix #5: Implement Rate Limiting (1 hour)

**File**: `/lib/rate-limit/middleware.ts`

Create a rate limiting middleware:

```typescript
import { Redis } from '@upstash/redis';
import { errors } from '@/lib/utils/api';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface RateLimitConfig {
  limiter: 'search' | 'frames' | 'extraction' | 'ocr';
  identifier: (req: Request) => Promise<string>;
}

const RATE_LIMITS = {
  search: { max: 30, window: 60000 }, // 30 per minute
  frames: { max: 100, window: 60000 }, // 100 per minute
  extraction: { max: 5, window: 60000 }, // 5 per minute
  ocr: { max: 20, window: 60000 }, // 20 per minute
};

export function withRateLimit(
  handler: Function,
  config: RateLimitConfig
) {
  return async (req: Request, ...args: any[]) => {
    const identifier = await config.identifier(req);
    const key = `ratelimit:${config.limiter}:${identifier}`;
    const limit = RATE_LIMITS[config.limiter];

    const now = Date.now();
    const window = Math.floor(now / limit.window);
    const windowKey = `${key}:${window}`;

    // Increment counter
    const count = await redis.incr(windowKey);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(windowKey, Math.ceil(limit.window / 1000));
    }

    // Check if limit exceeded
    if (count > limit.max) {
      const resetAt = (window + 1) * limit.window;
      const retryAfter = Math.ceil((resetAt - now) / 1000);

      return errors.tooManyRequests(
        `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        {
          limit: limit.max,
          remaining: 0,
          reset: new Date(resetAt).toISOString(),
          retryAfter
        }
      );
    }

    // Add rate limit headers to response
    const response = await handler(req, ...args);

    if (response instanceof Response) {
      response.headers.set('X-RateLimit-Limit', String(limit.max));
      response.headers.set('X-RateLimit-Remaining', String(limit.max - count));
      response.headers.set('X-RateLimit-Reset', new Date((window + 1) * limit.window).toISOString());
    }

    return response;
  };
}
```

---

## P2 MEDIUM PRIORITY FIXES

### Fix #6: Storage Path Validation (30 minutes)

**File**: `/lib/services/frame-extraction.ts`

Add this function at the top of the file:

```typescript
/**
 * Create a secure storage path with validation
 */
function createSecureStoragePath(
  orgId: string,
  recordingId: string,
  frameNumber: number
): string {
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(orgId)) {
    throw new Error(`Invalid org ID format: ${orgId}`);
  }

  if (!uuidRegex.test(recordingId)) {
    throw new Error(`Invalid recording ID format: ${recordingId}`);
  }

  if (!Number.isInteger(frameNumber) || frameNumber < 1 || frameNumber > 99999) {
    throw new Error(`Invalid frame number: ${frameNumber}`);
  }

  // Additional sanitization (defense in depth)
  const sanitizedOrgId = orgId.toLowerCase().replace(/[^0-9a-f-]/g, '');
  const sanitizedRecordingId = recordingId.toLowerCase().replace(/[^0-9a-f-]/g, '');

  if (sanitizedOrgId !== orgId || sanitizedRecordingId !== recordingId) {
    throw new Error('Invalid characters in IDs');
  }

  return `${sanitizedOrgId}/${sanitizedRecordingId}/frames/frame_${frameNumber.toString().padStart(4, '0')}.jpg`;
}
```

Update line 131 in the same file:

```typescript
// Replace line 131
const storagePath = createSecureStoragePath(orgId, recordingId, frameNumber);
```

### Fix #7: Enhanced RLS Policies (45 minutes)

Create migration file `/supabase/migrations/024_phase4_security_fixes.sql`:

```sql
-- Phase 4 Security Fixes
-- Fix RLS policies for video_frames table

-- Drop overly permissive service role policy
DROP POLICY IF EXISTS "Service role can manage all frames" ON video_frames;

-- Create more restrictive service role policies
CREATE POLICY "Service role can insert frames during job processing"
ON video_frames FOR INSERT
TO service_role
WITH CHECK (
  -- Ensure there's an active job for this recording
  EXISTS (
    SELECT 1 FROM jobs
    WHERE type = 'extract_frames'
    AND status IN ('pending', 'processing')
    AND (payload->>'recordingId')::uuid = recording_id
    AND org_id = video_frames.org_id
  )
);

CREATE POLICY "Service role can update frames during job processing"
ON video_frames FOR UPDATE
TO service_role
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE type IN ('extract_frames', 'generate_embeddings')
    AND status IN ('pending', 'processing')
    AND (payload->>'recordingId')::uuid = recording_id
  )
);

-- Add audit logging trigger
CREATE OR REPLACE FUNCTION log_frame_access()
RETURNS TRIGGER AS $$
BEGIN
  -- Log frame access for security audit
  IF TG_OP = 'SELECT' THEN
    INSERT INTO audit_logs (
      table_name,
      operation,
      user_id,
      org_id,
      record_id,
      metadata,
      created_at
    ) VALUES (
      'video_frames',
      TG_OP,
      auth.uid(),
      OLD.org_id,
      OLD.id,
      jsonb_build_object(
        'recording_id', OLD.recording_id,
        'frame_number', OLD.frame_number
      ),
      now()
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit_logs table if not exists
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id TEXT,
  org_id UUID,
  record_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
ON audit_logs(org_id, created_at DESC);

-- Add RLS to audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text AND role IN ('owner', 'admin')));
```

---

## Testing Script

Create `/__tests__/security/phase4-fixes.test.ts`:

```typescript
import { PIISanitizer } from '@/lib/security/pii-sanitizer';
import { extractUniformFrames } from '@/lib/services/frame-extraction';

describe('Phase 4 Security Fixes', () => {
  describe('PII Sanitization', () => {
    const sanitizer = new PIISanitizer();

    test('should sanitize SSN', () => {
      const text = 'My SSN is 123-45-6789';
      const result = sanitizer.sanitize(text);

      expect(result.sanitized).toBe('My SSN is [REDACTED_SSN]');
      expect(result.detectedTypes).toContain('SSN');
      expect(result.count).toBe(1);
    });

    test('should sanitize credit cards', () => {
      const text = 'Card: 4111 1111 1111 1111';
      const result = sanitizer.sanitize(text);

      expect(result.sanitized).toBe('Card: [REDACTED_CARD]');
      expect(result.detectedTypes).toContain('CREDIT_CARD');
    });

    test('should sanitize API keys', () => {
      const text = 'api_key=sk_test_abcdef123456789';
      const result = sanitizer.sanitize(text);

      expect(result.sanitized).toContain('[REDACTED_SECRET]');
      expect(result.detectedTypes).toContain('API_KEY');
    });

    test('should handle multiple PII types', () => {
      const text = 'Email: john@example.com, Phone: 555-123-4567';
      const result = sanitizer.sanitize(text);

      expect(result.sanitized).toBe('Email: [REDACTED_EMAIL], Phone: [REDACTED_PHONE]');
      expect(result.detectedTypes).toContain('EMAIL');
      expect(result.detectedTypes).toContain('PHONE');
      expect(result.count).toBe(2);
    });
  });

  describe('FFmpeg Command Injection Prevention', () => {
    test('should reject invalid quality values', async () => {
      await expect(
        extractUniformFrames('/tmp/video.mp4', '/tmp/frames', 1, 10, 'abc' as any)
      ).rejects.toThrow('Invalid quality');

      await expect(
        extractUniformFrames('/tmp/video.mp4', '/tmp/frames', 1, 10, -1)
      ).rejects.toThrow('Invalid quality');

      await expect(
        extractUniformFrames('/tmp/video.mp4', '/tmp/frames', 1, 10, 101)
      ).rejects.toThrow('Invalid quality');
    });

    test('should reject path traversal', async () => {
      await expect(
        extractUniformFrames('../../../etc/passwd', '/tmp/frames', 1, 10, 85)
      ).rejects.toThrow('Path traversal detected');

      await expect(
        extractUniformFrames('/tmp/video.mp4', '../../tmp/frames', 1, 10, 85)
      ).rejects.toThrow('Path traversal detected');
    });

    test('should reject invalid fps values', async () => {
      await expect(
        extractUniformFrames('/tmp/video.mp4', '/tmp/frames', -1, 10, 85)
      ).rejects.toThrow('Invalid fps');

      await expect(
        extractUniformFrames('/tmp/video.mp4', '/tmp/frames', 100, 10, 85)
      ).rejects.toThrow('Invalid fps');
    });
  });

  describe('Storage Path Validation', () => {
    test('should validate UUID format', () => {
      expect(() =>
        createSecureStoragePath('not-a-uuid', 'abc', 1)
      ).toThrow('Invalid org ID format');

      expect(() =>
        createSecureStoragePath('550e8400-e29b-41d4-a716-446655440000', 'not-a-uuid', 1)
      ).toThrow('Invalid recording ID format');
    });

    test('should validate frame number', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';

      expect(() =>
        createSecureStoragePath(validUuid, validUuid, -1)
      ).toThrow('Invalid frame number');

      expect(() =>
        createSecureStoragePath(validUuid, validUuid, 100000)
      ).toThrow('Invalid frame number');

      expect(() =>
        createSecureStoragePath(validUuid, validUuid, 1.5)
      ).toThrow('Invalid frame number');
    });

    test('should create valid paths', () => {
      const orgId = '550e8400-e29b-41d4-a716-446655440000';
      const recordingId = '123e4567-e89b-12d3-a456-426614174000';

      const path = createSecureStoragePath(orgId, recordingId, 42);

      expect(path).toBe(
        '550e8400-e29b-41d4-a716-446655440000/123e4567-e89b-12d3-a456-426614174000/frames/frame_0042.jpg'
      );
    });
  });
});
```

---

## Deployment Checklist

### Before Deployment

#### P0 Critical (Must Do)
- [ ] Apply FFmpeg command injection fix
- [ ] Deploy PII sanitization module
- [ ] Update OCR service with sanitization
- [ ] Test PII detection and sanitization

#### P1 High Priority (Should Do)
- [ ] Add input validation to all API routes
- [ ] Remove SQL injection risks
- [ ] Implement rate limiting
- [ ] Deploy rate limit middleware

#### P2 Medium Priority (Nice to Have)
- [ ] Add storage path validation
- [ ] Apply RLS policy migration
- [ ] Add memory monitoring
- [ ] Implement audit logging

### Verification Steps

1. **Test FFmpeg Security**:
```bash
# Try command injection (should fail)
curl -X POST /api/recordings/[id]/frames \
  -d '{"quality": "85; rm -rf /"}' \
  # Should return: Invalid quality error
```

2. **Test PII Sanitization**:
```bash
# Create test frame with PII
# Verify OCR output has [REDACTED_*] placeholders
```

3. **Test Rate Limiting**:
```bash
# Make multiple rapid requests
for i in {1..10}; do
  curl -X POST /api/search/visual -d '{"query": "test"}'
done
# Should get rate limit error after 5th request
```

4. **Verify RLS Policies**:
```sql
-- In Supabase SQL editor
SELECT * FROM video_frames WHERE org_id != 'your-org-id';
-- Should return 0 rows
```

---

## Environment Variables

Add these to `.env`:

```env
# Security Configuration
ENABLE_PII_DETECTION=true
ENABLE_VISUAL_SEARCH=true
OCR_CONFIDENCE_THRESHOLD=70
FRAME_EXTRACTION_FPS=0.5
FRAME_EXTRACTION_MAX_FRAMES=300
FRAME_QUALITY=85
FRAMES_STORAGE_BUCKET=video-frames

# Rate Limiting
RATE_LIMIT_SEARCH_MAX=30
RATE_LIMIT_SEARCH_WINDOW=60000
RATE_LIMIT_EXTRACTION_MAX=5
RATE_LIMIT_EXTRACTION_WINDOW=60000
```

---

## Post-Deployment Monitoring

Monitor these metrics:
- PII detection rate (should be > 0 if working)
- Rate limit violations (track abusive users)
- FFmpeg processing errors (should be 0)
- OCR confidence scores (track quality)

Set up alerts for:
- Any command injection attempts
- Excessive PII detections from single user
- Rate limit violations > 10/hour
- Failed frame extractions

---

**Status**: Ready for implementation
**Priority**: P0 fixes are CRITICAL and must be done first
**Time Estimate**: 5-6 hours for P0, 2-3 days for all fixes