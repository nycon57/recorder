-- Vector Search Functions for Phase 4
-- Created: 2025-10-07

-- Function to match chunks using cosine similarity
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_org_id uuid DEFAULT NULL,
  filter_recording_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  recording_id uuid,
  recording_title text,
  chunk_text text,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id,
    tc.recording_id,
    r.title as recording_title,
    tc.chunk_text,
    1 - (tc.embedding <=> query_embedding) as similarity,
    tc.metadata,
    tc.created_at
  FROM transcript_chunks tc
  JOIN recordings r ON r.id = tc.recording_id
  WHERE
    (filter_org_id IS NULL OR tc.org_id = filter_org_id)
    AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar chunks to a given chunk
CREATE OR REPLACE FUNCTION find_similar_chunks(
  source_chunk_id uuid,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  recording_id uuid,
  recording_title text,
  chunk_text text,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
DECLARE
  source_embedding vector(1536);
  source_org_id uuid;
BEGIN
  -- Get the embedding and org_id of the source chunk
  SELECT tc.embedding, tc.org_id INTO source_embedding, source_org_id
  FROM transcript_chunks tc
  WHERE tc.id = source_chunk_id;

  IF source_embedding IS NULL THEN
    RAISE EXCEPTION 'Chunk not found: %', source_chunk_id;
  END IF;

  RETURN QUERY
  SELECT
    tc.id,
    tc.recording_id,
    r.title as recording_title,
    tc.chunk_text,
    1 - (tc.embedding <=> source_embedding) as similarity,
    tc.metadata,
    tc.created_at
  FROM transcript_chunks tc
  JOIN recordings r ON r.id = tc.recording_id
  WHERE
    tc.org_id = source_org_id
    AND tc.id != source_chunk_id
    AND 1 - (tc.embedding <=> source_embedding) > match_threshold
  ORDER BY tc.embedding <=> source_embedding
  LIMIT match_count;
END;
$$;

-- Function for hybrid search (vector + keyword)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_org_id uuid DEFAULT NULL,
  filter_recording_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  recording_id uuid,
  recording_title text,
  chunk_text text,
  similarity float,
  keyword_rank float,
  combined_score float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      tc.id,
      tc.recording_id,
      r.title as recording_title,
      tc.chunk_text,
      1 - (tc.embedding <=> query_embedding) as similarity,
      tc.metadata,
      tc.created_at
    FROM transcript_chunks tc
    JOIN recordings r ON r.id = tc.recording_id
    WHERE
      (filter_org_id IS NULL OR tc.org_id = filter_org_id)
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ),
  keyword_results AS (
    SELECT
      tc.id,
      ts_rank(to_tsvector('english', tc.chunk_text), websearch_to_tsquery('english', query_text)) as rank
    FROM transcript_chunks tc
    WHERE
      (filter_org_id IS NULL OR tc.org_id = filter_org_id)
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      AND to_tsvector('english', tc.chunk_text) @@ websearch_to_tsquery('english', query_text)
  )
  SELECT
    vr.id,
    vr.recording_id,
    vr.recording_title,
    vr.chunk_text,
    vr.similarity,
    COALESCE(kr.rank, 0.0) as keyword_rank,
    (vr.similarity * 0.7 + COALESCE(kr.rank, 0.0) * 0.3) as combined_score,
    vr.metadata,
    vr.created_at
  FROM vector_results vr
  LEFT JOIN keyword_results kr ON kr.id = vr.id
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Function to get search statistics for an organization
CREATE OR REPLACE FUNCTION get_search_stats(org_id_param uuid)
RETURNS TABLE (
  total_chunks bigint,
  total_recordings bigint,
  avg_chunks_per_recording numeric,
  total_transcript_chunks bigint,
  total_document_chunks bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_chunks,
    COUNT(DISTINCT recording_id)::bigint as total_recordings,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT recording_id), 0), 2) as avg_chunks_per_recording,
    COUNT(*) FILTER (WHERE (metadata->>'source') = 'transcript')::bigint as total_transcript_chunks,
    COUNT(*) FILTER (WHERE (metadata->>'source') = 'document')::bigint as total_document_chunks
  FROM transcript_chunks
  WHERE org_id = org_id_param;
END;
$$;

-- Create index on chunk_text for full-text search
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_text_search
ON transcript_chunks
USING gin(to_tsvector('english', chunk_text));

-- Create index on metadata for filtering
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_metadata_source
ON transcript_chunks ((metadata->>'source'));

-- Create index on recording_id for filtering
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_recording_id
ON transcript_chunks (recording_id);

-- Add comment to explain vector search
COMMENT ON FUNCTION match_chunks IS
'Performs semantic search using pgvector cosine similarity. Returns chunks most similar to the query embedding.';

COMMENT ON FUNCTION find_similar_chunks IS
'Finds chunks similar to a given source chunk. Useful for "related content" features.';

COMMENT ON FUNCTION hybrid_search IS
'Combines vector similarity search with PostgreSQL full-text search for better results.';

COMMENT ON FUNCTION get_search_stats IS
'Returns statistics about searchable content for an organization.';
