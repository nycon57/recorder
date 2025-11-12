/**
 * Database Performance Analysis Script
 *
 * Analyzes current database performance and provides recommendations.
 * Does NOT make changes - use optimize-database.ts to apply fixes.
 *
 * Run with: npx tsx scripts/analyze-db-performance.ts
 */

import { createClient } from '@/lib/supabase/admin';

const supabase = createClient();

interface QueryStats {
  query: string;
  calls: number;
  total_time: number;
  mean_time: number;
  stddev_time: number;
  rows: number;
}

interface IndexUsage {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
}

interface TableBloat {
  tablename: string;
  real_size: string;
  extra_size: string;
  bloat_pct: number;
}

async function analyzeSlowQueries() {
  console.log('\n🐌 Top 20 Slowest Queries:');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          LEFT(query, 100) as query,
          calls,
          ROUND(total_exec_time::numeric, 2) as total_time_ms,
          ROUND(mean_exec_time::numeric, 2) as mean_time_ms,
          ROUND(stddev_exec_time::numeric, 2) as stddev_time_ms,
          rows
        FROM pg_stat_statements
        WHERE query NOT LIKE '%pg_stat%'
          AND query NOT LIKE '%information_schema%'
        ORDER BY mean_exec_time DESC
        LIMIT 20;
      `
    });

  if (error) {
    console.log('⚠️  pg_stat_statements extension not available. Enable it with:');
    console.log('   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');
    return;
  }

  if (!data || data.length === 0) {
    console.log('No query statistics available.');
    return;
  }

  console.log('\nQuery'.padEnd(70), 'Calls'.padEnd(8), 'Mean (ms)'.padEnd(12), 'Total (ms)');
  console.log('-'.repeat(100));

  data.forEach((stat: QueryStats) => {
    const queryPreview = stat.query.substring(0, 60).replace(/\s+/g, ' ');
    console.log(
      queryPreview.padEnd(70),
      stat.calls.toString().padEnd(8),
      stat.mean_time.toFixed(2).padEnd(12),
      stat.total_time.toFixed(2)
    );
  });
}

async function analyzeIndexUsage() {
  console.log('\n\n📊 Index Usage Statistics:');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        ORDER BY idx_scan DESC;
      `
    });

  if (error) {
    console.error('Error fetching index statistics:', error);
    return;
  }

  console.log('\nTable'.padEnd(25), 'Index'.padEnd(35), 'Scans'.padEnd(10), 'Size');
  console.log('-'.repeat(100));

  data?.forEach((idx: IndexUsage & { index_size: string }) => {
    console.log(
      idx.tablename.padEnd(25),
      idx.indexname.padEnd(35),
      idx.idx_scan.toString().padEnd(10),
      idx.index_size
    );
  });

  // Find unused indexes
  console.log('\n\n⚠️  Potentially Unused Indexes (0 scans):');
  console.log('-'.repeat(100));

  const unusedIndexes = data?.filter((idx: IndexUsage) => idx.idx_scan === 0);

  if (unusedIndexes && unusedIndexes.length > 0) {
    unusedIndexes.forEach((idx: IndexUsage) => {
      console.log(`${idx.tablename}.${idx.indexname}`);
    });
  } else {
    console.log('All indexes are being used.');
  }
}

async function analyzeMissingIndexes() {
  console.log('\n\n🔍 Potential Missing Indexes (Sequential Scans):');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          schemaname,
          relname as tablename,
          seq_scan,
          seq_tup_read,
          idx_scan,
          n_live_tup as rows,
          CASE
            WHEN seq_scan + idx_scan > 0 THEN
              ROUND(100.0 * seq_scan / (seq_scan + idx_scan), 2)
            ELSE 0
          END as seq_scan_pct
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_live_tup > 100
          AND seq_scan > 0
        ORDER BY seq_scan DESC
        LIMIT 20;
      `
    });

  if (error) {
    console.error('Error fetching sequential scan statistics:', error);
    return;
  }

  console.log('\nTable'.padEnd(25), 'Rows'.padEnd(10), 'SeqScans'.padEnd(12), 'IdxScans'.padEnd(12), 'SeqScan%');
  console.log('-'.repeat(100));

  data?.forEach((table: any) => {
    const warning = table.seq_scan_pct > 50 ? '⚠️ ' : '';
    console.log(
      `${warning}${table.tablename}`.padEnd(25),
      table.rows.toString().padEnd(10),
      table.seq_scan.toString().padEnd(12),
      table.idx_scan.toString().padEnd(12),
      `${table.seq_scan_pct}%`
    );
  });

  console.log('\n💡 Tables with >50% sequential scans may benefit from additional indexes.');
}

async function analyzeTableBloat() {
  console.log('\n\n💾 Table Bloat Analysis:');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
          pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as indexes_size,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows,
          CASE
            WHEN n_live_tup > 0 THEN
              ROUND(100.0 * n_dead_tup / (n_live_tup + n_dead_tup), 2)
            ELSE 0
          END as dead_row_pct
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
          AND n_live_tup > 0
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
      `
    });

  if (error) {
    console.error('Error fetching table bloat:', error);
    return;
  }

  console.log('\nTable'.padEnd(25), 'Total Size'.padEnd(12), 'Live Rows'.padEnd(12), 'Dead Rows'.padEnd(12), 'Dead%');
  console.log('-'.repeat(100));

  data?.forEach((table: any) => {
    const warning = table.dead_row_pct > 20 ? '⚠️ ' : '';
    console.log(
      `${warning}${table.tablename}`.padEnd(25),
      table.total_size.padEnd(12),
      table.live_rows.toString().padEnd(12),
      table.dead_rows.toString().padEnd(12),
      `${table.dead_row_pct}%`
    );
  });

  console.log('\n💡 Tables with >20% dead rows should be vacuumed.');
}

