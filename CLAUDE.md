# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Record** is an AI-powered knowledge management platform that enables browser-based screen/camera recording with automatic transcription, document generation, semantic search, and RAG-powered chat assistance. The system transforms tacit knowledge captured in recordings into structured, searchable documentation.

**Tech Stack:**
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (serverless), Node.js worker process
- **Database:** PostgreSQL with pgvector (Supabase) - Project ID: `clpatptmumyasbypvmun`
- **Storage:** Cloudflare R2 (S3-compatible)
- **Auth:** Clerk (Organizations enabled for multi-tenant)
- **AI/ML:** OpenAI (GPT, Whisper, embeddings), Google AI (Gemini)
- **Deployment:** Vercel (web), Railway (worker process)
- **Cache/Rate Limiting:** Upstash Redis

---

## Working with Claude Code

### Use MCP Servers for Database Operations

**IMPORTANT:** Always use the Supabase MCP server for database operations:
- Reading database schema and tables: `mcp__supabase__list_tables`
- Executing SQL queries: `mcp__supabase__execute_sql`
- Applying migrations: `mcp__supabase__apply_migration`
- Checking project status: `mcp__supabase__get_project`

**Supabase Project ID:** `clpatptmumyasbypvmun`

Never directly edit SQL files or write database queries without using the MCP server.

### Use Sub-Agents for Complex Tasks

**IMPORTANT:** Always delegate complex tasks to specialized sub-agents:

- **Code exploration:** Use `Task` tool with `subagent_type: "Explore"` for codebase navigation
- **API development:** Use `api-architect` agent for API routes and endpoints
- **UI components:** Use `tailwind-ui-architect` agent for Tailwind/ShadCN components
- **Database operations:** Use `supabase-specialist` agent for schema, RLS, migrations
- **Testing:** Use `test-engineer` agent for test creation and debugging
- **Security:** Use agents from `security-pro` plugin for security audits

Sub-agents have larger context windows and specialized knowledge for their domains.

### Use Plugins and MCP Servers

Available tools for specialized tasks:
- **Railway MCP:** Deployment and environment management
- **shadcn MCP:** Component library integration
- **Chrome DevTools MCP:** Browser testing and debugging

---

## Essential Commands

### Development
```bash
# Install dependencies
npm install

# Start Next.js dev server (http://localhost:3000)
npm run dev

# Start background job worker (separate terminal - REQUIRED for processing)
npm run worker

# Worker in watch mode (auto-restart on changes)
npm run worker:dev

# Process one batch of jobs and exit
npm run worker:once

# Process specific job by ID
npm run worker job:<job-id>
```

### Building & Testing
```bash
# Build for production
npm run build

# Type checking (1,249+ known errors - build uses ignoreBuildErrors: true)
npm run type:check

# Linting
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
npm run lint:check    # CI-friendly check

# Formatting
npm run format        # Check formatting
npm run format:fix    # Auto-fix formatting
npm run format:check  # CI-friendly check

# CSS Linting
npm run lint:css
npm run lint:css:fix
npm run lint:css:check

# Testing
npm test              # Run Jest unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
npm run test:e2e          # Playwright E2E tests
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:debug    # Debug E2E tests
```

---

## Architecture

### High-Level Flow
```
Browser Recording → Upload (Chunks) → Finalize → Transcribe → Docify → Chunk/Embed → Vector Index
                                                     ↓
                                            Background Worker (polls jobs table)
                                                     ↓
                                     Semantic Search ← RAG Assistant (with citations)
```

### Key Components

**1. Web Application (`app/` - Next.js App Router)**
- Server Components by default; Client Components marked with `'use client'`
- API routes in `app/api/*/route.ts` (thin orchestration layer)
- Authentication via Clerk; org-scoped authorization on all operations

**2. Background Worker (`scripts/worker.ts` + `lib/workers/`)**
- Separate Node process that polls `jobs` table
- Handlers: transcribe, docify, generate_embeddings, extract_audio, etc.
- Idempotent job processing with retry logic
- **CRITICAL:** Must run alongside web server for any processing to occur

**3. Database (Postgres + pgvector - Supabase)**
- **Project ID:** `clpatptmumyasbypvmun`
- Multi-tenant with org-level isolation
- Core tables: `recordings`, `transcripts`, `documents`, `transcript_chunks`, `jobs`
- Vector embeddings stored in `transcript_chunks.embedding vector(1536)`
- RLS policies enforce org boundaries (service role bypasses RLS)
- **Always use Supabase MCP server for database operations**

**4. Storage (Cloudflare R2)**
- Lazy initialization pattern (see `lib/storage/` files)
- Resumable uploads for large recordings
- Bucket structure: `org_{org_id}/recordings/{recording_id}/`

