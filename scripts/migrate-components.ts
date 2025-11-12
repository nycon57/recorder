#!/usr/bin/env tsx
/**
 * Component Migration Script
 *
 * Automates the replacement of old components with registry-based alternatives.
 *
 * Usage:
 *   npx tsx scripts/migrate-components.ts <migration-name>
 *
 * Examples:
 *   npx tsx scripts/migrate-components.ts empty-states
 *   npx tsx scripts/migrate-components.ts ai-chat
 *   npx tsx scripts/migrate-components.ts all
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${msg}${colors.reset}\n`),
};

// Migration rule interface
interface MigrationRule {
  name: string;
  description: string;
  filePattern: RegExp;
  transform: (content: string, filePath: string) => { content: string; changed: boolean };
}

// Migration results
interface MigrationResult {
  rule: string;
  file: string;
  changed: boolean;
  error?: string;
}

/**
 * Recursively find files matching pattern
 */
function findFiles(dir: string, pattern: RegExp, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, .git
      if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(entry)) {
        findFiles(fullPath, pattern, files);
      }
    } else if (pattern.test(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Apply a migration rule to a file
 */
function applyMigration(filePath: string, rule: MigrationRule): MigrationResult {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const { content: newContent, changed } = rule.transform(content, filePath);

    if (changed) {
      writeFileSync(filePath, newContent, 'utf-8');
    }

    return {
      rule: rule.name,
      file: filePath,
      changed,
    };
  } catch (error) {
    return {
      rule: rule.name,
      file: filePath,
      changed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run migrations
 */
function runMigrations(rules: MigrationRule[], dryRun = false): MigrationResult[] {
  const results: MigrationResult[] = [];
  const rootDir = process.cwd();

  log.header(`Running ${rules.length} migration rule(s)${dryRun ? ' (DRY RUN)' : ''}`);

  for (const rule of rules) {
    log.info(`Applying: ${rule.name}`);
    log.info(`  ${rule.description}`);

    const files = findFiles(rootDir, rule.filePattern);
    log.info(`  Found ${files.length} matching file(s)`);

    for (const file of files) {
      const relativePath = relative(rootDir, file);

      if (!dryRun) {
        const result = applyMigration(file, rule);
        results.push(result);

        if (result.changed) {
          log.success(`  ✓ ${relativePath}`);
        } else if (result.error) {
          log.error(`  ✗ ${relativePath}: ${result.error}`);
        }
      } else {
        log.info(`  → ${relativePath}`);
      }
    }
  }

  return results;
}

/**
 * Print migration summary
 */
function printSummary(results: MigrationResult[]) {
  log.header('Migration Summary');

  const changed = results.filter((r) => r.changed);
  const errors = results.filter((r) => r.error);
  const unchanged = results.filter((r) => !r.changed && !r.error);

  log.info(`Total files processed: ${results.length}`);
  log.success(`Changed: ${changed.length}`);
  log.warn(`Unchanged: ${unchanged.length}`);
  if (errors.length > 0) {
    log.error(`Errors: ${errors.length}`);
  }

  if (changed.length > 0) {
    log.header('Changed Files');
    for (const result of changed) {
      console.log(`  ${result.file}`);
    }
  }

  if (errors.length > 0) {
    log.header('Errors');
    for (const result of errors) {
      console.log(`  ${result.file}: ${result.error}`);
    }
  }
}

/**
 * Verify migrations with type check
 */
function verifyMigrations() {
  log.header('Verifying Migrations');
  log.info('Running type check...');

  try {
    execSync('npm run type:check', { stdio: 'inherit' });
    log.success('Type check passed');
  } catch (error) {
    log.error('Type check failed - please review errors above');
    process.exit(1);
  }
}

// Export utilities for migration rules
export {
  MigrationRule,
  MigrationResult,
  runMigrations,
  printSummary,
  verifyMigrations,
  log,
};

// CLI execution - Node ESM pattern for detecting direct invocation
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const migrationName = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!migrationName) {
    log.error('Usage: npx tsx scripts/migrate-components.ts <migration-name>');
    log.info('Available migrations: empty-states, ai-chat, all');
    process.exit(1);
  }

  log.header('Component Migration Tool');
  log.info(`Migration: ${migrationName}`);
  log.info(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);

  // Load migration rules (to be implemented in separate files)
  const rules: MigrationRule[] = [];

  if (migrationName === 'empty-states' || migrationName === 'all') {
    // Load empty-states rules
    log.info('Loading empty-states migration rules...');
  }

  if (migrationName === 'ai-chat' || migrationName === 'all') {
    // Load ai-chat rules
    log.info('Loading ai-chat migration rules...');
  }

  if (rules.length === 0) {
    log.error('No migration rules found for: ' + migrationName);
    process.exit(1);
  }

  const results = runMigrations(rules, dryRun);
  printSummary(results);

  if (!dryRun && results.some((r) => r.changed)) {
    verifyMigrations();
  }

  log.success('Migration complete!');
}
