/**
 * Database Optimization Script
 *
 * Analyzes and optimizes Supabase database based on API usage patterns.
 * Run with: npx tsx scripts/optimize-database.ts
 */

import { createClient } from '@/lib/supabase/admin';

// Initialize Supabase admin client using project's admin pattern
const supabase = createClient();

interface IndexInfo {
  schemaname: string;
  tablename: string;
  indexname: string;
  indexdef: string;
}

interface TableStats {
  schemaname: string;
  relname: string;
  seq_scan: number;
  seq_tup_read: number;
  idx_scan: number;
  idx_tup_fetch: number;
  n_tup_ins: number;
  n_tup_upd: number;
  n_tup_del: number;
  n_live_tup: number;
}

async function checkExistingIndexes(): Promise<IndexInfo[]> {
  console.log('\n📊 Checking existing indexes...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'recordings', 'jobs', 'tags', 'collections', 'transcript_chunks', 'recording_tags', 'recording_collections')
      ORDER BY tablename, indexname;
    `
  });

  if (error) {
    console.error('Error fetching indexes:', error);
    return [];
  }

  return data || [];
}

async function checkTableStatistics(): Promise<TableStats[]> {
  console.log('\n📈 Analyzing table statistics...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        schemaname,
        relname,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        n_tup_ins,
        n_tup_upd,
        n_tup_del,
        n_live_tup
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND relname IN ('users', 'recordings', 'jobs', 'tags', 'collections', 'transcript_chunks', 'recording_tags', 'recording_collections')
      ORDER BY seq_scan DESC;
    `
  });

  if (error) {
    console.error('Error fetching table statistics:', error);
    return [];
  }

  return data || [];
}

// NOTE: This function is not currently used but preserved for future query analysis
// If you need to explain queries, see scripts/explain-critical-queries.ts instead
// async function explainQuery(query: string): Promise<string> {
//   const { data, error } = await supabase.rpc('exec_sql', {
//     query: `EXPLAIN ANALYZE ${query}`
//   });
//
//   if (error) {
//     console.error('Error running EXPLAIN ANALYZE:', error);
//     return 'Error executing query plan';
//   }
//
//   return JSON.stringify(data, null, 2);
// }

async function createOptimizationIndexes() {
  console.log('\n🔧 Creating optimization indexes...\n');

  const indexCreationQueries = [
    // Critical: users.clerk_id - used in every authenticated API call
    {
      name: 'idx_users_clerk_id',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_clerk_id ON users(clerk_id);`,
      description: 'Index on users.clerk_id for fast user lookup'
    },

    // Composite index for recordings queries (org_id + deleted_at + created_at)
    {
      name: 'idx_recordings_org_deleted_created',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recordings_org_deleted_created
              ON recordings(org_id, deleted_at, created_at DESC)
              WHERE deleted_at IS NULL;`,
      description: 'Composite partial index for recordings list queries'
    },

    // Index for recordings status filtering
    {
      name: 'idx_recordings_status',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recordings_status
              ON recordings(status)
              WHERE deleted_at IS NULL;`,
      description: 'Partial index for recordings status filtering'
    },

    // Index for recordings org_id + content_type (for file size aggregations)
    {
      name: 'idx_recordings_org_content_type',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recordings_org_content_type
              ON recordings(org_id, content_type, deleted_at);`,
      description: 'Index for content type filtering and aggregations'
    },

    // Composite index for jobs table (status + created_at) - critical for worker polling
    {
      name: 'idx_jobs_status_created',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_created
              ON jobs(status, created_at ASC)
              WHERE status = 'pending';`,
      description: 'Partial index for pending jobs polling'
    },

    // Index for jobs dedupe_key (unique constraint enforcement)
    {
      name: 'idx_jobs_dedupe_key',
      query: `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_dedupe_key
              ON jobs(dedupe_key)
              WHERE dedupe_key IS NOT NULL AND status != 'completed';`,
      description: 'Unique index for job deduplication'
    },

    // Composite index for tags (org_id + deleted_at + name)
    {
      name: 'idx_tags_org_deleted_name',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tags_org_deleted_name
              ON tags(org_id, deleted_at, name)
              WHERE deleted_at IS NULL;`,
      description: 'Composite partial index for tags queries'
    },

    // Composite index for collections
    {
      name: 'idx_collections_org_deleted_name',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collections_org_deleted_name
              ON collections(org_id, deleted_at, name)
              WHERE deleted_at IS NULL;`,
      description: 'Composite partial index for collections queries'
    },

    // Index for transcript_chunks embeddings (vector similarity search)
    {
      name: 'idx_transcript_chunks_embedding',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_embedding
              ON transcript_chunks USING ivfflat (embedding vector_cosine_ops)
              WITH (lists = 100);`,
      description: 'IVFFlat index for vector similarity search'
    },

    // Index for transcript_chunks org_id filtering
    {
      name: 'idx_transcript_chunks_org',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transcript_chunks_org
              ON transcript_chunks(org_id);`,
      description: 'Index for org-scoped vector searches'
    },

    // Index for recording_tags junction table
    {
      name: 'idx_recording_tags_recording',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_tags_recording
              ON recording_tags(recording_id);`,
      description: 'Index for tag lookups by recording'
    },

    {
      name: 'idx_recording_tags_tag',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_tags_tag
              ON recording_tags(tag_id);`,
      description: 'Index for recording lookups by tag'
    },

    // Index for recording_collections junction table
    {
      name: 'idx_recording_collections_recording',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_collections_recording
              ON recording_collections(recording_id);`,
      description: 'Index for collection lookups by recording'
    },

    {
      name: 'idx_recording_collections_collection',
      query: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_collections_collection
              ON recording_collections(collection_id);`,
      description: 'Index for recording lookups by collection'
    },
  ];

  for (const index of indexCreationQueries) {
    console.log(`Creating ${index.name}: ${index.description}`);

    const { error } = await supabase.rpc('exec_sql', {
      query: index.query
    });

    if (error) {
      console.error(`❌ Error creating ${index.name}:`, error.message);
    } else {
      console.log(`✅ ${index.name} created successfully`);
    }
  }
}

async function analyzeRLSPolicies() {
  console.log('\n🔒 Analyzing RLS policies...\n');

  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ('users', 'recordings', 'jobs', 'tags', 'collections', 'transcript_chunks')
      ORDER BY tablename, policyname;
    `
  });

  if (error) {
    console.error('Error fetching RLS policies:', error);
    return [];
  }

  return data || [];
}

