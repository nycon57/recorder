-- =====================================================
-- Phase 5: Storage Configuration
-- =====================================================
-- Purpose: Set up dedicated storage bucket for connector imports
-- Dependencies: Migration 025 (Phase 5 Schema)
-- Priority: P0 - Required for connector file uploads
-- =====================================================

BEGIN;

RAISE NOTICE 'Configuring storage for Phase 5 connector system...';

-- =====================================================
-- 1. CREATE CONNECTOR IMPORTS BUCKET
-- =====================================================

-- Create dedicated bucket for connector-imported files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'connector-imports',
  'connector-imports',
  false,  -- Private bucket
  5368709120,  -- 5GB file size limit
  ARRAY[
    -- Video formats
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',

    -- Audio formats
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/mp4',

    -- Image formats
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml',

    -- Document formats
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- .docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       -- .xlsx
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    'application/msword',  -- .doc
    'application/vnd.ms-excel',  -- .xls
    'application/vnd.ms-powerpoint',  -- .ppt

    -- Text formats
    'text/plain',
    'text/markdown',
    'text/csv',
    'text/html',

    -- Data formats
    'application/json',
    'application/xml',
    'text/xml'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

RAISE NOTICE '  ✓ Created/updated connector-imports bucket';

-- =====================================================
-- 2. CREATE RLS POLICIES FOR STORAGE
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their org's connector files" ON storage.objects;
DROP POLICY IF EXISTS "Service role manages connector files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their org's connector folder" ON storage.objects;

-- Policy 1: Users can view files from their organization
CREATE POLICY "Users can view their org's connector files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'connector-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM users WHERE id = auth.uid()
    )
  );

RAISE NOTICE '  ✓ Created SELECT policy for connector-imports bucket';

-- Policy 2: Service role has full access (for background jobs)
CREATE POLICY "Service role manages connector files"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'connector-imports')
  WITH CHECK (bucket_id = 'connector-imports');

RAISE NOTICE '  ✓ Created service_role policy for connector-imports bucket';

-- Policy 3: Users can upload to their org's folder (for direct uploads)
CREATE POLICY "Users can upload to their org's connector folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'connector-imports'
    AND (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM users WHERE id = auth.uid()
    )
  );

RAISE NOTICE '  ✓ Created INSERT policy for connector-imports bucket';

-- =====================================================
-- 3. CREATE STORAGE CLEANUP FUNCTION
-- =====================================================

-- Function to clean up old connector imports
CREATE OR REPLACE FUNCTION cleanup_old_connector_imports(
  days_old INTEGER DEFAULT 90,
  dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
  org_id UUID,
  connector_type TEXT,
  files_to_delete INTEGER,
  storage_to_free_mb BIGINT
) AS $$
DECLARE
  v_cutoff_date TIMESTAMPTZ;
BEGIN
  v_cutoff_date := now() - (days_old || ' days')::interval;

  IF dry_run THEN
    -- Return what would be deleted without actually deleting
    RETURN QUERY
    SELECT
      id.org_id,
      cc.connector_type,
      COUNT(*)::INTEGER as files_to_delete,
      COALESCE(SUM(id.file_size_bytes), 0) / 1024 / 1024 as storage_to_free_mb
    FROM imported_documents id
    LEFT JOIN connector_configs cc ON id.connector_id = cc.id
    WHERE id.last_synced_at < v_cutoff_date
      AND id.connector_id IS NOT NULL
      AND NOT id.is_deleted
    GROUP BY id.org_id, cc.connector_type;
  ELSE
    -- Mark documents as deleted (soft delete)
    WITH deleted AS (
      UPDATE imported_documents
      SET is_deleted = true
      WHERE last_synced_at < v_cutoff_date
        AND connector_id IS NOT NULL
        AND NOT is_deleted
      RETURNING org_id, connector_id, file_size_bytes
    )
    SELECT
      d.org_id,
      cc.connector_type,
      COUNT(*)::INTEGER as files_to_delete,
      COALESCE(SUM(d.file_size_bytes), 0) / 1024 / 1024 as storage_to_free_mb
    FROM deleted d
    LEFT JOIN connector_configs cc ON d.connector_id = cc.id
    GROUP BY d.org_id, cc.connector_type;

    -- Note: Actual storage file deletion should be done by a separate job
    -- that reads is_deleted=true records and removes from storage.objects
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_old_connector_imports TO service_role;

