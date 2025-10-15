-- Migration: Create Audit Logs Table
-- Description: Comprehensive activity tracking for compliance and security
-- Date: 2025-10-14

-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action details
  action TEXT NOT NULL, -- e.g., 'user.created', 'recording.deleted', 'role.updated'
  resource_type TEXT NOT NULL, -- e.g., 'user', 'recording', 'organization'
  resource_id UUID, -- ID of the affected resource

  -- Change tracking
  old_values JSONB, -- State before the change
  new_values JSONB, -- State after the change

  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_audit_logs_org_id ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id) WHERE resource_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);

-- Create composite index for common queries
CREATE INDEX idx_audit_logs_org_resource ON audit_logs(org_id, resource_type, resource_id);

-- Add comments
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail of all actions for compliance and security monitoring';
COMMENT ON COLUMN audit_logs.action IS 'Action performed (e.g., user.created, recording.deleted)';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource affected';
COMMENT ON COLUMN audit_logs.resource_id IS 'ID of the affected resource (if applicable)';
COMMENT ON COLUMN audit_logs.old_values IS 'State before the change (for updates/deletes)';
COMMENT ON COLUMN audit_logs.new_values IS 'State after the change (for creates/updates)';
COMMENT ON COLUMN audit_logs.ip_address IS 'IP address of the request';
COMMENT ON COLUMN audit_logs.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN audit_logs.request_id IS 'Unique request ID for correlation';

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins and owners can read audit logs for their organization
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Only service role can insert/update/delete audit logs
CREATE POLICY "Service role has full access to audit logs"
  ON audit_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create function to log actions
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    org_id,
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    ip_address,
    user_agent,
    request_id,
    metadata
  ) VALUES (
    p_org_id,
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    p_ip_address,
    p_user_agent,
    p_request_id,
    p_metadata
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create automatic audit triggers for critical tables
-- This will be enhanced later to track specific columns

CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS TRIGGER AS $$
DECLARE
  org_id_val UUID;
  user_id_val UUID;
  action_name TEXT;
BEGIN
  -- Determine org_id (assume all tables have org_id)
  IF TG_OP = 'DELETE' THEN
    org_id_val := OLD.org_id;
  ELSE
    org_id_val := NEW.org_id;
  END IF;

  -- Try to get current user_id from users table
  SELECT id INTO user_id_val
  FROM users
  WHERE clerk_id = (auth.uid())::TEXT
  LIMIT 1;

  -- Determine action
  action_name := TG_TABLE_NAME || '.' || LOWER(TG_OP);

  -- Log the event
  IF TG_OP = 'DELETE' THEN
    PERFORM log_audit_event(
      org_id_val,
      user_id_val,
      action_name,
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD)::JSONB,
      NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM log_audit_event(
      org_id_val,
      user_id_val,
      action_name,
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD)::JSONB,
      row_to_json(NEW)::JSONB
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM log_audit_event(
      org_id_val,
      user_id_val,
      action_name,
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      row_to_json(NEW)::JSONB
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit triggers to critical tables (we'll enable these selectively)
-- Commented out for now - will enable per table as needed
-- CREATE TRIGGER audit_users_changes
--   AFTER INSERT OR UPDATE OR DELETE ON users
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- CREATE TRIGGER audit_organizations_changes
--   AFTER INSERT OR UPDATE OR DELETE ON organizations
--   FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
