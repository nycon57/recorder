#!/usr/bin/env tsx
/**
 * Background Job Worker
 *
 * Continuously polls and processes jobs from the database.
 * Run this as a separate process in production.
 *
 * Usage:
 *   yarn worker          # Run with default settings
 *   yarn worker:once     # Process one batch and exit
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { processJobs, processJobById } from '@/lib/workers/job-processor';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

const args = process.argv.slice(2);
const command = args[0];

/**
 * Scheduled Jobs Configuration
 * Define recurring jobs with their intervals (in milliseconds)
 */
const SCHEDULED_JOBS = [
  {
    type: 'archive_search_metrics',
    interval: 60 * 60 * 1000, // 1 hour
    payload: { retentionDays: 90 },
    dedupe_key: 'archive_search_metrics:hourly',
  },
] as const;

/**
 * Creates a scheduled job if one doesn't already exist (pending or running)
 */
async function createScheduledJob(jobConfig: typeof SCHEDULED_JOBS[number]): Promise<boolean> {
  const supabase = createAdminClient();

  // Check if a job with this dedupe_key already exists and is pending/running
  const { data: existingJob } = await supabase
    .from('jobs')
    .select('id, status')
    .eq('dedupe_key', jobConfig.dedupe_key)
    .in('status', ['pending', 'running'])
    .single();

  if (existingJob) {
    return false; // Job already queued
  }

  // Create the job
  const { error } = await supabase
    .from('jobs')
    .insert({
      type: jobConfig.type,
      payload: jobConfig.payload,
      dedupe_key: jobConfig.dedupe_key,
      status: 'pending',
      priority: 3, // Low priority for maintenance jobs
    });

  if (error) {
    console.error(`[Scheduler] Failed to create ${jobConfig.type} job:`, error.message);
    return false;
  }

  console.log(`[Scheduler] Created scheduled job: ${jobConfig.type}`);
  return true;
}

/**
 * Scheduler that creates recurring jobs at their configured intervals
 */
async function startScheduler(): Promise<void> {
  console.log('[Scheduler] Starting job scheduler...');
  console.log(`[Scheduler] Configured jobs: ${SCHEDULED_JOBS.map(j => `${j.type} (every ${j.interval / 1000 / 60} min)`).join(', ')}`);

  // Create initial jobs immediately
  for (const jobConfig of SCHEDULED_JOBS) {
    await createScheduledJob(jobConfig);
  }

  // Set up intervals for each job type
  for (const jobConfig of SCHEDULED_JOBS) {
    setInterval(async () => {
      await createScheduledJob(jobConfig);
    }, jobConfig.interval);
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🤖 Record Background Job Worker');
  console.log('='.repeat(60));

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_AI_API_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  // Check for Google Cloud credentials (either file path or base64)
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CREDENTIALS_BASE64) {
    console.error('❌ Missing Google Cloud credentials');
    console.error('   Set either GOOGLE_APPLICATION_CREDENTIALS (file path)');
    console.error('   or GOOGLE_CREDENTIALS_BASE64 (base64 encoded JSON)');
    process.exit(1);
  }

  console.log('✅ Environment variables validated');
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('✅ Using Google Cloud credentials from file:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
  } else {
    console.log('✅ Using Google Cloud credentials from base64 environment variable');
  }
  console.log();

  if (command === 'once') {
    console.log('📋 Running in one-shot mode (process one batch and exit)\n');
    // Process one batch with a timeout
    const timeout = setTimeout(() => {
      console.log('\n⏱️  Timeout reached, exiting...');
      process.exit(0);
    }, 60000); // 60 second timeout

    try {
      await processJobs({
        batchSize: 10,
        pollInterval: 1000,
        maxRetries: 3,
      });
    } finally {
      clearTimeout(timeout);
    }
  } else if (command?.startsWith('job:')) {
    // Process a specific job by ID
    const jobId = command.split(':')[1];
    if (!jobId) {
      console.error('❌ Usage: yarn worker job:<job-id>');
      process.exit(1);
    }

    console.log(`📋 Processing job ${jobId}\n`);
    try {
      await processJobById(jobId);
      console.log('\n✅ Job processed successfully');
      process.exit(0);
    } catch (error) {
      console.error('\n❌ Job failed:', error);
      process.exit(1);
    }
  } else {
    console.log('📋 Running in continuous mode (Ctrl+C to stop)\n');

    // Handle graceful shutdown
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...`);
      console.log('⏳ Waiting for current jobs to complete...');

      // Give current jobs 10 seconds to complete
      setTimeout(() => {
        console.log('✅ Shutdown complete');
        process.exit(0);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start the scheduler for recurring jobs (runs in background)
    await startScheduler();

    // Start processing jobs (main loop)
    await processJobs({
      batchSize: 10,
      pollInterval: 2000,        // Poll every 2 seconds (reduced from 5s)
      maxPollInterval: 10000,    // Max backoff: 10 seconds (reduced from 60s)
      maxRetries: 3,
    });
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
