-- Phase 1: Foundation Enhancements
-- Multi-layer indexing, document summaries, video frames, analytics, and caching

-- =============================================================================
-- TABLE: recording_summaries
-- Purpose: Store LLM-generated summaries of recordings for hierarchical search
-- =============================================================================
CREATE TABLE IF NOT EXISTS recording_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  summary_embedding vector(3072), -- Higher dimension for better summary representation
  model TEXT DEFAULT 'gemini-2.5-flash', -- Model used for summarization
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(recording_id), -- One summary per recording
  CHECK (char_length(summary_text) >= 50) -- Minimum summary length
);

-- Indexes
CREATE INDEX idx_recording_summaries_recording_id ON recording_summaries(recording_id);
CREATE INDEX idx_recording_summaries_org_id ON recording_summaries(org_id);
CREATE INDEX idx_recording_summaries_embedding ON recording_summaries USING ivfflat (summary_embedding vector_cosine_ops);

-- RLS Policies
ALTER TABLE recording_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view summaries from their org"
  ON recording_summaries FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "System can insert summaries"
  ON recording_summaries FOR INSERT
  WITH CHECK (true); -- Service role only

CREATE POLICY "System can update summaries"
  ON recording_summaries FOR UPDATE
  USING (true); -- Service role only

-- =============================================================================
-- TABLE: video_frames
-- Purpose: Store extracted video frames with visual embeddings for multimodal search
-- =============================================================================
CREATE TABLE IF NOT EXISTS video_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  frame_time_sec FLOAT NOT NULL,
  frame_url TEXT, -- S3/Supabase Storage path to frame image
  visual_description TEXT, -- LLM-generated description of frame
  visual_embedding vector(512), -- CLIP embeddings (512-dim)
  ocr_text TEXT, -- Extracted text from frame via OCR
  metadata JSONB DEFAULT '{}'::jsonb, -- Scene type, detected objects, etc.
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CHECK (frame_time_sec >= 0),
  CHECK (visual_embedding IS NULL OR vector_dims(visual_embedding) = 512)
);

-- Indexes
CREATE INDEX idx_video_frames_recording_id ON video_frames(recording_id);
CREATE INDEX idx_video_frames_org_id ON video_frames(org_id);
CREATE INDEX idx_video_frames_time ON video_frames(recording_id, frame_time_sec);
CREATE INDEX idx_video_frames_embedding ON video_frames USING ivfflat (visual_embedding vector_cosine_ops);

-- RLS Policies
ALTER TABLE video_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view frames from their org"
  ON video_frames FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- TABLE: connector_configs
-- Purpose: Store configuration for external data source connectors
-- =============================================================================
CREATE TABLE IF NOT EXISTS connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connector_type TEXT NOT NULL, -- 'google_drive', 'notion', 'file_upload', 'url_import'
  name TEXT, -- User-friendly name
  credentials JSONB NOT NULL, -- Encrypted OAuth tokens or API keys
  settings JSONB DEFAULT '{}'::jsonb, -- Connector-specific settings (folder IDs, filters, etc.)
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  sync_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CHECK (connector_type IN ('google_drive', 'notion', 'confluence', 'file_upload', 'url_import', 'slack')),
  CHECK (sync_status IN ('idle', 'syncing', 'error'))
);

-- Indexes
CREATE INDEX idx_connector_configs_org_id ON connector_configs(org_id);
CREATE INDEX idx_connector_configs_type ON connector_configs(connector_type);
CREATE INDEX idx_connector_configs_active ON connector_configs(org_id, is_active);

-- RLS Policies
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view connectors from their org"
  ON connector_configs FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create connectors for their org"
  ON connector_configs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org's connectors"
  ON connector_configs FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their org's connectors"
  ON connector_configs FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- TABLE: imported_documents