**5. Rate Limiting (Upstash Redis)**
- Lazy initialization in API routes
- Sliding window algorithm for API endpoints

---

## Critical Patterns

### 1. Lazy Service Initialization

**Problem:** Railway builds fail when services initialize at import time (missing env vars during build).

**Solution:** Initialize services lazily on first use:

```typescript
// ❌ BAD - Initializes at import time
export const r2Client = new S3Client({ /* config */ });

// ✅ GOOD - Lazy initialization
let r2Client: S3Client | null = null;

export function getR2Client() {
  if (!r2Client) {
    r2Client = new S3Client({ /* config */ });
  }
  return r2Client;
}
```

**Applies to:** R2 client, Redis client, OpenAI client, any service requiring env vars.

### 2. Dynamic Rendering for Auth

**Problem:** Next.js 15 tries to statically generate pages at build time. Pages using Clerk (ClerkProvider, SignedIn, SignedOut) fail with "Missing publishableKey" when env vars aren't available at build time.

**Solution:** Add `export const dynamic = 'force-dynamic'` to layouts/pages using Clerk:

```typescript
// In app/layout.tsx, app/(dashboard)/layout.tsx, app/(marketing)/layout.tsx
export const dynamic = 'force-dynamic';
```

This forces runtime rendering and prevents static generation that requires Clerk env vars.

### 3. Import Boundaries

**Critical:** Never import server-only code into Client Components:
- `@/lib/supabase/admin` (service role)
- `@/lib/workers/*`
- Database query functions
- Server-side utilities

Client Components must fetch data via API routes or Server Actions.

### 4. Org-Scoped Authorization

Every API route and Server Action must:
1. Verify user authentication (Clerk)
2. Extract `orgId` from session
3. Scope all DB queries by `org_id`

```typescript
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response('Unauthorized', { status: 401 });
  }

  // All queries MUST filter by orgId
  const { data } = await supabase
    .from('recordings')
    .select('*')
    .eq('org_id', orgId); // REQUIRED
}
```

### 5. Job Processing Flow

**Enqueuing jobs:**
```typescript
import { createJob } from '@/lib/workers/job-processor';

await createJob({
  type: 'transcribe',
  recording_id: recordingId,
  org_id: orgId,
  // Prevents duplicate jobs
  dedupe_key: `transcribe:${recordingId}`,
});
```

**Job Types:**
- `transcribe` → Extract audio and call Whisper API
- `doc_generate` → Generate markdown doc with LLM
- `generate_embeddings` → Chunk text and create vector embeddings
- `extract_audio` → Extract audio from video
- `sync_connector` → Sync external integrations (Google Drive, Notion, etc.)

**Job States:** `pending` → `running` → `completed` / `failed`

---

## Project Structure

### Core Directories

```
app/
  (auth)/              # Sign-in/sign-up pages (Clerk)
  (marketing)/         # Public marketing pages
  (dashboard)/         # Authenticated app pages
  api/                 # API route handlers
    recordings/        # Recording CRUD + finalize
    chat/              # RAG assistant endpoints
    library/           # Library/content management
    organizations/     # Org settings, members, departments
    webhooks/          # External service webhooks
  components/
    ui/                # shadcn/ui components
    layout/            # App shell (nav, sidebar)
    recorder/          # Recording UI components
    sections/          # Feature-specific components

lib/
  supabase/           # Supabase client (admin + browser)
  workers/            # Background job handlers
    handlers/         # Individual job type handlers
  services/           # Business logic (RAG, search, etc.)
  connectors/         # External integrations (Drive, Notion, etc.)
  utils/              # Shared utilities
  validations/        # Zod schemas for API validation

scripts/
  worker.ts           # Background worker entry point
  setup-database.md   # DB setup instructions

documentation/        # Extensive project docs (architecture, security, etc.)
```

### Path Aliases

```typescript
// Use @/ prefix for all imports
import { Button } from '@/app/components/ui/button';
import { createJob } from '@/lib/workers/job-processor';
```

---

## Database Schema

**Project ID:** `clpatptmumyasbypvmun`

### Core Tables

**recordings**
- `id` (PK), `org_id` (FK), `user_id` (FK), `title`, `status`
- Status flow: `pending` → `transcribing` → `transcribed` → `processing` → `completed`
- Storage paths: `raw_video_path`, `processed_video_path`

**transcripts**
- `id` (PK), `recording_id` (FK), `text`, `language`, `duration_seconds`
- Full transcript from Whisper API

**documents**
- `id` (PK), `recording_id` (FK), `content`, `format` (markdown/html)
- AI-generated structured documentation

