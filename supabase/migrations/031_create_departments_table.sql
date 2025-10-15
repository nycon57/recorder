-- Migration: Create Departments Table
-- Description: Hierarchical department structure for organizing users and content
-- Date: 2025-10-14

-- Create departments table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL,

  -- Default visibility settings for content created in this department
  default_visibility TEXT DEFAULT 'department' CHECK (default_visibility IN ('private', 'department', 'org', 'public')),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Constraints
  UNIQUE (org_id, slug),

  -- Prevent circular references (department can't be its own parent)
  CHECK (id != parent_id)
);

-- Create indexes
CREATE INDEX idx_departments_org_id ON departments(org_id);
CREATE INDEX idx_departments_parent_id ON departments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_departments_org_slug ON departments(org_id, slug);
CREATE INDEX idx_departments_created_by ON departments(created_by) WHERE created_by IS NOT NULL;

-- Create junction table for users-departments (many-to-many)
CREATE TABLE user_departments (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, department_id)
);

-- Create indexes for user_departments
CREATE INDEX idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX idx_user_departments_department_id ON user_departments(department_id);

-- Add comments
COMMENT ON TABLE departments IS 'Hierarchical department structure for organizing users and content within organizations';
COMMENT ON COLUMN departments.parent_id IS 'Parent department ID for hierarchy (NULL = root level)';
COMMENT ON COLUMN departments.slug IS 'URL-friendly identifier unique within organization';
COMMENT ON COLUMN departments.default_visibility IS 'Default content visibility for items created in this department';

COMMENT ON TABLE user_departments IS 'Many-to-many relationship between users and departments';

-- Enable RLS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for departments
-- Users can read departments in their organization
CREATE POLICY "Users can read departments in their org"
  ON departments FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Admins and owners can manage departments
CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to departments"
  ON departments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for user_departments
-- Users can read their own department memberships
CREATE POLICY "Users can read their department memberships"
  ON user_departments FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
    OR
    user_id IN (
      SELECT id FROM users
      WHERE org_id IN (
        SELECT org_id FROM users
        WHERE clerk_id = (auth.uid())::TEXT
        AND role IN ('owner', 'admin')
      )
    )
  );

-- Admins can manage department memberships
CREATE POLICY "Admins can manage department memberships"
  ON user_departments FOR ALL
  USING (
    user_id IN (
      SELECT u.id FROM users u
      INNER JOIN users current_user ON current_user.clerk_id = (auth.uid())::TEXT
      WHERE u.org_id = current_user.org_id
      AND current_user.role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to user_departments"
  ON user_departments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to get department path (for breadcrumbs)
CREATE OR REPLACE FUNCTION get_department_path(dept_id UUID)
RETURNS TEXT[] AS $$
DECLARE
  path TEXT[] := '{}';
  current_dept departments;
BEGIN
  -- Start with the given department
  SELECT * INTO current_dept FROM departments WHERE id = dept_id;

  -- Build path from child to root
  WHILE current_dept.id IS NOT NULL LOOP
    path := current_dept.name || path;

    -- Move to parent
    IF current_dept.parent_id IS NOT NULL THEN
      SELECT * INTO current_dept FROM departments WHERE id = current_dept.parent_id;
    ELSE
      current_dept.id := NULL;
    END IF;
  END LOOP;

  RETURN path;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to check if department is descendant of another
CREATE OR REPLACE FUNCTION is_descendant_of(child_id UUID, ancestor_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_id UUID;
BEGIN
  current_id := child_id;

  -- Traverse up the tree
  WHILE current_id IS NOT NULL LOOP
    IF current_id = ancestor_id THEN
      RETURN TRUE;
    END IF;

    SELECT parent_id INTO current_id FROM departments WHERE id = current_id;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create updated_at trigger
CREATE TRIGGER update_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
