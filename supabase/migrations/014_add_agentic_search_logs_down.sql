-- Rollback for 014_add_agentic_search_logs.sql
-- Description: Removes agentic_search_logs table and all associated objects
-- Created: 2025-10-12

-- Drop the table (CASCADE will drop all policies and indexes automatically)
DROP TABLE IF EXISTS agentic_search_logs CASCADE;

-- Verification
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'agentic_search_logs') THEN
    RAISE EXCEPTION 'Failed to drop agentic_search_logs table';
  END IF;

  RAISE NOTICE 'Successfully rolled back migration 014_add_agentic_search_logs';
END $$;
