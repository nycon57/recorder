# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Record is a full-stack AI-powered knowledge management platform combining browser-based screen recording with automatic transcription, document generation, semantic search, and RAG-powered chat assistant.

**Tech Stack**: Next.js 15, React 19, TypeScript, Supabase (PostgreSQL + pgvector + Storage), Clerk (Auth + Organizations), OpenAI (Whisper, GPT-5 Nano, Embeddings), Stripe, Upstash Redis, Tailwind CSS + shadcn/ui + Material-UI

**Browser Requirement**: Chrome/Chromium only (requires `documentPictureInPicture`, `MediaStreamTrackProcessor`, `MediaStreamTrackGenerator` APIs)

## Development Commands

```bash
# Development
yarn dev                    # Start Next.js dev server (http://localhost:3000)
yarn worker:dev             # Start background worker in watch mode

# Build & Production
yarn build                  # Build for production
yarn start                  # Start production server
yarn worker                 # Run job processor (continuous mode)
yarn worker:once            # Process one batch and exit

# Testing
yarn test                   # Run Jest tests
yarn test:watch             # Run tests in watch mode
yarn test:coverage          # Run with coverage report

# Code Quality
yarn type:check             # TypeScript type checking
yarn lint                   # Lint JS/TS (Next.js ESLint)
yarn lint:fix               # Auto-fix lint issues
yarn lint:css               # Lint CSS (Stylelint)
yarn lint:css:fix           # Auto-fix CSS issues
yarn format:check           # Check Prettier formatting
yarn format:fix             # Auto-fix formatting
```

**Development Workflow**: Run `yarn dev` for the web app and `yarn worker:dev` for background jobs in separate terminals.

## Project Structure

```
app/
├── (dashboard)/           # Protected routes (requires auth)
│   ├── assistant/        # RAG-powered AI chat
│   ├── dashboard/        # Main dashboard
│   ├── record/           # Recording interface + video composition
│   ├── recordings/       # Recordings list
│   ├── search/           # Semantic search
│   └── settings/         # User/org settings
├── (marketing)/          # Public routes
│   ├── features/
│   ├── pricing/
│   └── about/
├── api/                  # API Routes
│   ├── billing/         # Stripe integration
│   ├── chat/            # AI assistant
│   ├── recordings/      # CRUD + finalize
│   ├── search/          # Vector search
│   └── share/           # Public sharing
├── components/          # Shared React components
│   ├── layout/         # Navbar, footer, sidebar
│   ├── recorder/       # Recording UI (PiP, controls)
│   └── ui/             # shadcn/ui components
└── s/[shareId]/        # Public shared content viewer

lib/
├── openai/             # OpenAI client
├── supabase/           # Supabase clients (client, server, admin)
├── workers/            # Background job system
│   ├── job-processor.ts  # Main loop
│   └── handlers/         # Job handlers
├── services/           # Business logic
├── types/              # TypeScript types
├── utils/              # Helpers (including api.ts)
└── validations/        # Zod schemas

supabase/
├── migrations/         # SQL migrations
└── storage/            # Storage config
```

## Key Architecture Patterns

### 1. Video Composition System

Located in `app/(dashboard)/record/services/composer.ts`

Uses browser APIs to composite multiple video streams:
- `MediaStreamTrackProcessor` reads video frames from camera/screen tracks
- `MediaStreamTrackGenerator` creates output track
- `OffscreenCanvas` composites screenshare (background) + camera overlay (bottom-right)
- Applies circular or square mask to camera using `ctx.clip()` and `ctx.roundRect()`
- Streams audio from microphone alongside composed video

**Critical**: Requires Chrome/Chromium. Firefox/Safari lack support for these APIs.

### 2. Background Job Processing

Located in `lib/workers/job-processor.ts`

Async job queue with retry logic for AI processing pipeline:

**Job Flow**:
1. Recording finalized → `transcribe` job (OpenAI Whisper)
2. Transcription complete → `doc_generate` job (GPT-5 Nano)
3. Document generated → `generate_embeddings` job (text-embedding-3-small)
4. Embeddings complete → Recording status: `completed`

**Implementation Details**:
- Polls `jobs` table for `status='pending'` with `run_after <= now()`
- Processes jobs in parallel batches (default 10)
- Exponential backoff for retries (max 3 attempts)
- Each job type has handler in `lib/workers/handlers/`
- Workers can run as separate process (`yarn worker`) or serverless cron

### 3. API Route Patterns

All API routes follow consistent structure using `lib/utils/api.ts` helpers:

