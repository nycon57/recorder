-- Migration: Add agentic_search_logs table
-- Description: Logs for agentic retrieval executions, including query decomposition and iteration traces
-- Created: 2025-10-12

-- Create agentic_search_logs table
CREATE TABLE agentic_search_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  original_query TEXT NOT NULL,
  query_intent TEXT CHECK (
    query_intent IN ('single_fact', 'multi_part', 'comparison', 'exploration', 'how_to')
  ),
  subqueries JSONB DEFAULT '[]'::jsonb,
  iterations JSONB DEFAULT '[]'::jsonb,
  final_results JSONB,
  total_duration_ms INTEGER,
  chunks_retrieved INTEGER,
  confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add table comment
COMMENT ON TABLE agentic_search_logs IS 'Logs for agentic retrieval executions, including query decomposition and iteration traces';

-- Add column comments for documentation
COMMENT ON COLUMN agentic_search_logs.org_id IS 'Organization that owns this search log';
COMMENT ON COLUMN agentic_search_logs.user_id IS 'User who initiated the search (NULL if user deleted)';
COMMENT ON COLUMN agentic_search_logs.original_query IS 'The original user query';
COMMENT ON COLUMN agentic_search_logs.query_intent IS 'Classified intent: single_fact, multi_part, comparison, exploration, or how_to';
COMMENT ON COLUMN agentic_search_logs.subqueries IS 'Array of sub-queries generated from query decomposition';
COMMENT ON COLUMN agentic_search_logs.iterations IS 'Execution trace of each iteration including search results and decisions';
COMMENT ON COLUMN agentic_search_logs.final_results IS 'Final aggregated search results returned to user';
COMMENT ON COLUMN agentic_search_logs.total_duration_ms IS 'Total execution time in milliseconds';
COMMENT ON COLUMN agentic_search_logs.chunks_retrieved IS 'Total number of chunks retrieved across all iterations';
COMMENT ON COLUMN agentic_search_logs.confidence_score IS 'Average confidence score (0-1) of the final results';
COMMENT ON COLUMN agentic_search_logs.reasoning_path IS 'Human-readable explanation of the search reasoning and decisions';

-- Create indexes for efficient querying
CREATE INDEX idx_agentic_logs_org_id ON agentic_search_logs(org_id);
CREATE INDEX idx_agentic_logs_user_id ON agentic_search_logs(user_id);
CREATE INDEX idx_agentic_logs_created_at ON agentic_search_logs(created_at DESC);
CREATE INDEX idx_agentic_logs_intent ON agentic_search_logs(query_intent);

-- Additional index for analytics queries (org + date range)
CREATE INDEX idx_agentic_logs_org_created ON agentic_search_logs(org_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE agentic_search_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their org's search logs
CREATE POLICY "Users can view their org's search logs"
  ON agentic_search_logs
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- RLS Policy: Users can insert logs for their org
CREATE POLICY "Users can insert logs for their org"
  ON agentic_search_logs
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- RLS Policy: Service role can manage all logs
CREATE POLICY "Service role can manage all logs"
  ON agentic_search_logs
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );
