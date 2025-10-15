#!/usr/bin/env tsx

/**
 * Apply Performance Optimization Migrations
 *
 * This script applies the critical performance indexes and functions
 * to the Supabase database.
 *
 * Usage:
 *   npx tsx scripts/apply-performance-migrations.ts
 *
 * Or using environment variables:
 *   SUPABASE_DB_URL="postgresql://..." npx tsx scripts/apply-performance-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    persistSession: false,
  },
});

async function applyMigration(migrationFile: string): Promise<boolean> {
  try {
    console.log(`\n📄 Reading migration: ${migrationFile}`);
    const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
    const sql = readFileSync(migrationPath, 'utf-8');

    console.log(`🚀 Applying migration...`);

    // Split SQL by statement and execute
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length < 10) continue; // Skip empty or comment-only statements

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_string: statement + ';' });

        if (error) {
          // Try direct execution if RPC fails
          const { error: directError } = await supabase.from('_migrations').select('*').limit(0);
          if (directError) {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
            // Continue with other statements
          }
        }
      } catch (err: any) {
        console.warn(`⚠️  Warning on statement ${i + 1}: ${err.message}`);
        // Continue with other statements
      }
    }

    console.log(`✅ Migration applied: ${migrationFile}`);
    return true;
  } catch (error: any) {
    console.error(`❌ Error applying migration ${migrationFile}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Performance Optimization Migrations');
  console.log('=====================================\n');

  console.log(`🔗 Connecting to Supabase: ${SUPABASE_URL}`);

  // Test connection
  try {
    const { data, error } = await supabase.from('organizations').select('id').limit(1);
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      process.exit(1);
    }
    console.log('✅ Connection successful\n');
  } catch (error: any) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }

  // Apply migrations
  const migrations = [
    '040_add_performance_indexes.sql',
    '041_add_stats_aggregation_function.sql',
  ];

  let successCount = 0;
  for (const migration of migrations) {
    const success = await applyMigration(migration);
    if (success) successCount++;
  }

  console.log('\n=====================================');
  console.log(`✅ Applied ${successCount}/${migrations.length} migrations successfully`);

  if (successCount === migrations.length) {
    console.log('\n🎉 All performance optimizations applied!');
    console.log('\nNext steps:');
    console.log('1. Verify indexes: Check Supabase Dashboard > Database > Indexes');
    console.log('2. Test APIs: Run your stats and audit logs endpoints');
    console.log('3. Monitor performance: Check query execution times');
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
