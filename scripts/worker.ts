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

import { processJobs, processJobById } from '@/lib/workers/job-processor';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  console.log('='.repeat(60));
  console.log('🤖 Record Background Job Worker');
  console.log('='.repeat(60));

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENAI_API_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.error(`❌ Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  console.log('✅ Environment variables validated\n');

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

    // Start processing
    await processJobs({
      batchSize: 10,
      pollInterval: 5000,
      maxRetries: 3,
    });
  }
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
