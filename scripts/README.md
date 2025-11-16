# Processing Pipeline Test Scripts

This directory contains diagnostic and testing scripts for the Record processing pipeline.

## Quick Start

```bash
# 1. Check system health (fastest, no prerequisites)
yarn tsx scripts/check-system-health.ts

# 2. Run full integration test (requires worker running)
yarn tsx scripts/test-processing-flow.ts

# 3. Monitor specific recording (requires recording ID)
yarn tsx scripts/test-sse-stream.ts <recording-id>
```

## Scripts Overview

### 1. check-system-health.ts

**Purpose**: Quick health check of all system components

**Runtime**: ~5-10 seconds

**Prerequisites**:
- `.env` file configured

**What it checks**:
- **Offline checks:**
  - Environment variables configuration
  - Job handlers availability
  - Streaming manager status
- **Online checks (requires network):**
  - Supabase connection and database health
  - Google AI API access

**When to use**:
- First thing after cloning repo
- After changing configuration
- Before starting development
- Diagnosing "nothing works" issues

**Example output**:
```bash
✓ NEXT_PUBLIC_SUPABASE_URL
✓ Supabase connection
✓ Table: recordings
✓ Google AI connection - API responding
✓ Pending jobs count - 0 jobs
✓ Handler: transcribe-gemini-video

Health Score: 94%
System is healthy and ready!
```

---

### 2. test-processing-flow.ts

**Purpose**: Comprehensive end-to-end integration test

**Runtime**: ~30-60 seconds (depends on worker)

**Prerequisites**:
- `.env` file configured
- Supabase database with migrations
- Background worker running (`yarn worker:dev`)

**What it tests**:
1. Environment configuration
2. Test recording creation
3. Finalize endpoint behavior
4. Job creation in database
5. Job handler imports
6. SSE streaming manager
7. Job processing by worker (polls for 30s)

**When to use**:
- After major code changes
- Before deploying
- CI/CD pipeline
- Validating new environment

**Example output**:
```bash
=== TEST 1: Environment & Configuration ===
✓ NEXT_PUBLIC_SUPABASE_URL found
✓ Supabase connection OK

=== TEST 2: Non-Streaming Finalize Endpoint ===
✓ Recording status updated to "uploaded"
✓ Transcribe job created: abc-123-def
✓ Job verified in database

=== TEST 3: Job Processing (Polling) ===
ℹ Job status: pending (attempt 1/15)
ℹ Job status: processing (attempt 5/15)
✓ Job completed successfully!

=== SUMMARY ===
Total Tests: 5
✓ Passed: 5
✗ Failed: 0
```

---

### 3. test-sse-stream.ts

**Purpose**: Test and monitor SSE streaming for a specific recording

**Runtime**: ~30-60 seconds

**Prerequisites**:
- `.env` file configured
- Recording ID (from database or previous test)
- Worker running (for live job monitoring)

**Usage**:
```bash
yarn tsx scripts/test-sse-stream.ts <recording-id>
```

**What it tests**:
1. Streaming manager internal API
2. Mock SSE connection creation
3. Event sending and formatting
4. Job status polling and monitoring
5. Recording status and related data

**When to use**:
- Debugging SSE connection issues
- Monitoring live job execution
- Verifying progress callbacks
- Testing event delivery

**Example output**:
```bash
=== TEST 1: Streaming Manager Internal API ===
✓ Connection registered
📝 [LOG] Test log message
📊 [PROGRESS] Test progress update - 25%
✅ [COMPLETE] Test complete

Total events received: 7
Event breakdown:
  log: 2
  progress: 2
  transcript_chunk: 1
  document_chunk: 1
  complete: 1

=== TEST 2: Job Processing Simulation ===
Found 3 jobs:
  - transcribe: completed
  - doc_generate: processing
  - generate_embeddings: pending

[+2.0s] Job doc_generate: processing → completed
[+10.5s] Job generate_embeddings: pending → processing
[+25.3s] Job generate_embeddings: processing → completed
```

---

## Common Workflows

### First Time Setup

```bash
# 1. Clone repo
git clone <repo-url>
cd recorder

# 2. Install dependencies
yarn install

# 3. Copy environment template
cp .env.example .env
# Edit .env with your credentials

# 4. Run health check
yarn tsx scripts/check-system-health.ts

# 5. If healthy, run full test
yarn tsx scripts/test-processing-flow.ts
```

### Daily Development

```bash
# Terminal 1: Start worker
yarn worker:dev

# Terminal 2: Start dev server
yarn dev

# Terminal 3: Quick health check when needed
yarn tsx scripts/check-system-health.ts
```

### Debugging Processing Issues

```bash
# 1. Check system health
yarn tsx scripts/check-system-health.ts

# 2. If healthy, check database
psql $DATABASE_URL -c "SELECT id, status FROM recordings ORDER BY created_at DESC LIMIT 5"

# 3. Get a recording ID with issues
recording_id="<paste-id-here>"

# 4. Monitor that recording
yarn tsx scripts/test-sse-stream.ts $recording_id

# 5. Check jobs for that recording
psql $DATABASE_URL -c "SELECT id, type, status, error FROM jobs WHERE payload->>'recordingId' = '$recording_id'"
```

