#!/usr/bin/env tsx
/**
 * Check Jobs in Database
 *
 * This script checks for pending jobs in the database to diagnose why the worker
 * might not be processing them.
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

async function checkJobs() {
  console.log('='.repeat(60));
  console.log('📊 Database Jobs Check');
  console.log('='.repeat(60));
  console.log();

  // Check pending jobs
  const { data: pendingJobs, error: pendingError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(10);

  if (pendingError) {
    console.error('❌ Error fetching pending jobs:', pendingError);
    return;
  }

  console.log(`📋 Pending Jobs: ${pendingJobs?.length || 0}`);
  if (pendingJobs && pendingJobs.length > 0) {
    pendingJobs.forEach((job, index) => {
      console.log(`\n   Job ${index + 1}:`);
      console.log(`   - ID: ${job.id}`);
      console.log(`   - Type: ${job.type}`);
      console.log(`   - Created: ${job.created_at}`);
      console.log(`   - Run At: ${job.run_at}`);
      console.log(`   - Attempts: ${job.attempts}`);
      console.log(`   - Payload: ${JSON.stringify(job.payload)}`);
      if (job.error) {
        console.log(`   - Last Error: ${job.error}`);
      }
    });
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // Check processing jobs
  const { data: processingJobs, error: processingError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'processing')
    .order('started_at', { ascending: false })
    .limit(10);

  if (processingError) {
    console.error('❌ Error fetching processing jobs:', processingError);
    return;
  }

  console.log(`⚙️  Processing Jobs: ${processingJobs?.length || 0}`);
  if (processingJobs && processingJobs.length > 0) {
    processingJobs.forEach((job, index) => {
      console.log(`\n   Job ${index + 1}:`);
      console.log(`   - ID: ${job.id}`);
      console.log(`   - Type: ${job.type}`);
      console.log(`   - Started: ${job.started_at}`);
      console.log(`   - Progress: ${job.progress_percent}%`);
      console.log(`   - Message: ${job.progress_message}`);
      console.log(`   - Payload: ${JSON.stringify(job.payload)}`);
    });
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // Check recently completed jobs
  const { data: completedJobs, error: completedError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5);

  if (completedError) {
    console.error('❌ Error fetching completed jobs:', completedError);
    return;
  }

  console.log(`✅ Recently Completed Jobs: ${completedJobs?.length || 0}`);
  if (completedJobs && completedJobs.length > 0) {
    completedJobs.forEach((job, index) => {
      console.log(`\n   Job ${index + 1}:`);
      console.log(`   - ID: ${job.id}`);
      console.log(`   - Type: ${job.type}`);
      console.log(`   - Completed: ${job.completed_at}`);
      console.log(`   - Payload: ${JSON.stringify(job.payload)}`);
    });
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // Check recently failed jobs
  const { data: failedJobs, error: failedError } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);

  if (failedError) {
    console.error('❌ Error fetching failed jobs:', failedError);
    return;
  }

  console.log(`❌ Recently Failed Jobs: ${failedJobs?.length || 0}`);
  if (failedJobs && failedJobs.length > 0) {
    failedJobs.forEach((job, index) => {
      console.log(`\n   Job ${index + 1}:`);
      console.log(`   - ID: ${job.id}`);
      console.log(`   - Type: ${job.type}`);
      console.log(`   - Attempts: ${job.attempts}`);
      console.log(`   - Error: ${job.error}`);
      console.log(`   - Payload: ${JSON.stringify(job.payload)}`);
    });
  }

  console.log('\n' + '='.repeat(60) + '\n');

  // Summary
  const { count: totalPending } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: totalProcessing } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');

  const { count: totalFailed } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  console.log('📊 Summary:');
  console.log(`   - Total Pending: ${totalPending || 0}`);
  console.log(`   - Total Processing: ${totalProcessing || 0}`);
  console.log(`   - Total Failed: ${totalFailed || 0}`);
  console.log();
}

checkJobs().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});