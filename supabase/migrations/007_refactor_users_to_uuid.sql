-- Migration: Refactor users table to use UUID primary key instead of Clerk ID
-- This makes the schema consistent with organizations and decouples from auth provider

-- Step 1: Add temporary uuid column to users
ALTER TABLE users ADD COLUMN user_uuid UUID DEFAULT uuid_generate_v4();

-- Step 2: Populate UUIDs for existing users (if any)
UPDATE users SET user_uuid = uuid_generate_v4() WHERE user_uuid IS NULL;

-- Step 3: Make user_uuid NOT NULL
ALTER TABLE users ALTER COLUMN user_uuid SET NOT NULL;

-- Step 4: Update recordings table
ALTER TABLE recordings ADD COLUMN created_by_uuid UUID;
UPDATE recordings SET created_by_uuid = (SELECT user_uuid FROM users WHERE users.id = recordings.created_by);
ALTER TABLE recordings ALTER COLUMN created_by_uuid SET NOT NULL;
ALTER TABLE recordings DROP CONSTRAINT recordings_created_by_fkey;
ALTER TABLE recordings DROP COLUMN created_by;
ALTER TABLE recordings RENAME COLUMN created_by_uuid TO created_by;
-- Will add FK constraint after users.id becomes UUID

-- Step 5: Update notifications table
ALTER TABLE notifications ADD COLUMN user_uuid UUID;
UPDATE notifications SET user_uuid = (SELECT user_uuid FROM users WHERE users.id = notifications.user_id);
ALTER TABLE notifications ALTER COLUMN user_uuid SET NOT NULL;
ALTER TABLE notifications DROP CONSTRAINT notifications_user_id_fkey;
ALTER TABLE notifications DROP COLUMN user_id;
ALTER TABLE notifications RENAME COLUMN user_uuid TO user_id;
-- Will add FK constraint after users.id becomes UUID

-- Step 6: Update shares table
ALTER TABLE shares ADD COLUMN created_by_uuid UUID;
UPDATE shares SET created_by_uuid = (SELECT user_uuid FROM users WHERE users.id = shares.created_by);
ALTER TABLE shares ALTER COLUMN created_by_uuid SET NOT NULL;
ALTER TABLE shares DROP CONSTRAINT shares_created_by_fkey;
ALTER TABLE shares DROP COLUMN created_by;
ALTER TABLE shares RENAME COLUMN created_by_uuid TO created_by;
-- Will add FK constraint after users.id becomes UUID

-- Step 7: Update chat_conversations table
ALTER TABLE chat_conversations ADD COLUMN user_uuid UUID;
UPDATE chat_conversations SET user_uuid = (SELECT user_uuid FROM users WHERE users.id = chat_conversations.user_id);
ALTER TABLE chat_conversations ALTER COLUMN user_uuid SET NOT NULL;
ALTER TABLE chat_conversations DROP CONSTRAINT chat_conversations_user_id_fkey;
ALTER TABLE chat_conversations DROP COLUMN user_id;
ALTER TABLE chat_conversations RENAME COLUMN user_uuid TO user_id;
-- Will add FK constraint after users.id becomes UUID

-- Step 8: Drop RLS policy that references users.id
DROP POLICY IF EXISTS "Users can read their own data" ON users;

-- Step 9: Drop indexes on users.id before changing it
DROP INDEX IF EXISTS idx_users_email;

-- Step 10: Switch users table to UUID primary key
ALTER TABLE users DROP CONSTRAINT users_pkey;
ALTER TABLE users RENAME COLUMN id TO clerk_id;
ALTER TABLE users RENAME COLUMN user_uuid TO id;
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE users ADD CONSTRAINT users_clerk_id_unique UNIQUE (clerk_id);

-- Step 11: Recreate indexes
CREATE INDEX idx_users_clerk_id ON users(clerk_id);
CREATE INDEX idx_users_email ON users(email);

-- Step 12: Add foreign key constraints back
ALTER TABLE recordings ADD CONSTRAINT recordings_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE shares ADD CONSTRAINT shares_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_conversations ADD CONSTRAINT chat_conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 13: Recreate RLS policy with new structure
CREATE POLICY "Users can read their own data"
ON users
FOR SELECT
TO authenticated
USING (clerk_id = auth.uid()::text);

-- Step 14: Add comments
COMMENT ON COLUMN users.id IS 'Internal UUID primary key (stable across auth providers)';
COMMENT ON COLUMN users.clerk_id IS 'External Clerk user ID for authentication';