-- Purpose: Track documents imported from external connectors
-- =============================================================================
CREATE TABLE IF NOT EXISTS imported_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID NOT NULL REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- ID in source system (Drive file ID, Notion page ID, etc.)
  title TEXT,
  content TEXT,
  file_type TEXT, -- 'pdf', 'docx', 'md', 'html', 'notion_page', etc.
  source_url TEXT, -- Link back to original document
  file_size_bytes BIGINT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Author, modified date, tags, etc.
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  sync_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  UNIQUE(connector_id, external_id), -- Prevent duplicate imports
  CHECK (sync_status IN ('pending', 'processing', 'completed', 'error'))
);

-- Indexes
CREATE INDEX idx_imported_documents_connector ON imported_documents(connector_id);
CREATE INDEX idx_imported_documents_org ON imported_documents(org_id);
CREATE INDEX idx_imported_documents_status ON imported_documents(sync_status) WHERE sync_status != 'completed';
CREATE INDEX idx_imported_documents_external_id ON imported_documents(connector_id, external_id);

-- RLS Policies
ALTER TABLE imported_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view imported docs from their org"
  ON imported_documents FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- TABLE: search_analytics
-- Purpose: Track search queries for quality monitoring and optimization
-- =============================================================================
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  query_hash TEXT, -- Hash for deduplication
  results_count INTEGER,
  latency_ms INTEGER,
  mode TEXT, -- 'standard', 'agentic', 'hybrid', 'hierarchical'
  filters JSONB DEFAULT '{}'::jsonb,
  top_result_similarity FLOAT, -- Similarity score of top result
  user_feedback INTEGER, -- 1 for thumbs up, -1 for thumbs down, null for no feedback
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CHECK (mode IN ('standard', 'agentic', 'hybrid', 'hierarchical')),
  CHECK (user_feedback IN (-1, 1) OR user_feedback IS NULL),
  CHECK (latency_ms >= 0),
  CHECK (results_count >= 0)
);

-- Indexes
CREATE INDEX idx_search_analytics_org ON search_analytics(org_id);
CREATE INDEX idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_created ON search_analytics(created_at DESC);
CREATE INDEX idx_search_analytics_query_hash ON search_analytics(query_hash);

-- RLS Policies
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics from their org"
  ON search_analytics FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- =============================================================================
-- TABLE: query_cache
-- Purpose: Cache query embeddings and search results for performance
-- =============================================================================
CREATE TABLE IF NOT EXISTS query_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  query_embedding vector(1536),
  results JSONB NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  ttl TIMESTAMPTZ NOT NULL, -- Time-to-live for cache invalidation
  hit_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CHECK (ttl > now())
);

-- Indexes
CREATE INDEX idx_query_cache_hash ON query_cache(query_hash);
CREATE INDEX idx_query_cache_ttl ON query_cache(ttl) WHERE ttl > now();
CREATE INDEX idx_query_cache_embedding ON query_cache USING ivfflat (query_embedding vector_cosine_ops);

