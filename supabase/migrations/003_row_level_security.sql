-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================
--
-- This migration enables RLS on all user-facing tables and creates policies
-- that work with Clerk authentication via service role.
--
-- ARCHITECTURE NOTE:
-- - Frontend: Uses Clerk for authentication
-- - Backend: Next.js API routes with Supabase admin client (service_role)
-- - RLS: Provides defense-in-depth security layer
--
-- Service role has full access (for API routes)
-- Future: Can add policies for direct client access with JWT claims
--

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to check if a user has access to an organization
CREATE OR REPLACE FUNCTION user_has_org_access(
  p_user_id TEXT,
  p_org_id UUID,
  p_min_role TEXT DEFAULT 'reader'
)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  role_hierarchy TEXT[] := ARRAY['reader', 'contributor', 'admin', 'owner'];
  min_role_level INT;
  user_role_level INT;
BEGIN
  -- Get user's role in the organization
  SELECT role INTO user_role
  FROM user_organizations
  WHERE user_id = p_user_id AND org_id = p_org_id;

  IF user_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check role hierarchy
  SELECT array_position(role_hierarchy, p_min_role) INTO min_role_level;
  SELECT array_position(role_hierarchy, user_role) INTO user_role_level;

  RETURN user_role_level >= min_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all organization IDs a user has access to
CREATE OR REPLACE FUNCTION get_user_org_ids(p_user_id TEXT)
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT org_id
    FROM user_organizations
    WHERE user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;

-- Note: jobs and events tables are backend-only, no RLS needed
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SERVICE ROLE POLICIES (Full Access for API Routes)
-- ============================================================================

-- Organizations
CREATE POLICY "Service role has full access to organizations"
  ON organizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users
CREATE POLICY "Service role has full access to users"
  ON users FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- User Organizations
CREATE POLICY "Service role has full access to user_organizations"
  ON user_organizations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Recordings
CREATE POLICY "Service role has full access to recordings"
  ON recordings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Transcripts
CREATE POLICY "Service role has full access to transcripts"
  ON transcripts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Documents
CREATE POLICY "Service role has full access to documents"
  ON documents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Transcript Chunks
CREATE POLICY "Service role has full access to transcript_chunks"
  ON transcript_chunks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Notifications
CREATE POLICY "Service role has full access to notifications"
  ON notifications FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Shares
CREATE POLICY "Service role has full access to shares"
  ON shares FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Chat Conversations
CREATE POLICY "Service role has full access to chat_conversations"
  ON chat_conversations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Chat Messages
CREATE POLICY "Service role has full access to chat_messages"
  ON chat_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Usage Counters
CREATE POLICY "Service role has full access to usage_counters"
  ON usage_counters FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- AUTHENTICATED USER POLICIES (Future: For Direct Client Access)
-- ============================================================================
--
-- These policies are commented out for now since the app uses service_role
-- through API routes. Uncomment if you add direct client access with JWT.
--

-- Organizations: Users can view organizations they belong to
-- CREATE POLICY "Users can view their organizations"
--   ON organizations FOR SELECT
--   TO authenticated
--   USING (id = ANY(get_user_org_ids(auth.uid()::TEXT)));

-- Recordings: Users can view recordings from their organizations
-- CREATE POLICY "Users can view their org's recordings"
--   ON recordings FOR SELECT
--   TO authenticated
--   USING (org_id = ANY(get_user_org_ids(auth.uid()::TEXT)));

-- Recordings: Contributors can create recordings
-- CREATE POLICY "Contributors can create recordings"
--   ON recordings FOR INSERT
--   TO authenticated
--   WITH CHECK (
--     user_has_org_access(auth.uid()::TEXT, org_id, 'contributor')
--   );

-- Recordings: Owners can update their recordings
-- CREATE POLICY "Users can update their own recordings"
--   ON recordings FOR UPDATE
--   TO authenticated
--   USING (created_by = auth.uid()::TEXT)
--   WITH CHECK (created_by = auth.uid()::TEXT);

-- Recordings: Admins can delete recordings in their org
-- CREATE POLICY "Admins can delete org recordings"
--   ON recordings FOR DELETE
--   TO authenticated
--   USING (
--     user_has_org_access(auth.uid()::TEXT, org_id, 'admin')
--   );

-- Transcripts: Users can view transcripts from their org's recordings
-- CREATE POLICY "Users can view transcripts from their org"
--   ON transcripts FOR SELECT
--   TO authenticated
--   USING (
--     recording_id IN (
--       SELECT id FROM recordings
--       WHERE org_id = ANY(get_user_org_ids(auth.uid()::TEXT))
--     )
--   );

-- Documents: Users can view documents from their organizations
-- CREATE POLICY "Users can view their org's documents"
--   ON documents FOR SELECT
--   TO authenticated
--   USING (org_id = ANY(get_user_org_ids(auth.uid()::TEXT)));

-- Transcript Chunks: Users can view chunks from their organizations
-- CREATE POLICY "Users can view their org's chunks"
--   ON transcript_chunks FOR SELECT
--   TO authenticated
--   USING (org_id = ANY(get_user_org_ids(auth.uid()::TEXT)));

-- Notifications: Users can view their own notifications
-- CREATE POLICY "Users can view their own notifications"
--   ON notifications FOR SELECT
--   TO authenticated
--   USING (user_id = auth.uid()::TEXT);

-- Notifications: Users can update (mark as read) their notifications
-- CREATE POLICY "Users can update their own notifications"
--   ON notifications FOR UPDATE
--   TO authenticated
--   USING (user_id = auth.uid()::TEXT)
--   WITH CHECK (user_id = auth.uid()::TEXT);

-- Chat Conversations: Users can view conversations from their organizations
-- CREATE POLICY "Users can view their org's conversations"
--   ON chat_conversations FOR SELECT
--   TO authenticated
--   USING (org_id = ANY(get_user_org_ids(auth.uid()::TEXT)));

-- Chat Messages: Users can view messages from accessible conversations
-- CREATE POLICY "Users can view messages from their conversations"
--   ON chat_messages FOR SELECT
--   TO authenticated
--   USING (
--     conversation_id IN (
--       SELECT id FROM chat_conversations
--       WHERE org_id = ANY(get_user_org_ids(auth.uid()::TEXT))
--     )
--   );

-- ============================================================================
-- PUBLIC POLICIES (For Public Shares)
-- ============================================================================

-- Allow public access to valid, non-expired, non-revoked shares
CREATE POLICY "Public can view active shares"
  ON shares FOR SELECT
  TO public
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Note: Access to shared recordings/documents will be handled at the API level
-- The API will verify the share_id and serve content accordingly

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Service role has full access to organizations" ON organizations IS
'Backend API routes use service_role for all database operations';

COMMENT ON POLICY "Public can view active shares" ON shares IS
'Allows public to view share metadata; API validates access to actual content';

COMMENT ON FUNCTION user_has_org_access IS
'Checks if a user has at least the minimum required role in an organization';

COMMENT ON FUNCTION get_user_org_ids IS
'Returns array of organization IDs a user is a member of';
