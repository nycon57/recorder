/**
 * Mock Logger Utility
 * Placeholder for the actual logger that will be implemented by another agent
 * This ensures our code works even if the real logger isn't available yet
 */

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: Record<string, any>;
  duration?: number;
}

class MockLogger {
  private startTimes: Map<string, number> = new Map();

  info(message: string, context?: Record<string, any>) {
    console.log(`[INFO] ${message}`, context || '');
  }

  warn(message: string, context?: Record<string, any>) {
    console.warn(`[WARN] ${message}`, context || '');
  }

  error(message: string, error?: Error | unknown, context?: Record<string, any>) {
    console.error(`[ERROR] ${message}`, error, context || '');
  }

  debug(message: string, context?: Record<string, any>) {
    console.log(`[DEBUG] ${message}`, context || '');
  }

  startTimer(key: string): void {
    this.startTimes.set(key, Date.now());
  }

  endTimer(key: string, message: string, context?: Record<string, any>): number {
    const startTime = this.startTimes.get(key);
    if (!startTime) {
      this.warn(`Timer '${key}' was not started`);
      return 0;
    }
    const duration = Date.now() - startTime;
    this.info(`${message} (${duration}ms)`, { ...context, duration });
    this.startTimes.delete(key);
    return duration;
  }
}

export const logger = new MockLogger();