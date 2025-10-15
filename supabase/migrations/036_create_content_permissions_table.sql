-- Migration: Create Content Permissions Table
-- Description: Granular content visibility and access control
-- Date: 2025-10-14

-- Create content_permissions table
CREATE TABLE content_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Resource identification
  resource_type TEXT NOT NULL CHECK (resource_type IN ('recording', 'document', 'tag', 'share')),
  resource_id UUID NOT NULL,

  -- Visibility settings
  visibility TEXT NOT NULL DEFAULT 'org' CHECK (visibility IN ('private', 'department', 'org', 'public')),

  -- Department-specific access
  department_ids UUID[], -- If visibility='department', restrict to these departments
  allowed_user_ids UUID[], -- Additional specific users who can access

  -- Permissions
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE (org_id, resource_type, resource_id)
);

-- Create indexes
CREATE INDEX idx_content_permissions_org_id ON content_permissions(org_id);
CREATE INDEX idx_content_permissions_resource ON content_permissions(resource_type, resource_id);
CREATE INDEX idx_content_permissions_visibility ON content_permissions(visibility);
CREATE INDEX idx_content_permissions_department_ids ON content_permissions USING GIN (department_ids) WHERE department_ids IS NOT NULL;
CREATE INDEX idx_content_permissions_allowed_users ON content_permissions USING GIN (allowed_user_ids) WHERE allowed_user_ids IS NOT NULL;

-- Add comments
COMMENT ON TABLE content_permissions IS 'Granular access control for content across the platform';
COMMENT ON COLUMN content_permissions.resource_type IS 'Type of resource (recording, document, tag, share)';
COMMENT ON COLUMN content_permissions.resource_id IS 'ID of the specific resource';
COMMENT ON COLUMN content_permissions.visibility IS 'Base visibility level: private, department, org, or public';
COMMENT ON COLUMN content_permissions.department_ids IS 'Specific departments with access (when visibility=department)';
COMMENT ON COLUMN content_permissions.allowed_user_ids IS 'Additional users granted explicit access';

-- Enable RLS
ALTER TABLE content_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read permissions for their org
CREATE POLICY "Users can read content permissions in their org"
  ON content_permissions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Admins and resource owners can manage permissions
CREATE POLICY "Admins and owners can manage permissions"
  ON content_permissions FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
    OR
    created_by IN (
      SELECT id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to content_permissions"
  ON content_permissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to check if user can access resource
CREATE OR REPLACE FUNCTION can_access_resource(
  p_user_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  permission_record RECORD;
  user_record RECORD;
  user_dept_ids UUID[];
BEGIN
  -- Get user details
  SELECT org_id, role INTO user_record
  FROM users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- System admins and org owners have access to everything
  IF user_record.role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Get permission record
  SELECT * INTO permission_record
  FROM content_permissions
  WHERE resource_type = p_resource_type
  AND resource_id = p_resource_id
  LIMIT 1;

  -- If no permission record exists, default to org-wide visibility
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Check visibility level
  IF permission_record.visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  IF permission_record.visibility = 'org' THEN
    RETURN TRUE;
  END IF;

  IF permission_record.visibility = 'private' THEN
    -- Only creator and explicitly allowed users
    RETURN permission_record.created_by = p_user_id
      OR p_user_id = ANY(permission_record.allowed_user_ids);
  END IF;

  IF permission_record.visibility = 'department' THEN
    -- Check if user belongs to any of the allowed departments
    SELECT array_agg(department_id) INTO user_dept_ids
    FROM user_departments
    WHERE user_id = p_user_id;

    RETURN user_dept_ids && permission_record.department_ids
      OR p_user_id = ANY(permission_record.allowed_user_ids);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to get accessible resources for a user
CREATE OR REPLACE FUNCTION get_accessible_resources(
  p_user_id UUID,
  p_resource_type TEXT
) RETURNS TABLE (resource_id UUID) AS $$
DECLARE
  user_record RECORD;
  user_dept_ids UUID[];
BEGIN
  -- Get user details
  SELECT org_id, role INTO user_record
  FROM users
  WHERE id = p_user_id;

  -- System admins and org owners see everything
  IF user_record.role IN ('owner', 'admin') THEN
    RETURN QUERY
    SELECT cp.resource_id
    FROM content_permissions cp
    WHERE cp.resource_type = p_resource_type
    AND cp.org_id = user_record.org_id;
    RETURN;
  END IF;

  -- Get user's departments
  SELECT array_agg(department_id) INTO user_dept_ids
  FROM user_departments
  WHERE user_id = p_user_id;

  -- Return accessible resources
  RETURN QUERY
  SELECT cp.resource_id
  FROM content_permissions cp
  WHERE cp.resource_type = p_resource_type
  AND cp.org_id = user_record.org_id
  AND (
    cp.visibility = 'public'
    OR cp.visibility = 'org'
    OR (cp.visibility = 'private' AND (cp.created_by = p_user_id OR p_user_id = ANY(cp.allowed_user_ids)))
    OR (cp.visibility = 'department' AND (user_dept_ids && cp.department_ids OR p_user_id = ANY(cp.allowed_user_ids)))
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create updated_at trigger
CREATE TRIGGER update_content_permissions_updated_at
  BEFORE UPDATE ON content_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
