-- Performance optimization indexes for multi-format content support
-- These indexes significantly improve query performance for library, dashboard, and search operations

-- ============================================================================
-- RECORDINGS TABLE INDEXES
-- ============================================================================

-- Content type filtering optimization (for library page)
CREATE INDEX IF NOT EXISTS idx_recordings_org_content_created
  ON recordings(org_id, content_type, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordings_org_content_status
  ON recordings(org_id, content_type, status)
  WHERE deleted_at IS NULL;

-- Status-based queries optimization (for dashboard and monitoring)
CREATE INDEX IF NOT EXISTS idx_recordings_status_created
  ON recordings(status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_recordings_org_status
  ON recordings(org_id, status)
  WHERE deleted_at IS NULL;

-- Soft delete optimization (speeds up queries with deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at
  ON recordings(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- File size queries (for storage calculations)
CREATE INDEX IF NOT EXISTS idx_recordings_org_filesize
  ON recordings(org_id, file_size DESC)
  WHERE deleted_at IS NULL;

-- Text search optimization (requires pg_trgm extension)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_recordings_title_trgm
  ON recordings USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recordings_description_trgm
  ON recordings USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_recordings_filename_trgm
  ON recordings USING gin (original_filename gin_trgm_ops);

-- Combined search index for common search patterns
CREATE INDEX IF NOT EXISTS idx_recordings_search_text
  ON recordings USING gin (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(original_filename, ''))
  );

-- ============================================================================
-- TAGS TABLE INDEXES
-- ============================================================================

-- Tags listing optimization
CREATE INDEX IF NOT EXISTS idx_tags_org_deleted
  ON tags(org_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_tags_org_name
  ON tags(org_id, name)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- RECORDING_TAGS TABLE INDEXES
-- ============================================================================

-- Tag association queries
CREATE INDEX IF NOT EXISTS idx_recording_tags_composite
  ON recording_tags(recording_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_recording_tags_tag_recording
  ON recording_tags(tag_id, recording_id);

-- ============================================================================
-- JOBS TABLE INDEXES
-- ============================================================================

-- Job queue optimization (critical for worker performance)
CREATE INDEX IF NOT EXISTS idx_jobs_pending_run_at
  ON jobs(run_at, created_at)
  WHERE status = 'pending';

-- Note: jobs table doesn't have org_id column in current schema
-- CREATE INDEX IF NOT EXISTS idx_jobs_org_status
--   ON jobs(org_id, status, created_at DESC);

-- Job type filtering
CREATE INDEX IF NOT EXISTS idx_jobs_type_status
  ON jobs(type, status, created_at)
  WHERE status IN ('pending', 'processing');

-- Dedupe key lookup
CREATE INDEX IF NOT EXISTS idx_jobs_dedupe_key
  ON jobs(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- ============================================================================
-- TRANSCRIPTS TABLE INDEXES
-- ============================================================================

-- Transcript lookup by recording
CREATE INDEX IF NOT EXISTS idx_transcripts_recording_created
  ON transcripts(recording_id, created_at DESC);

-- Note: transcripts table doesn't have org_id column in current schema
-- Organization-based transcript queries should use recordings.org_id join
-- CREATE INDEX IF NOT EXISTS idx_transcripts_org_created
--   ON transcripts(org_id, created_at DESC);

-- ============================================================================
-- TRANSCRIPT_CHUNKS TABLE INDEXES
-- ============================================================================

-- Chunk lookup by recording
CREATE INDEX IF NOT EXISTS idx_chunks_recording_chunk_index
  ON transcript_chunks(recording_id, chunk_index);

-- Organization-based chunk queries
CREATE INDEX IF NOT EXISTS idx_chunks_org_created
  ON transcript_chunks(org_id, created_at DESC);

-- Vector similarity search (IVFFlat index for pgvector)
-- Note: Adjust 'lists' parameter based on data size (sqrt(n_rows))
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
  ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ============================================================================
-- DOCUMENTS TABLE INDEXES
-- ============================================================================

-- Document lookup by recording
CREATE INDEX IF NOT EXISTS idx_documents_recording_created
  ON documents(recording_id, created_at DESC);

-- Organization-based document queries
CREATE INDEX IF NOT EXISTS idx_documents_org_created
  ON documents(org_id, created_at DESC);

-- ============================================================================
-- CONVERSATIONS TABLE INDEXES
-- ============================================================================

-- Conversation listing
CREATE INDEX IF NOT EXISTS idx_conversations_org_created
  ON conversations(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_user_created
  ON conversations(user_id, created_at DESC);

-- ============================================================================
-- CHAT_MESSAGES TABLE INDEXES
-- ============================================================================

-- Message retrieval for conversations
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created
  ON chat_messages(conversation_id, created_at ASC);

-- ============================================================================
-- SHARES TABLE INDEXES
-- ============================================================================

-- Share lookup by resource (target)
CREATE INDEX IF NOT EXISTS idx_shares_target
  ON shares(target_type, target_id);

-- Share lookup by share ID
CREATE INDEX IF NOT EXISTS idx_shares_share_id
  ON shares(share_id);

-- ============================================================================
-- SEARCH_ANALYTICS TABLE INDEXES (for analytics)
-- ============================================================================

-- Analytics queries
CREATE INDEX IF NOT EXISTS idx_search_analytics_org_created
  ON search_analytics(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_user_created
  ON search_analytics(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_analytics_mode_created
  ON search_analytics(mode, created_at DESC);

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Organization member queries
CREATE INDEX IF NOT EXISTS idx_users_org_role
  ON users(org_id, role);

CREATE INDEX IF NOT EXISTS idx_users_clerk_id
  ON users(clerk_id);

-- ============================================================================
-- ORGANIZATIONS TABLE INDEXES
-- ============================================================================

-- Organization lookup by Clerk ID
CREATE INDEX IF NOT EXISTS idx_organizations_clerk_id
  ON organizations(clerk_org_id);

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update table statistics for query planner optimization
ANALYZE recordings;
ANALYZE tags;
ANALYZE recording_tags;
ANALYZE jobs;
ANALYZE transcripts;
ANALYZE transcript_chunks;
ANALYZE documents;
ANALYZE conversations;
ANALYZE chat_messages;
ANALYZE shares;
ANALYZE search_analytics;
ANALYZE users;
ANALYZE organizations;

-- ============================================================================
-- PERFORMANCE MONITORING FUNCTIONS
-- ============================================================================

-- Function to check index usage
CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE(
  schemaname text,
  tablename text,
  indexname text,
  index_size text,
  idx_scan bigint,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  is_unique boolean,
  is_primary boolean
)
LANGUAGE sql
AS $$
  SELECT
    psu.schemaname,
    psu.relname as tablename,
    psu.indexrelname as indexname,
    pg_size_pretty(pg_relation_size(psu.indexrelid)) as index_size,
    psu.idx_scan,
    psu.idx_tup_read,
    psu.idx_tup_fetch,
    pi.indisunique as is_unique,
    pi.indisprimary as is_primary
  FROM pg_stat_user_indexes psu
  JOIN pg_index pi ON pi.indexrelid = psu.indexrelid
  WHERE psu.schemaname = 'public'
  ORDER BY psu.idx_scan DESC;
$$;

-- Function to identify missing indexes
CREATE OR REPLACE FUNCTION suggest_missing_indexes()
RETURNS TABLE(
  tablename text,
  attname text,
  n_distinct real,
  correlation real,
  null_frac real,
  avg_width integer,
  most_common_vals text
)
LANGUAGE sql
AS $$
  SELECT
    tablename,
    attname,
    n_distinct,
    correlation,
    null_frac,
    avg_width,
    most_common_vals::text
  FROM pg_stats
  WHERE schemaname = 'public'
    AND n_distinct > 100
    AND correlation < 0.1
    AND null_frac < 0.5
  ORDER BY n_distinct DESC;
$$;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON INDEX idx_recordings_org_content_created IS 'Optimizes library filtering by content type';
COMMENT ON INDEX idx_recordings_org_content_status IS 'Optimizes dashboard stats by content type and status';
COMMENT ON INDEX idx_recordings_status_created IS 'Optimizes processing queue monitoring';
COMMENT ON INDEX idx_recordings_title_trgm IS 'Enables fuzzy text search on title';
COMMENT ON INDEX idx_recordings_description_trgm IS 'Enables fuzzy text search on description';
COMMENT ON INDEX idx_recordings_filename_trgm IS 'Enables fuzzy text search on filename';
COMMENT ON INDEX idx_jobs_pending_run_at IS 'Critical for job worker performance - indexes pending jobs by scheduled run time';
COMMENT ON INDEX idx_chunks_embedding_ivfflat IS 'Enables fast vector similarity search';