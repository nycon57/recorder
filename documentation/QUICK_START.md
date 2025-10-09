# Quick Start Guide

This guide will help you get the project running quickly.

## Prerequisites

- Node.js 18+ and Yarn
- A Supabase account (https://supabase.com)
- A Clerk account (https://clerk.com)
- An OpenAI API key (https://platform.openai.com)

## Step 1: Install Dependencies

```bash
yarn install
```

## Step 2: Set Up Supabase

1. Create a new project at https://supabase.com
2. Go to Project Settings > API to get your keys
3. Go to SQL Editor and run the migration:
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and execute in SQL Editor
4. Run storage configuration:
   - Copy contents of `supabase/storage/buckets.sql`
   - Paste and execute in SQL Editor

## Step 3: Set Up Clerk

1. Create an application at https://clerk.com
2. Enable Organizations:
   - Go to Configure > Organizations
   - Enable Organizations feature
   - Add roles: owner, admin, contributor, reader
3. Configure redirect URLs:
   - Add `http://localhost:3000` to allowed origins
4. Copy your API keys from Dashboard

## Step 4: Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in these required values:

```env
# Clerk (get from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase (get from https://supabase.com/dashboard/project/_/settings/api)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-...

# Optional for now (can be added later)
# STRIPE_SECRET_KEY=sk_test_...
# UPSTASH_REDIS_REST_URL=...
# RESEND_API_KEY=re_...
```

## Step 5: Run the Development Server

```bash
yarn dev
```

Open http://localhost:3000 in your browser.

## Step 6: Test the Setup

1. Click "Sign Up" to create an account
2. Create an organization when prompted
3. You should see the dashboard

## Troubleshooting

### Database Connection Issues

If you see database errors:
1. Verify your Supabase URL and keys in `.env.local`
2. Check that migrations ran successfully
3. Go to Supabase Dashboard > Database > Tables to verify tables exist

### Authentication Issues

If sign-in doesn't work:
1. Verify Clerk keys in `.env.local`
2. Check that `http://localhost:3000` is in Clerk's allowed origins
3. Make sure Organizations feature is enabled in Clerk

### API Errors

If API routes return 500 errors:
1. Check the terminal console for detailed error messages
2. Verify all environment variables are set
3. Check that database migrations completed successfully

## Next Steps

See [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for:
- Current progress
- Remaining tasks
- Detailed implementation plan

## Common Commands

```bash
# Development
yarn dev                # Start dev server
yarn build              # Build for production
yarn start              # Start production server

# Code Quality
yarn lint               # Check linting
yarn lint:fix           # Fix linting issues
yarn type:check         # Check TypeScript types
yarn format:check       # Check formatting
yarn format:fix         # Fix formatting
```

## Project Structure

```
.
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── health/       # Health check
│   │   └── recordings/   # Recording endpoints
│   ├── layout.tsx        # Root layout with Clerk
│   └── page.tsx          # Landing page
├── lib/                   # Shared utilities
│   ├── openai/           # OpenAI client
│   ├── supabase/         # Supabase clients
│   ├── types/            # TypeScript types
│   ├── utils/            # Helper utilities
│   └── validations/      # Zod schemas
├── src/                   # Legacy components (to be migrated)
├── supabase/
│   ├── migrations/       # Database schema
│   └── storage/          # Storage configuration
├── middleware.ts         # Clerk authentication
└── next.config.js        # Next.js configuration
```

## API Endpoints

Currently implemented:

- `GET /api/health` - Health check
- `GET /api/recordings` - List recordings
- `POST /api/recordings` - Create recording and get upload URL
- `GET /api/recordings/[id]` - Get specific recording
- `PUT /api/recordings/[id]` - Update recording
- `DELETE /api/recordings/[id]` - Delete recording
- `POST /api/recordings/[id]/finalize` - Finalize upload

## What's Next?

The foundation is in place! Next steps:

1. **Migrate Recording Components**: Port the existing React recording components from `/src` to Next.js client components in `/app`
2. **Implement Upload**: Build the chunked upload system with progress tracking
3. **Background Jobs**: Create the worker process for transcription
4. **Transcription**: Integrate OpenAI Whisper or AssemblyAI
5. **Document Generation**: Implement AI-powered doc generation with GPT-5 Nano

See the full roadmap in [documentation/master-implementation.md](./documentation/master-implementation.md).

## Getting Help

- Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for progress
- Review [CLAUDE.md](./CLAUDE.md) for project overview
- See [documentation/](./documentation/) for detailed architecture

## Important Notes

- This is a work in progress migration from Vite to Next.js
- Original recording features are preserved but not yet integrated
- Database schema is complete but needs to be populated via API
- Authentication is set up but UI migration is pending
- All backend infrastructure is ready for development

Happy coding! 🚀
