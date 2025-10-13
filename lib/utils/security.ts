/**
 * Security Utilities for Phase 4
 *
 * Provides input sanitization, PII detection, and validation helpers
 * to protect against security vulnerabilities.
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * PII Patterns for detection and redaction
 */
export const PII_PATTERNS = {
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  phone: /\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  apiKey: /\b[A-Z0-9]{32,}\b/g,
  jwt: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  password: /\b(?:password|pwd|pass|secret)[\s:=]+\S+/gi,
  uuid: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
};

/**
 * Detect PII in text and return analysis
 */
export interface PIIDetectionResult {
  hasPII: boolean;
  types: string[];
  redacted: string;
  confidence: number;
}

export function detectPII(text: string): PIIDetectionResult {
  if (!text || text.trim().length === 0) {
    return {
      hasPII: false,
      types: [],
      redacted: text,
      confidence: 1.0,
    };
  }

  let hasPII = false;
  const types: string[] = [];
  let redacted = text;
  let matchCount = 0;

  for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      hasPII = true;
      types.push(type);
      matchCount += matches.length;
      redacted = redacted.replace(pattern, `[${type.toUpperCase()}]`);
    }
  }

  // Calculate confidence based on match clarity
  const confidence = hasPII ? Math.min(0.7 + (matchCount * 0.1), 1.0) : 1.0;

  return {
    hasPII,
    types,
    redacted,
    confidence,
  };
}

/**
 * Sanitize OCR text to remove PII and dangerous content
 */
export function sanitizeOcrText(text: string, maxLength: number = 10000): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  // Detect and redact PII
  const { redacted } = detectPII(text);

  // HTML sanitization to prevent XSS
  const sanitized = DOMPurify.sanitize(redacted, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Limit length to prevent storage issues
  return sanitized.substring(0, maxLength);
}

/**
 * Sanitize visual description from Gemini Vision
 */
export function sanitizeVisualDescription(
  description: string,
  maxLength: number = 5000
): string {
  if (!description || description.trim().length === 0) {
    return '';
  }

  // Detect and redact PII
  const { redacted } = detectPII(description);

  // HTML sanitization
  const sanitized = DOMPurify.sanitize(redacted, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Limit length
  return sanitized.substring(0, maxLength);
}

/**
 * Validate and sanitize file paths to prevent traversal attacks
 */
export function validateFilePath(path: string, allowedExtensions: string[]): boolean {
  // Check for path traversal attempts
  if (path.includes('../') || path.includes('..\\')) {
    return false;
  }

  // Check for absolute paths (should only use relative)
  if (path.startsWith('/') || /^[A-Z]:\\/.test(path)) {
    return false;
  }

  // Validate file extension
  const extension = path.split('.').pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    return false;
  }

  // Check for null bytes
  if (path.includes('\0')) {
    return false;
  }

  // Validate format
  const validPattern = /^[a-zA-Z0-9/_.-]+\.(mp4|webm|mov|jpg|jpeg|png)$/;
  if (!validPattern.test(path)) {
    return false;
  }

  return true;
}

/**
 * Validate storage path includes org_id for isolation
 */
export function validateStoragePath(path: string, orgId: string): boolean {
  // Path MUST start with orgId
  if (!path.startsWith(`${orgId}/`)) {
    throw new Error('Invalid storage path: missing org scope');
  }

  // Check for path traversal
  if (path.includes('../') || path.includes('..\\')) {
    throw new Error('Path traversal detected');
  }

  // Path MUST match expected format: {orgId}/{recordingId}/frames/frame_XXXX.jpg
  const validPattern = new RegExp(
    `^${orgId.replace(/-/g, '\\-')}/[a-f0-9-]+/frames/frame_\\d{4}\\.(jpg|png|webp)$`
  );

  if (!validPattern.test(path)) {
    throw new Error('Invalid storage path format');
  }

  return true;
}

/**
 * Sanitize FFmpeg quality parameter to prevent injection
 */
export function sanitizeFFmpegQuality(quality: number | undefined): number {
  const defaultQuality = 85;

  if (quality === undefined || quality === null) {
    return defaultQuality;
  }

  // Ensure it's a number
  const numQuality = Number(quality);
  if (isNaN(numQuality)) {
    return defaultQuality;
  }

  // Clamp to valid range
  return Math.max(10, Math.min(100, Math.floor(numQuality)));
}

/**
 * Sanitize FFmpeg FPS parameter
 */
export function sanitizeFFmpegFPS(fps: number | undefined): number {
  const defaultFPS = 0.5;

  if (fps === undefined || fps === null) {
    return defaultFPS;
  }

  const numFPS = Number(fps);
  if (isNaN(numFPS) || numFPS <= 0) {
    return defaultFPS;
  }

  // Clamp to reasonable range
  return Math.max(0.1, Math.min(5, numFPS));
}

/**
 * Sanitize max frames parameter
 */
export function sanitizeMaxFrames(maxFrames: number | undefined): number {
  const defaultMaxFrames = 300;

  if (maxFrames === undefined || maxFrames === null) {
    return defaultMaxFrames;
  }

  const numFrames = Number(maxFrames);
  if (isNaN(numFrames) || numFrames <= 0) {
    return defaultMaxFrames;
  }

  // Clamp to reasonable range to prevent resource exhaustion
  return Math.max(1, Math.min(500, Math.floor(numFrames)));
}

/**
 * Sanitize error messages before exposing to users
 */
export function sanitizeErrorMessage(message: string, maxLength: number = 500): string {
  if (!message) {
    return 'An error occurred';
  }

  // Remove file paths
  let sanitized = message.replace(/\/[^\s]+/g, '[path]');

  // Remove potential API keys or tokens
  sanitized = sanitized.replace(/\b[A-Z0-9]{20,}\b/g, '[key]');

  // Remove stack traces
  sanitized = sanitized.split('\n')[0];

  // Limit length
  sanitized = sanitized.substring(0, maxLength);

  return sanitized;
}

/**
 * Rate limit key generator for consistent naming
 */
export function getRateLimitKey(
  operation: string,
  identifier: string
): string {
  return `rate_limit:${operation}:${identifier}`;
}

/**
 * Log PII detection events for compliance
 */
export function logPIIDetection(
  context: string,
  piiTypes: string[],
  recordingId?: string
): void {
  console.warn('[PII Detection]', {
    context,
    piiTypes,
    recordingId,
    timestamp: new Date().toISOString(),
  });
}
