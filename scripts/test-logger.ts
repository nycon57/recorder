#!/usr/bin/env tsx
/**
 * Test Logger Functionality
 *
 * This script tests if the logger is working correctly by attempting various log levels
 */

import { createLogger, logger, logInfo, logError, logWarn, logDebug } from '@/lib/utils/logger';

console.log('='.repeat(60));
console.log('🧪 Logger Test');
console.log('='.repeat(60));
console.log();

// Test default logger
console.log('Testing default logger:');
logger.debug('This is a DEBUG message', { data: { test: true } });
logger.info('This is an INFO message', { context: { requestId: 'test-123' } });
logger.warn('This is a WARN message', { context: { userId: 'user-456' } });
logger.error('This is an ERROR message', { error: new Error('Test error') });

console.log();
console.log('-'.repeat(60));
console.log();

// Test logger with context
console.log('Testing logger with default context:');
const contextLogger = createLogger({ service: 'test-service', recordingId: 'rec-789' });
contextLogger.debug('Debug with context');
contextLogger.info('Info with context', { data: { action: 'testing' } });
contextLogger.warn('Warning with context');
contextLogger.error('Error with context', { error: new Error('Context error') });

console.log();
console.log('-'.repeat(60));
console.log();

// Test child logger
console.log('Testing child logger:');
const childLogger = contextLogger.child({ jobId: 'job-abc', step: 'processing' });
childLogger.info('Child logger message', { data: { percent: 50 } });

console.log();
console.log('-'.repeat(60));
console.log();

// Test convenience functions
console.log('Testing convenience functions:');
logDebug('Convenience debug');
logInfo('Convenience info');
logWarn('Convenience warning');
logError('Convenience error', { error: new Error('Convenience error') });

console.log();
console.log('='.repeat(60));
console.log('✅ Logger test complete!');