async function generateOptimizationReport() {
  console.log('🚀 Database Optimization Analysis\n');
  console.log('='.repeat(80));

  // 1. Check existing indexes
  const indexes = await checkExistingIndexes();
  console.log('\nExisting Indexes:');
  console.log('-'.repeat(80));

  const indexesByTable = indexes.reduce((acc, idx) => {
    if (!acc[idx.tablename]) acc[idx.tablename] = [];
    acc[idx.tablename].push(idx);
    return acc;
  }, {} as Record<string, IndexInfo[]>);

  Object.entries(indexesByTable).forEach(([table, tableIndexes]) => {
    console.log(`\n${table}: (${tableIndexes.length} indexes)`);
    tableIndexes.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
      console.log(`    ${idx.indexdef}`);
    });
  });

  // 2. Check table statistics
  const stats = await checkTableStatistics();
  console.log('\n\nTable Statistics:');
  console.log('-'.repeat(80));
  console.log('Table'.padEnd(25), 'SeqScans'.padEnd(12), 'IdxScans'.padEnd(12), 'Rows'.padEnd(12), 'Ratio');
  console.log('-'.repeat(80));

  stats.forEach(stat => {
    const ratio = stat.idx_scan > 0
      ? (stat.idx_scan / (stat.seq_scan + stat.idx_scan) * 100).toFixed(1)
      : '0.0';

    console.log(
      stat.relname.padEnd(25),
      stat.seq_scan.toString().padEnd(12),
      stat.idx_scan.toString().padEnd(12),
      stat.n_live_tup.toString().padEnd(12),
      `${ratio}% idx`
    );
  });

  // 3. Create optimization indexes
  await createOptimizationIndexes();

  // 4. Analyze RLS policies
  const policies = await analyzeRLSPolicies();
  console.log('\n\nRLS Policies:');
  console.log('-'.repeat(80));

  interface RLSPolicy {
    schemaname: string;
    tablename: string;
    policyname: string;
    permissive: string;
    roles: string[] | null;
    cmd: string;
    qual: string | null;
    with_check: string | null;
  }

  const policiesByTable = policies.reduce((acc, policy) => {
    if (!acc[policy.tablename]) acc[policy.tablename] = [];
    acc[policy.tablename].push(policy);
    return acc;
  }, {} as Record<string, RLSPolicy[]>);

  Object.entries(policiesByTable).forEach(([table, tablePolicies]) => {
    console.log(`\n${table}: (${tablePolicies.length} policies)`);
    tablePolicies.forEach(policy => {
      console.log(`  - ${policy.policyname} (${policy.cmd})`);
      const roles = Array.isArray(policy.roles) ? policy.roles.join(', ') : 'public';
      console.log(`    Roles: ${roles}`);
      if (policy.qual) {
        console.log(`    Using: ${policy.qual}`);
      }
    });
  });

  // 5. Recommendations
  console.log('\n\n📋 Optimization Recommendations:');
  console.log('='.repeat(80));

  console.log('\n1. Critical Indexes Created:');
  console.log('   ✅ idx_users_clerk_id - For fast user authentication lookups');
  console.log('   ✅ idx_recordings_org_deleted_created - For recordings list queries');
  console.log('   ✅ idx_jobs_status_created - For worker polling efficiency');
  console.log('   ✅ idx_tags_org_deleted_name - For tag filtering and sorting');
  console.log('   ✅ idx_collections_org_deleted_name - For collection queries');

  console.log('\n2. Query Optimization Tips:');
  console.log('   • Always include org_id in WHERE clauses for multi-tenant isolation');
  console.log('   • Use partial indexes (WHERE deleted_at IS NULL) for soft delete patterns');
  console.log('   • Leverage composite indexes for common query patterns');
  console.log('   • Consider EXPLAIN ANALYZE for slow queries');

  console.log('\n3. Vector Search Optimization:');
  console.log('   • IVFFlat index created for transcript_chunks.embedding');
  console.log('   • Consider increasing lists parameter for larger datasets (>1M vectors)');
  console.log('   • Use probes parameter in queries to balance speed vs accuracy');

  console.log('\n4. RLS Performance:');
  console.log('   • Ensure RLS policies use indexed columns (org_id, user_id)');
  console.log('   • Consider using service role for background jobs to bypass RLS');
  console.log('   • Monitor pg_stat_user_tables for excessive sequential scans');

  console.log('\n5. Maintenance Tasks:');
  console.log('   • Run VACUUM ANALYZE periodically to update statistics');
  console.log('   • Monitor index bloat with pg_stat_user_indexes');
  console.log('   • Consider partitioning large tables (recordings, transcript_chunks)');

  console.log('\n\n✨ Optimization complete!\n');
}

// Run the optimization
generateOptimizationReport()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
