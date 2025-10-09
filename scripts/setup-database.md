# Database Setup Instructions

The Supabase JS client cannot execute raw SQL for security reasons. You need to run the migrations manually through the Supabase dashboard.

## Quick Setup (5 minutes)

### Step 1: Open Supabase SQL Editor

Go to: https://supabase.com/dashboard/project/clpatptmumyasbypvmun/sql

### Step 2: Run Migrations

Copy and paste each migration file in order into the SQL editor and click "Run":

#### 1. Initial Schema (001_initial_schema.sql)

Creates all tables: organizations, users, recordings, transcripts, documents, jobs, events, notifications, shares, and usage_counters.

Location: `supabase/migrations/001_initial_schema.sql`

#### 2. Vector Search Functions (002_vector_search_functions.sql)

Sets up pgvector extension and search functions for semantic search.

Location: `supabase/migrations/002_vector_search_functions.sql`

#### 3. Row Level Security (003_row_level_security.sql)

Implements RLS policies for multi-tenant data isolation.

Location: `supabase/migrations/003_row_level_security.sql`

#### 4. Security & Performance (004_security_and_performance_fixes.sql)

Additional indexes and security improvements.

Location: `supabase/migrations/004_security_and_performance_fixes.sql`

### Step 3: Verify Setup

Run this query to verify tables were created:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

You should see:
- chat_conversations
- chat_messages
- documents
- events
- jobs
- notifications
- organizations
- recordings
- shares
- transcript_chunks
- transcripts
- usage_counters
- user_organizations
- users

### Step 4: Create Your First Organization

After migrations are complete, you'll need an organization. Your Clerk user will be synced, but you need to create an org manually or through the Clerk dashboard.

Alternatively, sign into the app and Clerk will handle organization creation.

## Troubleshooting

### "Extension vector does not exist"

Enable the `vector` extension:
1. Go to Database → Extensions
2. Search for "vector"
3. Enable "pgvector"

### "Permission denied"

Make sure you're using the service role key, not the anon key.

### Tables already exist

If you see "relation already exists" errors, the tables are already created. You can skip that migration.

## Alternative: One-Command Setup

If you have Supabase CLI installed:

```bash
# Link to project
npx supabase link --project-ref clpatptmumyasbypvmun

# Push migrations
npx supabase db push
```
