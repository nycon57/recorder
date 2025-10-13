# Phase 4 Advanced Video Processing - Security Audit Report

**Date**: 2025-10-12
**Auditor**: Claude (Security Specialist)
**Phase**: Phase 4 - Advanced Video Processing
**Status**: PRE-IMPLEMENTATION AUDIT

---

## Executive Summary

This security audit evaluates the proposed Phase 4 Advanced Video Processing implementation, focusing on frame extraction, visual indexing, OCR, and multimodal search capabilities. The audit identifies critical security vulnerabilities that must be addressed before implementation, with special attention to the RLS policy issues that have affected previous phases.

### Overall Risk Assessment: HIGH RISK

**Key Findings**:
- **P0 CRITICAL**: RLS policies in existing `video_frames` table use incorrect authentication pattern
- **P0 CRITICAL**: Missing service role authorization checks for frame extraction jobs
- **P1 HIGH**: No input sanitization for FFmpeg commands (command injection risk)
- **P1 HIGH**: Missing storage bucket configuration and permissions
- **P2 MEDIUM**: OCR output not sanitized for PII/sensitive data
- **P2 MEDIUM**: No rate limiting for resource-intensive operations

---

## 1. Database Security Assessment

### 1.1 RLS Policy Analysis - CRITICAL

#### Current State (Migration 012)

**CRITICAL ISSUE FOUND**: The `video_frames` table created in migration 012 has the same RLS authentication bug found in other tables.

```sql
-- CURRENT (INCORRECT) - Line 75 of migration 012
CREATE POLICY "Users can view frames from their org"
  ON video_frames FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
  -- ❌ WRONG: Uses id instead of clerk_id
```

**Impact**: Users cannot access video frames. Feature is completely broken.

**FIXED IN**: Migration 016 corrects this:
```sql
-- CORRECTED (Migration 016, lines 40-43)
CREATE POLICY "Users can view frames from their org"
  ON video_frames FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));
```

**Status**: ✅ Fixed if migration 016 has been applied

#### Missing RLS Policies

**CRITICAL GAP**: No INSERT/UPDATE/DELETE policies for service role frame management:

```sql
-- MISSING: Service role needs explicit policies for frame management
CREATE POLICY "Service role can insert frames"
  ON video_frames FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update frames"
  ON video_frames FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can delete frames"
  ON video_frames FOR DELETE
  TO service_role
  USING (true);
```

### 1.2 Table Structure Security Review

#### video_frames Table (Migration 012)

**Good Practices**:
- ✅ Proper CASCADE DELETE on foreign keys
- ✅ org_id included for multi-tenancy
- ✅ CHECK constraint on frame_time_sec
- ✅ Vector dimension validation

**Security Concerns**:
- ⚠️ `frame_url` stored as TEXT (no validation)
- ⚠️ `ocr_text` not sanitized
- ⚠️ `metadata` JSONB can contain arbitrary data
- ⚠️ No constraints on visual_description length

**Recommended Additions**:
```sql
-- Add constraints for data integrity
ALTER TABLE video_frames
ADD CONSTRAINT check_frame_url_format
  CHECK (frame_url ~ '^[a-zA-Z0-9/_.-]+\.(jpg|jpeg|png|webp)$'),
ADD CONSTRAINT check_description_length
  CHECK (char_length(visual_description) <= 5000),
ADD CONSTRAINT check_ocr_text_length
  CHECK (char_length(ocr_text) <= 10000);

-- Add audit columns
ALTER TABLE video_frames
ADD COLUMN processed_by UUID REFERENCES users(id),
ADD COLUMN processing_error TEXT;
```

### 1.3 Index Security Analysis

**Performance Indexes Present**:
- ✅ idx_video_frames_recording_id
- ✅ idx_video_frames_org_id
- ✅ idx_video_frames_time
- ✅ idx_video_frames_embedding (IVFFlat)

