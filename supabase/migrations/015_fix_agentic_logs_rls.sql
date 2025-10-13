-- Migration: Fix RLS policies for agentic_search_logs
-- Description: Corrects authentication pattern to use clerk_id instead of id
-- Issue: Migration 014 used incorrect auth pattern (id = auth.uid() vs clerk_id = auth.uid()::text)
-- Created: 2025-10-12

-- =============================================================================
-- DROP INCORRECT POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Users can view their org's search logs" ON agentic_search_logs;
DROP POLICY IF EXISTS "Users can insert logs for their org" ON agentic_search_logs;
DROP POLICY IF EXISTS "Service role can manage all logs" ON agentic_search_logs;

-- =============================================================================
-- CREATE CORRECTED POLICIES
-- =============================================================================

-- RLS Policy: Users can view their org's search logs
-- Uses clerk_id pattern (consistent with migrations 007-009)
CREATE POLICY "Users can view their org's search logs"
  ON agentic_search_logs
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id
      FROM users
      WHERE clerk_id = auth.uid()::text
    )
  );

-- RLS Policy: Users can insert logs for their org
-- Uses clerk_id pattern (consistent with migrations 007-009)
CREATE POLICY "Users can insert logs for their org"
  ON agentic_search_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT org_id
      FROM users
      WHERE clerk_id = auth.uid()::text
    )
  );

-- RLS Policy: Service role can manage all logs
-- Service role bypasses RLS by default, but explicit policy for documentation
CREATE POLICY "Service role can manage all logs"
  ON agentic_search_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- ADD PERFORMANCE INDEXES FOR ANALYTICS QUERIES
-- =============================================================================

-- Index for quality analysis queries (filtering by confidence score)
CREATE INDEX IF NOT EXISTS idx_agentic_logs_confidence
  ON agentic_search_logs(confidence_score DESC NULLS LAST)
  WHERE confidence_score IS NOT NULL;

-- Index for performance troubleshooting queries (slow query analysis)
CREATE INDEX IF NOT EXISTS idx_agentic_logs_duration
  ON agentic_search_logs(total_duration_ms DESC)
  WHERE total_duration_ms > 5000;

-- Index for user activity analysis
CREATE INDEX IF NOT EXISTS idx_agentic_logs_user_created
  ON agentic_search_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Verify RLS is still enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'agentic_search_logs') THEN
    RAISE EXCEPTION 'RLS is not enabled on agentic_search_logs table';
  END IF;

  RAISE NOTICE 'RLS policies successfully fixed for agentic_search_logs';
  RAISE NOTICE 'Added 3 performance indexes for analytics queries';
END $$;
