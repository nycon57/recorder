# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Status**: ✅ **PHASES 1-3 COMPLETE** - MVP with recording, transcription, and AI processing is fully functional

Record has evolved from a browser-based screen recorder into a comprehensive AI-powered knowledge management platform that combines:
- Browser-based recording (screen + camera + audio)
- Automatic transcription with OpenAI Whisper
- AI-powered document generation (Docify) with GPT-5 Nano
- Semantic search with pgvector embeddings
- RAG-based AI assistant for Q&A
- Multi-tenant collaboration features

### Architecture Evolution

**Previous (Vite)**: Client-side only, privacy-focused, no backend
**Current (Next.js)**: Full-stack SaaS with cloud storage, AI processing, and collaboration

### Tech Stack

**Frontend**:
- Next.js 14 with App Router
- React 18 + TypeScript
- Tailwind CSS + Material-UI
- MediaRecorder API + FFMPEG.wasm

**Backend**:
- Next.js API Routes (serverless)
- Supabase PostgreSQL (with pgvector extension)
- Supabase Storage (S3-compatible)
- Background job system

**Auth & Payments**:
- Clerk (authentication + organizations)
- Stripe (billing - planned)

**AI Services**:
- OpenAI Whisper (transcription)
- OpenAI GPT-5 Nano (document generation + chat)
- OpenAI text-embedding-3-small (embeddings for semantic search)

**Infrastructure**:
- Vercel (hosting + serverless functions)
- Upstash Redis (rate limiting - planned)
- Resend (email notifications - planned)

## Browser Requirements

Recording features require Chrome/Chromium browsers:
- `documentPictureInPicture` - for PiP recording interface
- `MediaStreamTrackProcessor` - for video frame processing
- `MediaStreamTrackGenerator` - for composited stream generation

Legacy browser checks in [src/main.tsx](src/main.tsx:23-26) (to be migrated).

## Development Commands

```bash
# Install dependencies
yarn install

# Start dev server (http://localhost:3000)
yarn dev

# Build for production
yarn build

# Start production server
yarn start

# Type checking
yarn type:check

# Linting
yarn lint           # Check JS/TS files (Next.js built-in)
yarn lint:fix       # Auto-fix JS/TS issues
yarn lint:css       # Check CSS files
yarn lint:css:fix   # Auto-fix CSS issues

# Formatting
yarn format:check   # Check Prettier formatting
yarn format:fix     # Auto-fix formatting
```

## Project Structure (Next.js)

```
.
├── app/                          # Next.js App Router
│   ├── api/                     # API Routes
│   │   ├── health/             # Health check
│   │   └── recordings/         # Recording endpoints
│   ├── layout.tsx              # Root layout (Clerk provider)
│   ├── page.tsx                # Landing page
│   └── globals.css             # Global styles
├── lib/                         # Shared libraries
│   ├── openai/                 # OpenAI client & config
│   ├── supabase/               # Supabase clients (client, server, admin)
│   ├── workers/                # Background job processors
│   │   ├── job-processor.ts   # Main job processing loop
│   │   └── handlers/          # Job type handlers (transcribe, docify, embeddings)
│   ├── services/               # Business logic services
│   │   └── chunking.ts        # Text chunking utilities
│   ├── types/                  # TypeScript type definitions
│   ├── utils/                  # Helper utilities
│   └── validations/            # Zod validation schemas
├── scripts/                     # CLI scripts
│   └── worker.ts               # Background job worker executable
├── src/                         # ⚠️ Legacy Vite components (integrated in Phase 2)
│   ├── components/             # React components (Material-UI)
│   ├── contexts/               # React Context providers
│   ├── hooks/                  # Custom React hooks
│   └── services/               # Business logic & utilities
├── supabase/                    # Database & storage
│   ├── migrations/             # SQL schema migrations
│   └── storage/                # Storage bucket configuration
├── middleware.ts                # Clerk authentication middleware
├── next.config.js              # Next.js configuration
└── tsconfig.json               # TypeScript configuration
```

### Database Schema

See [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) for complete schema.

Key tables:
- `organizations` - Multi-tenant organizations
- `users` - User accounts (synced from Clerk)
- `user_organizations` - Membership with roles (owner, admin, contributor, reader)
- `recordings` - Recording metadata with status tracking
- `transcripts` - Speech-to-text with word-level timestamps
- `documents` - AI-generated documentation (Docify)
- `transcript_chunks` - Text chunks with vector embeddings (pgvector)
- `jobs` - Background job queue with retry logic
- `events` - Event outbox pattern
- `notifications` - User notifications
- `shares` - Public/password-protected sharing
- `usage_counters` - Per-org usage tracking

### API Routes

