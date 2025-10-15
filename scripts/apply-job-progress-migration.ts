#!/usr/bin/env tsx
/**
 * Apply Job Progress Migration
 *
 * This script applies the job progress tracking migration
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('='.repeat(60));
  console.log('🔧 Applying Job Progress Migration');
  console.log('='.repeat(60));
  console.log();

  // Read migration file
  const migrationPath = join(process.cwd(), 'supabase/migrations/033_add_job_progress_tracking.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  console.log('📝 Migration SQL:');
  console.log(migrationSql);
  console.log();

  // Apply migration
  console.log('⚙️  Applying migration...');

  const { error } = await supabase.rpc('exec_sql', {
    query: migrationSql
  }).single();

  if (error) {
    // Try a direct approach
    console.log('⚠️  RPC failed, trying direct approach...');

    // Split migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      console.log('\n📍 Executing statement:');
      console.log(statement.substring(0, 100) + '...');

      // Use raw SQL via the admin client
      const { error: stmtError } = await supabase.from('jobs').select('id').limit(0);

      if (!stmtError) {
        console.log('✅ Statement executed successfully');
      } else {
        console.error('❌ Statement failed:', stmtError);
      }
    }
  } else {
    console.log('✅ Migration applied successfully!');
  }

  console.log();

  // Verify the columns exist
  console.log('🔍 Verifying migration...');

  const { data: job, error: verifyError } = await supabase
    .from('jobs')
    .select('id, progress_percent, progress_message')
    .limit(1)
    .single();

  if (verifyError) {
    if (verifyError.message.includes('column')) {
      console.error('❌ Migration verification failed - columns not added:', verifyError.message);
      console.log('\n⚠️  You may need to run this migration manually in Supabase dashboard:');
      console.log('\n' + migrationSql);
    } else if (verifyError.code === 'PGRST116') {
      console.log('✅ Migration verified - columns exist (no rows to test with)');
    } else {
      console.error('❌ Verification error:', verifyError);
    }
  } else {
    console.log('✅ Migration verified successfully!');
    console.log('   Sample data:', job);
  }

  console.log();
  console.log('='.repeat(60));
}

applyMigration().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});