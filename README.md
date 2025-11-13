# Record - AI-Powered Knowledge Management Platform

An AI-powered knowledge management platform that enables browser-based screen/camera recording with automatic transcription, document generation, semantic search, and RAG-powered chat assistance.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Node.js worker process
- **Database:** PostgreSQL with pgvector (Supabase)
- **Storage:** Cloudflare R2
- **Auth:** Clerk (with Organizations)
- **AI/ML:** OpenAI (GPT, Whisper, embeddings)

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables (see .env.example)
cp .env.example .env.local

# Start development server
npm run dev

# Start background worker (required for processing)
npm run worker
```

## Environment Variables

Create a `.env.local` file with:

```bash
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenAI
OPENAI_API_KEY=

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
```

## Key Features

- 🎥 Browser-based screen/camera recording
- 🎤 Automatic transcription (Whisper API)
- 📄 AI-generated documentation
- 🔍 Semantic search with vector embeddings
- 💬 RAG-powered chat assistant
- 🔄 Background job processing
- 🏢 Multi-tenant organization support
- 🔐 Role-based access control

## Development

```bash
# Type checking
npm run type:check

# Linting
npm run lint

# Testing
npm test

# Build for production
npm run build
```

## License

Proprietary - All rights reserved

## Support

For issues and support, please contact the development team.
