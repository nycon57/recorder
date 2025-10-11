/**
 * Database query optimization utilities
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/monitoring/logger';
import { trackMetrics } from '@/lib/monitoring/metrics';

/**
 * Measure query performance
 */
export async function measureQuery<T>(
  operation: string,
  table: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    // Log slow queries (>1s)
    if (duration > 1000) {
      logger.warn('Slow query detected', {
        operation,
        table,
        duration,
      });
    }

    // Track metrics
    trackMetrics.dbQuery(operation, table, duration);

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    trackMetrics.dbQuery(operation, table, duration);
    throw error;
  }
}

/**
 * Batch query executor
 *
 * Executes multiple queries in parallel to reduce round trips.
 */
export async function batchQuery<T>(
  queries: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(queries.map((query) => query()));
}

/**
 * Paginated query helper with cursor-based pagination
 */
export interface PaginationOptions {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

/**
 * Execute paginated query with cursor
 */
export async function paginatedQuery<T extends { id: string; created_at: string }>(
  supabase: SupabaseClient,
  table: string,
  options: PaginationOptions & {
    filters?: Record<string, any>;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<PaginatedResult<T>> {
  const {
    limit = 50,
    cursor,
    filters = {},
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options;

  let query = supabase.from(table).select('*');

  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  // Apply cursor pagination
  if (cursor) {
    const operator = orderDirection === 'desc' ? 'lt' : 'gt';
    query = query[operator](orderBy, cursor);
  }

  // Order and limit
  query = query.order(orderBy, { ascending: orderDirection === 'asc' }).limit(limit + 1);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const nextCursor = hasMore ? items[items.length - 1][orderBy as keyof T] as string : undefined;

  return {
    data: items as T[],
    nextCursor,
    hasMore,
  };
}

/**
 * Bulk insert with batching
 */
export async function bulkInsert<T>(
  supabase: SupabaseClient,
  table: string,
  records: T[],
  batchSize: number = 1000
): Promise<void> {
  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  await Promise.all(
    batches.map(async (batch) => {
      const { error } = await supabase.from(table).insert(batch);
      if (error) {
        logger.error('Bulk insert error', error as Error, { table, batchSize: batch.length });
        throw error;
      }
    })
  );
}

/**
 * Database indexes recommendation
 */
export const RECOMMENDED_INDEXES = `
-- Performance-critical indexes for the application

-- Recordings
CREATE INDEX IF NOT EXISTS idx_recordings_org_created
  ON recordings(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recordings_status
  ON recordings(status) WHERE status != 'completed';

-- Transcripts
CREATE INDEX IF NOT EXISTS idx_transcripts_recording
  ON transcripts(recording_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_org
  ON transcripts(org_id);

-- Transcript chunks (for vector search)
CREATE INDEX IF NOT EXISTS idx_chunks_recording
  ON transcript_chunks(recording_id);
CREATE INDEX IF NOT EXISTS idx_chunks_org
  ON transcript_chunks(org_id);
-- IVFFlat index for vector similarity (already in migrations)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
  ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_recording
  ON documents(recording_id);
CREATE INDEX IF NOT EXISTS idx_documents_org
  ON documents(org_id);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_org
  ON conversations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages(conversation_id, created_at ASC);

-- Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON jobs(status, created_at ASC)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_jobs_dedupe
  ON jobs(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- Shares
CREATE INDEX IF NOT EXISTS idx_shares_resource
  ON shares(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_shares_shareId
  ON shares(share_id);

-- Users (for org/role lookups)
CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON users(org_id, role);
`;