**Missing Security-Related Indexes**:
```sql
-- Add index for access pattern monitoring
CREATE INDEX idx_video_frames_access_pattern
  ON video_frames(org_id, created_at DESC);

-- Add partial index for failed processing
CREATE INDEX idx_video_frames_errors
  ON video_frames(recording_id)
  WHERE processing_error IS NOT NULL;
```

---

## 2. File Storage Security

### 2.1 Supabase Storage Configuration

**CRITICAL**: No storage bucket exists for video frames yet.

**Required Bucket Configuration**:
```sql
-- Create storage bucket with proper permissions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-frames',
  'video-frames',
  false, -- MUST be private
  5242880, -- 5MB max per frame
  ARRAY['image/jpeg', 'image/png', 'image/webp']
);

-- RLS policies for bucket
CREATE POLICY "Users can view frames from their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'video-frames' AND
    (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM users WHERE clerk_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role can manage all frames"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'video-frames')
  WITH CHECK (bucket_id = 'video-frames');
```

### 2.2 Path Structure Security

**CRITICAL**: Frame paths must include org_id for isolation:

```typescript
// SECURE: Org-scoped path structure
const storagePath = `${orgId}/${recordingId}/frames/frame_${frameNumber}.jpg`;

// INSECURE: Missing org isolation
const badPath = `frames/${recordingId}/frame_${frameNumber}.jpg`; // ❌ NO!
```

**Validation Required**:
```typescript
function validateStoragePath(path: string, orgId: string): boolean {
  // Path MUST start with orgId
  if (!path.startsWith(`${orgId}/`)) {
    throw new Error('Invalid storage path: missing org scope');
  }

  // Path MUST NOT contain traversal attempts
  if (path.includes('../') || path.includes('..\\')) {
    throw new Error('Path traversal detected');
  }

  // Path MUST match expected format
  const validPattern = new RegExp(
    `^${orgId}/[a-f0-9-]+/frames/frame_\\d{4}\\.(jpg|png|webp)$`
  );

  if (!validPattern.test(path)) {
    throw new Error('Invalid storage path format');
  }

  return true;
}
```

### 2.3 Presigned URL Security

**Requirements**:
- ✅ URLs must expire (max 1 hour)
- ✅ Include org_id in path validation
- ✅ Never expose permanent URLs
- ✅ Validate user has access before generating

```typescript
async function getFrameUrl(
  frameId: string,
  userId: string,
  orgId: string
): Promise<string> {
  const supabase = await createClient();

  // Verify user has access to frame
  const { data: frame, error } = await supabase
    .from('video_frames')
    .select('frame_url, org_id')
    .eq('id', frameId)
    .eq('org_id', orgId) // CRITICAL: Org isolation
    .single();

  if (error || !frame) {
    throw new Error('Frame not found or access denied');
  }

  // Generate time-limited presigned URL
  const { data: url } = await supabase.storage
    .from('video-frames')
    .createSignedUrl(frame.frame_url, 3600); // 1 hour expiry

  return url.signedUrl;
}
```

---

## 3. API Security

### 3.1 Authentication & Authorization

**Phase 4 API Routes to Secure**:

#### `/api/recordings/[id]/frames` - GET frames for recording

```typescript
export const GET = apiHandler(async (request: NextRequest, { params }) => {
  // CRITICAL: Must use requireOrg for org isolation
  const { orgId, userId } = await requireOrg();
  const recordingId = params.id;

  // Verify recording belongs to org
  const { data: recording } = await supabase
    .from('recordings')
    .select('id')
    .eq('id', recordingId)
    .eq('org_id', orgId) // CRITICAL: Org check
    .single();

  if (!recording) {
    return errors.notFound('Recording');
  }

  // Get frames with org validation
  const { data: frames } = await supabase
    .from('video_frames')
    .select('*')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId) // REDUNDANT but safer
    .order('frame_time_sec');

  return successResponse(frames);
});
```

#### `/api/search/visual` - Visual search endpoint

