/**
 * Security validation and sanitization utilities
 */

import { z } from 'zod';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize file paths to prevent path traversal
 */
export function sanitizeFilePath(path: string): string {
  // Remove any path traversal attempts
  const sanitized = path
    .replace(/\.\./g, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');

  return sanitized;
}

/**
 * Validate UUID format
 */
export const uuidSchema = z.string().uuid();

export function isValidUuid(value: string): boolean {
  try {
    uuidSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export const emailSchema = z.string().email();

export function isValidEmail(value: string): boolean {
  try {
    emailSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate URL format
 */
export const urlSchema = z.string().url();

export function isValidUrl(value: string): boolean {
  try {
    urlSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate allowed file types
 */
export function validateFileType(
  filename: string,
  allowedExtensions: string[]
): { valid: boolean; extension?: string; error?: string } {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (!extension) {
    return { valid: false, error: 'No file extension found' };
  }

  if (!allowedExtensions.includes(extension)) {
    return {
      valid: false,
      error: `File type .${extension} not allowed. Allowed types: ${allowedExtensions.join(', ')}`,
    };
  }

  return { valid: true, extension };
}

/**
 * Validate file size
 */
export function validateFileSize(
  size: number,
  maxSizeBytes: number
): { valid: boolean; error?: string } {
  if (size > maxSizeBytes) {
    const maxSizeMB = (maxSizeBytes / (1024 * 1024)).toFixed(2);
    const actualSizeMB = (size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size ${actualSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Content Security Policy directives
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-eval'", // Required for FFMPEG.wasm
    'https://challenges.cloudflare.com', // Clerk
    'https://clerk.*.clerk.accounts.dev',
  ],
  'style-src': ["'self'", "'unsafe-inline'"], // Material-UI requires inline styles
  'img-src': ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
  'media-src': ["'self'", 'blob:', 'https://*.supabase.co'],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',
    'https://api.openai.com',
    'https://*.clerk.accounts.dev',
    'https://clerk.*.clerk.accounts.dev',
  ],
  'font-src': ["'self'", 'data:'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
  'worker-src': ["'self'", 'blob:'], // Required for FFMPEG.wasm workers
};

/**
 * Build CSP header string
 */
export function buildCspHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ');
}

/**
 * Security headers configuration
 */
export const SECURITY_HEADERS = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=*, microphone=*, display-capture=*', // Required for recording
  },
  {
    key: 'Content-Security-Policy',
    value: buildCspHeader(),
  },
];

/**
 * Validate password strength
 */
export function validatePasswordStrength(
  password: string
): { valid: boolean; score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }

  if (password.length >= 12) {
    score += 1;
  }

  // Complexity checks
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include uppercase letters');
  }

  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include numbers');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('Include special characters');
  }

  // Common password check (simple version)
  const commonPasswords = ['password', '12345678', 'qwerty', 'abc123'];
  if (commonPasswords.some((common) => password.toLowerCase().includes(common))) {
    score -= 2;
    feedback.push('Avoid common passwords');
  }

  return {
    valid: score >= 4,
    score: Math.max(0, Math.min(6, score)),
    feedback,
  };
}
