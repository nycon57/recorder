-- =====================================================
-- Migration: 042_add_deleted_at_to_recordings.sql
-- Description: Add soft delete support to recordings table
-- Created: 2025-10-15
-- =====================================================

-- Add deleted_at column for soft delete support
-- This allows recordings to be "deleted" without removing data permanently
-- Useful for recovery, audit trails, and data retention policies
ALTER TABLE recordings
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add index on deleted_at for efficient filtering of active recordings
-- WHERE clause makes this a partial index (only indexes NULL values)
-- This optimizes queries that filter for active (non-deleted) recordings
CREATE INDEX IF NOT EXISTS idx_recordings_deleted_at
ON recordings(deleted_at)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN recordings.deleted_at IS
'Timestamp when recording was soft-deleted. NULL means recording is active.
Used for soft delete pattern - allows recovery and maintains referential integrity.';

-- =====================================================
-- UPDATE RLS POLICIES TO RESPECT SOFT DELETES
-- =====================================================

-- Drop existing RLS policies for recordings
DROP POLICY IF EXISTS "recordings_select_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_insert_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_update_policy" ON recordings;
DROP POLICY IF EXISTS "recordings_delete_policy" ON recordings;

-- Recreate policies with deleted_at check
-- Users can only see active (non-deleted) recordings in their org
CREATE POLICY "recordings_select_policy" ON recordings
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
    AND deleted_at IS NULL
  );

-- Users can insert recordings in their org
CREATE POLICY "recordings_insert_policy" ON recordings
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Users can update recordings in their org (only active ones)
CREATE POLICY "recordings_update_policy" ON recordings
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
    AND deleted_at IS NULL
  );

-- Allow soft deletes (setting deleted_at) for recordings in user's org
CREATE POLICY "recordings_delete_policy" ON recordings
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- =====================================================
-- VERIFY MIGRATION
-- =====================================================

DO $$
BEGIN
  -- Check that column exists
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'recordings'
    AND column_name = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'Column recordings.deleted_at was not created';
  END IF;

  -- Check that index exists
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE tablename = 'recordings'
    AND indexname = 'idx_recordings_deleted_at'
  ) THEN
    RAISE EXCEPTION 'Index idx_recordings_deleted_at was not created';
  END IF;

  RAISE NOTICE 'Migration 042_add_deleted_at_to_recordings completed successfully!';
END $$;
