-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- ORGANIZATIONS & USERS
-- ============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);

-- Sync with Clerk users
CREATE TABLE users (
    id TEXT PRIMARY KEY, -- Clerk user ID
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Organization membership with roles
CREATE TABLE user_organizations (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'contributor', 'reader')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, org_id)
);

CREATE INDEX idx_user_organizations_org_id ON user_organizations(org_id);
CREATE INDEX idx_user_organizations_user_id ON user_organizations(user_id);

-- ============================================================================
-- RECORDINGS
-- ============================================================================

CREATE TABLE recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN (
        'uploading', 'uploaded', 'transcribing', 'transcribed',
        'doc_generating', 'completed', 'error'
    )),
    duration_sec INTEGER,
    storage_path_raw TEXT,
    storage_path_processed TEXT,
    thumbnail_url TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_recordings_org_id ON recordings(org_id);
CREATE INDEX idx_recordings_created_by ON recordings(created_by);
CREATE INDEX idx_recordings_status ON recordings(status) WHERE status NOT IN ('completed', 'error');
CREATE INDEX idx_recordings_created_at ON recordings(org_id, created_at DESC);

-- ============================================================================
-- TRANSCRIPTS
-- ============================================================================

CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE UNIQUE,
    language TEXT DEFAULT 'en',
    text TEXT NOT NULL,
    words_json JSONB, -- Word-level timestamps and confidence
    confidence FLOAT,
    provider TEXT, -- 'whisper', 'assemblyai', etc.
    provider_job_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_recording_id ON transcripts(recording_id);
CREATE INDEX idx_transcripts_provider_job_id ON transcripts(provider_job_id);

-- ============================================================================
-- DOCUMENTS (Generated from transcripts)
-- ============================================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    markdown TEXT NOT NULL,
    html TEXT,
    summary TEXT,
    version TEXT DEFAULT 'ai:1', -- Track AI vs user edits
    model TEXT, -- GPT-4, GPT-3.5, etc.
    is_published BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'edited', 'error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_recording_id ON documents(recording_id);
CREATE INDEX idx_documents_org_id ON documents(org_id);
CREATE INDEX idx_documents_is_published ON documents(is_published) WHERE is_published = true;

-- ============================================================================
-- VECTOR EMBEDDINGS
-- ============================================================================

CREATE TABLE transcript_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recording_id UUID NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI ada-002 dimension
    start_time_sec FLOAT,
    end_time_sec FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    model TEXT DEFAULT 'text-embedding-ada-002',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcript_chunks_recording_id ON transcript_chunks(recording_id);
CREATE INDEX idx_transcript_chunks_org_id ON transcript_chunks(org_id);
CREATE INDEX idx_transcript_chunks_embedding ON transcript_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- BACKGROUND JOBS
-- ============================================================================

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'transcribe', 'docify', 'embed', etc.
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued', 'running', 'succeeded', 'failed', 'dead'
    )),
    payload JSONB NOT NULL,
    result JSONB,
    error TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    dedupe_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status, run_at) WHERE status IN ('queued', 'running');
CREATE INDEX idx_jobs_type ON jobs(type);
CREATE INDEX idx_jobs_dedupe_key ON jobs(dedupe_key);

-- ============================================================================
-- EVENTS (Outbox pattern for notifications)
-- ============================================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_processed ON events(processed, created_at) WHERE processed = false;
CREATE INDEX idx_events_type ON events(type);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ============================================================================
-- SHARING
-- ============================================================================

CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('recording', 'document')),
    target_id UUID NOT NULL,
    share_id TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'base64url'),
    password_hash TEXT, -- bcrypt hash if password protected
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shares_share_id ON shares(share_id);
CREATE INDEX idx_shares_org_id ON shares(org_id);
CREATE INDEX idx_shares_target ON shares(target_type, target_id);

-- ============================================================================
-- USAGE TRACKING
-- ============================================================================

CREATE TABLE usage_counters (
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    period DATE NOT NULL DEFAULT CURRENT_DATE,
    minutes_transcribed INTEGER DEFAULT 0,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    storage_gb FLOAT DEFAULT 0.0,
    recordings_count INTEGER DEFAULT 0,
    queries_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, period)
);

CREATE INDEX idx_usage_counters_org_period ON usage_counters(org_id, period DESC);

-- ============================================================================
-- CHAT HISTORY (Optional - for saving conversations)
-- ============================================================================

CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_conversations_org_user ON chat_conversations(org_id, user_id, updated_at DESC);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sources JSONB, -- Array of {recording_id, chunk_id, text}
    tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recordings_updated_at BEFORE UPDATE ON recordings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcripts_updated_at BEFORE UPDATE ON transcripts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_conversations_updated_at BEFORE UPDATE ON chat_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (Phase 2 - commented out for now)
-- ============================================================================

-- Enable RLS on all tables (uncomment when ready)
-- ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (will be implemented in Phase 2)
-- CREATE POLICY "Users can view their org's recordings"
--     ON recordings FOR SELECT
--     USING (org_id IN (
--         SELECT org_id FROM user_organizations
--         WHERE user_id = auth.uid()
--     ));
