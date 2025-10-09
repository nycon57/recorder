# Running the Complete System

This guide explains how to run the full Record platform with all Phase 1-3 features.

---

## Prerequisites

Before starting, ensure you have:

✅ **Node.js 18+** installed
✅ **Yarn** package manager
✅ **Clerk account** with Organizations enabled
✅ **Supabase project** with:
   - PostgreSQL database
   - pgvector extension enabled
   - Storage buckets created
   - Migrations applied
✅ **OpenAI API key** with access to:
   - Whisper API (transcription)
   - GPT-5 Nano API (document generation)
   - Embeddings API (text-embedding-3-small)

---

## One-Time Setup

### 1. Install Dependencies

```bash
yarn install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...  # Optional

# Webhook Security
WEBHOOK_SECRET=your-random-secret-string

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Database Migrations

**Option 1: Supabase CLI** (recommended)
```bash
supabase db push
```

**Option 2: Manual SQL**
1. Open Supabase SQL Editor
2. Copy contents of `supabase/migrations/001_initial_schema.sql`
3. Execute

### 4. Create Storage Buckets

In Supabase SQL Editor, run:
```bash
# Copy and execute contents of supabase/storage/buckets.sql
```

### 5. Enable pgvector Extension

In Supabase SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Running the Application

You need **TWO** terminal windows/tabs:

### Terminal 1: Web Server

```bash
yarn dev
```

This starts:
- Next.js development server on http://localhost:3000
- API routes for recordings, uploads, etc.
- Server-side rendering

**Output:**
```
▲ Next.js 14.2.0
- Local:        http://localhost:3000
- Network:      http://192.168.1.x:3000

✓ Ready in 2.5s
```

### Terminal 2: Background Job Worker

```bash
yarn worker
```

This starts:
- Job processor that polls the database
- Handles transcription, document generation, embeddings
- Automatically retries failed jobs

**Output:**
```
============================================================
🤖 Record Background Job Worker
============================================================
✅ Environment variables validated

📋 Running in continuous mode (Ctrl+C to stop)

[Job Processor] Starting job processor...
[Job Processor] Batch size: 10, Poll interval: 5000ms
```

---

## Using the System

### 1. Sign Up / Sign In

1. Open http://localhost:3000
2. Click "Sign Up" or "Sign In"
3. Create account via Clerk
4. Create an organization (or join one)

### 2. Create a Recording

1. Navigate to "New Recording" (/record)
2. Select recording mode:
   - Screen only
   - Screen + Camera
   - Camera only
3. Choose devices (camera, microphone)
4. Click "Start Recording"
5. Grant browser permissions
6. Record your content
7. Click "Stop Recording"

### 3. Upload & Process

After stopping:
1. Upload modal appears
2. Enter title and description (optional)
3. Click "Upload"
4. Video uploads to Supabase Storage
5. Processing begins automatically

**Watch the worker terminal**:
```
[Job Processor] Found 1 pending jobs
[Job 123...] Processing job type: transcribe
[Transcribe] Starting transcription for recording 456...
[Transcribe] Downloading video from org_789/recordings/456/raw.webm
[Transcribe] Calling OpenAI Whisper API
[Transcribe] Transcription completed. Duration: 120s
[Transcribe] Saved transcript abc...
[Transcribe] Enqueued document generation job

[Job 124...] Processing job type: doc_generate
[Docify] Starting document generation for recording 456...
[Docify] Calling GPT-5 Nano for document generation
[Docify] Generated document (3500 chars)
[Docify] Saved document def...
[Docify] Enqueued embedding generation

[Job 125...] Processing job type: generate_embeddings
[Embeddings] Starting embedding generation for recording 456...
[Embeddings] Created 15 transcript chunks
[Embeddings] Created 12 document chunks
[Embeddings] Total chunks to embed: 27
[Embeddings] Generating embeddings for batch 1/2
[Embeddings] Generating embeddings for batch 2/2
[Embeddings] Successfully saved 27 embeddings
```

### 4. View Results

1. Navigate to Dashboard (/dashboard)
2. See recording with status "completed"
3. Click to view:
   - Video player
   - Transcript (Phase 4+)
   - Generated document (Phase 4+)
   - Chat with AI about content (Phase 5+)

---

## Monitoring & Debugging

### Check Job Status

**SQL Query in Supabase:**
```sql
-- View all jobs
SELECT id, type, status, attempt_count, created_at, error
FROM jobs
ORDER BY created_at DESC
LIMIT 20;

-- View pending jobs
SELECT * FROM jobs WHERE status = 'pending';

-- View failed jobs
SELECT * FROM jobs WHERE status = 'failed';
```

### Check Recording Status

```sql
-- View recordings with status
SELECT id, title, status, created_at
FROM recordings
ORDER BY created_at DESC
LIMIT 10;

-- View transcripts
SELECT id, recording_id, language, duration_seconds
FROM transcripts
ORDER BY created_at DESC;

-- View documents
SELECT id, recording_id, title, format
FROM documents
ORDER BY created_at DESC;

