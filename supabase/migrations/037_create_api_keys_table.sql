-- Migration: Create API Keys Table
-- Description: Manage organization API keys for programmatic access
-- Date: 2025-10-14

-- Create api_keys table
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Key details
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars of key (for display)
  key_hash TEXT NOT NULL UNIQUE, -- bcrypt hash of the full key

  -- Permissions and scopes
  scopes TEXT[] DEFAULT '{}', -- e.g., ['recordings:read', 'search:execute', 'documents:write']
  rate_limit INTEGER DEFAULT 1000, -- Requests per hour

  -- Status and lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  description TEXT,
  ip_whitelist INET[], -- Optional IP address restrictions
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes
CREATE INDEX idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX idx_api_keys_status ON api_keys(status);
CREATE INDEX idx_api_keys_active ON api_keys(org_id, status) WHERE status = 'active';
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Add comments
COMMENT ON TABLE api_keys IS 'Organization API keys for programmatic access';
COMMENT ON COLUMN api_keys.key_prefix IS 'First 8 characters of key for display (e.g., "sk_live_...")';
COMMENT ON COLUMN api_keys.key_hash IS 'Bcrypt hash of the full API key';
COMMENT ON COLUMN api_keys.scopes IS 'Array of permission scopes granted to this key';
COMMENT ON COLUMN api_keys.rate_limit IS 'Maximum requests per hour for this key';
COMMENT ON COLUMN api_keys.ip_whitelist IS 'Optional array of allowed IP addresses';

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can read API keys in their org
CREATE POLICY "Admins can read api keys"
  ON api_keys FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Admins can create API keys
CREATE POLICY "Admins can create api keys"
  ON api_keys FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Admins can update API keys (revoke)
CREATE POLICY "Admins can update api keys"
  ON api_keys FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to api_keys"
  ON api_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to validate API key and check permissions
CREATE OR REPLACE FUNCTION validate_api_key(
  p_key_hash TEXT,
  p_required_scope TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  key_record RECORD;
  result JSONB;
BEGIN
  -- Get API key
  SELECT * INTO key_record
  FROM api_keys
  WHERE key_hash = p_key_hash
  AND status = 'active'
  AND (expires_at IS NULL OR expires_at > NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid or expired API key'
    );
  END IF;

  -- Check IP whitelist if configured
  IF key_record.ip_whitelist IS NOT NULL AND array_length(key_record.ip_whitelist, 1) > 0 THEN
    IF p_ip_address IS NULL OR NOT (p_ip_address = ANY(key_record.ip_whitelist)) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'IP address not whitelisted'
      );
    END IF;
  END IF;

  -- Check scope if required
  IF p_required_scope IS NOT NULL THEN
    IF NOT (p_required_scope = ANY(key_record.scopes)) AND NOT ('*' = ANY(key_record.scopes)) THEN
      RETURN jsonb_build_object(
        'valid', false,
        'error', 'Insufficient permissions for requested scope'
      );
    END IF;
  END IF;

  -- Update last used
  UPDATE api_keys
  SET last_used_at = NOW(), usage_count = usage_count + 1
  WHERE id = key_record.id;

  result := jsonb_build_object(
    'valid', true,
    'org_id', key_record.org_id,
    'scopes', key_record.scopes,
    'rate_limit', key_record.rate_limit
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate API key prefix
CREATE OR REPLACE FUNCTION generate_api_key_prefix(p_environment TEXT DEFAULT 'live')
RETURNS TEXT AS $$
BEGIN
  RETURN 'sk_' || p_environment || '_' || substring(encode(gen_random_bytes(4), 'base64url'), 1, 8);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Function to revoke API key
CREATE OR REPLACE FUNCTION revoke_api_key(p_key_id UUID, p_revoked_by UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE api_keys
  SET status = 'revoked', revoked_at = NOW(), revoked_by = p_revoked_by
  WHERE id = p_key_id
  AND status = 'active';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