-- Auto-cleanup expired cache entries (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM query_cache WHERE ttl < now();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- UPDATE: jobs table to support new job types
-- =============================================================================
DO $$ BEGIN
  -- Add new job types if not exists
  ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'generate_summary';
  ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'extract_frames';
  ALTER TYPE job_type ADD VALUE IF NOT EXISTS 'sync_connector';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================================================
-- FUNCTION: Vector search with recency bias
-- =============================================================================
CREATE OR REPLACE FUNCTION search_chunks_with_recency(
  query_embedding vector(1536),
  match_org_id UUID,
  match_count INTEGER DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  recency_weight FLOAT DEFAULT 0.0, -- 0.0 = no recency bias, 1.0 = max bias
  recency_decay_days INTEGER DEFAULT 30 -- How many days until score decays to 0
)
RETURNS TABLE (
  id UUID,
  recording_id UUID,
  recording_title TEXT,
  chunk_text TEXT,
  similarity FLOAT,
  recency_score FLOAT,
  final_score FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.recording_id,
    r.title AS recording_title,
    tc.chunk_text,
    1 - (tc.embedding <=> query_embedding) AS similarity,
    CASE
      WHEN recency_weight > 0 THEN
        GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - r.created_at)) / (recency_decay_days * 86400)))
      ELSE 0
    END AS recency_score,
    (1 - (tc.embedding <=> query_embedding)) *
    (1 + recency_weight * GREATEST(0, 1 - (EXTRACT(EPOCH FROM (now() - r.created_at)) / (recency_decay_days * 86400)))) AS final_score,
    tc.metadata,
    tc.created_at
  FROM transcript_chunks tc
  INNER JOIN recordings r ON tc.recording_id = r.id
  WHERE tc.org_id = match_org_id
    AND 1 - (tc.embedding <=> query_embedding) >= match_threshold
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- FUNCTION: Hierarchical search (summaries → chunks)
-- =============================================================================
CREATE OR REPLACE FUNCTION hierarchical_search(
  query_embedding_1536 vector(1536),
  query_embedding_3072 vector(3072),
  match_org_id UUID,
  top_documents INTEGER DEFAULT 5,
  chunks_per_document INTEGER DEFAULT 3,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  recording_id UUID,
  recording_title TEXT,
  chunk_text TEXT,
  similarity FLOAT,
  summary_similarity FLOAT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
DECLARE
  relevant_recordings UUID[];
BEGIN
  -- Step 1: Find top-k most relevant recordings via summary search
  SELECT ARRAY_AGG(rs.recording_id ORDER BY (1 - (rs.summary_embedding <=> query_embedding_3072)) DESC)
  INTO relevant_recordings
  FROM recording_summaries rs
  WHERE rs.org_id = match_org_id
    AND 1 - (rs.summary_embedding <=> query_embedding_3072) >= match_threshold
  LIMIT top_documents;

  -- Step 2: For each relevant recording, get top chunks
  RETURN QUERY
  SELECT DISTINCT ON (tc.recording_id, tc.id)
    tc.id,
    tc.recording_id,
    r.title AS recording_title,
    tc.chunk_text,
    1 - (tc.embedding <=> query_embedding_1536) AS similarity,
    1 - (rs.summary_embedding <=> query_embedding_3072) AS summary_similarity,
    tc.metadata,
    tc.created_at
  FROM transcript_chunks tc
  INNER JOIN recordings r ON tc.recording_id = r.id
  LEFT JOIN recording_summaries rs ON tc.recording_id = rs.recording_id
  WHERE tc.recording_id = ANY(relevant_recordings)
    AND tc.org_id = match_org_id
    AND 1 - (tc.embedding <=> query_embedding_1536) >= match_threshold
  ORDER BY tc.recording_id, (1 - (tc.embedding <=> query_embedding_1536)) DESC
  LIMIT top_documents * chunks_per_document;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE recording_summaries IS 'LLM-generated summaries for hierarchical retrieval';
COMMENT ON TABLE video_frames IS 'Extracted frames with visual embeddings for multimodal search';
COMMENT ON TABLE connector_configs IS 'External data source connectors (Google Drive, Notion, etc.)';
COMMENT ON TABLE imported_documents IS 'Documents synced from external connectors';
COMMENT ON TABLE search_analytics IS 'Query logs for monitoring and optimization';
COMMENT ON TABLE query_cache IS 'Cache layer for frequently accessed queries';

COMMENT ON FUNCTION search_chunks_with_recency IS 'Vector search with time-weighted scoring';
COMMENT ON FUNCTION hierarchical_search IS 'Two-tier search: summaries → chunks for better document diversity';

-- =============================================================================
-- GRANTS (for service role)
-- =============================================================================
GRANT ALL ON recording_summaries TO service_role;
GRANT ALL ON video_frames TO service_role;
GRANT ALL ON connector_configs TO service_role;
GRANT ALL ON imported_documents TO service_role;
GRANT ALL ON search_analytics TO service_role;
GRANT ALL ON query_cache TO service_role;
