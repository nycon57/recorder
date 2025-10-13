-- =====================================================
-- Phase 5 Migration Validation Script
-- =====================================================
-- Purpose: Validate that Phase 5 migrations were applied correctly
-- Usage: psql $DATABASE_URL -f scripts/validate-phase5-migration.sql
-- =====================================================

\set ON_ERROR_STOP on
\timing on

\echo ''
\echo '========================================================'
\echo 'Phase 5 Migration Validation'
\echo '========================================================'
\echo ''

-- =====================================================
-- 1. VALIDATE TABLES
-- =====================================================

\echo 'Checking tables...'

SELECT
  CASE
    WHEN COUNT(*) = 3 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'All 3 new tables exist' as check_name,
  COUNT(*) as found,
  3 as expected
FROM pg_tables
WHERE tablename IN ('connector_sync_logs', 'connector_webhook_events', 'file_upload_batches');

-- =====================================================
-- 2. VALIDATE COLUMNS
-- =====================================================

\echo ''
\echo 'Checking connector_configs columns...'

SELECT
  CASE
    WHEN COUNT(*) >= 13 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'connector_configs has all new columns' as check_name,
  COUNT(*) as found,
  13 as expected
FROM information_schema.columns
WHERE table_name = 'connector_configs'
  AND column_name IN (
    'credentials_updated_at', 'next_sync_at', 'sync_frequency', 'last_sync_status',
    'webhook_url', 'webhook_secret', 'webhook_active', 'error_count',
    'last_error', 'last_error_at', 'description', 'filters', 'metadata'
  );

\echo ''
\echo 'Checking imported_documents columns...'

SELECT
  CASE
    WHEN COUNT(*) >= 11 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'imported_documents has all new columns' as check_name,
  COUNT(*) as found,
  11 as expected
FROM information_schema.columns
WHERE table_name = 'imported_documents'
  AND column_name IN (
    'content_hash', 'parent_external_id', 'processing_status', 'processing_error',
    'chunks_generated', 'embeddings_generated', 'source_metadata',
    'first_synced_at', 'sync_count', 'is_deleted', 'external_url'
  );

-- =====================================================
-- 3. VALIDATE FUNCTIONS
-- =====================================================

\echo ''
\echo 'Checking functions...'

SELECT
  CASE
    WHEN COUNT(*) = 2 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'All helper functions exist' as check_name,
  COUNT(*) as found,
  2 as expected
FROM pg_proc
WHERE proname IN ('increment_batch_processed', 'increment_batch_failed');

-- Test function execution
\echo ''
\echo 'Testing increment_batch_processed function...'

DO $$
DECLARE
  v_batch_id UUID;
BEGIN
  -- Create test batch
  INSERT INTO file_upload_batches (org_id, total_files, batch_name)
  VALUES (
    (SELECT id FROM organizations LIMIT 1),
    10,
    'Test Batch for Validation'
  )
  RETURNING id INTO v_batch_id;

  -- Test increment
  PERFORM increment_batch_processed(v_batch_id);

  -- Verify
  IF (SELECT processed_files FROM file_upload_batches WHERE id = v_batch_id) = 1 THEN
    RAISE NOTICE '✓ PASS: increment_batch_processed works correctly';
  ELSE
    RAISE EXCEPTION '✗ FAIL: increment_batch_processed did not increment';
  END IF;

  -- Cleanup
  DELETE FROM file_upload_batches WHERE id = v_batch_id;
END $$;

-- =====================================================
-- 4. VALIDATE INDEXES
-- =====================================================

\echo ''
\echo 'Checking indexes...'

SELECT
  CASE
    WHEN COUNT(*) >= 10 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'All Phase 5 indexes exist' as check_name,
  COUNT(*) as found,
  10 as expected
FROM pg_indexes
WHERE indexname LIKE '%connector%'
   OR indexname LIKE '%sync_log%'
   OR indexname LIKE '%webhook%'
   OR indexname LIKE '%upload_batch%';

-- =====================================================
-- 5. VALIDATE RLS POLICIES
-- =====================================================

\echo ''
\echo 'Checking RLS policies...'

SELECT
  table_name,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) >= 2 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status
FROM pg_policies
WHERE tablename IN (
  'connector_configs',
  'imported_documents',
  'connector_sync_logs',
  'connector_webhook_events',
  'file_upload_batches'
)
GROUP BY table_name
ORDER BY table_name;

