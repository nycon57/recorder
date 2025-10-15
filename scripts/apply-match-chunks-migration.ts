/**
 * Apply match_chunks function migration
 *
 * Run with: npx tsx scripts/apply-match-chunks-migration.ts
 */

import { supabaseAdmin } from '../lib/supabase/admin';
import { readFileSync } from 'fs';
import { join } from 'path';

async function applyMigration() {
  console.log('[Migration] Applying match_chunks function...');

  const migrationSQL = readFileSync(
    join(__dirname, '../supabase/migrations/035_add_match_chunks_function.sql'),
    'utf-8'
  );

  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: migrationSQL,
    });

    if (error) {
      // If exec_sql doesn't exist, try direct execution
      console.log('[Migration] Trying direct execution...');
      const { error: directError } = await supabaseAdmin.from('_supabase_migrations').insert({
        name: '035_add_match_chunks_function',
        statements: [migrationSQL],
      });

      if (directError) {
        console.error('[Migration] Failed:', directError);
        console.log('\n[Migration] Please run this SQL manually in Supabase Dashboard > SQL Editor:');
        console.log('\n' + migrationSQL);
        process.exit(1);
      }
    }

    console.log('[Migration] ✓ Successfully applied match_chunks function');
    console.log('[Migration] Testing the function...');

    // Test the function
    const testEmbedding = new Array(1536).fill(0.1);
    const { data, error: testError } = await supabaseAdmin.rpc('match_chunks', {
      query_embedding: `[${testEmbedding.join(',')}]`,
      match_threshold: 0.7,
      match_count: 1,
    });

    if (testError) {
      console.error('[Migration] ✗ Function test failed:', testError.message);
      console.log('\n[Migration] Please run this SQL manually in Supabase Dashboard > SQL Editor:');
      console.log('\n' + migrationSQL);
      process.exit(1);
    }

    console.log('[Migration] ✓ Function is working correctly');
    console.log('[Migration] Done! Your RAG system should now work.');
  } catch (error: any) {
    console.error('[Migration] Error:', error.message);
    console.log('\n[Migration] Please run this SQL manually in Supabase Dashboard > SQL Editor:');
    console.log('\n' + migrationSQL);
    process.exit(1);
  }
}

applyMigration();
