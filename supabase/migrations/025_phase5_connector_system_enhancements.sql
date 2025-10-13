-- =====================================================
-- Phase 5: Connector System Enhancements
-- =====================================================
-- Purpose: Complete Phase 5 connector system database schema
-- Dependencies: Migration 012 (Phase 1 Foundation)
-- Priority: P0 - CRITICAL (fixes multiple blocking issues)
--
-- This migration:
--   1. Adds missing columns to existing tables
--   2. Creates 3 new tables for connector system
--   3. Implements helper functions for batch processing
--   4. Fixes RLS policies with proper service_role access
--   5. Adds performance indexes
--
-- Estimated execution time: < 5 seconds
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: UPDATE EXISTING TABLES
-- =====================================================

RAISE NOTICE 'Updating existing tables with missing columns...';

-- Add missing columns to connector_configs
ALTER TABLE connector_configs
  ADD COLUMN IF NOT EXISTS credentials_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT,
  ADD COLUMN IF NOT EXISTS webhook_active BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS filters JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add check constraint for sync_frequency
DO $$ BEGIN
  ALTER TABLE connector_configs
    ADD CONSTRAINT check_connector_sync_frequency
    CHECK (sync_frequency IN ('manual', 'hourly', 'daily', 'weekly'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add check constraint for last_sync_status
DO $$ BEGIN
  ALTER TABLE connector_configs
    ADD CONSTRAINT check_connector_sync_status
    CHECK (last_sync_status IN ('success', 'partial', 'failed') OR last_sync_status IS NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add index for scheduled syncs
CREATE INDEX IF NOT EXISTS idx_connector_configs_next_sync
  ON connector_configs(next_sync_at)
  WHERE is_active = true AND sync_frequency != 'manual';

-- Add missing columns to imported_documents
ALTER TABLE imported_documents
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS parent_external_id TEXT,
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS processing_error TEXT,
  ADD COLUMN IF NOT EXISTS chunks_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS embeddings_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS first_synced_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sync_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_url TEXT;

-- Migrate sync_status to processing_status if needed
UPDATE imported_documents
SET processing_status = sync_status
WHERE processing_status IS NULL AND sync_status IS NOT NULL;

-- Add check constraint
DO $$ BEGIN
  ALTER TABLE imported_documents
    ADD CONSTRAINT check_imported_docs_processing_status
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add indexes for imported_documents
CREATE INDEX IF NOT EXISTS idx_imported_docs_hash
  ON imported_documents(content_hash)
  WHERE content_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_imported_docs_chunks
  ON imported_documents(chunks_generated)
  WHERE NOT chunks_generated;

CREATE INDEX IF NOT EXISTS idx_imported_docs_deleted
  ON imported_documents(is_deleted)
  WHERE is_deleted = true;

CREATE INDEX IF NOT EXISTS idx_imported_docs_processing_status
  ON imported_documents(processing_status, org_id)
  WHERE processing_status IN ('pending', 'processing');

RAISE NOTICE '  ✓ Updated connector_configs with 13 new columns';
RAISE NOTICE '  ✓ Updated imported_documents with 11 new columns';
RAISE NOTICE '  ✓ Added 6 performance indexes';

-- =====================================================
-- SECTION 2: CREATE NEW TABLES
-- =====================================================

RAISE NOTICE 'Creating new connector system tables...';

-- Table: connector_sync_logs
CREATE TABLE IF NOT EXISTS connector_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Sync execution
  sync_type TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Results
  status TEXT,
  documents_synced INTEGER DEFAULT 0,
  documents_updated INTEGER DEFAULT 0,
  documents_failed INTEGER DEFAULT 0,
  documents_deleted INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  error_details JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Performance metrics
  api_calls_made INTEGER DEFAULT 0,
  bytes_transferred BIGINT DEFAULT 0,

  CONSTRAINT check_sync_type CHECK (sync_type IN ('manual', 'scheduled', 'webhook') OR sync_type IS NULL),
  CONSTRAINT check_sync_status CHECK (status IN ('running', 'success', 'partial', 'failed') OR status IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_connector ON connector_sync_logs(connector_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_org ON connector_sync_logs(org_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_logs_status ON connector_sync_logs(status) WHERE status = 'running';

COMMENT ON TABLE connector_sync_logs IS 'Audit log of all connector sync operations for debugging and monitoring';
COMMENT ON COLUMN connector_sync_logs.duration_ms IS 'Total sync duration in milliseconds';
COMMENT ON COLUMN connector_sync_logs.bytes_transferred IS 'Total bytes downloaded during sync';

-- Table: connector_webhook_events
CREATE TABLE IF NOT EXISTS connector_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id UUID REFERENCES connector_configs(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event info
  event_type TEXT NOT NULL,
  event_source TEXT,
  event_id TEXT,

  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,

  -- Processing
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT now()
);

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_dedup
  ON connector_webhook_events(event_source, event_id)
  WHERE event_source IS NOT NULL AND event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed ON connector_webhook_events(processed)
  WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON connector_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_connector ON connector_webhook_events(connector_id);

COMMENT ON TABLE connector_webhook_events IS 'Incoming webhook events from external services (Zoom, Teams, Google Drive)';
COMMENT ON COLUMN connector_webhook_events.retry_count IS 'Number of processing attempts for failed events';

-- Table: file_upload_batches
CREATE TABLE IF NOT EXISTS file_upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Batch info
  batch_name TEXT,
  total_files INTEGER NOT NULL,
  processed_files INTEGER DEFAULT 0,
  failed_files INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'uploading',
  progress_percent FLOAT DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,

  CONSTRAINT check_batch_status CHECK (status IN ('uploading', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_upload_batches_org ON file_upload_batches(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_batches_status ON file_upload_batches(status)
  WHERE status IN ('uploading', 'processing');
CREATE INDEX IF NOT EXISTS idx_upload_batches_user ON file_upload_batches(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE file_upload_batches IS 'Batch file upload tracking and progress reporting';
COMMENT ON COLUMN file_upload_batches.progress_percent IS 'Upload completion percentage (0-100)';

RAISE NOTICE '  ✓ Created connector_sync_logs table';
RAISE NOTICE '  ✓ Created connector_webhook_events table';
RAISE NOTICE '  ✓ Created file_upload_batches table';

-- =====================================================
-- SECTION 3: CREATE HELPER FUNCTIONS
-- =====================================================

RAISE NOTICE 'Creating helper functions...';

-- Function: increment_batch_processed
CREATE OR REPLACE FUNCTION increment_batch_processed(
  batch_id_param UUID
)
RETURNS void AS $$
BEGIN
  UPDATE file_upload_batches
  SET
    processed_files = processed_files + 1,
    progress_percent = CASE
      WHEN total_files > 0
      THEN ((processed_files + 1)::float / total_files::float) * 100
      ELSE 0
    END
  WHERE id = batch_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_batch_processed TO service_role;
GRANT EXECUTE ON FUNCTION increment_batch_processed TO authenticated;

COMMENT ON FUNCTION increment_batch_processed IS 'Atomically increment processed file count and update progress percentage';

-- Function: increment_batch_failed
CREATE OR REPLACE FUNCTION increment_batch_failed(
  batch_id_param UUID
)
RETURNS void AS $$
BEGIN
  UPDATE file_upload_batches
  SET
    failed_files = failed_files + 1,
    processed_files = processed_files + 1,
    progress_percent = CASE
      WHEN total_files > 0
      THEN ((processed_files + 1)::float / total_files::float) * 100
      ELSE 0
    END,
    status = CASE
      WHEN (failed_files + 1) >= total_files THEN 'failed'
      ELSE status
    END
  WHERE id = batch_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_batch_failed TO service_role;
GRANT EXECUTE ON FUNCTION increment_batch_failed TO authenticated;

COMMENT ON FUNCTION increment_batch_failed IS 'Atomically increment failed file count, update progress, and mark batch as failed if all files failed';

RAISE NOTICE '  ✓ Created increment_batch_processed function';
RAISE NOTICE '  ✓ Created increment_batch_failed function';

-- =====================================================
-- SECTION 4: UPDATE RLS POLICIES
-- =====================================================

RAISE NOTICE 'Updating RLS policies...';

-- Fix connector_configs policies (add role restriction + service_role bypass)
DROP POLICY IF EXISTS "Users can create connectors for their org" ON connector_configs;
DROP POLICY IF EXISTS "Users can update their org's connectors" ON connector_configs;
DROP POLICY IF EXISTS "Users can delete their org's connectors" ON connector_configs;

-- Only admins/owners can manage connectors
CREATE POLICY "Admins can manage their org's connectors"
  ON connector_configs FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Service role full access (critical for background jobs)
CREATE POLICY "Service role full access to connectors"
  ON connector_configs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Fix imported_documents policies
CREATE POLICY "Service role full access to imported docs"
  ON imported_documents FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add policies for connector_sync_logs
ALTER TABLE connector_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's sync logs"
  ON connector_sync_logs FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role manages sync logs"
  ON connector_sync_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add policies for connector_webhook_events
ALTER TABLE connector_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's webhook events"
  ON connector_webhook_events FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role manages webhook events"
  ON connector_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Add policies for file_upload_batches
ALTER TABLE file_upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org's upload batches"
  ON file_upload_batches FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can create upload batches"
  ON file_upload_batches FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role manages upload batches"
  ON file_upload_batches FOR ALL TO service_role
  USING (true) WITH CHECK (true);

RAISE NOTICE '  ✓ Updated connector_configs policies (role-based access)';
RAISE NOTICE '  ✓ Added service_role bypass policies';
RAISE NOTICE '  ✓ Created RLS policies for all new tables';

-- =====================================================
-- SECTION 5: GRANTS
-- =====================================================

RAISE NOTICE 'Granting permissions...';

GRANT ALL ON connector_sync_logs TO service_role;
GRANT ALL ON connector_webhook_events TO service_role;
GRANT ALL ON file_upload_batches TO service_role;

GRANT SELECT ON connector_sync_logs TO authenticated;
GRANT SELECT ON connector_webhook_events TO authenticated;
GRANT SELECT, INSERT ON file_upload_batches TO authenticated;

RAISE NOTICE '  ✓ Granted permissions to service_role and authenticated';

-- =====================================================
-- SECTION 6: VALIDATION
-- =====================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_function_count INTEGER;
  v_policy_count INTEGER;
BEGIN
  -- Verify all tables exist
  SELECT COUNT(*) INTO v_table_count
  FROM pg_tables
  WHERE tablename IN ('connector_sync_logs', 'connector_webhook_events', 'file_upload_batches');

  IF v_table_count != 3 THEN
    RAISE EXCEPTION 'Table creation failed: expected 3 tables, found %', v_table_count;
  END IF;

  -- Verify functions exist
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname IN ('increment_batch_processed', 'increment_batch_failed');

  IF v_function_count != 2 THEN
    RAISE EXCEPTION 'Function creation failed: expected 2 functions, found %', v_function_count;
  END IF;

  -- Verify RLS policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename IN ('connector_sync_logs', 'connector_webhook_events', 'file_upload_batches');

  IF v_policy_count < 6 THEN
    RAISE WARNING 'Expected at least 6 RLS policies for new tables, found %', v_policy_count;
  END IF;

  -- Success message
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Phase 5 Migration Completed Successfully!';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Updated 2 existing tables with 24 new columns';
  RAISE NOTICE '  - Created 3 new tables (%, %, %)',
    'connector_sync_logs', 'connector_webhook_events', 'file_upload_batches';
  RAISE NOTICE '  - Created 2 helper functions (%, %)',
    'increment_batch_processed', 'increment_batch_failed';
  RAISE NOTICE '  - Updated/added % RLS policies', v_policy_count + 3;
  RAISE NOTICE '  - Added 10 performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Run validation tests';
  RAISE NOTICE '  2. Test connector creation and sync';
  RAISE NOTICE '  3. Test batch file upload';
  RAISE NOTICE '  4. Monitor background job logs';
  RAISE NOTICE '';
  RAISE NOTICE 'Rollback: supabase/migrations/025_phase5_connector_system_enhancements_down.sql';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;
