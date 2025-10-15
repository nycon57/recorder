#!/usr/bin/env tsx

/**
 * Fix Script for Stuck Recording Processing
 *
 * This script manually creates the transcribe job for a recording that was
 * uploaded but never had its processing pipeline initiated.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const RECORDING_ID = '80e70735-9b25-4c8a-8345-c7d41545ccc7';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function fixStuckRecording(recordingId: string) {
  console.log('='.repeat(80));
  console.log('FIX STUCK RECORDING - CREATE TRANSCRIBE JOB');
  console.log('='.repeat(80));
  console.log(`Recording ID: ${recordingId}\n`);

  // 1. Fetch Recording
  console.log('1. Fetching recording metadata...');
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (recordingError || !recording) {
    console.error('❌ Error fetching recording:', recordingError?.message || 'Not found');
    process.exit(1);
  }

  console.log(`   ✅ Recording found: "${recording.title}"`);
  console.log(`   Status: ${recording.status}`);
  console.log(`   Org ID: ${recording.org_id}`);
  console.log(`   Storage Path: ${recording.storage_path_raw}\n`);

  if (!recording.storage_path_raw) {
    console.error('❌ Recording has no storage_path_raw - cannot create transcribe job');
    process.exit(1);
  }

  // 2. Check for existing jobs
  console.log('2. Checking for existing jobs...');
  const { data: allJobs } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  const existingJobs = allJobs?.filter((job: any) => {
    const payload = job.payload as any;
    return payload?.recordingId === recordingId || payload?.recording_id === recordingId;
  }) || [];

  if (existingJobs.length > 0) {
    console.log(`   ⚠️  Found ${existingJobs.length} existing job(s):`);
    existingJobs.forEach((job: any) => {
      console.log(`      - ${job.type} (${job.status}) - Created: ${job.created_at}`);
    });

    const transcribeJob = existingJobs.find((j: any) => j.type === 'transcribe');
    if (transcribeJob) {
      console.log(`\n   ⚠️  Transcribe job already exists (ID: ${transcribeJob.id})`);
      console.log(`   Status: ${transcribeJob.status}`);
      console.log(`   Run At: ${transcribeJob.run_at}`);
      console.log(`   Attempts: ${transcribeJob.attempts}`);

      if (transcribeJob.error) {
        console.log(`   Error: ${transcribeJob.error}`);
      }

      const proceed = process.argv.includes('--force');
      if (!proceed) {
        console.log('\n   To reset and recreate the job, run with --force flag');
        process.exit(0);
      } else {
        console.log('\n   --force flag detected, will delete existing job and recreate...');
        const { error: deleteError } = await supabase
          .from('jobs')
          .delete()
          .eq('id', transcribeJob.id);

        if (deleteError) {
          console.error('   ❌ Error deleting job:', deleteError.message);
          process.exit(1);
        }
        console.log('   ✅ Deleted existing job\n');
      }
    }
  } else {
    console.log('   ✅ No existing jobs found\n');
  }

  // 3. Create transcribe job
  console.log('3. Creating transcribe job...');
  const { data: newJob, error: jobError } = await supabase
    .from('jobs')
    .insert({
      type: 'transcribe',
      status: 'pending',
      payload: {
        recordingId: recordingId,
        orgId: recording.org_id,
        storagePath: recording.storage_path_raw,
      },
      dedupe_key: `transcribe:${recordingId}`,
      run_at: new Date().toISOString(),
      attempts: 0,
      max_attempts: 3,
    })
    .select()
    .single();

  if (jobError) {
    console.error('❌ Error creating job:', jobError.message);

    // Check if it's a duplicate key error
    if (jobError.message.includes('dedupe_key')) {
      console.log('\n⚠️  Job with this dedupe_key already exists.');
      console.log('This usually means the transcribe job was created but not found in the search.');
      console.log('Try running the diagnostic script again to verify.');
    }

    process.exit(1);
  }

  console.log('   ✅ Transcribe job created successfully!');
  console.log(`   Job ID: ${newJob.id}`);
  console.log(`   Status: ${newJob.status}`);
  console.log(`   Run At: ${newJob.run_at}\n`);

  // 4. Update recording status if needed
  if (recording.status !== 'uploaded') {
    console.log('4. Updating recording status to "uploaded"...');
    const { error: updateError } = await supabase
      .from('recordings')
      .update({
        status: 'uploaded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error('   ⚠️  Error updating recording status:', updateError.message);
    } else {
      console.log('   ✅ Recording status updated\n');
    }
  }

  console.log('='.repeat(80));
  console.log('✅ FIX COMPLETE');
  console.log('='.repeat(80));
  console.log('\n📋 Next Steps:');
  console.log('1. Ensure background worker is running:');
  console.log('   Development: yarn worker:dev');
  console.log('   Production: yarn worker');
  console.log('\n2. Monitor job progress using the diagnostic script:');
  console.log('   npx tsx scripts/diagnose-processing.ts');
  console.log('\n3. Check worker logs for any errors during processing');
  console.log();
}

async function main() {
  try {
    // Verify environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }

    await fixStuckRecording(RECORDING_ID);

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run the fix
main();
