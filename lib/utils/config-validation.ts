/**
 * Configuration Validation Utility
 *
 * Provides safe parsing and validation for environment variables
 * to prevent injection attacks and ensure valid configuration.
 */

export interface ValidationOptions {
  min?: number;
  max?: number;
  allowedValues?: string[];
  required?: boolean;
}

export class ConfigValidationError extends Error {
  constructor(message: string, public readonly key: string, public readonly value: any) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Safely parse and validate an integer environment variable
 */
export function parseIntSafe(
  value: string | undefined,
  defaultValue: number,
  options: ValidationOptions = {}
): number {
  const { min, max } = options;

  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new ConfigValidationError(
      `Invalid integer value: "${value}" (expected a number)`,
      'value',
      value
    );
  }

  if (min !== undefined && parsed < min) {
    throw new ConfigValidationError(
      `Value ${parsed} is below minimum ${min}`,
      'value',
      parsed
    );
  }

  if (max !== undefined && parsed > max) {
    throw new ConfigValidationError(
      `Value ${parsed} exceeds maximum ${max}`,
      'value',
      parsed
    );
  }

  return parsed;
}

/**
 * Safely parse and validate a float environment variable
 */
export function parseFloatSafe(
  value: string | undefined,
  defaultValue: number,
  options: ValidationOptions = {}
): number {
  const { min, max } = options;

  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = parseFloat(value);

  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new ConfigValidationError(
      `Invalid float value: "${value}" (expected a finite number)`,
      'value',
      value
    );
  }

  if (min !== undefined && parsed < min) {
    throw new ConfigValidationError(
      `Value ${parsed} is below minimum ${min}`,
      'value',
      parsed
    );
  }

  if (max !== undefined && parsed > max) {
    throw new ConfigValidationError(
      `Value ${parsed} exceeds maximum ${max}`,
      'value',
      parsed
    );
  }

  return parsed;
}

/**
 * Safely validate a string environment variable
 */
export function parseStringSafe(
  value: string | undefined,
  defaultValue: string,
  options: ValidationOptions = {}
): string {
  const { allowedValues } = options;

  if (value === undefined || value === '') {
    return defaultValue;
  }

  if (allowedValues && !allowedValues.includes(value)) {
    throw new ConfigValidationError(
      `Invalid value: "${value}" (must be one of: ${allowedValues.join(', ')})`,
      'value',
      value
    );
  }

  return value;
}

/**
 * Validate semantic chunking configuration
 */
export function validateSemanticChunkConfig(config: {
  minSize: number;
  maxSize: number;
  targetSize: number;
  similarityThreshold: number;
}): void {
  if (config.minSize >= config.maxSize) {
    throw new ConfigValidationError(
      `minSize (${config.minSize}) must be less than maxSize (${config.maxSize})`,
      'minSize',
      config.minSize
    );
  }

  if (config.targetSize < config.minSize || config.targetSize > config.maxSize) {
    throw new ConfigValidationError(
      `targetSize (${config.targetSize}) must be between minSize (${config.minSize}) and maxSize (${config.maxSize})`,
      'targetSize',
      config.targetSize
    );
  }

  if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    throw new ConfigValidationError(
      `similarityThreshold (${config.similarityThreshold}) must be between 0 and 1`,
      'similarityThreshold',
      config.similarityThreshold
    );
  }
}

/**
 * Sanitize metadata object to prevent injection
 */
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Skip potentially dangerous keys
    if (key.startsWith('__') || key.startsWith('$')) {
      console.warn(`[Config Validation] Skipping potentially dangerous key: ${key}`);
      continue;
    }

    // Sanitize value based on type
    if (typeof value === 'string') {
      // Remove null bytes and control characters
      sanitized[key] = value.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '');
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(v =>
        typeof v === 'string' ? v.replace(/\0/g, '').replace(/[\x00-\x1F\x7F]/g, '') : v
      );
    } else if (value === null || value === undefined) {
      sanitized[key] = value;
    } else {
      // Skip complex objects
      console.warn(`[Config Validation] Skipping complex object for key: ${key}`);
    }
  }

  return sanitized;
}
