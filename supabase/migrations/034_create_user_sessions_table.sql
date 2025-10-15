-- Migration: Create User Sessions Table
-- Description: Track active user sessions for security and session management
-- Date: 2025-10-14

-- Create user_sessions table
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Session details
  session_token TEXT NOT NULL UNIQUE,
  clerk_session_id TEXT, -- Reference to Clerk session

  -- Device/browser info
  ip_address INET,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  os TEXT,
  location JSONB, -- Geolocation data { city, region, country }

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_org_id ON user_sessions(org_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_clerk_session_id ON user_sessions(clerk_session_id) WHERE clerk_session_id IS NOT NULL;
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(user_id, last_active_at DESC) WHERE revoked_at IS NULL AND expires_at > NOW();

-- Add comments
COMMENT ON TABLE user_sessions IS 'Track active user sessions for security monitoring and session management';
COMMENT ON COLUMN user_sessions.session_token IS 'Unique session token';
COMMENT ON COLUMN user_sessions.clerk_session_id IS 'Reference to Clerk session ID';
COMMENT ON COLUMN user_sessions.device_type IS 'Device type: desktop, mobile, or tablet';
COMMENT ON COLUMN user_sessions.location IS 'Geolocation data from IP address';
COMMENT ON COLUMN user_sessions.revoked_at IS 'When the session was manually revoked';

-- Enable RLS
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own sessions
CREATE POLICY "Users can read their own sessions"
  ON user_sessions FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Users can revoke their own sessions
CREATE POLICY "Users can revoke their own sessions"
  ON user_sessions FOR UPDATE
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  )
  WITH CHECK (revoked_at IS NOT NULL);

-- Admins can read all sessions in their org
CREATE POLICY "Admins can read org sessions"
  ON user_sessions FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to user_sessions"
  ON user_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_sessions
  WHERE expires_at < NOW() - INTERVAL '7 days' -- Keep expired sessions for 7 days for audit
  OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active session count for a user
CREATE OR REPLACE FUNCTION get_active_session_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM user_sessions
    WHERE user_id = p_user_id
    AND revoked_at IS NULL
    AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;