**Implemented**:
- `GET /api/health` - Health check
- `GET /api/recordings` - List recordings (paginated, org-scoped)
- `POST /api/recordings` - Create recording + get signed upload URL
- `GET /api/recordings/[id]` - Get specific recording with signed video URL
- `PUT /api/recordings/[id]` - Update recording metadata
- `DELETE /api/recordings/[id]` - Delete recording + storage cleanup
- `POST /api/recordings/[id]/finalize` - Finalize upload, enqueue transcription
- `POST /api/webhooks` - External webhook handler with HMAC verification

**Planned** (see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)):
- Search endpoints (semantic search with pgvector)
- Chat/Assistant endpoints (RAG-powered Q&A)
- Document viewing/editing endpoints
- Organization management endpoints
- Sharing endpoints (public/password-protected)
- Stripe webhook handler

### Import Path Aliases

Configured in [tsconfig.json](tsconfig.json:25-32):

```typescript
import { Component } from '@/components/Component';      // Absolute from root
import { useHook } from 'hooks/useHook';                 // src/hooks/useHook
import { Context } from 'contexts/context';              // src/contexts/context
import service from 'services/service';                  // src/services/service
```

### Legacy Components (To Be Migrated)

Located in `/src` directory - original Vite app components:
- **App.tsx** - Main app shell with keyboard shortcuts
- **VideoStreams** - Camera/screen preview
- **PiPWindow** - Picture-in-Picture controls
- **RecordingModal** - Post-recording export (WEBM/MP4)
- **Teleprompter** - Scrolling teleprompter
- **LayoutSwitcher** - Recording mode selection
- **ShapeSelect** - Camera shape toggle

### Video Composition System (Legacy)

Core recording logic in [src/services/composer.ts](src/services/composer.ts):
1. Captures camera + microphone + screenshare MediaStreams
2. Uses `MediaStreamTrackProcessor` to read video frames
3. Uses `MediaStreamTrackGenerator` to create composited track
4. Draws screenshare to OffscreenCanvas, overlays camera
5. Returns combined MediaStream with synced audio

**Status**: ✅ Migrated and integrated in Phase 2.

### CORS Headers (Required for FFMPEG.wasm)

Configured in [next.config.js](next.config.js) for SharedArrayBuffer support:

```javascript
headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
]
```

## Authentication & Authorization

- **Authentication**: Clerk handles sign-up, sign-in, session management
- **Organizations**: Clerk Organizations feature for multi-tenancy
- **Roles**: owner, admin, contributor, reader (stored in `user_organizations`)
- **Middleware**: [middleware.ts](middleware.ts) protects routes
- **API Auth**: Use `requireAuth()` and `requireOrg()` from [lib/utils/api.ts](lib/utils/api.ts)

## Code Style

### Import Order

ESLint enforces import grouping:
1. React & Next.js imports
2. External dependencies
3. Internal aliases (@/, components/, hooks/, etc.)
4. Relative imports
5. CSS imports (always last)

### API Route Patterns

```typescript
import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';

export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  // ... implementation
  return successResponse(data);
});
```

### Validation with Zod

All API inputs validated with Zod schemas from [lib/validations/api.ts](lib/validations/api.ts):

```typescript
const body = await parseBody(request, createRecordingSchema);
```

## Background Job Processing

The application uses a background job system for async processing:

**Running the worker**:
```bash
yarn worker          # Continuous mode
yarn worker:once     # Process one batch and exit
yarn worker:dev      # Watch mode for development
```

**Job types**:
- `transcribe` - OpenAI Whisper transcription
- `doc_generate` - GPT-5 Nano document generation
- `generate_embeddings` - OpenAI text-embedding-3-small embeddings

**Job flow**:
1. Upload finalized → Creates `transcribe` job
2. Transcription completed → Creates `doc_generate` job
3. Document generated → Creates `generate_embeddings` job
4. Embeddings completed → Recording status: `completed`

See [PHASE3_SUMMARY.md](PHASE3_SUMMARY.md) for detailed async processing documentation.

## Deployment

**Web Application**: Vercel (Next.js optimized)
- Push to `main` branch triggers automatic deployment
- Preview deployments for PRs
- Environment variables configured in Vercel dashboard

**Background Worker**: Requires long-running process
- VPS/EC2 with PM2 or systemd
- Vercel Cron (serverless, runs every N minutes)
- Dedicated worker service (Railway, Fly.io)

See [RUNNING_THE_SYSTEM.md](RUNNING_THE_SYSTEM.md) for production deployment guide.

## Getting Started

- [RUNNING_THE_SYSTEM.md](RUNNING_THE_SYSTEM.md) - Complete guide to running the app
- [QUICK_START.md](QUICK_START.md) - Quick setup instructions
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - Progress and roadmap
- [PHASE3_SUMMARY.md](PHASE3_SUMMARY.md) - Phase 3 (async processing) details

## Important Notes

- ✅ Phases 1-3 complete - MVP is fully functional
- ✅ Recording, upload, transcription, doc generation, and embeddings all working
- ✅ Legacy Vite components successfully integrated in Phase 2
- 🚧 Phase 4 (vector search) ready to begin
- 📚 Comprehensive documentation in root and `/documentation` directory
