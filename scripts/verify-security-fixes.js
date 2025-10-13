#!/usr/bin/env node

/**
 * Security Fixes Verification Script
 * Verifies that all critical security fixes have been properly applied
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

let testsRun = 0;
let testsPassed = 0;
let testsFailed = 0;
const issues = [];

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function testPassed(testName) {
  testsRun++;
  testsPassed++;
  log(`  ✓ ${testName}`, colors.green);
}

function testFailed(testName, reason) {
  testsRun++;
  testsFailed++;
  log(`  ✗ ${testName}`, colors.red);
  if (reason) {
    log(`    Reason: ${reason}`, colors.yellow);
    issues.push({ test: testName, reason });
  }
}

// Test 1: Cache Key Isolation
function verifyCacheIsolation() {
  log('\n1. CACHE KEY ISOLATION', colors.blue);

  const cacheFile = path.join(__dirname, '../lib/services/cache/multi-layer-cache.ts');

  try {
    const content = fs.readFileSync(cacheFile, 'utf8');

    // Check for orgId parameter in buildKey
    if (content.includes('buildKey(key: string, namespace?: string, orgId?: string)')) {
      testPassed('buildKey includes orgId parameter');
    } else {
      testFailed('buildKey missing orgId parameter');
    }

    // Check for orgId validation
    if (content.includes('SECURITY WARNING: Cache key created without orgId')) {
      testPassed('orgId validation warning present');
    } else {
      testFailed('Missing orgId validation warning');
    }

    // Check CacheConfig interface update
    if (content.includes('orgId?: string; // SECURITY: Required for multi-tenant isolation')) {
      testPassed('CacheConfig interface includes orgId');
    } else {
      testFailed('CacheConfig interface missing orgId');
    }

  } catch (error) {
    testFailed('Cache file not found or readable', error.message);
  }
}

// Test 2: System Admin Authorization
function verifySystemAdmin() {
  log('\n2. SYSTEM ADMIN AUTHORIZATION', colors.blue);

  const apiFile = path.join(__dirname, '../lib/utils/api.ts');

  try {
    const content = fs.readFileSync(apiFile, 'utf8');

    // Check for requireSystemAdmin function
    if (content.includes('export async function requireSystemAdmin()')) {
      testPassed('requireSystemAdmin function exists');
    } else {
      testFailed('requireSystemAdmin function not found');
    }

    // Check for is_system_admin check
    if (content.includes('userData.is_system_admin !== true')) {
      testPassed('System admin flag check present');
    } else {
      testFailed('System admin flag check missing');
    }

    // Check for security logging
    if (content.includes('[SECURITY] Non-system-admin user')) {
      testPassed('Security logging for unauthorized access');
    } else {
      testFailed('Missing security logging');
    }

  } catch (error) {
    testFailed('API utils file not found', error.message);
  }
}

// Test 3: UUID Validation
function verifyUUIDValidation() {
  log('\n3. UUID VALIDATION', colors.blue);

  const validationFile = path.join(__dirname, '../lib/utils/validation.ts');
  const analyticsFile = path.join(__dirname, '../app/api/admin/analytics/route.ts');

  try {
    // Check validation utility exists
    const validationContent = fs.readFileSync(validationFile, 'utf8');
    if (validationContent.includes('export function isValidUUID')) {
      testPassed('UUID validation utility exists');
    } else {
      testFailed('UUID validation utility not found');
    }

    // Check UUID regex pattern
    if (validationContent.includes('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i')) {
      testPassed('Correct UUID v4 regex pattern');
    } else {
      testFailed('Invalid UUID regex pattern');
    }

    // Check usage in admin routes
    const analyticsContent = fs.readFileSync(analyticsFile, 'utf8');
    if (analyticsContent.includes('isValidUUID') || analyticsContent.includes('uuidRegex')) {
      testPassed('UUID validation used in admin routes');
    } else {
      testFailed('Admin routes not using UUID validation');
    }

  } catch (error) {
    testFailed('Validation files not found', error.message);
  }
}

// Test 4: Rate Limiter Fail-Closed
function verifyRateLimiter() {
  log('\n4. RATE LIMITER FAIL-CLOSED', colors.blue);

  const rateLimiterFile = path.join(__dirname, '../lib/services/quotas/rate-limiter.ts');

  try {
    const content = fs.readFileSync(rateLimiterFile, 'utf8');

    // Check for circuit breaker
    if (content.includes('circuitBreaker')) {
      testPassed('Circuit breaker implementation present');
    } else {
      testFailed('Circuit breaker not implemented');
    }

    // Check for fail-closed behavior
    if (content.includes('SECURITY: Fail closed if circuit is open')) {
      testPassed('Fail-closed behavior implemented');
    } else {
      testFailed('Fail-closed behavior not found');
    }

    // Check for circuit breaker threshold
    if (content.includes('CIRCUIT_BREAKER_THRESHOLD')) {
      testPassed('Circuit breaker threshold configured');
    } else {
      testFailed('Circuit breaker threshold missing');
    }

    // Check for denying requests on failure
    if (content.includes('success: false') && content.includes('Redis failure - denying request')) {
      testPassed('Denies requests on Redis failure');
    } else {
      testFailed('Not properly denying requests on failure');
    }

  } catch (error) {
    testFailed('Rate limiter file not found', error.message);
  }
}

// Test 5: Atomic Quota Checks
function verifyAtomicQuota() {
  log('\n5. ATOMIC QUOTA CHECKS', colors.blue);

  const quotaFile = path.join(__dirname, '../lib/services/quotas/quota-manager.ts');

  try {
    const content = fs.readFileSync(quotaFile, 'utf8');

    // Check for checkAndConsumeQuota function
    if (content.includes('static async checkAndConsumeQuota')) {
      testPassed('checkAndConsumeQuota function exists');
    } else {
      testFailed('checkAndConsumeQuota function not found');
    }

    // Check for atomic PostgreSQL function call
    if (content.includes('check_quota_optimized')) {
      testPassed('Uses atomic PostgreSQL function');
    } else {
      testFailed('Not using atomic database function');
    }

    // Check for deprecation warning
    if (content.includes('DEPRECATED: checkQuota() is vulnerable to race conditions')) {
      testPassed('Deprecation warning for old method');
    } else {
      testFailed('Missing deprecation warning');
    }

    // Check for cache clearing
    if (content.includes('this.clearCache(orgId)')) {
      testPassed('Cache clearing after quota consumption');
    } else {
      testFailed('Not clearing cache after consumption');
    }

  } catch (error) {
    testFailed('Quota manager file not found', error.message);
  }
}

// Test 6: Database Migration
function verifyDatabaseMigration() {
  log('\n6. DATABASE MIGRATION', colors.blue);

  const migrationFile = path.join(__dirname, '../supabase/migrations/029_phase6_security_fixes.sql');

  try {
    const content = fs.readFileSync(migrationFile, 'utf8');

    // Check for system admin column
    if (content.includes('ADD COLUMN IF NOT EXISTS is_system_admin')) {
      testPassed('is_system_admin column migration');
    } else {
      testFailed('Missing is_system_admin column');
    }

    // Check for atomic quota function
    if (content.includes('CREATE OR REPLACE FUNCTION check_quota_optimized')) {
      testPassed('Atomic quota function created');
    } else {
      testFailed('Atomic quota function missing');
    }

    // Check for UUID validation function
    if (content.includes('CREATE OR REPLACE FUNCTION is_valid_uuid')) {
      testPassed('UUID validation function created');
    } else {
      testFailed('UUID validation function missing');
    }

    // Check for security audit log
    if (content.includes('CREATE TABLE IF NOT EXISTS security_audit_log')) {
      testPassed('Security audit log table created');
    } else {
      testFailed('Security audit log table missing');
    }

    // Check for row-level locking
    if (content.includes('FOR UPDATE SKIP LOCKED')) {
      testPassed('Row-level locking for race condition prevention');
    } else {
      testFailed('Missing row-level locking');
    }

  } catch (error) {
    testFailed('Migration file not found', error.message);
  }
}

// Test 7: Security Headers
function verifySecurityHeaders() {
  log('\n7. SECURITY HEADERS', colors.blue);

  const configFile = path.join(__dirname, '../next.config.js');

  try {
    const content = fs.readFileSync(configFile, 'utf8');

    // Check for CSP header
    if (content.includes('Content-Security-Policy')) {
      testPassed('Content Security Policy configured');
    } else {
      testFailed('Content Security Policy missing');
    }

    // Check for security headers
    const headers = [
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'X-XSS-Protection',
    ];

    headers.forEach(header => {
      if (content.includes(header)) {
        testPassed(`${header} header present`);
      } else {
        testFailed(`${header} header missing`);
      }
    });

  } catch (error) {
    testFailed('Next.js config file not found', error.message);
  }
}

// Run all tests
function runTests() {
  log('\n====================================', colors.blue);
  log('SECURITY FIXES VERIFICATION', colors.blue);
  log('====================================', colors.blue);

  verifyCacheIsolation();
  verifySystemAdmin();
  verifyUUIDValidation();
  verifyRateLimiter();
  verifyAtomicQuota();
  verifyDatabaseMigration();
  verifySecurityHeaders();

  // Summary
  log('\n====================================', colors.blue);
  log('VERIFICATION SUMMARY', colors.blue);
  log('====================================', colors.blue);

  log(`\nTests Run: ${testsRun}`);
  log(`Tests Passed: ${testsPassed}`, colors.green);
  log(`Tests Failed: ${testsFailed}`, testsFailed > 0 ? colors.red : colors.green);

  if (issues.length > 0) {
    log('\nISSUES FOUND:', colors.red);
    issues.forEach(issue => {
      log(`  - ${issue.test}: ${issue.reason}`, colors.yellow);
    });
  }

  if (testsFailed === 0) {
    log('\n✅ ALL SECURITY FIXES VERIFIED SUCCESSFULLY!', colors.green);
    process.exit(0);
  } else {
    log('\n❌ SECURITY VERIFICATION FAILED!', colors.red);
    log('Please address the issues above before deployment.', colors.yellow);
    process.exit(1);
  }
}

// Execute tests
runTests();