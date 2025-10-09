# Setup Guide

This guide will help you get the Record application running locally.

## Prerequisites

- Node.js 18+ and npm/yarn
- A Clerk account (free tier works)
- A Supabase project
- An OpenAI API key

## Step 1: Clone and Install

```bash
cd /path/to/recorder
yarn install
```

## Step 2: Configure Clerk Authentication

### 2.1 Create a Clerk Application

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com)
2. Create a new application or select an existing one
3. Copy your API keys

### 2.2 **IMPORTANT: Enable Organizations**

⚠️ **This app requires Organizations to be enabled in Clerk**

1. In your Clerk dashboard, navigate to **Organizations** in the sidebar
2. Click **Enable Organizations**
3. Configure organization settings as needed

### 2.3 Update Environment Variables

In `.env.local`, update:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_secret_here
NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED=true  # Set to true!
```

## Step 3: Configure Supabase

### 3.1 Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Copy your project URL and anon key

### 3.2 Run Database Migrations

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

### 3.3 Update Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

## Step 4: Configure OpenAI

Get an API key from [platform.openai.com](https://platform.openai.com/api-keys)

```bash
OPENAI_API_KEY=sk-your_key_here
WHISPER_API_KEY=sk-your_key_here  # Usually same as OPENAI_API_KEY
```

## Step 5: Start the Development Server

```bash
yarn dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Step 6: Test the Application

1. **Sign Up**: Click "Get Started" and create an account
2. **Create Organization**: After signing in, create your first organization
3. **Create Recording**: Navigate to `/record` and test the recording feature

## Common Issues

### "Organizations Not Enabled" Error

**Symptom**: Yellow warning box on dashboard

**Solution**:
1. Enable Organizations in Clerk dashboard
2. Set `NEXT_PUBLIC_CLERK_ORGANIZATIONS_ENABLED=true` in `.env.local`
3. Restart dev server

### "OrganizationSwitcher cannot be rendered" Error

**Symptom**: Error in console about OrganizationSwitcher

**Solution**: Same as above - enable Organizations in Clerk

### Database Connection Errors

**Symptom**: Supabase connection errors

**Solution**:
1. Check your Supabase project is active
2. Verify connection string in `.env.local`
3. Ensure migrations have been run

### Browser Recording Not Working

**Symptom**: Recording features don't work

**Solution**:
- Use Chrome/Chromium-based browsers only
- Recording requires `documentPictureInPicture` API support
- HTTPS or localhost required for camera/microphone access

## Optional: Background Job Worker

For transcription and AI processing, run the background worker:

```bash
# In a separate terminal
yarn worker
```

Or for development with auto-reload:

```bash
yarn worker:dev
```

## Next Steps

- Read [CLAUDE.md](./CLAUDE.md) for architecture overview
- Check [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) for feature status
- See [RUNNING_THE_SYSTEM.md](./RUNNING_THE_SYSTEM.md) for production deployment

## Support

For issues, check:
- [GitHub Issues](https://github.com/addyosmani/recorder/issues)
- [Clerk Documentation](https://clerk.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