**transcript_chunks**
- `id` (PK), `recording_id` (FK), `org_id`, `text`, `embedding vector(1536)`
- Chunked content with embeddings for semantic search
- HNSW/IVF vector index for similarity queries

**jobs**
- `id` (PK), `type`, `status`, `payload`, `dedupe_key`, `attempt_count`
- Worker polls this table for pending jobs
- Max 3 retries with exponential backoff

**To inspect schema:** Use `mcp__supabase__list_tables` with project_id: `clpatptmumyasbypvmun`

---

## Common Development Tasks

### Adding a New API Route

**Best Practice:** Use the `api-architect` sub-agent for API development.

1. Create route handler: `app/api/[resource]/route.ts`
2. Validate auth and extract orgId:
   ```typescript
   import { auth } from '@clerk/nextjs/server';
   const { userId, orgId } = await auth();
   if (!userId || !orgId) return new Response('Unauthorized', { status: 401 });
   ```
3. Validate request body with Zod (see `lib/validations/`)
4. Scope all queries by `org_id`
5. Return JSON with error handling

### Adding a New Job Type

**Best Practice:** Delegate to appropriate sub-agent based on complexity.

1. Create handler: `lib/workers/handlers/my-job.ts`
2. Implement `handleMyJob(payload)` function
3. Register in `lib/workers/job-processor.ts` handler map
4. Create job with `createJob({ type: 'my_job', ... })`

### Working with Database

**REQUIRED:** Always use Supabase MCP server for database operations:

```
# List all tables
mcp__supabase__list_tables(project_id: "clpatptmumyasbypvmun")

# Execute SQL query
mcp__supabase__execute_sql(
  project_id: "clpatptmumyasbypvmun",
  query: "SELECT * FROM recordings WHERE org_id = '...' LIMIT 10"
)

# Apply migration
mcp__supabase__apply_migration(
  project_id: "clpatptmumyasbypvmun",
  name: "add_new_column",
  query: "ALTER TABLE recordings ADD COLUMN new_field TEXT"
)
```

**Best Practice:** For complex schema changes, use the `supabase-specialist` sub-agent.

### Adding UI Components

**Best Practice:** Use the `tailwind-ui-architect` sub-agent for all UI component work.

1. Use shadcn MCP server to search for components: `mcp__shadcn__search_items_in_registries`
2. Add component: `mcp__shadcn__get_add_command_for_items`
3. Customize styling with Tailwind
4. Ensure accessibility (ARIA labels, keyboard navigation)

### Adding a Connector (External Integration)

**Best Practice:** Review existing connectors in `lib/connectors/` before creating new ones.

1. Extend `lib/connectors/base.ts` abstract class
2. Implement sync logic in new file: `lib/connectors/my-service.ts`
3. Register in `lib/connectors/registry.ts`
4. Add OAuth flow in `app/api/integrations/[connector]/`

### Working with RAG System

**Search Implementation:**
```typescript
import { performSemanticSearch } from '@/lib/services/vector-search';

const results = await performSemanticSearch({
  query: 'user question',
  orgId,
  limit: 10,
  filters: { recording_id: 'optional' },
});
```

**Chat/RAG:**
```typescript
import { executeRAGQuery } from '@/lib/services/rag';

const answer = await executeRAGQuery({
  query: 'user question',
  orgId,
  conversationHistory: [],
});
// Returns answer with citations
```

---

## Environment Variables

### Required for Development