```typescript
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  // CRITICAL: Validate request body
  const body = await parseBody(request, visualSearchSchema);

  // Sanitize query to prevent injection
  const sanitizedQuery = sanitizeSearchQuery(body.query);

  // Rate limiting check
  const rateLimitKey = `visual_search:${orgId}`;
  const isRateLimited = await checkRateLimit(rateLimitKey, {
    maxRequests: 10,
    windowMs: 60000, // 10 requests per minute
  });

  if (isRateLimited) {
    return errors.rateLimitExceeded();
  }

  // Perform search with org isolation
  const results = await visualSearch(sanitizedQuery, {
    orgId,
    limit: Math.min(body.limit || 20, 100), // Cap at 100
  });

  return successResponse(results);
});
```

### 3.2 Input Validation

**Required Zod Schemas**:

```typescript
// lib/validations/api.ts additions

export const frameExtractionSchema = z.object({
  recordingId: z.string().uuid(),
  fps: z.number().min(0.1).max(5).optional(),
  maxFrames: z.number().min(1).max(500).optional(),
  quality: z.number().min(10).max(100).optional(),
});

export const visualSearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(100).optional(),
  recordingIds: z.array(z.string().uuid()).optional(),
  includeOcr: z.boolean().optional(),
});

export const ocrRequestSchema = z.object({
  frameId: z.string().uuid(),
  language: z.enum(['eng', 'spa', 'fra', 'deu']).optional(),
  confidenceThreshold: z.number().min(0).max(100).optional(),
});
```

### 3.3 Rate Limiting

**CRITICAL**: Visual processing is resource-intensive. Must implement rate limiting:

```typescript
// lib/utils/rate-limit.ts

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

export async function checkRateLimit(
  key: string,
  options: RateLimitOptions
): Promise<boolean> {
  const { maxRequests, windowMs } = options;
  const now = Date.now();
  const windowStart = now - windowMs;

  // Use Redis sorted set for sliding window
  const pipeline = redis.pipeline();

  // Remove old entries
  pipeline.zremrangebyscore(key, 0, windowStart);

  // Add current request
  pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });

  // Count requests in window
  pipeline.zcount(key, windowStart, now);

  // Set expiry
  pipeline.expire(key, Math.ceil(windowMs / 1000));

  const results = await pipeline.exec();
  const count = results[2] as number;

  return count > maxRequests;
}
```

---

## 4. External Service Integration Security

### 4.1 FFmpeg Command Injection Prevention

**CRITICAL VULNERABILITY**: FFmpeg commands are vulnerable to injection if paths aren't sanitized.

**INSECURE Example**:
```typescript
// ❌ VULNERABLE TO COMMAND INJECTION
const command = `ffmpeg -i ${videoPath} -fps ${fps} output.jpg`;
```

**SECURE Implementation**:
```typescript
import { spawn } from 'child_process';
import path from 'path';

function secureFfmpegExtract(
  videoPath: string,
  outputDir: string,
  options: FrameExtractionOptions
): Promise<void> {
  // Validate inputs
  if (!path.isAbsolute(videoPath)) {
    throw new Error('Video path must be absolute');
  }

  if (!videoPath.match(/^[a-zA-Z0-9/_.-]+\.(mp4|webm|mov)$/)) {
    throw new Error('Invalid video path format');
  }

  // Use spawn with array args (prevents injection)
  return new Promise((resolve, reject) => {
    const args = [
      '-i', videoPath,
      '-vf', `fps=${options.fps || 0.5}`,
      '-frames:v', String(options.maxFrames || 300),
      '-q:v', String(Math.ceil((100 - (options.quality || 85)) / 3)),
      path.join(outputDir, 'frame_%04d.jpg')
    ];

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: 'pipe',
      shell: false, // CRITICAL: Disable shell
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}
```

### 4.2 Gemini Vision API Security

**Requirements**:
- ✅ API key stored in environment variables
- ✅ Never log API responses with PII
- ✅ Validate response format
- ✅ Handle API errors gracefully

