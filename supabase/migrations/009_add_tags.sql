-- Migration: Add tags support for recordings
-- This allows users to categorize and organize their recordings with tags

-- Create tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6', -- Default blue color
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, name) -- Ensure unique tag names per organization
);

-- Create junction table for recording-tag relationships
CREATE TABLE IF NOT EXISTS recording_tags (
  recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (recording_id, tag_id)
);

-- Create indexes for performance
CREATE INDEX idx_tags_org_id ON tags(org_id);
CREATE INDEX idx_tags_name ON tags(org_id, name);
CREATE INDEX idx_recording_tags_recording_id ON recording_tags(recording_id);
CREATE INDEX idx_recording_tags_tag_id ON recording_tags(tag_id);

-- Enable RLS
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tags
CREATE POLICY "Users can view tags in their org"
ON tags
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can create tags in their org"
ON tags
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can update tags in their org"
ON tags
FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
  )
);

CREATE POLICY "Users can delete tags in their org"
ON tags
FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
  )
);

-- RLS Policies for recording_tags
CREATE POLICY "Users can view recording tags in their org"
ON recording_tags
FOR SELECT
TO authenticated
USING (
  recording_id IN (
    SELECT id FROM recordings WHERE org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
    )
  )
);

CREATE POLICY "Users can create recording tags in their org"
ON recording_tags
FOR INSERT
TO authenticated
WITH CHECK (
  recording_id IN (
    SELECT id FROM recordings WHERE org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
    )
  )
);

CREATE POLICY "Users can delete recording tags in their org"
ON recording_tags
FOR DELETE
TO authenticated
USING (
  recording_id IN (
    SELECT id FROM recordings WHERE org_id IN (
      SELECT org_id FROM users WHERE clerk_id = auth.uid()::text
    )
  )
);

-- Add comments
COMMENT ON TABLE tags IS 'Tags for organizing recordings';
COMMENT ON TABLE recording_tags IS 'Junction table linking recordings to tags';
COMMENT ON COLUMN tags.color IS 'Hex color code for tag display (e.g., #3b82f6)';
