/**
 * Structured Logging Utility
 *
 * Console-only logging with structured formatting for easy debugging.
 * Supports log levels, color-coded output, and contextual information.
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
  recordingId?: string;
  jobId?: string;
  orgId?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogOptions {
  level?: LogLevel;
  context?: LogContext;
  error?: Error;
  data?: any;
}

// ANSI color codes for terminal output
const colors = {
  DEBUG: '\x1b[36m', // Cyan
  INFO: '\x1b[32m',  // Green
  WARN: '\x1b[33m',  // Yellow
  ERROR: '\x1b[31m', // Red
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  BRIGHT: '\x1b[1m',
};

/**
 * Format timestamp in ISO format with milliseconds
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format context information as key=value pairs
 */
function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  const parts: string[] = [];

  // Priority order for common fields
  const priorityFields = ['recordingId', 'jobId', 'orgId', 'userId', 'requestId'];

  priorityFields.forEach(field => {
    if (context[field]) {
      parts.push(`${field}=${context[field]}`);
    }
  });

  // Add remaining fields
  Object.keys(context)
    .filter(key => !priorityFields.includes(key))
    .forEach(key => {
      parts.push(`${key}=${context[key]}`);
    });

  return parts.length > 0 ? ` [${parts.join(' ')}]` : '';
}

/**
 * Core logging function
 */
function log(level: LogLevel, message: string, options: LogOptions = {}): void {
  const timestamp = getTimestamp();
  const contextStr = formatContext(options.context);
  const color = colors[level];
  const reset = colors.RESET;
  const dim = colors.DIM;

  // Build log line: [TIMESTAMP] [LEVEL] [CONTEXT] Message
  const logLine = `${dim}[${timestamp}]${reset} ${color}[${level.padEnd(5)}]${reset}${contextStr} ${message}`;

  // Output to appropriate console method
  switch (level) {
    case 'ERROR':
      console.error(logLine);
      if (options.error) {
        console.error(`${dim}Error:${reset}`, options.error);
        if (options.error.stack) {
          console.error(`${dim}Stack:${reset}\n${options.error.stack}`);
        }
      }
      break;
    case 'WARN':
      console.warn(logLine);
      break;
    case 'DEBUG':
      console.debug(logLine);
      break;
    case 'INFO':
    default:
      console.log(logLine);
      break;
  }

  // Log additional data if provided
  if (options.data !== undefined) {
    console.log(`${dim}Data:${reset}`, typeof options.data === 'object' ? JSON.stringify(options.data, null, 2) : options.data);
  }
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private defaultContext: LogContext;

  constructor(defaultContext: LogContext = {}) {
    this.defaultContext = defaultContext;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({
      ...this.defaultContext,
      ...additionalContext,
    });
  }

  /**
   * Log debug message
   */
  debug(message: string, options: Omit<LogOptions, 'level'> = {}): void {
    log('DEBUG', message, {
      ...options,
      context: { ...this.defaultContext, ...options.context },
    });
  }

  /**
   * Log info message
   */
  info(message: string, options: Omit<LogOptions, 'level'> = {}): void {
    log('INFO', message, {
      ...options,
      context: { ...this.defaultContext, ...options.context },
    });
  }

  /**
   * Log warning message
   */
  warn(message: string, options: Omit<LogOptions, 'level'> = {}): void {
    log('WARN', message, {
      ...options,
      context: { ...this.defaultContext, ...options.context },
    });
  }

  /**
   * Log error message
   */
  error(message: string, options: Omit<LogOptions, 'level'> = {}): void {
    log('ERROR', message, {
      ...options,
      context: { ...this.defaultContext, ...options.context },
    });
  }

  /**
   * Log with custom level
   */
  log(level: LogLevel, message: string, options: Omit<LogOptions, 'level'> = {}): void {
    log(level, message, {
      ...options,
      context: { ...this.defaultContext, ...options.context },
    });
  }
}

/**
 * Create a logger instance with optional default context
 */
export function createLogger(defaultContext: LogContext = {}): Logger {
  return new Logger(defaultContext);
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Convenience functions for global logging
 */
export const logDebug = (message: string, options?: Omit<LogOptions, 'level'>) => logger.debug(message, options);
export const logInfo = (message: string, options?: Omit<LogOptions, 'level'>) => logger.info(message, options);
export const logWarn = (message: string, options?: Omit<LogOptions, 'level'>) => logger.warn(message, options);
export const logError = (message: string, options?: Omit<LogOptions, 'level'>) => logger.error(message, options);