```typescript
async function secureGeminiVision(imageBuffer: Buffer): Promise<VisualDescription> {
  try {
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBuffer.toString('base64'),
        },
      },
      { text: SECURE_PROMPT }, // Use predefined prompt
    ]);

    // Validate response format
    const response = result.response.text();
    const parsed = validateGeminiResponse(response);

    // Sanitize for PII
    return sanitizeVisualDescription(parsed);
  } catch (error) {
    // Log error without exposing sensitive data
    console.error('[Gemini Vision] Processing failed:', {
      error: error.message,
      // DO NOT log imageBuffer or API response
    });
    throw new Error('Visual processing failed');
  }
}
```

### 4.3 Tesseract OCR Security

**Security Concerns**:
- OCR may extract sensitive data (SSN, credit cards, passwords)
- Must sanitize output before storage
- Resource-intensive (DoS potential)

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeOcrText(text: string): string {
  // Remove potential PII patterns
  const patterns = [
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
    /\b(?:password|pwd|pass)[\s:=]+\S+/gi, // Passwords
  ];

  let sanitized = text;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }

  // HTML sanitization
  sanitized = DOMPurify.sanitize(sanitized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  return sanitized.substring(0, 10000); // Limit length
}

async function secureOcrExtraction(
  imagePath: string,
  options: OcrOptions
): Promise<OcrResult> {
  // Resource limit
  const timeout = setTimeout(() => {
    throw new Error('OCR timeout');
  }, 30000); // 30 second timeout

  try {
    const result = await extractText(imagePath);
    clearTimeout(timeout);

    return {
      text: sanitizeOcrText(result.text),
      confidence: result.confidence,
      blocks: result.blocks.map(b => ({
        ...b,
        text: sanitizeOcrText(b.text),
      })),
    };
  } finally {
    clearTimeout(timeout);
  }
}
```

---

## 5. Background Job Security

### 5.1 Job Handler Authorization

**CRITICAL**: Job handlers must verify authorization before processing:

```typescript
// lib/workers/handlers/extract-frames.ts

export async function handleExtractFrames(
  job: Job<ExtractFramesPayload>
): Promise<void> {
  const { recordingId, orgId, videoPath } = job.payload;

  // CRITICAL: Verify recording exists and belongs to org
  const { data: recording, error } = await supabaseAdmin
    .from('recordings')
    .select('id, org_id, status')
    .eq('id', recordingId)
    .eq('org_id', orgId) // MUST match
    .single();

  if (error || !recording) {
    throw new Error('Recording not found or org mismatch');
  }

  // Verify video file exists and is accessible
  if (!await verifyFileAccess(videoPath, orgId)) {
    throw new Error('Video file not accessible');
  }

  // Process with sanitized inputs
  await processFrameExtraction({
    recordingId,
    orgId,
    videoPath: path.normalize(videoPath), // Normalize path
  });
}
```

### 5.2 Payload Validation

**All job payloads must be validated**:

```typescript
// lib/types/jobs.ts

export const extractFramesPayloadSchema = z.object({
  recordingId: z.string().uuid(),
  orgId: z.string().uuid(),
  videoPath: z.string().regex(/^[a-zA-Z0-9/_.-]+\.(mp4|webm|mov)$/),
  options: z.object({
    fps: z.number().min(0.1).max(5).optional(),
    maxFrames: z.number().min(1).max(500).optional(),
    quality: z.number().min(10).max(100).optional(),
  }).optional(),
});

// In handler
const validatedPayload = extractFramesPayloadSchema.parse(job.payload);
```

### 5.3 Error Handling

**Never expose internal errors**:

```typescript
export async function handleExtractFrames(job: Job): Promise<void> {
  try {
    // ... processing logic
  } catch (error) {
    // Log detailed error internally
    console.error('[Frame Extraction] Job failed:', {
      jobId: job.id,
      recordingId: job.payload.recordingId,
      error: error.message,
      stack: error.stack,
    });

    // Store sanitized error in database
    await supabaseAdmin
      .from('video_frames')
      .update({
        processing_error: sanitizeErrorMessage(error.message),
      })
      .eq('recording_id', job.payload.recordingId);

    // Re-throw generic error
    throw new Error('Frame extraction failed');
  }
}

