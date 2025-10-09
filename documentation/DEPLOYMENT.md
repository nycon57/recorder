# Deployment Guide

Complete guide for deploying the Record platform to production.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Vercel Deployment](#vercel-deployment)
- [Background Workers](#background-workers)
- [Monitoring & Alerts](#monitoring--alerts)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, ensure you have:

- [x] Vercel account (for hosting)
- [x] Supabase project (for database & storage)
- [x] Clerk account (for authentication)
- [x] OpenAI API key (for AI features)
- [x] Upstash Redis instance (for rate limiting)
- [x] Domain name (optional, but recommended)

## Environment Setup

### 1. Create Production Environment Variables

Copy `.env.example` to create your production environment file:

```bash
cp .env.example .env.production
```

### 2. Required Environment Variables

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://yourdomain.com
LOG_LEVEL=info

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_SECRET_KEY=sk_live_xxxxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI
OPENAI_API_KEY=sk-xxxxx

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxx

# Optional: Email Notifications
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=notifications@yourdomain.com

# Optional: Stripe Billing
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx
```

## Database Setup

### 1. Run Migrations

Connect to your Supabase database and run all migrations:

```bash
# Using Supabase CLI
supabase db push

# Or manually via SQL editor in Supabase dashboard:
# - Run supabase/migrations/001_initial_schema.sql
# - Run supabase/migrations/002_vector_search_functions.sql
```

### 2. Enable pgvector Extension

In Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Create Performance Indexes

```sql
-- See lib/performance/query-optimization.ts for full list

-- Critical indexes
CREATE INDEX IF NOT EXISTS idx_recordings_org_created
  ON recordings(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chunks_embedding_ivfflat
  ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_jobs_status_created
  ON jobs(status, created_at ASC)
  WHERE status = 'pending';
```

### 4. Configure Storage Buckets

In Supabase Storage:

1. Create bucket: `recordings`
2. Set RLS policies:

```sql
-- Allow authenticated users to upload to their org's folder
CREATE POLICY "Users can upload to org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read recordings from their org
CREATE POLICY "Users can read org recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'recordings');
```

## Vercel Deployment

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Link Project

```bash
vercel link
```

### 3. Set Environment Variables

Add all production environment variables in Vercel dashboard:

```bash
vercel env add CLERK_SECRET_KEY
vercel env add OPENAI_API_KEY
# ... add all other variables
```

Or use CLI:

```bash
cat .env.production | vercel env add production
```

### 4. Deploy

```bash
# Production deployment
vercel --prod

# Or push to main branch (auto-deploys)
git push origin main
```

### 5. Configure Custom Domain

In Vercel dashboard:
1. Go to Settings → Domains
2. Add your domain
3. Configure DNS records as instructed

## Background Workers

Background workers process transcription, document generation, and embeddings.

### Option 1: Vercel Cron Jobs (Recommended)

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-jobs",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Create cron endpoint at `app/api/cron/process-jobs/route.ts`:

```typescript
import { processJobs } from '@/lib/workers/job-processor';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  await processJobs({ batchSize: 10 });
  return new Response('OK');
}
```

### Option 2: External Worker (Long-running)

Deploy worker to a separate service (Railway, Fly.io, etc.):

```bash
# Build worker
yarn build

# Run worker
yarn worker
```

**Dockerfile** for worker:

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --production
COPY . .

CMD ["yarn", "worker"]
```

## Monitoring & Alerts

### 1. Error Tracking (Sentry)

```bash
npm install @sentry/nextjs
```

Add to `.env.production`:

```bash
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

Initialize in `instrumentation.ts`:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}
```

### 2. Performance Monitoring

Built-in metrics are logged. To export to external services:

**DataDog**:
```bash
DATADOG_API_KEY=xxxxx
```

**New Relic**:
```bash
NEW_RELIC_LICENSE_KEY=xxxxx
```

### 3. Uptime Monitoring

Use services like:
- UptimeRobot
- Pingdom
- BetterUptime

Monitor these endpoints:
- `https://yourdomain.com/api/health` - Health check
- `https://yourdomain.com` - Landing page

### 4. Log Aggregation

Vercel automatically captures logs. For advanced needs:

**LogDrain to DataDog**:
1. Go to Vercel → Settings → Log Drains
2. Add DataDog integration
3. Configure API key

## Post-Deployment

### 1. Verify Deployment

```bash
# Health check
curl https://yourdomain.com/api/health

# Should return: { "status": "ok", "timestamp": "..." }
```

### 2. Test Critical Flows

- [ ] User sign-up/sign-in (Clerk)
- [ ] Recording upload (Supabase Storage)
- [ ] Transcription job (OpenAI Whisper)
- [ ] Vector search (pgvector)
- [ ] AI chat (RAG)
- [ ] Share links
- [ ] Rate limiting

### 3. Performance Checks

```bash
# Lighthouse CI
npx lighthouse https://yourdomain.com --view

# PageSpeed Insights
https://pagespeed.web.dev/analysis?url=https://yourdomain.com
```

Target metrics:
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s

### 4. Security Audit

- [ ] HTTPS enabled
- [ ] Security headers configured (check with securityheaders.com)
- [ ] Content Security Policy active
- [ ] Rate limiting working
- [ ] RLS policies enforced (Supabase)

### 5. Database Optimization

Run VACUUM and ANALYZE:

```sql
VACUUM ANALYZE recordings;
VACUUM ANALYZE transcript_chunks;
VACUUM ANALYZE jobs;
```

Set up automated maintenance in Supabase:

```sql
-- Auto-vacuum configuration
ALTER TABLE recordings SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
```

## Troubleshooting

### Issue: Build fails on Vercel

**Solution**: Check Next.js version compatibility and environment variables.

```bash
# Local build test
yarn build
```

### Issue: Database connection errors

**Solution**: Verify Supabase connection strings and RLS policies.

```bash
# Test connection
psql $SUPABASE_DB_URL -c "SELECT 1"
```

### Issue: OpenAI API errors

**Solution**: Check API key and rate limits.

```bash
# Verify API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Issue: Rate limiting not working

**Solution**: Verify Upstash Redis connection.

```bash
# Test Redis connection
curl $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"
```

### Issue: Background jobs not processing

**Solution**:
1. Check worker logs
2. Verify job processor is running
3. Check database for pending jobs

```sql
SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10;
```

### Issue: Slow vector search

**Solution**:
1. Ensure IVFFlat index exists
2. Increase `lists` parameter
3. Consider upgrading database

```sql
-- Rebuild index with more lists
DROP INDEX IF EXISTS idx_chunks_embedding_ivfflat;
CREATE INDEX idx_chunks_embedding_ivfflat
  ON transcript_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 200);
```

## Scaling Considerations

### Database

- **< 1k recordings**: Supabase Free tier
- **1k - 10k recordings**: Supabase Pro ($25/mo)
- **> 10k recordings**: Supabase Team or dedicated Postgres

### Storage

- **< 10 GB**: Supabase included storage
- **> 10 GB**: Upgrade storage or use external S3

### Workers

- **Low volume**: Vercel Cron (5 min intervals)
- **High volume**: Dedicated worker instances (Railway/Fly.io)
- **Enterprise**: Kubernetes with auto-scaling

### Rate Limiting

- **< 1M requests/mo**: Upstash Free tier
- **> 1M requests/mo**: Upstash Pro

## Backup Strategy

### 1. Database Backups

Supabase provides automatic daily backups. For critical data:

```bash
# Manual backup
pg_dump $SUPABASE_DB_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $SUPABASE_DB_URL < backup-20250101.sql
```

### 2. Storage Backups

Use Supabase CLI or rclone:

```bash
# Sync to S3
rclone sync supabase:recordings s3:backup-recordings
```

## Cost Estimation

**Monthly costs** (estimated):

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| Vercel | $0 (Hobby) | $20+ (Pro) |
| Supabase | $0 (500 MB, 1 GB storage) | $25+ (Pro) |
| Upstash Redis | $0 (10k commands/day) | $10+ |
| OpenAI API | Pay-as-go | ~$50-200 (varies) |
| Clerk | $0 (10k MAU) | $25+ |
| **Total** | **~$0** | **~$130-270** |

OpenAI costs depend on usage:
- Whisper: $0.006/min
- GPT-5 Nano: $0.05/1M input, $0.40/1M output
- text-embedding-3-small: $0.02/1M tokens

---

## Support

For deployment issues:
- Check [IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md) for feature status
- Review [QUICK_START.md](../QUICK_START.md) for local development
- File issues at: https://github.com/anthropics/claude-code/issues
