-- Migration: Create User Invitations Table
-- Description: Manage user invitations and onboarding flow
-- Date: 2025-10-14

-- Create user_invitations table
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'contributor', 'reader')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'base64url'),

  -- Department assignments
  department_ids UUID[] DEFAULT '{}',

  -- Invitation metadata
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  custom_message TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Tracking
  reminder_sent_at TIMESTAMPTZ, -- Last reminder sent
  reminder_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Constraints
  UNIQUE (org_id, email, status) -- One pending invitation per email per org
);

-- Create indexes
CREATE INDEX idx_user_invitations_org_id ON user_invitations(org_id);
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_token ON user_invitations(token);
CREATE INDEX idx_user_invitations_invited_by ON user_invitations(invited_by);
CREATE INDEX idx_user_invitations_status ON user_invitations(status);
CREATE INDEX idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX idx_user_invitations_pending ON user_invitations(org_id, status) WHERE status = 'pending';

-- Add comments
COMMENT ON TABLE user_invitations IS 'Manage user invitations and track onboarding';
COMMENT ON COLUMN user_invitations.token IS 'Unique invitation token sent in email link';
COMMENT ON COLUMN user_invitations.department_ids IS 'Array of department IDs to assign user to upon acceptance';
COMMENT ON COLUMN user_invitations.custom_message IS 'Optional personalized message from inviter';
COMMENT ON COLUMN user_invitations.reminder_sent_at IS 'Last time a reminder email was sent';

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can read invitations in their org
CREATE POLICY "Admins can read invitations"
  ON user_invitations FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON user_invitations FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Admins can update invitations (revoke, resend)
CREATE POLICY "Admins can update invitations"
  ON user_invitations FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to user_invitations"
  ON user_invitations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE user_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(p_token TEXT, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  invitation_record RECORD;
  result JSONB;
BEGIN
  -- Get invitation
  SELECT * INTO invitation_record
  FROM user_invitations
  WHERE token = p_token
  AND status = 'pending'
  AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Update invitation status
  UPDATE user_invitations
  SET status = 'accepted', accepted_at = NOW()
  WHERE id = invitation_record.id;

  -- Update user with role and departments
  UPDATE users
  SET
    role = invitation_record.role,
    org_id = invitation_record.org_id,
    status = 'active',
    onboarded_at = NOW()
  WHERE id = p_user_id;

  -- Assign departments if specified
  IF array_length(invitation_record.department_ids, 1) > 0 THEN
    INSERT INTO user_departments (user_id, department_id)
    SELECT p_user_id, unnest(invitation_record.department_ids)
    ON CONFLICT DO NOTHING;
  END IF;

  result := jsonb_build_object(
    'success', true,
    'org_id', invitation_record.org_id,
    'role', invitation_record.role
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
