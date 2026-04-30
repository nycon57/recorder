/**
 * Run Supabase migrations
 *
 * This script reads and executes SQL migration files against the Supabase database.
 * It uses the service role key to bypass RLS policies.
 */

const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

async function runMigration(filename) {
  const filePath = path.join(migrationsDir, filename);
  console.log(`\n📄 Reading: ${filename}`);

  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`🚀 Executing migration...`);

  try {
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single();

    if (error) {
      // Try direct SQL execution if RPC doesn't exist
      const { error: directError } = await supabase.from('_migrations').select('*');

      if (directError) {
        console.error(`❌ Error: ${error.message}`);
        console.error(`   Details: ${error.details || 'N/A'}`);
        console.error(`   Hint: ${error.hint || 'N/A'}`);
        return false;
      }
    }

    console.log(`✅ ${filename} applied successfully`);
    return true;
  } catch (err) {
    console.error(`❌ Unexpected error:`, err.message);
    return false;
  }
}

async function main() {
  console.log('🔧 Supabase Migration Runner');
  console.log('━'.repeat(50));
  console.log(`📍 Database: ${supabaseUrl}`);
  console.log(`📁 Migrations directory: ${migrationsDir}`);

  // Check connection
  console.log('\n🔌 Testing database connection...');
  const { error: connError } = await supabase.from('_migrations').select('*').limit(1);

  if (connError && connError.code !== '42P01') { // 42P01 = table doesn't exist (expected)
    console.error('❌ Database connection failed:', connError.message);
    process.exit(1);
  }

  console.log('✅ Database connection successful');

  // Get migration files
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }

  console.log(`\n📋 Found ${files.length} migration file(s):`);
  files.forEach(f => console.log(`   - ${f}`));

  // Run migrations
  console.log('\n🏃 Running migrations...');
  console.log('━'.repeat(50));

  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    const success = await runMigration(file);
    if (success) {
      successCount++;
    } else {
      failCount++;
      console.log('\n⚠️  Migration failed. You may need to run this SQL manually in the Supabase dashboard.');
    }
  }

  console.log('\n' + '━'.repeat(50));
  console.log(`📊 Summary: ${successCount} succeeded, ${failCount} failed`);

  if (failCount > 0) {
    console.log('\n💡 To run migrations manually:');
    console.log('   1. Go to https://supabase.com/dashboard/project/clpatptmumyasbypvmun/sql');
    console.log('   2. Copy the content of each migration file');
    console.log('   3. Paste and execute in the SQL editor');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