function sanitizeErrorMessage(message: string): string {
  // Remove file paths, credentials, internal details
  return message
    .replace(/\/[^\s]+/g, '[path]')
    .replace(/\b[A-Z0-9]{20,}\b/g, '[key]')
    .substring(0, 500);
}
```

---

## 6. Data Privacy & Compliance

### 6.1 PII Detection and Handling

**Implement PII detection in visual descriptions and OCR**:

```typescript
// lib/services/pii-detector.ts

const PII_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  apiKey: /\b[A-Z0-9]{32,}\b/,
};

export function detectPII(text: string): {
  hasPII: boolean;
  types: string[];
  redacted: string;
} {
  let hasPII = false;
  const types: string[] = [];
  let redacted = text;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    if (pattern.test(text)) {
      hasPII = true;
      types.push(type);
      redacted = redacted.replace(pattern, `[${type.toUpperCase()}]`);
    }
  }

  return { hasPII, types, redacted };
}
```

### 6.2 GDPR Compliance

**Right to Erasure Implementation**:

```typescript
// Ensure cascade deletion works properly
async function deleteUserData(userId: string, orgId: string): Promise<void> {
  // Video frames are deleted via CASCADE on recordings table
  // But ensure storage files are also deleted

  const { data: frames } = await supabaseAdmin
    .from('video_frames')
    .select('frame_url')
    .eq('org_id', orgId);

  if (frames) {
    for (const frame of frames) {
      await supabaseAdmin.storage
        .from('video-frames')
        .remove([frame.frame_url]);
    }
  }

  // Log deletion for compliance
  await auditLog('user_data_deleted', {
    userId,
    orgId,
    timestamp: new Date().toISOString(),
  });
}
```

### 6.3 Data Retention

```typescript
// Implement retention policy
async function enforceRetentionPolicy(): Promise<void> {
  const retentionDays = parseInt(process.env.FRAME_RETENTION_DAYS || '90');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // Delete old frames
  const { data: oldFrames } = await supabaseAdmin
    .from('video_frames')
    .select('id, frame_url')
    .lt('created_at', cutoffDate.toISOString());

  for (const frame of oldFrames || []) {
    // Delete from storage
    await supabaseAdmin.storage
      .from('video-frames')
      .remove([frame.frame_url]);

    // Delete from database
    await supabaseAdmin
      .from('video_frames')
      .delete()
      .eq('id', frame.id);
  }
}
```

---

## 7. Testing Requirements

### 7.1 Security Test Cases

```typescript
// __tests__/security/phase4-security.test.ts