### CI/CD Integration

```yaml
# .github/workflows/test.yml
- name: Health Check
  run: yarn tsx scripts/check-system-health.ts

- name: Start Worker
  run: yarn worker &

- name: Integration Tests
  run: yarn tsx scripts/test-processing-flow.ts
  timeout-minutes: 5
```

---

## Interpreting Results

### Health Check

**100% pass**: System ready, all components working
**80-99% pass**: Minor issues, review warnings
**60-79% pass**: Significant issues, fix before proceeding
**<60% pass**: Critical issues, system won't function

### Integration Test

**All tests pass**: Pipeline working end-to-end
**Some tests pass**: Identify which component failed, check logs
**All tests fail**: Check health first, likely config issue

### SSE Stream Test

**Events received**: Streaming working correctly
**No events**: Worker not running or connection issue
**Partial events**: Handler crashed mid-execution

---

## Troubleshooting

### "Command not found: yarn"

Use npm instead:
```bash
npx tsx scripts/check-system-health.ts
```

### "Cannot find module '@/lib/...'"

You're running from wrong directory:
```bash
# Must run from project root
cd /path/to/recorder
yarn tsx scripts/check-system-health.ts
```

### "supabaseUrl is required"

Missing environment variables:
```bash
# Check .env exists
ls -la .env

# Verify variables are set
cat .env | grep SUPABASE_URL
```

### "Job did not complete within 30s"

Worker not running or crashed:
```bash
# Check if worker is running
ps aux | grep worker

# Start worker
yarn worker:dev

# Check worker logs
tail -f worker.log  # if logging to file
```

### Test hangs or times out

Increase timeout or check network:
```bash
# Check Supabase connectivity
curl https://your-project.supabase.co

# Check Google AI API
curl https://generativelanguage.googleapis.com

# Increase test timeout (edit script)
const TEST_TIMEOUT_MS = 120000; // 2 minutes
```

---

## Environment Variables Reference

Required for all tests:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_AI_API_KEY`

Required for specific tests:
- `CLERK_SECRET_KEY` (finalize endpoint auth)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (auth)

Optional but recommended:
- `GOOGLE_GENERATIVE_AI_API_KEY` (AI assistant)
- `COHERE_API_KEY` (search re-ranking)

---

## Advanced Usage

### Running Specific Tests

```bash
# Health check only
yarn tsx scripts/check-system-health.ts | grep "✓"

# Integration test without job polling
# (edit script, set MAX_POLL_ATTEMPTS = 0)
yarn tsx scripts/test-processing-flow.ts

# Stream test with custom recording
recording_id=$(psql $DATABASE_URL -t -c "SELECT id FROM recordings ORDER BY created_at DESC LIMIT 1")
yarn tsx scripts/test-sse-stream.ts $recording_id
```

### Automated Testing

```bash
#!/bin/bash
# run-all-tests.sh

set -e

echo "=== Running Health Check ==="
yarn tsx scripts/check-system-health.ts

echo "=== Starting Worker ==="
yarn worker &
WORKER_PID=$!

echo "=== Running Integration Tests ==="
yarn tsx scripts/test-processing-flow.ts

echo "=== Stopping Worker ==="
kill $WORKER_PID

echo "=== All Tests Complete ==="
```

### Custom Test Data

```typescript
// Create custom test recording
import { createAdminClient } from '@/lib/supabase/admin';

const supabase = createAdminClient();
const { data } = await supabase.from('recordings').insert({
  org_id: 'your-org-id',
  created_by: 'your-user-id',
  title: 'Custom Test Recording',
  status: 'uploading',
}).select().single();

console.log('Recording ID:', data.id);

// Now run stream test
// yarn tsx scripts/test-sse-stream.ts <recording-id>
```

---

## Related Documentation

- [PROCESSING_PIPELINE_DEBUG_GUIDE.md](../PROCESSING_PIPELINE_DEBUG_GUIDE.md) - Detailed troubleshooting
- [PROCESSING_PIPELINE_TEST_SUITE.md](../PROCESSING_PIPELINE_TEST_SUITE.md) - Test suite documentation
- [CLAUDE.md](../CLAUDE.md) - Project architecture
- [README.md](../README.md) - Main project README

---

## Contributing

When adding new scripts:

1. Follow naming convention: `{verb}-{noun}.ts`
2. Add color-coded output for readability
3. Include clear error messages
4. Document in this README
5. Add to test suite documentation
6. Update troubleshooting guide if needed

## Support

If tests continue to fail after following this guide:

1. Check [PROCESSING_PIPELINE_DEBUG_GUIDE.md](../PROCESSING_PIPELINE_DEBUG_GUIDE.md)
2. Review error messages carefully
3. Enable debug logging: `LOG_LEVEL=debug`
4. Check GitHub issues for similar problems
5. Ask for help with:
   - Exact error messages
   - Test output
   - Environment details
   - Steps to reproduce
