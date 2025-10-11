-- Migration: Fix job status constraint to match new status values
-- The application code uses: 'pending', 'processing', 'completed', 'failed'
-- But the database constraint was using old values

-- Drop the old constraint
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;

-- Add the new constraint with correct status values
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- Update any existing jobs with old status values to new ones
UPDATE jobs SET status = 'pending' WHERE status = 'queued';
UPDATE jobs SET status = 'processing' WHERE status = 'running';
UPDATE jobs SET status = 'completed' WHERE status = 'succeeded';
-- 'failed' remains the same

-- Add comment
COMMENT ON CONSTRAINT jobs_status_check ON jobs IS
  'Job status must be one of: pending, processing, completed, failed';