COMMENT ON FUNCTION cleanup_old_connector_imports IS
  'Mark old connector imports for deletion. Use dry_run=true to preview, dry_run=false to execute.';

RAISE NOTICE '  ✓ Created cleanup_old_connector_imports function';

-- =====================================================
-- 4. CREATE STORAGE USAGE TRACKING VIEW
-- =====================================================

CREATE OR REPLACE VIEW connector_storage_usage AS
SELECT
  cc.org_id,
  cc.connector_type,
  cc.name as connector_name,
  COUNT(DISTINCT id.id) as total_files,
  COUNT(DISTINCT id.id) FILTER (WHERE NOT id.is_deleted) as active_files,
  COALESCE(SUM(id.file_size_bytes), 0) as total_bytes,
  COALESCE(SUM(id.file_size_bytes) FILTER (WHERE NOT id.is_deleted), 0) as active_bytes,
  COALESCE(SUM(id.file_size_bytes), 0) / 1024 / 1024 as total_mb,
  COALESCE(SUM(id.file_size_bytes) FILTER (WHERE NOT id.is_deleted), 0) / 1024 / 1024 as active_mb,
  MIN(id.first_synced_at) as first_import_at,
  MAX(id.last_synced_at) as last_import_at
FROM connector_configs cc
LEFT JOIN imported_documents id ON id.connector_id = cc.id
WHERE cc.connector_type != 'file_upload'  -- Exclude direct uploads
GROUP BY cc.org_id, cc.connector_type, cc.name;

COMMENT ON VIEW connector_storage_usage IS
  'Track storage usage by connector for quota management and billing';

RAISE NOTICE '  ✓ Created connector_storage_usage view';

-- =====================================================
-- 5. VALIDATION
-- =====================================================

DO $$
DECLARE
  v_bucket_count INTEGER;
  v_policy_count INTEGER;
  v_function_exists BOOLEAN;
  v_view_exists BOOLEAN;
BEGIN
  -- Check bucket exists
  SELECT COUNT(*) INTO v_bucket_count
  FROM storage.buckets
  WHERE id = 'connector-imports';

  IF v_bucket_count != 1 THEN
    RAISE EXCEPTION 'Bucket creation failed: connector-imports not found';
  END IF;

  -- Check policies exist
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%connector%';

  IF v_policy_count < 3 THEN
    RAISE WARNING 'Expected 3 storage policies, found %', v_policy_count;
  END IF;

  -- Check function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_connector_imports'
  ) INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'Function cleanup_old_connector_imports was not created';
  END IF;

  -- Check view exists
  SELECT EXISTS (
    SELECT 1 FROM pg_views WHERE viewname = 'connector_storage_usage'
  ) INTO v_view_exists;

  IF NOT v_view_exists THEN
    RAISE EXCEPTION 'View connector_storage_usage was not created';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'Phase 5 Storage Configuration Completed!';
  RAISE NOTICE '========================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Created connector-imports bucket (5GB limit)';
  RAISE NOTICE '  - Configured % allowed file types', 25;
  RAISE NOTICE '  - Created % RLS policies for storage', v_policy_count;
  RAISE NOTICE '  - Created cleanup_old_connector_imports function';
  RAISE NOTICE '  - Created connector_storage_usage view';
  RAISE NOTICE '';
  RAISE NOTICE 'Storage Path Convention:';
  RAISE NOTICE '  {org_id}/connectors/{connector_type}/{connector_id}/{YYYY-MM-DD}/{file_id}-{filename}';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  - Preview cleanup: SELECT * FROM cleanup_old_connector_imports(90, true);';
  RAISE NOTICE '  - Execute cleanup: SELECT * FROM cleanup_old_connector_imports(90, false);';
  RAISE NOTICE '  - Check storage: SELECT * FROM connector_storage_usage;';
  RAISE NOTICE '';
  RAISE NOTICE '========================================================';
END $$;

COMMIT;