-- Check embeddings
SELECT COUNT(*), recording_id
FROM transcript_chunks
GROUP BY recording_id;
```

### Worker Logs

The worker outputs detailed logs:
- `[Job Processor]` - Main loop messages
- `[Job <id>]` - Individual job processing
- `[Transcribe]` - Transcription steps
- `[Docify]` - Document generation steps
- `[Embeddings]` - Embedding generation steps

### API Logs

Next.js dev server shows:
- HTTP requests to API routes
- Authentication checks
- Database queries (if verbose logging enabled)
- Errors and stack traces

---

## Common Issues & Solutions

### Worker Not Processing Jobs

**Symptom:** Jobs stay in `pending` status

**Check:**
1. Worker is running (`yarn worker`)
2. Environment variables are set correctly
3. Database connection works
4. Check worker terminal for errors

**Solution:**
```bash
# Restart worker
Ctrl+C
yarn worker

# Or process specific job
yarn worker job:<job-id>
```

### Transcription Fails

**Symptom:** Job marked as `failed`, error in jobs table

**Common causes:**
1. Invalid OpenAI API key
2. Rate limit exceeded
3. Video file too large
4. Network timeout

**Check:**
```sql
SELECT error FROM jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1;
```

**Solution:**
- Verify OpenAI API key
- Check OpenAI dashboard for rate limits
- Wait and retry: `UPDATE jobs SET status = 'pending', attempt_count = 0 WHERE id = '...'`

### Document Generation Fails

**Symptom:** Recording stuck in `doc_generating` status

**Common causes:**
1. OpenAI API rate limit
2. GPT-5 Nano access not enabled
3. Token limit exceeded

**Solution:**
- Check OpenAI account tier (GPT-5 Nano access)
- Reduce transcript length if needed
- Check worker logs for specific error

### Upload Fails

**Symptom:** Upload progress stops or returns error

**Common causes:**
1. Supabase storage bucket doesn't exist
2. Signed URL expired
3. Network issue

**Solution:**
- Run storage bucket SQL
- Check Supabase dashboard → Storage
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct

---

## Development Workflow

### Making Changes

**Frontend changes** (React components):
- Edit files in `app/` or `src/components/`
- Hot reload automatically updates browser
- No restart needed

**Backend changes** (API routes):
- Edit files in `app/api/`
- Next.js automatically restarts
- No manual restart needed

**Worker changes** (job handlers):
- Edit files in `lib/workers/`
- **Must restart worker**: Ctrl+C then `yarn worker`
- Or use watch mode: `yarn worker:dev`

### Testing Specific Jobs

**Process one batch and exit:**
```bash
yarn worker:once
```

**Process specific job by ID:**
```bash
yarn worker job:01234567-89ab-cdef-0123-456789abcdef
```

### Clearing Test Data

**Delete all recordings:**
```sql
DELETE FROM recordings WHERE org_id = '<your-org-id>';
-- Cascades to transcripts, documents, chunks, jobs
```

**Reset failed jobs:**
```sql
UPDATE jobs
SET status = 'pending', attempt_count = 0, run_after = NOW()
WHERE status = 'failed';
```

---

## Production Deployment

### Vercel Deployment

**Web Server:**
```bash
git push origin main
# Vercel auto-deploys
```

**Environment Variables:**
- Add all `.env.local` vars to Vercel dashboard
- Use production keys for Clerk, Supabase, OpenAI

### Background Worker

**Option 1: Long-running process (VPS/EC2)**
```bash
# Using PM2
pm2 start scripts/worker.ts --name record-worker --interpreter tsx

# Or systemd service
sudo systemctl start record-worker
```

**Option 2: Serverless function (Vercel Cron)**
```javascript
// app/api/cron/process-jobs/route.ts
export async function GET() {
  await processJobs({ batchSize: 10, pollInterval: 1000 });
  return Response.json({ success: true });
}
```

Then configure Vercel Cron:
```json
{
  "crons": [
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/5 * * * *"  // Every 5 minutes
    }
  ]
}
```

**Option 3: Dedicated worker service (Railway, Fly.io)**
- Deploy worker as separate app
- Configure environment variables
- Auto-restart on failure

---

## Performance Tips

### Optimize Worker Processing

```bash
# Process more jobs per cycle
BATCH_SIZE=20 yarn worker

# Reduce poll interval for faster pickup
POLL_INTERVAL=2000 yarn worker
```

**Edit `scripts/worker.ts`:**
```typescript
await processJobs({
  batchSize: 20,        // More jobs per batch
  pollInterval: 2000,   // Check more frequently
  maxRetries: 5,        // More retry attempts
});
```

### Optimize Embedding Generation

**Edit `lib/workers/handlers/embeddings.ts`:**
```typescript
const BATCH_SIZE = 100; // Increase from 20 (OpenAI allows up to 2048)
```

### Database Indexing

Already optimized in schema:
- `jobs(status, run_after)` - Fast job queries
- `transcript_chunks(embedding) USING ivfflat` - Vector search
- All foreign keys indexed automatically

---

## Next Steps

After successfully running the system:

1. **Test end-to-end flow:**
   - Record → Upload → Transcribe → Generate Doc → Embeddings
   - Verify each step completes

2. **Proceed to Phase 4:**
   - Implement semantic search API
   - Build search UI
   - Test vector similarity queries

3. **Read documentation:**
   - [PHASE3_SUMMARY.md](PHASE3_SUMMARY.md) - Phase 3 details
   - [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Roadmap

---

## Support

If you encounter issues:
1. Check worker and web server logs
2. Verify environment variables
3. Check Supabase database and storage
4. Open an issue on GitHub with logs

**Happy recording! 🎥✨**
