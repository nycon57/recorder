-- Migration: Enhance Users Table
-- Description: Add profile, onboarding, activity tracking, and preference fields
-- Date: 2025-10-14

-- Add new columns to users table
ALTER TABLE users
  -- Profile fields
  ADD COLUMN title TEXT, -- Job title/position
  ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  ADD COLUMN bio TEXT,
  ADD COLUMN phone TEXT,
  ADD COLUMN timezone TEXT DEFAULT 'UTC',

  -- Onboarding fields
  ADD COLUMN invitation_token TEXT UNIQUE,
  ADD COLUMN invitation_expires_at TIMESTAMPTZ,
  ADD COLUMN invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN onboarded_at TIMESTAMPTZ,
  ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),

  -- Activity tracking
  ADD COLUMN last_login_at TIMESTAMPTZ,
  ADD COLUMN last_active_at TIMESTAMPTZ,
  ADD COLUMN login_count INTEGER DEFAULT 0,

  -- Preferences
  ADD COLUMN notification_preferences JSONB DEFAULT '{}',
  ADD COLUMN ui_preferences JSONB DEFAULT '{}',

  -- Soft delete
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX idx_users_department_id ON users(department_id) WHERE department_id IS NOT NULL;
CREATE INDEX idx_users_invitation_token ON users(invitation_token) WHERE invitation_token IS NOT NULL;
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_last_active_at ON users(last_active_at DESC);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_users_org_id_status ON users(org_id, status);

-- Update notification_preferences with defaults
UPDATE users
SET notification_preferences = jsonb_build_object(
  'email', jsonb_build_object(
    'recordings_completed', true,
    'share_received', true,
    'mention', true,
    'weekly_digest', false
  ),
  'in_app', jsonb_build_object(
    'recordings_completed', true,
    'share_received', true,
    'mention', true
  )
)
WHERE notification_preferences = '{}';

-- Update ui_preferences with defaults
UPDATE users
SET ui_preferences = jsonb_build_object(
  'theme', 'system',
  'sidebar_collapsed', false,
  'recordings_view', 'grid',
  'default_recording_visibility', 'org'
)
WHERE ui_preferences = '{}';

-- Add comments for documentation
COMMENT ON COLUMN users.title IS 'Job title or position';
COMMENT ON COLUMN users.department_id IS 'Department this user belongs to';
COMMENT ON COLUMN users.bio IS 'User biography/description';
COMMENT ON COLUMN users.phone IS 'Phone number';
COMMENT ON COLUMN users.timezone IS 'User timezone for display purposes';
COMMENT ON COLUMN users.invitation_token IS 'Unique token for email invitation flow';
COMMENT ON COLUMN users.invitation_expires_at IS 'When the invitation token expires';
COMMENT ON COLUMN users.invited_by IS 'User who invited this user';
COMMENT ON COLUMN users.onboarded_at IS 'When the user completed onboarding';
COMMENT ON COLUMN users.status IS 'User account status';
COMMENT ON COLUMN users.last_login_at IS 'Last time user logged in';
COMMENT ON COLUMN users.last_active_at IS 'Last time user was active';
COMMENT ON COLUMN users.login_count IS 'Total number of logins';
COMMENT ON COLUMN users.notification_preferences IS 'User notification settings';
COMMENT ON COLUMN users.ui_preferences IS 'User interface preferences';
COMMENT ON COLUMN users.deleted_at IS 'Soft delete timestamp (null = active)';
