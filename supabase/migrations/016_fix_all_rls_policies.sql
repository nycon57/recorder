-- Migration: Fix ALL RLS policies using incorrect auth pattern
-- Description: Corrects authentication pattern across ALL tables to use clerk_id
-- Issue: Migration 012 introduced incorrect pattern (id = auth.uid() vs clerk_id = auth.uid()::text)
--        This pattern was copied to migration 014
-- Affected Tables: recording_summaries, video_frames, connector_configs,
--                  imported_documents, search_analytics, agentic_search_logs
-- Created: 2025-10-12

-- =============================================================================
-- TABLE: recording_summaries (from migration 012)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view summaries from their org" ON recording_summaries;
DROP POLICY IF EXISTS "System can insert summaries" ON recording_summaries;
DROP POLICY IF EXISTS "System can update summaries" ON recording_summaries;

CREATE POLICY "Users can view summaries from their org"
  ON recording_summaries FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "System can insert summaries"
  ON recording_summaries FOR INSERT
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "System can update summaries"
  ON recording_summaries FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- TABLE: video_frames (from migration 012)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view frames from their org" ON video_frames;

CREATE POLICY "Users can view frames from their org"
  ON video_frames FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- =============================================================================
-- TABLE: connector_configs (from migration 012)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view connectors from their org" ON connector_configs;
DROP POLICY IF EXISTS "Users can create connectors for their org" ON connector_configs;
DROP POLICY IF EXISTS "Users can update their org's connectors" ON connector_configs;
DROP POLICY IF EXISTS "Users can delete their org's connectors" ON connector_configs;

CREATE POLICY "Users can view connectors from their org"
  ON connector_configs FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can create connectors for their org"
  ON connector_configs FOR INSERT
  TO authenticated
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can update their org's connectors"
  ON connector_configs FOR UPDATE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text))
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can delete their org's connectors"
  ON connector_configs FOR DELETE
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- =============================================================================
-- TABLE: imported_documents (from migration 012)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view imported docs from their org" ON imported_documents;

CREATE POLICY "Users can view imported docs from their org"
  ON imported_documents FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- =============================================================================
-- TABLE: search_analytics (from migration 012)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view analytics from their org" ON search_analytics;

CREATE POLICY "Users can view analytics from their org"
  ON search_analytics FOR SELECT
  TO authenticated
  USING (org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid()::text));

-- =============================================================================
-- TABLE: agentic_search_logs (from migration 014, fixed in 015)
-- =============================================================================
-- NOTE: This table's policies were already fixed in migration 015
-- No action needed here

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  -- Count policies using incorrect pattern (should be 0 after this migration)
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE policyname LIKE '%org%'
    AND definition LIKE '%id = auth.uid()%'
    AND schemaname = 'public';

  IF policy_count > 0 THEN
    RAISE WARNING 'Still found % policies using incorrect auth pattern', policy_count;
  ELSE
    RAISE NOTICE 'All RLS policies successfully fixed to use clerk_id pattern';
  END IF;

  -- List all affected tables for confirmation
  RAISE NOTICE 'Fixed policies for tables: recording_summaries, video_frames, connector_configs, imported_documents, search_analytics';
END $$;