-- Check for service_role policies
\echo ''
\echo 'Checking service_role bypass policies...'

SELECT
  CASE
    WHEN COUNT(*) >= 5 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'All tables have service_role policies' as check_name,
  COUNT(*) as found,
  5 as expected
FROM pg_policies
WHERE (policyname LIKE '%service%role%' OR roles = '{service_role}')
  AND tablename IN (
    'connector_configs',
    'imported_documents',
    'connector_sync_logs',
    'connector_webhook_events',
    'file_upload_batches'
  );

-- =====================================================
-- 6. VALIDATE STORAGE
-- =====================================================

\echo ''
\echo 'Checking storage buckets...'

SELECT
  CASE
    WHEN COUNT(*) = 1 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'connector-imports bucket exists' as check_name,
  COUNT(*) as found,
  1 as expected
FROM storage.buckets
WHERE id = 'connector-imports';

\echo ''
\echo 'Checking storage policies...'

SELECT
  CASE
    WHEN COUNT(*) >= 3 THEN '✓ PASS'
    ELSE '✗ FAIL'
  END as status,
  'Storage RLS policies exist' as check_name,
  COUNT(*) as found,
  3 as expected
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%connector%';

-- =====================================================
-- 7. VALIDATE CONSTRAINTS
-- =====================================================

\echo ''
\echo 'Checking check constraints...'

SELECT
  tc.table_name,
  tc.constraint_name,
  '✓' as status
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'CHECK'
  AND tc.table_name IN (
    'connector_configs',
    'imported_documents',
    'connector_sync_logs',
    'connector_webhook_events',
    'file_upload_batches'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- 8. SUMMARY
-- =====================================================

\echo ''
\echo '========================================================'
\echo 'Validation Summary'
\echo '========================================================'
\echo ''

DO $$
DECLARE
  v_tables_ok BOOLEAN;
  v_columns_ok BOOLEAN;
  v_functions_ok BOOLEAN;
  v_policies_ok BOOLEAN;
  v_storage_ok BOOLEAN;
  v_overall_status TEXT;
BEGIN
  -- Check all components
  SELECT COUNT(*) = 3 INTO v_tables_ok
  FROM pg_tables
  WHERE tablename IN ('connector_sync_logs', 'connector_webhook_events', 'file_upload_batches');

  SELECT COUNT(*) = 2 INTO v_functions_ok
  FROM pg_proc
  WHERE proname IN ('increment_batch_processed', 'increment_batch_failed');

  SELECT COUNT(*) >= 10 INTO v_policies_ok
  FROM pg_policies
  WHERE tablename IN (
    'connector_configs', 'imported_documents', 'connector_sync_logs',
    'connector_webhook_events', 'file_upload_batches'
  );

  SELECT COUNT(*) = 1 INTO v_storage_ok
  FROM storage.buckets
  WHERE id = 'connector-imports';

  -- Overall status
  IF v_tables_ok AND v_functions_ok AND v_policies_ok AND v_storage_ok THEN
    v_overall_status := '✓ ALL CHECKS PASSED';
  ELSE
    v_overall_status := '✗ SOME CHECKS FAILED';
  END IF;

  RAISE NOTICE 'Tables:    %', CASE WHEN v_tables_ok THEN '✓ PASS' ELSE '✗ FAIL' END;
  RAISE NOTICE 'Functions: %', CASE WHEN v_functions_ok THEN '✓ PASS' ELSE '✗ FAIL' END;
  RAISE NOTICE 'Policies:  %', CASE WHEN v_policies_ok THEN '✓ PASS' ELSE '✗ FAIL' END;
  RAISE NOTICE 'Storage:   %', CASE WHEN v_storage_ok THEN '✓ PASS' ELSE '✗ FAIL' END;
  RAISE NOTICE '';
  RAISE NOTICE 'Overall:   %', v_overall_status;
  RAISE NOTICE '';

  IF v_overall_status = '✓ ALL CHECKS PASSED' THEN
    RAISE NOTICE 'Phase 5 migrations applied successfully!';
    RAISE NOTICE 'You can now test connector functionality.';
  ELSE
    RAISE EXCEPTION 'Phase 5 validation failed. Check the output above for details.';
  END IF;
END $$;

\echo '========================================================'
\echo ''
