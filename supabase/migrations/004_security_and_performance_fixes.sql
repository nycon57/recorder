-- ============================================================================
-- SECURITY AND PERFORMANCE FIXES
-- ============================================================================
--
-- This migration addresses issues found by Supabase advisors:
-- 1. Fixes mutable search_path in functions (security)
-- 2. Adds missing indexes on foreign keys (performance)
-- 3. Documents intentional RLS exceptions
--

-- ============================================================================
-- FIX FUNCTION SEARCH_PATH (Security)
-- ============================================================================

-- Fix: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix: user_has_org_access
CREATE OR REPLACE FUNCTION user_has_org_access(
  p_user_id TEXT,
  p_org_id UUID,
  p_min_role TEXT DEFAULT 'reader'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_hierarchy TEXT[] := ARRAY['reader', 'contributor', 'admin', 'owner'];
  min_role_level INT;
  user_role_level INT;
BEGIN
  SELECT role INTO user_role
  FROM public.user_organizations
  WHERE user_id = p_user_id AND org_id = p_org_id;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT array_position(role_hierarchy, p_min_role) INTO min_role_level;
  SELECT array_position(role_hierarchy, user_role) INTO user_role_level;

  RETURN user_role_level >= min_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix: get_user_org_ids
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id TEXT)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT org_id
    FROM public.user_organizations
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Fix: match_chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding public.vector(1536),
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
SET search_path = ''
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
  FROM public.transcript_chunks tc
  JOIN public.recordings r ON r.id = tc.recording_id
  WHERE
    (filter_org_id IS NULL OR tc.org_id = filter_org_id)
    AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Fix: find_similar_chunks
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
SET search_path = ''
AS $$
DECLARE
  source_embedding public.vector(1536);
  source_org_id uuid;
BEGIN
  SELECT tc.embedding, tc.org_id INTO source_embedding, source_org_id
  FROM public.transcript_chunks tc
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
  FROM public.transcript_chunks tc
  JOIN public.recordings r ON r.id = tc.recording_id
  WHERE
    tc.org_id = source_org_id
    AND tc.id != source_chunk_id
    AND 1 - (tc.embedding <=> source_embedding) > match_threshold
  ORDER BY tc.embedding <=> source_embedding
  LIMIT match_count;
END;
$$;

-- Fix: hybrid_search
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text text,
  query_embedding public.vector(1536),
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
SET search_path = ''
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
    FROM public.transcript_chunks tc
    JOIN public.recordings r ON r.id = tc.recording_id
    WHERE
      (filter_org_id IS NULL OR tc.org_id = filter_org_id)
      AND (filter_recording_ids IS NULL OR tc.recording_id = ANY(filter_recording_ids))
      AND 1 - (tc.embedding <=> query_embedding) > match_threshold
  ),
  keyword_results AS (
    SELECT
      tc.id,
      ts_rank(to_tsvector('english', tc.chunk_text), websearch_to_tsquery('english', query_text)) as rank
    FROM public.transcript_chunks tc
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

-- Fix: get_search_stats
CREATE OR REPLACE FUNCTION get_search_stats(org_id_param uuid)
RETURNS TABLE (
  total_chunks bigint,
  total_recordings bigint,
  avg_chunks_per_recording numeric,
  total_transcript_chunks bigint,
  total_document_chunks bigint
)
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_chunks,
    COUNT(DISTINCT recording_id)::bigint as total_recordings,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT recording_id), 0), 2) as avg_chunks_per_recording,
    COUNT(*) FILTER (WHERE (metadata->>'source') = 'transcript')::bigint as total_transcript_chunks,
    COUNT(*) FILTER (WHERE (metadata->>'source') = 'document')::bigint as total_document_chunks
  FROM public.transcript_chunks
  WHERE org_id = org_id_param;
END;
$$;

-- ============================================================================
-- ADD MISSING INDEXES (Performance)
-- ============================================================================

-- Index for chat_conversations.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id
ON chat_conversations(user_id);

-- Index for shares.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_shares_created_by
ON shares(created_by);

-- ============================================================================
-- DOCUMENTATION FOR INTENTIONAL RLS EXCEPTIONS
-- ============================================================================

COMMENT ON TABLE jobs IS
'Backend-only table for background job processing. RLS intentionally disabled - accessed only by worker processes with service_role.';

COMMENT ON TABLE events IS
'Backend-only table for event outbox pattern. RLS intentionally disabled - accessed only by service_role for event processing.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all functions have search_path set
-- Run this to check:
-- SELECT
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as arguments,
--   CASE
--     WHEN p.proconfig IS NULL THEN 'No search_path set'
--     WHEN 'search_path=' = ANY(p.proconfig) THEN 'search_path set to empty'
--     ELSE array_to_string(p.proconfig, ', ')
--   END as search_path_config
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.prokind = 'f'
-- ORDER BY p.proname;