async function analyzeRLSPolicies() {
  console.log('\n\n🔒 RLS Policy Analysis:');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          tablename,
          policyname,
          permissive,
          roles,
          cmd,
          qual
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname;
      `
    });

  if (error) {
    console.error('Error fetching RLS policies:', error);
    return;
  }

  const policiesByTable = data?.reduce((acc: any, policy: any) => {
    if (!acc[policy.tablename]) acc[policy.tablename] = [];
    acc[policy.tablename].push(policy);
    return acc;
  }, {});

  Object.entries(policiesByTable || {}).forEach(([table, policies]: [string, any]) => {
    console.log(`\n${table}: (${policies.length} policies)`);
    policies.forEach((policy: any) => {
      console.log(`  - ${policy.policyname} (${policy.cmd})`);
      console.log(`    Roles: ${policy.roles.join(', ')}`);
      if (policy.qual) {
        console.log(`    Using: ${policy.qual}`);
      }
    });
  });

  console.log('\n💡 Ensure RLS policies use indexed columns (org_id, user_id) for best performance.');
}

async function analyzeVectorIndexes() {
  console.log('\n\n🎯 Vector Index Configuration:');
  console.log('='.repeat(100));

  const { data, error } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexdef LIKE '%ivfflat%'
        ORDER BY tablename;
      `
    });

  if (error) {
    console.error('Error fetching vector indexes:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('⚠️  No vector indexes found. Consider creating IVFFlat indexes for vector columns.');
    return;
  }

  data.forEach((idx: any) => {
    console.log(`\n${idx.tablename}.${idx.indexname}:`);
    console.log(`  ${idx.indexdef}`);
  });

  // Check row count for vector tables
  const { data: rowCounts } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT
          'transcript_chunks' as table_name,
          COUNT(*) as row_count
        FROM transcript_chunks;
      `
    });

  if (rowCounts && rowCounts.length > 0) {
    const rowCount = rowCounts[0].row_count;
    const recommendedLists = Math.ceil(Math.sqrt(rowCount));

    console.log(`\n💡 Vector Index Recommendations:`);
    console.log(`   Current rows: ${rowCount}`);
    console.log(`   Recommended lists parameter: ${recommendedLists} (sqrt of row count)`);

    if (rowCount > 100000) {
      console.log(`   ⚠️  Consider increasing lists parameter for better performance on large datasets.`);
    }
  }
}

async function generateSummaryReport() {
  console.log('🎯 Database Performance Analysis Report');
  console.log('='.repeat(100));
  console.log(`Generated: ${new Date().toISOString()}`);
  console.log(`Database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);

  await analyzeSlowQueries();
  await analyzeIndexUsage();
  await analyzeMissingIndexes();
  await analyzeTableBloat();
  await analyzeRLSPolicies();
  await analyzeVectorIndexes();

  console.log('\n\n📋 Action Items:');
  console.log('='.repeat(100));
  console.log('\n1. Apply performance indexes:');
  console.log('   npx supabase migration up --db-url $SUPABASE_DB_URL');
  console.log('   (or use Supabase dashboard to run migration file)');

  console.log('\n2. Vacuum tables with high dead row percentage:');
  console.log('   VACUUM ANALYZE <table_name>;');

  console.log('\n3. Monitor query performance:');
  console.log('   Enable pg_stat_statements if not already enabled');
  console.log('   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;');

  console.log('\n4. Review and optimize slow queries:');
  console.log('   Use EXPLAIN ANALYZE to understand query execution plans');

  console.log('\n5. Consider partitioning large tables:');
  console.log('   Tables with >1M rows may benefit from partitioning');

  console.log('\n\n✨ Analysis complete!\n');
}

// Run the analysis
generateSummaryReport()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
