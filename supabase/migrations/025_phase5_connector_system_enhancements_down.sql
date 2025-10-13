-- =====================================================
-- Phase 5: Rollback Migration
-- =====================================================
-- Purpose: Rollback Phase 5 connector system changes
-- WARNING: This will delete all connector sync logs,
--          webhook events, and batch upload records
-- =====================================================

BEGIN;

RAISE NOTICE 'Rolling back Phase 5 connector system enhancements...';

-- =====================================================
-- 1. DROP NEW TABLES
-- =====================================================

RAISE NOTICE 'Dropping new tables...';

DROP TABLE IF EXISTS file_upload_batches CASCADE;
RAISE NOTICE '  ✓ Dropped file_upload_batches';

DROP TABLE IF EXISTS connector_webhook_events CASCADE;
RAISE NOTICE '  ✓ Dropped connector_webhook_events';

DROP TABLE IF EXISTS connector_sync_logs CASCADE;
RAISE NOTICE '  ✓ Dropped connector_sync_logs';

-- =====================================================
-- 2. DROP FUNCTIONS
-- =====================================================

RAISE NOTICE 'Dropping helper functions...';

DROP FUNCTION IF EXISTS increment_batch_processed(UUID);
RAISE NOTICE '  ✓ Dropped increment_batch_processed';

DROP FUNCTION IF EXISTS increment_batch_failed(UUID);
RAISE NOTICE '  ✓ Dropped increment_batch_failed';

-- =====================================================
-- 3. REVERT RLS POLICIES
-- =====================================================

RAISE NOTICE 'Reverting RLS policies...';

-- Revert connector_configs policies to original
DROP POLICY IF EXISTS "Admins can manage their org's connectors" ON connector_configs;
DROP POLICY IF EXISTS "Service role full access to connectors" ON connector_configs;

-- Restore original policies
CREATE POLICY "Users can create connectors for their org"
  ON connector_configs FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org's connectors"
  ON connector_configs FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their org's connectors"
  ON connector_configs FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

RAISE NOTICE '  ✓ Reverted connector_configs policies';

-- Remove service role policy from imported_documents
DROP POLICY IF EXISTS "Service role full access to imported docs" ON imported_documents;
RAISE NOTICE '  ✓ Removed service_role policy from imported_documents';

-- =====================================================
-- 4. REVERT COLUMN CHANGES (OPTIONAL)
-- =====================================================

-- WARNING: Uncomment these only if you want to completely remove
-- all Phase 5 enhancements. This will cause data loss!

/*
RAISE NOTICE 'Reverting column changes (data loss will occur)...';

-- Revert connector_configs columns
ALTER TABLE connector_configs
  DROP COLUMN IF EXISTS credentials_updated_at,
  DROP COLUMN IF EXISTS next_sync_at,
  DROP COLUMN IF EXISTS sync_frequency,
  DROP COLUMN IF EXISTS last_sync_status,
  DROP COLUMN IF EXISTS webhook_url,
  DROP COLUMN IF EXISTS webhook_secret,
  DROP COLUMN IF EXISTS webhook_active,
  DROP COLUMN IF EXISTS error_count,
  DROP COLUMN IF EXISTS last_error,
  DROP COLUMN IF EXISTS last_error_at,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS filters,
  DROP COLUMN IF EXISTS metadata;

RAISE NOTICE '  ✓ Reverted connector_configs columns';

-- Revert imported_documents columns
ALTER TABLE imported_documents
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS parent_external_id,
  DROP COLUMN IF EXISTS processing_status,
  DROP COLUMN IF EXISTS processing_error,
  DROP COLUMN IF EXISTS chunks_generated,
  DROP COLUMN IF EXISTS embeddings_generated,
  DROP COLUMN IF EXISTS source_metadata,
  DROP COLUMN IF EXISTS first_synced_at,
  DROP COLUMN IF EXISTS sync_count,
  DROP COLUMN IF EXISTS is_deleted,
  DROP COLUMN IF EXISTS external_url;

RAISE NOTICE '  ✓ Reverted imported_documents columns';
*/

-- =====================================================
-- 5. DROP INDEXES
-- =====================================================

RAISE NOTICE 'Dropping Phase 5 indexes...';

DROP INDEX IF EXISTS idx_connector_configs_next_sync;
DROP INDEX IF EXISTS idx_imported_docs_hash;
DROP INDEX IF EXISTS idx_imported_docs_chunks;
DROP INDEX IF EXISTS idx_imported_docs_deleted;
DROP INDEX IF EXISTS idx_imported_docs_processing_status;

RAISE NOTICE '  ✓ Dropped 5 indexes';

-- =====================================================
-- VALIDATION
-- =====================================================

DO $$
DECLARE
  v_table_count INTEGER;
  v_function_count INTEGER;
BEGIN
  -- Verify tables are dropped
  SELECT COUNT(*) INTO v_table_count
  FROM pg_tables
  WHERE tablename IN ('connector_sync_logs', 'connector_webhook_events', 'file_upload_batches');

  IF v_table_count > 0 THEN
    RAISE WARNING 'Some tables were not dropped: % tables still exist', v_table_count;
  END IF;

  -- Verify functions are dropped
  SELECT COUNT(*) INTO v_function_count
  FROM pg_proc
  WHERE proname IN ('increment_batch_processed', 'increment_batch_failed');

  IF v_function_count > 0 THEN
    RAISE WARNING 'Some functions were not dropped: % functions still exist', v_function_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Phase 5 Rollback Completed';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Dropped 3 tables';
  RAISE NOTICE '  - Dropped 2 functions';
  RAISE NOTICE '  - Reverted RLS policies';
  RAISE NOTICE '  - Dropped 5 indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: Column changes were NOT reverted to preserve data.';
  RAISE NOTICE '      Uncomment section 4 in migration file to remove columns.';
  RAISE NOTICE '';
  RAISE NOTICE 'To re-apply: supabase/migrations/025_phase5_connector_system_enhancements.sql';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;
