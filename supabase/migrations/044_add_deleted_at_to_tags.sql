-- Add deleted_at column to tags table for soft delete
ALTER TABLE tags
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for faster queries on active tags
CREATE INDEX IF NOT EXISTS idx_tags_org_deleted
ON tags(org_id, deleted_at)
WHERE deleted_at IS NULL;

-- Create index for tag name lookups
CREATE INDEX IF NOT EXISTS idx_tags_name_lower
ON tags(org_id, LOWER(name))
WHERE deleted_at IS NULL;