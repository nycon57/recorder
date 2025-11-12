/**
 * EXPLAIN ANALYZE Critical Queries
 *
 * Tests and analyzes execution plans for the most frequently used queries
 * identified in the API usage patterns.
 *
 * Run with: npx tsx scripts/explain-critical-queries.ts
 *
 * ⚠️  SQL INJECTION WARNING
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * This script uses string interpolation to construct SQL queries for testing.
 * This pattern is UNSAFE and should NEVER be used with user input or in
 * production code. It is ONLY acceptable here because:
 *
 * 1. This is a development/testing script that never runs in production
 * 2. All values are HARDCODED (not from user input or external sources)
 * 3. This script is used for database performance analysis only
 *
 * ❌ NEVER DO THIS IN PRODUCTION CODE:
 *    const query = `SELECT * FROM users WHERE id = '${userId}'`;
 *
 * ✅ ALWAYS USE PARAMETERIZED QUERIES IN PRODUCTION:
 *    const { data } = await supabase
 *      .from('users')
 *      .select('*')
 *      .eq('id', userId);
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { createClient } from '@/lib/supabase/admin';

const supabase = createClient();

// Sample org_id for testing (replace with actual org_id from your database)
// ⚠️  SECURITY: These are HARDCODED test values, not user input
const SAMPLE_ORG_ID = 'bdca3343-182b-4325-bb67-cca2eb17a937';
const SAMPLE_CLERK_ID = 'user_33oGSFJBUU1BYSa6YlpfvkC7Ky8';

interface ExplainResult {
  'QUERY PLAN': string;
}

async function explainQuery(name: string, query: string) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📊 ${name}`);
  console.log('='.repeat(100));
  console.log(`\nQuery:\n${query}\n`);

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`
    });

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('Execution Plan:');
  console.log('-'.repeat(100));

  if (data && Array.isArray(data)) {
    data.forEach((row: ExplainResult) => {
      console.log(row['QUERY PLAN']);
    });
  }

  // Extract key metrics from execution plan
  const planText = JSON.stringify(data);
  const executionTimeMatch = planText.match(/Execution Time: ([\d.]+) ms/);
  const planningTimeMatch = planText.match(/Planning Time: ([\d.]+) ms/);

  if (executionTimeMatch || planningTimeMatch) {
    console.log('\n📈 Performance Metrics:');
    console.log('-'.repeat(100));
    if (planningTimeMatch) {
      console.log(`Planning Time: ${planningTimeMatch[1]} ms`);
    }
    if (executionTimeMatch) {
      console.log(`Execution Time: ${executionTimeMatch[1]} ms`);
    }
  }
}

async function testCriticalQueries() {
  console.log('🎯 EXPLAIN ANALYZE - Critical Query Analysis');
  console.log('='.repeat(100));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Sample Org ID: ${SAMPLE_ORG_ID}`);
  console.log(`Sample Clerk ID: ${SAMPLE_CLERK_ID}`);

  // Query 1: User lookup by clerk_id (most critical - every API call)
  await explainQuery(
    'Query 1: User Lookup by clerk_id',
    `
      SELECT id, org_id, role, email, name
      FROM users
      WHERE clerk_id = '${SAMPLE_CLERK_ID}';
    `
  );

  // Query 2: Jobs polling (every 60 seconds)
  await explainQuery(
    'Query 2: Jobs Polling (Pending Jobs)',
    `
      SELECT *
      FROM jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 10;
    `
  );

  // Query 3: Recordings list query
  await explainQuery(
    'Query 3: Recordings List Query',
    `
      SELECT *
      FROM recordings
      WHERE org_id = '${SAMPLE_ORG_ID}'
        AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100;
    `
  );

  // Query 4: Recordings status filter
  await explainQuery(
    'Query 4: Recordings Status Filter',
    `
      SELECT status
      FROM recordings
      WHERE org_id = '${SAMPLE_ORG_ID}'
        AND deleted_at IS NULL;
    `
  );

  // Query 5: Recordings file size aggregation
  await explainQuery(
    'Query 5: Recordings File Size Aggregation',
    `
      SELECT file_size, content_type
      FROM recordings
      WHERE org_id = '${SAMPLE_ORG_ID}'
        AND deleted_at IS NULL;
    `
  );

  // Query 6: Tags list query
  await explainQuery(
    'Query 6: Tags List Query',
    `
      SELECT *
      FROM tags
      WHERE org_id = '${SAMPLE_ORG_ID}'
        AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT 100;
    `
  );

  // Query 7: Collections list query
  await explainQuery(
    'Query 7: Collections List Query',
    `
      SELECT *
      FROM collections
      WHERE org_id = '${SAMPLE_ORG_ID}'
        AND deleted_at IS NULL
      ORDER BY name ASC
      LIMIT 50;
    `
  );

  // Query 8: Vector similarity search (semantic search)
  await explainQuery(
    'Query 8: Vector Similarity Search',
    `
      SELECT
        recording_id,
        text,
        1 - (embedding <=> '[0.1,0.2,0.3]'::vector) as similarity
      FROM transcript_chunks
      WHERE org_id = '${SAMPLE_ORG_ID}'
      ORDER BY embedding <=> '[0.1,0.2,0.3]'::vector
      LIMIT 10;
    `
  );

  // Query 9: Recording with tags and collections (JOIN query)
  await explainQuery(
    'Query 9: Recording with Tags (JOIN)',
    `
      SELECT r.*, t.name as tag_name
      FROM recordings r
      LEFT JOIN recording_tags rt ON r.id = rt.recording_id
      LEFT JOIN tags t ON rt.tag_id = t.id
      WHERE r.org_id = '${SAMPLE_ORG_ID}'
        AND r.deleted_at IS NULL
      LIMIT 50;
    `
  );

  // Query 10: Job status by recording
  await explainQuery(
    'Query 10: Jobs by Recording ID',
    `
      SELECT *
      FROM jobs
      WHERE recording_id IN (
        SELECT id FROM recordings
        WHERE org_id = '${SAMPLE_ORG_ID}'
        LIMIT 10
      )
      ORDER BY created_at DESC;
    `
  );

  console.log('\n\n📋 Summary & Recommendations:');
  console.log('='.repeat(100));

  console.log('\n1. Index Usage:');
  console.log('   ✓ Check if "Index Scan" appears in execution plans (good)');
  console.log('   ✗ "Seq Scan" indicates missing or unused indexes (bad)');

  console.log('\n2. Performance Targets:');
  console.log('   - User lookup: <5ms (critical path)');
  console.log('   - Jobs polling: <10ms (runs every 60s)');
  console.log('   - Recordings list: <50ms (user-facing)');
  console.log('   - Vector search: <100ms (acceptable for semantic search)');

  console.log('\n3. Red Flags:');
  console.log('   - Sequential scans on large tables');
  console.log('   - Execution time >100ms for frequently called queries');
  console.log('   - High planning time (>10ms)');
  console.log('   - N+1 query patterns in JOIN operations');

  console.log('\n4. Next Steps:');
  console.log('   - Apply migration: supabase/migrations/20251111000001_add_performance_indexes.sql');
  console.log('   - Run ANALYZE on affected tables');
  console.log('   - Re-run this script to verify improvements');
  console.log('   - Monitor production query performance with pg_stat_statements');

  console.log('\n✨ Analysis complete!\n');
}

// Run the tests
testCriticalQueries()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
