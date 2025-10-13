/**
 * Security validation utilities
 * Provides secure input validation to prevent injection attacks
 */

/**
 * SECURITY: Validate UUID v4 format to prevent SQL injection
 * @param uuid - The string to validate
 * @returns true if valid UUID v4, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
  // UUID v4 regex pattern
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Where x is any hex digit and y is one of 8, 9, a, or b
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uuid);
}

/**
 * SECURITY: Validate and sanitize UUIDs in batch
 * @param uuids - Array of strings to validate
 * @returns Array of valid UUIDs only
 */
export function sanitizeUUIDs(uuids: string[]): string[] {
  return uuids.filter(isValidUUID);
}

/**
 * SECURITY: Validate email format
 * @param email - The email string to validate
 * @returns true if valid email format, false otherwise
 */
export function isValidEmail(email: string): boolean {
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * SECURITY: Sanitize string input to prevent XSS
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  // Remove control characters and limit length
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, maxLength);
}

/**
 * SECURITY: Validate alphanumeric with specific allowed characters
 * @param input - The string to validate
 * @param allowedChars - Additional allowed characters (default: hyphen and underscore)
 * @returns true if valid, false otherwise
 */
export function isAlphanumeric(input: string, allowedChars: string = '-_'): boolean {
  const pattern = new RegExp(`^[a-zA-Z0-9${allowedChars}]+$`);
  return pattern.test(input);
}

/**
 * SECURITY: Validate URL to prevent open redirect
 * @param url - The URL to validate
 * @param allowedHosts - Array of allowed hostnames
 * @returns true if valid and allowed, false otherwise
 */
export function isValidURL(url: string, allowedHosts?: string[]): boolean {
  try {
    const parsed = new URL(url);

    // Check protocol (only https in production)
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }

    // Check against allowed hosts if provided
    if (allowedHosts && !allowedHosts.includes(parsed.hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * SECURITY: Validate integer within range
 * @param value - The value to validate
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns true if valid integer within range, false otherwise
 */
export function isValidInteger(value: any, min: number = 0, max: number = Number.MAX_SAFE_INTEGER): boolean {
  const num = Number(value);
  return Number.isInteger(num) && num >= min && num <= max;
}

/**
 * SECURITY: Validate enum value
 * @param value - The value to validate
 * @param allowedValues - Array of allowed values
 * @returns true if value is in allowed list, false otherwise
 */
export function isValidEnum<T>(value: T, allowedValues: readonly T[]): boolean {
  return allowedValues.includes(value);
}

/**
 * SECURITY: Validate JSON string
 * @param jsonString - The string to validate as JSON
 * @returns Parsed object if valid, null otherwise
 */
export function parseJSONSafe<T = any>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    return null;
  }
}

/**
 * SECURITY: Validate file extension
 * @param filename - The filename to validate
 * @param allowedExtensions - Array of allowed extensions (without dot)
 * @returns true if extension is allowed, false otherwise
 */
export function isValidFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedExtensions.includes(ext) : false;
}

/**
 * SECURITY: Validate MIME type
 * @param mimeType - The MIME type to validate
 * @param allowedTypes - Array of allowed MIME types or patterns
 * @returns true if MIME type is allowed, false otherwise
 */
export function isValidMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.some(allowed => {
    if (allowed.endsWith('/*')) {
      // Handle wildcard patterns like 'image/*'
      const prefix = allowed.slice(0, -2);
      return mimeType.startsWith(prefix + '/');
    }
    return mimeType === allowed;
  });
}

/**
 * SECURITY: Sanitize SQL identifier (table/column name)
 * @param identifier - The identifier to sanitize
 * @returns Sanitized identifier safe for SQL
 */
export function sanitizeSQLIdentifier(identifier: string): string {
  // Only allow alphanumeric and underscore, must start with letter
  const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '');

  // Ensure it starts with a letter
  if (!/^[a-zA-Z]/.test(sanitized)) {
    throw new Error('Invalid SQL identifier');
  }

  // Limit length to prevent DoS
  if (sanitized.length > 63) { // PostgreSQL identifier limit
    throw new Error('SQL identifier too long');
  }

  return sanitized.toLowerCase();
}

/**
 * SECURITY: Rate limit key generator
 * @param identifier - User or org identifier
 * @param action - The action being rate limited
 * @returns Consistent rate limit key
 */
export function getRateLimitKey(identifier: string, action: string): string {
  if (!isValidUUID(identifier) && !isValidEmail(identifier)) {
    throw new Error('Invalid identifier for rate limiting');
  }

  if (!isAlphanumeric(action)) {
    throw new Error('Invalid action for rate limiting');
  }

  return `ratelimit:${action}:${identifier}`;
}

/**
 * SECURITY: Generate secure random token
 * @param length - Token length in bytes (default 32)
 * @returns Hex-encoded random token
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    const buffer = new Uint8Array(length);
    window.crypto.getRandomValues(buffer);
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } else {
    // Node.js environment
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
  }
}

// Export validation schemas for common use cases
export const ValidationSchemas = {
  uuid: {
    validate: isValidUUID,
    error: 'Invalid UUID format',
  },
  email: {
    validate: isValidEmail,
    error: 'Invalid email format',
  },
  url: {
    validate: (url: string) => isValidURL(url),
    error: 'Invalid URL format',
  },
  alphanumeric: {
    validate: (str: string) => isAlphanumeric(str),
    error: 'Only alphanumeric characters allowed',
  },
  positiveInteger: {
    validate: (val: any) => isValidInteger(val, 1),
    error: 'Must be a positive integer',
  },
} as const;

// Type guards for TypeScript
export function assertValidUUID(uuid: string): asserts uuid is string {
  if (!isValidUUID(uuid)) {
    throw new Error('Invalid UUID format');
  }
}

export function assertValidEmail(email: string): asserts email is string {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }
}

export function assertValidEnum<T>(value: T, allowedValues: readonly T[]): asserts value is T {
  if (!isValidEnum(value, allowedValues)) {
    throw new Error(`Invalid enum value. Allowed: ${allowedValues.join(', ')}`);
  }
}