```bash
# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (Project ID: clpatptmumyasbypvmun)
NEXT_PUBLIC_SUPABASE_URL=https://clpatptmumyasbypvmun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# OpenAI
OPENAI_API_KEY=sk-...

# Google AI (Gemini)
GOOGLE_AI_API_KEY=...
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
# OR
GOOGLE_CREDENTIALS_BASE64=base64_encoded_json

# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://...

# Upstash Redis (optional for dev)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### Railway Deployment Notes

Railway builds can fail if services initialize at module import time. Always use lazy initialization for:
- R2 client
- Redis client
- OpenAI client
- Any service requiring env vars

See recent commits (`60eb032`, `4723dd4`) for examples.

---

## Testing

### Unit Tests (`__tests__/`)
- Jest + React Testing Library
- Mock Supabase client in tests
- Run with `npm test`

### E2E Tests (`__tests__/e2e/`)
- Playwright for end-to-end flows
- Test recording, upload, processing pipeline
- Run with `npm run test:e2e`

### Manual Testing
- Always test with worker running: `npm run worker` in separate terminal
- Check job processing in Supabase dashboard (jobs table)
- Monitor worker logs for processing status

---

## Known Issues & Workarounds

### TypeScript Build Errors (1,249+ errors)

Build currently uses `ignoreBuildErrors: true` in `next.config.js`. Priority fix order:
1. Next.js 15 async params migration (~50 errors)
2. Test suite type safety (~100 errors)
3. Worker handler coverage (~20 errors)
4. Type mismatches in business logic (~200 errors)

Use `npm run type:check` to verify progress toward re-enabling strict checks.

### Railway Build Failures

If Railway build fails with missing env vars:
1. Check for eager initialization of services
2. Refactor to lazy initialization pattern
3. Add `export const dynamic = 'force-dynamic'` to pages using Clerk

### Worker Not Processing Jobs

Common causes:
1. Worker process not running (`npm run worker`)
2. Missing env vars (check `scripts/worker.ts` validation)
3. Database connection issues
4. Jobs stuck in `running` state (manually reset to `pending` using Supabase MCP)

**To debug:** Use `mcp__supabase__execute_sql` to check jobs table:
```sql
SELECT * FROM jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;
```

---

## Performance Considerations

### Vector Search Optimization
- Use `pg_vector` HNSW index for fast similarity search
- Limit results appropriately (default 10-20)
- Consider hierarchical search for large result sets

### Caching Strategy
- Edge cache for static content (Vercel)
- Redis cache for API responses (Upstash)
- Multi-layer cache in `lib/services/cache/`

### Upload Optimization
- Chunked uploads (10MB parts) for large recordings
- Resumable upload support via upload session IDs
- Client-side compression before upload

---

## Security Notes

### Critical Headers
- COOP/COEP headers required for `/record` route (FFmpeg.wasm)
- CSP includes Clerk and Supabase domains
- See `next.config.js` for full header configuration

### RBAC
- All operations scoped by `org_id`
- Role-based access via Clerk roles (owner, admin, member)
- Server-side validation in every API route
- RLS policies in Supabase as defense-in-depth

### Secrets Management
- Never commit API keys or credentials
- Use `.env.local` for local development
- Railway/Vercel for production env vars
- Service role key only in server-side code

---

## External Service Integration

### Connectors System
Located in `lib/connectors/`:
- Google Drive (OAuth + file sync)
- Microsoft Teams (meetings import)
- Notion (page sync)
- Zoom (recording import)
- File upload (local files)
- URL import (web content)

Each connector extends `BaseConnector` class and registers in `registry.ts`.

### Webhook Handling
- Validate HMAC signatures for external webhooks
- Idempotency via `dedupe_key` to prevent duplicate processing
- Process webhooks asynchronously via job queue

---

## Deployment

### Vercel (Web Application)
- Automatic deployment on `git push`
- Set all env vars in Vercel dashboard
- Preview deployments for PRs

### Railway (Background Worker)
- Deploy `scripts/worker.ts` as separate service
- Configure env vars (same as Vercel + credentials)
- Ensure lazy initialization for all services
- Set up health check endpoint if needed
- **Use Railway MCP server** for deployment operations

---

## Additional Resources

Key documentation files in `documentation/`:
- `architecture-overview.md` - System architecture
- `tech-stack.md` - Technology decisions
- `database-schema.md` - Full schema details
- `RUNNING_THE_SYSTEM.md` - Setup and operation guide
- `repository-structure.md` - Detailed file organization
- `MASTER_ROADMAP.md` - Feature roadmap

See `lib/connectors/README.md` for connector system details.
See `lib/services/CHAT_TOOLS_README.md` for RAG assistant documentation.

---

## Development Workflow

1. **Start services:** `npm run dev` (web) + `npm run worker` (jobs) in separate terminals
2. **Make changes:** Edit files (hot reload for web, restart worker manually)
3. **Test locally:** Create recording → verify processing in worker logs
4. **Check database:** Use Supabase MCP server to verify job/recording status
5. **Commit changes:** Follow conventional commits (`feat:`, `fix:`, etc.)
6. **Deploy:** Push to `main` for automatic deployment

**Key principle:** Always run the worker alongside the web server. Without it, recordings will upload but never process.

---

## Claude Code Best Practices

### Always Use Sub-Agents

For complex tasks, delegate to specialized agents:
- **Codebase exploration:** `Task` with `subagent_type: "Explore"`
- **API development:** `api-architect`
- **UI work:** `tailwind-ui-architect`
- **Database:** `supabase-specialist`
- **Testing:** `test-engineer`
- **Security:** `security-pro` agents

### Always Use MCP Servers

- **Database operations:** Supabase MCP (project: `clpatptmumyasbypvmun`)
- **UI components:** shadcn MCP
- **Deployments:** Railway MCP
- **Browser testing:** Chrome DevTools MCP

### Maximize Context Windows

Sub-agents and MCP servers have larger context windows than direct tool calls. Use them to:
- Read multiple large files
- Understand complex systems
- Execute multi-step operations
- Access specialized knowledge domains