describe('Phase 4 Security Tests', () => {
  describe('RLS Policies', () => {
    it('should prevent cross-tenant frame access', async () => {
      const user1 = await createTestUser('org1');
      const user2 = await createTestUser('org2');

      // Create frame for org1
      const frame = await createTestFrame('org1');

      // Try to access as user2
      const { data, error } = await supabaseAs(user2)
        .from('video_frames')
        .select('*')
        .eq('id', frame.id)
        .single();

      expect(error).toBeTruthy();
      expect(data).toBeNull();
    });

    it('should enforce org isolation in storage', async () => {
      const frame = await createTestFrame('org1');

      // Try to access with wrong org path
      const { data, error } = await supabase.storage
        .from('video-frames')
        .download('org2/' + frame.frame_url.split('/').slice(1).join('/'));

      expect(error).toBeTruthy();
    });
  });

  describe('Command Injection', () => {
    it('should sanitize FFmpeg inputs', async () => {
      const maliciousPath = '/tmp/video.mp4; rm -rf /';

      await expect(
        secureFfmpegExtract(maliciousPath, '/tmp/out', {})
      ).rejects.toThrow('Invalid video path format');
    });

    it('should prevent path traversal', async () => {
      const traversalPath = '../../../etc/passwd';

      await expect(
        validateStoragePath(traversalPath, 'org1')
      ).rejects.toThrow('Path traversal detected');
    });
  });

  describe('PII Detection', () => {
    it('should redact SSN from OCR text', () => {
      const text = 'SSN: 123-45-6789';
      const result = sanitizeOcrText(text);

      expect(result).toBe('SSN: [REDACTED]');
      expect(result).not.toContain('123-45-6789');
    });

    it('should detect multiple PII types', () => {
      const text = 'Email: test@example.com, Card: 1234-5678-9012-3456';
      const result = detectPII(text);

      expect(result.hasPII).toBe(true);
      expect(result.types).toContain('email');
      expect(result.types).toContain('creditCard');
      expect(result.redacted).not.toContain('test@example.com');
    });
  });

  describe('Rate Limiting', () => {
    it('should limit visual search requests', async () => {
      const orgId = 'test-org';

      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        const limited = await checkRateLimit(`visual_search:${orgId}`, {
          maxRequests: 10,
          windowMs: 60000,
        });
        expect(limited).toBe(false);
      }

      // 11th request should be limited
      const limited = await checkRateLimit(`visual_search:${orgId}`, {
        maxRequests: 10,
        windowMs: 60000,
      });
      expect(limited).toBe(true);
    });
  });
});
```

### 7.2 Penetration Testing Checklist

- [ ] Test RLS policies with different user roles
- [ ] Attempt cross-tenant data access
- [ ] Try SQL injection in search queries
- [ ] Test command injection in FFmpeg paths
- [ ] Attempt path traversal in storage paths
- [ ] Test rate limiting bypass attempts
- [ ] Verify presigned URL expiration
- [ ] Test PII detection and redaction
- [ ] Verify error message sanitization
- [ ] Test resource exhaustion (large images, many frames)

---

## 8. Vulnerability Summary

### P0 - CRITICAL (Must Fix Before Implementation)

1. **RLS Authentication Pattern**
   - Status: ✅ Fixed in migration 016
   - Action: Verify migration 016 is applied

2. **Missing Service Role Policies**
   - Status: ❌ Not fixed
   - Action: Add INSERT/UPDATE/DELETE policies for video_frames

3. **FFmpeg Command Injection**
   - Status: ❌ Not implemented
   - Action: Use spawn with array args, validate all inputs

4. **Storage Bucket Missing**
   - Status: ❌ Not created
   - Action: Create bucket with proper RLS policies

### P1 - HIGH (Fix Before Production)

1. **No Input Sanitization**
   - Affects: FFmpeg paths, OCR output, visual descriptions
   - Action: Implement comprehensive sanitization

2. **Missing Rate Limiting**
   - Affects: Visual search, frame extraction
   - Action: Implement Redis-based rate limiting

3. **No PII Detection**
   - Affects: OCR text, visual descriptions
   - Action: Implement PII detector and redaction

### P2 - MEDIUM (Fix Soon)

1. **No Audit Logging**
   - Action: Log all frame access and processing

2. **Missing Data Retention Policy**
   - Action: Implement automatic cleanup

3. **Incomplete Error Handling**
   - Action: Sanitize all error messages

---

## 9. Remediation Plan

### Immediate Actions (Before Any Implementation)

1. **Apply RLS Fixes**:
```bash
# Verify migration 016 is applied
supabase db diff
supabase migration up
```

2. **Create Storage Bucket**:
```sql
-- Run in Supabase SQL editor
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('video-frames', 'video-frames', false, 5242880, ARRAY['image/jpeg', 'image/png']);
```

3. **Add Missing Policies**:
```sql
-- Add service role policies for video_frames
CREATE POLICY "Service role can insert frames"
  ON video_frames FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can update frames"
  ON video_frames FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