```typescript
import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { parseBody } from '@/lib/utils/api';
import { mySchema } from '@/lib/validations/api';

export const POST = apiHandler(async (request: NextRequest) => {
  // Automatically handles errors and generates request IDs
  const { orgId, userId, role } = await requireOrg(); // or requireAuth()
  const body = await parseBody(request, mySchema); // Zod validation

  // ... implementation

  return successResponse(data);
});
```

**Key Functions**:
- `apiHandler()`: Wraps route with error handling and request ID generation
- `requireAuth()`: Returns `{ userId, orgId? }` from Clerk, throws if not authenticated
- `requireOrg()`: Requires org context, looks up Supabase `users` table for internal org UUID and role
- `parseBody()`: Validates request body against Zod schema
- `successResponse()` / `errors.*`: Standardized response helpers

### 4. Authentication & Multi-Tenancy

**Clerk Integration**:
- Handles sign-up, sign-in, session management
- Organizations feature for multi-tenancy
- User metadata synced to Supabase `users` table

**Dual Organization IDs**:
- `clerkOrgId` (string): Clerk's organization ID
- `orgId` (UUID): Internal Supabase organization ID from `users.org_id`
- `requireOrg()` returns both for reference

**Roles**: `owner`, `admin`, `contributor`, `reader` (stored in `users.role`)

**Route Protection** (`middleware.ts`):
- Public routes: `/`, `/features`, `/pricing`, `/about`, `/contact`, `/terms`, `/privacy`, `/sign-in`, `/sign-up`, `/api/webhooks`, `/api/health`, `/s/*`
- All other routes require authentication via Clerk

### 5. Database Schema (Supabase)

Key tables:
- `organizations`: Multi-tenant orgs (synced from Clerk)
- `users`: User accounts with `org_id` (UUID) and `role`
- `recordings`: Recording metadata with status (`uploading`, `transcribing`, `processing`, `completed`, `failed`)
- `transcripts`: Speech-to-text with word-level timestamps
- `documents`: AI-generated markdown docs
- `transcript_chunks`: Text chunks with pgvector embeddings for semantic search
- `jobs`: Background job queue with `status`, `type`, `attempt_count`, `run_after`
- `conversations` & `messages`: AI chat history
- `shares`: Public/password-protected sharing
- `usage_counters`: Per-org usage tracking

## Critical Configuration

### CORS Headers (next.config.js)

Required for FFMPEG.wasm (SharedArrayBuffer support):

```javascript
{
  key: 'Cross-Origin-Opener-Policy',
  value: 'same-origin',
},
{
  key: 'Cross-Origin-Embedder-Policy',
  value: 'require-corp',
}
```

**DO NOT REMOVE**: These headers are essential for video conversion (WEBM → MP4) to work.

### Import Path Aliases (tsconfig.json)

Only `@/*` is configured (maps to project root):

```typescript
import { Component } from '@/components/Component';
import { createClient } from '@/lib/supabase/client';
```

All other imports use relative or absolute paths.

## Code Style

**Import Order** (enforced by ESLint):
1. React & Next.js
2. External dependencies
3. Internal (`@/...`)
4. Relative imports
5. CSS (always last)

**Validation**: All API inputs validated with Zod schemas from `lib/validations/api.ts`

**Error Handling**: Use `apiHandler` wrapper for consistent error responses

## Testing

**Framework**: Jest with React Testing Library

**Coverage**: API routes, utilities, validation schemas, business logic services

**Run**:
```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:coverage     # Coverage report
```

## Deployment

**Web App**: Vercel
- Auto-deploy from `main` branch
- Environment variables: `CLERK_*`, `NEXT_PUBLIC_SUPABASE_*`, `OPENAI_API_KEY`, `STRIPE_*`, `UPSTASH_REDIS_*`

**Background Worker**: Requires long-running process
- Options: VPS/EC2 + PM2, Railway, Fly.io, or Vercel Cron
- Run `yarn worker` in production
- Needs same environment variables as web app

## Common Tasks

**Add API Endpoint**:
1. Create route file in `app/api/`
2. Use `apiHandler` wrapper
3. Add Zod schema to `lib/validations/api.ts`
4. Use `requireOrg()` for protected routes
5. Return with `successResponse()`

**Add Background Job**:
1. Define job type in `lib/types/jobs.ts`
2. Create handler in `lib/workers/handlers/`
3. Register handler in `lib/workers/job-processor.ts`
4. Enqueue via `supabase.from('jobs').insert({ type, payload, org_id })`

**Add UI Component**:
1. Use shadcn CLI: `npx shadcn@latest add <component>`
2. Or create in `app/components/`
3. Follow Tailwind + TypeScript patterns
