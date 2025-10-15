#!/usr/bin/env tsx
/**
 * Create Test Job
 *
 * This script creates a test job in the database to see if the worker picks it up
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestJob() {
  console.log('='.repeat(60));
  console.log('🧪 Create Test Job');
  console.log('='.repeat(60));
  console.log();

  // First, let's find a recording to use
  const { data: recording, error: recError } = await supabase
    .from('recordings')
    .select('id, org_id, title, storage_path_raw')
    .eq('id', '80e70735-9b25-4c8a-8345-c7d41545ccc7')
    .single();

  if (recError || !recording) {
    console.error('❌ Could not find recording:', recError);
    return;
  }

  console.log('📹 Found recording:');
  console.log(`   - ID: ${recording.id}`);
  console.log(`   - Title: ${recording.title}`);
  console.log(`   - Org ID: ${recording.org_id}`);
  console.log(`   - Storage Path: ${recording.storage_path_raw}`);
  console.log();

  // Create a test transcribe job
  const testJob = {
    type: 'transcribe',
    status: 'pending',
    payload: {
      recordingId: recording.id,
      orgId: recording.org_id,
      storagePath: recording.storage_path_raw,
    },
    attempts: 0,
    max_attempts: 3,
  };

  console.log('📝 Creating test job:');
  console.log(`   - Type: ${testJob.type}`);
  console.log(`   - Payload:`, JSON.stringify(testJob.payload, null, 2));
  console.log();

  const { data: createdJob, error: jobError } = await supabase
    .from('jobs')
    .insert(testJob)
    .select()
    .single();

  if (jobError) {
    console.error('❌ Failed to create job:', jobError);
    return;
  }

  console.log('✅ Job created successfully!');
  console.log(`   - Job ID: ${createdJob.id}`);
  console.log(`   - Created At: ${createdJob.created_at}`);
  console.log();
  console.log('📊 Now check if the worker picks it up...');
  console.log();

  // Monitor the job for 30 seconds
  console.log('⏳ Monitoring job status for 30 seconds...');
  console.log('-'.repeat(60));

  let lastStatus = createdJob.status;
  let lastProgress = null;

  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: job, error } = await supabase
      .from('jobs')
      .select('status, progress_percent, progress_message, started_at, completed_at, error')
      .eq('id', createdJob.id)
      .single();

    if (error) {
      console.error('Error checking job:', error);
      break;
    }

    if (job.status !== lastStatus || job.progress_percent !== lastProgress) {
      console.log(`\n⏰ [${i + 1}s] Status Change Detected:`);
      console.log(`   - Status: ${lastStatus} → ${job.status}`);

      if (job.progress_percent !== null) {
        console.log(`   - Progress: ${job.progress_percent}%`);
      }

      if (job.progress_message) {
        console.log(`   - Message: ${job.progress_message}`);
      }

      if (job.started_at && lastStatus === 'pending') {
        console.log(`   - Started At: ${job.started_at}`);
      }

      if (job.completed_at) {
        console.log(`   - Completed At: ${job.completed_at}`);
      }

      if (job.error) {
        console.log(`   - Error: ${job.error}`);
      }

      lastStatus = job.status;
      lastProgress = job.progress_percent;
    } else {
      process.stdout.write('.');
    }

    if (job.status === 'completed' || job.status === 'failed') {
      console.log('\n' + '-'.repeat(60));
      console.log(`\n🏁 Job finished with status: ${job.status}`);
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete!');
}

createTestJob().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});