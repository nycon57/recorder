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
 *
 * IMPROVEMENT: Added comprehensive error handling for file system operations
 * - Wraps file system operations in try-catch blocks
 * - Logs errors with file path context for debugging
 * - Continues gracefully when individual files/directories fail
 * - Prevents entire migration from failing due to single file system errors
 */
function findFiles(dir: string, pattern: RegExp, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules, .next, .git, and other build/dependency directories
          if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(entry)) {
            findFiles(fullPath, pattern, files);
          }
        } else if (pattern.test(fullPath)) {
          files.push(fullPath);
        }
      } catch (fileError) {
        // Handle individual file/directory errors gracefully
        // This prevents permission errors or broken symlinks from breaking the entire scan
        log.warn(`Skipping file ${fullPath}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        continue;
      }
    }
  } catch (dirError) {
    // Handle directory read errors
    // This can happen with permission issues or when directory is deleted during scan
    log.error(`Cannot read directory ${dir}: ${dirError instanceof Error ? dirError.message : String(dirError)}`);
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
export type {
  MigrationRule,
  MigrationResult,
};
export {
  runMigrations,
  printSummary,
  verifyMigrations,
  log,
};

/**
 * Helper function to validate migration rules
 */
function validateRule(rule: any, source: string): rule is MigrationRule {
  if (!rule.name || typeof rule.name !== 'string') {
    log.warn(`Invalid rule from ${source}: missing or invalid 'name' property`);
    return false;
  }
  if (!rule.description || typeof rule.description !== 'string') {
    log.warn(`Invalid rule from ${source}: missing or invalid 'description' property`);
    return false;
  }
  if (!rule.filePattern || !(rule.filePattern instanceof RegExp)) {
    log.warn(`Invalid rule from ${source}: missing or invalid 'filePattern' property`);
    return false;
  }
  if (!rule.transform || typeof rule.transform !== 'function') {
    log.warn(`Invalid rule from ${source}: missing or invalid 'transform' function`);
    return false;
  }
  return true;
}

/**
 * Helper function to load rules from a file
 */
async function loadRulesFromFile(filePath: string): Promise<MigrationRule[]> {
  try {
    // Attempt to dynamically import the rules file
    const module = await import(filePath);
    const loadedRules = module.default || module.rules || [];

    // Validate each rule
    const validRules = loadedRules.filter((rule: any) =>
      validateRule(rule, filePath)
    );

    if (validRules.length > 0) {
      log.success(`Loaded ${validRules.length} rule(s) from ${filePath}`);
    }

    return validRules;
  } catch (error) {
    // File doesn't exist or has errors - this is expected for migrations not yet implemented
    if ((error as any)?.code === 'ERR_MODULE_NOT_FOUND' ||
        (error as any)?.code === 'MODULE_NOT_FOUND') {
      log.info(`No rules file found at ${filePath} (migration not yet implemented)`);
    } else {
      log.warn(`Error loading rules from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return [];
  }
}

/**
 * Main CLI execution function
 * IMPROVEMENT: Wrapped in async function to support dynamic imports
 */
async function main() {
  const migrationName = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!migrationName) {
    log.error('Usage: npx tsx scripts/migrate-components.ts <migration-name>');
    log.info('Available migrations: empty-states, ai-chat, recording-ui, all');
    process.exit(1);
  }

  log.header('Component Migration Tool');
  log.info(`Migration: ${migrationName}`);
  log.info(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);

  /**
   * IMPROVEMENT: Implement migration rules loading system
   * - Attempts to load migration rules from separate rule files
   * - Falls back gracefully if rule files don't exist yet
   * - Validates rules before use to ensure they have required properties
   * - Provides clear error messages for missing or invalid rules
   */
  const rules: MigrationRule[] = [];

  // Load rules based on migration name
  if (migrationName === 'empty-states' || migrationName === 'all') {
    log.info('Loading empty-states migration rules...');
    const emptyStatesRules = await loadRulesFromFile('./migrations/empty-states-rules.ts');
    rules.push(...emptyStatesRules);
  }

  if (migrationName === 'ai-chat' || migrationName === 'all') {
    log.info('Loading ai-chat migration rules...');
    const aiChatRules = await loadRulesFromFile('./migrations/ai-chat-rules.ts');
    rules.push(...aiChatRules);
  }

  if (migrationName === 'recording-ui' || migrationName === 'all') {
    log.info('Loading recording-ui migration rules...');
    const recordingRules = await loadRulesFromFile('./migrations/recording-ui-rules.ts');
    rules.push(...recordingRules);
  }

  // Check if any rules were loaded
  if (rules.length === 0) {
    log.error(`No migration rules found for: ${migrationName}`);
    log.info('Available migrations: empty-states, ai-chat, recording-ui, all');
    log.info('To create a new migration, add a rules file to scripts/migrations/');
    process.exit(1);
  }

  const results = runMigrations(rules, dryRun);
  printSummary(results);

  if (!dryRun && results.some((r) => r.changed)) {
    verifyMigrations();
  }

  log.success('Migration complete!');
}

// CLI execution - Node ESM pattern for detecting direct invocation
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch((error) => {
    log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
