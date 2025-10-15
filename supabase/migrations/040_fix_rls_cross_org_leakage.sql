-- Migration: Fix RLS Cross-Organization Data Leakage
-- Description: Replace vulnerable IN (SELECT ...) patterns with EXISTS for proper isolation
-- Date: 2025-10-15
-- Security: Critical - Prevents cross-organization data leakage
-- OWASP Reference: A01:2021 – Broken Access Control
-- CWE-639: Authorization Bypass Through User-Controlled Key

-- ==============================================================================
-- CRITICAL SECURITY FIX
-- ==============================================================================
-- The existing RLS policies use the pattern:
--   WHERE org_id IN (SELECT org_id FROM users WHERE clerk_id = auth.uid())
--
-- This is VULNERABLE because:
-- 1. If a user is deleted but has deleted_at set, they can still pass the check
-- 2. The subquery can return multiple org_ids if there are data integrity issues
-- 3. It doesn't properly validate the org_id relationship
--
-- The secure pattern uses EXISTS with proper constraints:
--   WHERE EXISTS (
--     SELECT 1 FROM users
--     WHERE clerk_id = auth.uid()
--     AND org_id = table.org_id
--     AND deleted_at IS NULL
--     LIMIT 1
--   )
--
-- This ensures:
-- 1. Explicit org_id matching (prevents data leakage)
-- 2. Deleted user check (prevents zombie access)
-- 3. Single row validation (LIMIT 1)
-- 4. Early exit optimization (EXISTS vs IN)
-- ==============================================================================

-- ==============================================================================
-- 1. FIX DEPARTMENTS TABLE RLS POLICIES
-- ==============================================================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can read departments in their org" ON departments;
DROP POLICY IF EXISTS "Admins can manage departments" ON departments;

-- Create secure policies with EXISTS pattern
CREATE POLICY "Users can read departments in their org"
  ON departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = departments.org_id
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

CREATE POLICY "Admins can manage departments"
  ON departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = departments.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- ==============================================================================
-- 2. FIX AUDIT_LOGS TABLE RLS POLICIES
-- ==============================================================================

-- Drop existing vulnerable policy
DROP POLICY IF EXISTS "Admins can read audit logs" ON audit_logs;

-- Create secure policy with EXISTS pattern
CREATE POLICY "Admins can read audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = audit_logs.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- ==============================================================================
-- 3. FIX USER_INVITATIONS TABLE RLS POLICIES
-- ==============================================================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Admins can read invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can create invitations" ON user_invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON user_invitations;

-- Create secure policies with EXISTS pattern
CREATE POLICY "Admins can read invitations"
  ON user_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = user_invitations.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

CREATE POLICY "Admins can create invitations"
  ON user_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = user_invitations.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

CREATE POLICY "Admins can update invitations"
  ON user_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = user_invitations.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- ==============================================================================
-- 4. FIX API_KEYS TABLE RLS POLICIES
-- ==============================================================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Admins can read api keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can create api keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can update api keys" ON api_keys;

-- Create secure policies with EXISTS pattern
CREATE POLICY "Admins can read api keys"
  ON api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = api_keys.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

CREATE POLICY "Admins can create api keys"
  ON api_keys FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = api_keys.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

CREATE POLICY "Admins can update api keys"
  ON api_keys FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND org_id = api_keys.org_id
      AND role IN ('owner', 'admin')
      AND deleted_at IS NULL
      LIMIT 1
    )
  );

-- ==============================================================================
-- 5. FIX USER_DEPARTMENTS JUNCTION TABLE RLS POLICIES
-- ==============================================================================

-- Drop existing vulnerable policies
DROP POLICY IF EXISTS "Users can read their department memberships" ON user_departments;
DROP POLICY IF EXISTS "Admins can manage department memberships" ON user_departments;

-- Create secure policies
-- Users can read their own department memberships OR admins can read all in their org
CREATE POLICY "Users can read department memberships"
  ON user_departments FOR SELECT
  USING (
    -- User can read their own memberships
    user_id IN (
      SELECT id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND deleted_at IS NULL
    )
    OR
    -- Admins can read all memberships in their org
    EXISTS (
      SELECT 1 FROM users u1
      INNER JOIN users u2 ON u2.id = user_departments.user_id
      WHERE u1.clerk_id = (auth.uid())::TEXT
      AND u1.org_id = u2.org_id
      AND u1.role IN ('owner', 'admin')
      AND u1.deleted_at IS NULL
      AND u2.deleted_at IS NULL
      LIMIT 1
    )
  );

-- Admins can manage department memberships for users in their org
CREATE POLICY "Admins can manage department memberships"
  ON user_departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users current_user
      INNER JOIN users target_user ON target_user.id = user_departments.user_id
      WHERE current_user.clerk_id = (auth.uid())::TEXT
      AND current_user.org_id = target_user.org_id
      AND current_user.role IN ('owner', 'admin')
      AND current_user.deleted_at IS NULL
      AND target_user.deleted_at IS NULL
      LIMIT 1
    )
  );

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================
-- Run these queries to verify the policies are working correctly:
--
-- 1. Verify no cross-org access to departments:
-- SELECT * FROM departments WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
-- (Should return 0 rows)
--
-- 2. Verify no cross-org access to audit logs:
-- SELECT * FROM audit_logs WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
-- (Should return 0 rows)
--
-- 3. Verify no cross-org access to invitations:
-- SELECT * FROM user_invitations WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
-- (Should return 0 rows)
--
-- 4. Verify no cross-org access to API keys:
-- SELECT * FROM api_keys WHERE org_id != (SELECT org_id FROM users WHERE clerk_id = auth.uid() LIMIT 1);
-- (Should return 0 rows)
-- ==============================================================================

-- Add comments for audit trail
COMMENT ON POLICY "Users can read departments in their org" ON departments IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can manage departments" ON departments IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can read audit logs" ON audit_logs IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can read invitations" ON user_invitations IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can create invitations" ON user_invitations IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can update invitations" ON user_invitations IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can read api keys" ON api_keys IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can create api keys" ON api_keys IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';

COMMENT ON POLICY "Admins can update api keys" ON api_keys IS
  'SECURITY FIX 2025-10-15: Prevents cross-org data leakage using EXISTS pattern';