```

### Implementation Requirements

1. **Secure FFmpeg Integration**:
   - Use spawn with array arguments
   - Validate all input paths
   - Implement timeouts

2. **PII Protection**:
   - Implement PII detector
   - Redact sensitive data before storage
   - Log PII detection events

3. **Rate Limiting**:
   - Implement Redis-based limiting
   - Different limits per operation type
   - Monitor and adjust limits

4. **Monitoring**:
   - Log all frame processing
   - Track error rates
   - Monitor storage usage

---

## 10. Security Checklist for Implementation

### Pre-Implementation
- [ ] Migration 016 applied (RLS fixes)
- [ ] Storage bucket created with RLS
- [ ] Service role policies added
- [ ] Rate limiting infrastructure ready

### During Implementation
- [ ] All inputs validated with Zod
- [ ] FFmpeg using spawn (not exec)
- [ ] PII detection implemented
- [ ] Storage paths include org_id
- [ ] Error messages sanitized
- [ ] Timeouts on all external calls

### Post-Implementation
- [ ] Security tests passing
- [ ] Penetration testing completed
- [ ] Monitoring configured
- [ ] Documentation updated
- [ ] Team trained on security requirements

---

## 11. OWASP Top 10 Coverage

| OWASP Risk | Status | Mitigation |
|------------|--------|------------|
| A01: Broken Access Control | ⚠️ PARTIAL | RLS fixed, needs testing |
| A02: Cryptographic Failures | ✅ OK | Using Supabase encryption |
| A03: Injection | ❌ AT RISK | FFmpeg command injection risk |
| A04: Insecure Design | ⚠️ PARTIAL | Some design improvements needed |
| A05: Security Misconfiguration | ❌ AT RISK | Storage bucket not configured |
| A06: Vulnerable Components | ✅ OK | Dependencies up to date |
| A07: Authentication Failures | ✅ OK | Using Clerk + proper patterns |
| A08: Data Integrity Failures | ✅ OK | Proper validation in place |
| A09: Security Logging | ❌ MISSING | No audit logging yet |
| A10: SSRF | ⚠️ PARTIAL | Some external calls need validation |

---

## 12. Recommended Security Headers

Add to API responses:

```typescript
// lib/utils/security-headers.ts

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data: https:;",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

// Apply in API routes
export const GET = apiHandler(async (request: NextRequest) => {
  const response = successResponse(data);

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
});
```

---

## 13. Conclusion

Phase 4 Advanced Video Processing introduces significant security challenges due to:
- External process execution (FFmpeg)
- File storage management
- OCR and visual processing of potentially sensitive data
- Resource-intensive operations

The most critical issues are:
1. **RLS policies** - Already fixed in migration 016, needs verification
2. **Command injection** - FFmpeg must use secure spawn method
3. **Storage security** - Bucket needs proper configuration
4. **PII exposure** - OCR/visual descriptions need sanitization

**Recommendation**: DO NOT proceed with implementation until:
1. All P0 critical issues are resolved
2. Security test suite is implemented
3. Storage bucket is properly configured
4. Rate limiting is in place

**Estimated Security Work**: 16-24 hours to properly secure Phase 4 implementation

---

## Appendix A: Security Test Commands

```bash
# Test RLS policies
npm run test -- __tests__/security/phase4-security.test.ts

# Check for command injection vulnerabilities
grep -r "exec\|execSync\|shell: true" lib/services/

# Verify storage bucket configuration
supabase storage list

# Test rate limiting
curl -X POST http://localhost:3000/api/search/visual \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}' \
  --verbose \
  --repeat 20

# Check for exposed sensitive data
grep -r "password\|secret\|key\|token" lib/services/ | grep -v ".test"
```

---

## Appendix B: Emergency Response Plan

If a security incident occurs:

1. **Immediate Actions**:
   - Disable affected endpoints
   - Revoke compromised credentials
   - Enable emergency rate limiting

2. **Investigation**:
   - Review audit logs
   - Identify affected data
   - Determine attack vector

3. **Remediation**:
   - Patch vulnerability
   - Rotate all secrets
   - Notify affected users

4. **Post-Incident**:
   - Conduct security review
   - Update security tests
   - Document lessons learned

---

**Report Prepared By**: Claude (Security Specialist)
**Date**: 2025-10-12
**Status**: CRITICAL ISSUES FOUND - DO NOT DEPLOY WITHOUT FIXES
**Next Review**: After P0 issues resolved