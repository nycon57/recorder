/**
 * SSE Streaming Endpoint Test
 *
 * Tests the Server-Sent Events streaming functionality for real-time progress updates.
 * This simulates a client connecting to the streaming finalize endpoint and listening
 * for events.
 *
 * Usage:
 *   yarn tsx scripts/test-sse-stream.ts <recording-id>
 *
 * Requirements:
 *   - Recording must exist in database
 *   - Background worker should be running (yarn worker:dev)
 *   - Valid authentication token (for actual API testing)
 */

import { streamingManager } from '@/lib/services/streaming-processor';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors.gray}[${timestamp}]${colors.reset} ${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'blue');
  console.log('='.repeat(80) + '\n');
}

function logEvent(type: string, message: string, data?: any) {
  const emoji = {
    progress: '📊',
    log: '📝',
    error: '❌',
    complete: '✅',
    transcript_chunk: '📄',
    document_chunk: '📋',
    heartbeat: '💓',
  }[type] || '📡';

  log(`${emoji} [${type.toUpperCase()}] ${message}`, 'cyan');
  if (data && Object.keys(data).length > 0) {
    console.log(colors.gray + JSON.stringify(data, null, 2) + colors.reset);
  }
}

/**
 * Test 1: Streaming Manager Internal API
 */
async function testStreamingManagerInternal(recordingId: string) {
  logSection('TEST 1: Streaming Manager Internal API');

  log('Testing streaming manager methods...', 'blue');

  // Check connection status
  const isConnected = streamingManager.isConnected(recordingId);
  log(`Connection exists: ${isConnected ? 'YES' : 'NO'}`, isConnected ? 'green' : 'yellow');

  // Check active connections
  const connectionCount = streamingManager.getConnectionCount();
  log(`Active connections: ${connectionCount}`, 'blue');

  // Try creating a mock connection
  log('Creating mock SSE connection...', 'blue');

  const events: any[] = [];
  let controllerClosed = false;

  const mockController = {
    enqueue: (chunk: Uint8Array) => {
      if (controllerClosed) return;
      const text = new TextDecoder().decode(chunk);
      // Parse SSE format: "data: {json}\n\n"
      if (text.startsWith('data: ')) {
        try {
          const jsonStr = text.replace('data: ', '').trim();
          const event = JSON.parse(jsonStr);
          events.push(event);
          logEvent(event.type, event.message, event.data);
        } catch (e) {
          // Might be heartbeat or other non-JSON
          if (text.includes('heartbeat')) {
            log('💓 Heartbeat received', 'gray');
          }
        }
      }
    },
    close: () => {
      controllerClosed = true;
      log('SSE connection closed', 'yellow');
    },
  };

  // Register connection
  streamingManager.register(recordingId, mockController as any);
  log('✓ Connection registered', 'green');

  // Send test events
  log('\nSending test events...', 'blue');

  await sleep(100);
  streamingManager.sendLog(recordingId, 'Test log message', { test: true });

  await sleep(100);
  streamingManager.sendProgress(recordingId, 'transcribe', 25, 'Test progress update', {
    step: 1,
    total: 4,
  });

  await sleep(100);
  streamingManager.sendProgress(recordingId, 'transcribe', 50, 'Halfway done');

  await sleep(100);
  streamingManager.sendTranscriptChunk(recordingId, 'This is a test transcript chunk.');

  await sleep(100);
  streamingManager.sendDocumentChunk(recordingId, '# Test Document\n\nThis is a test.');

  await sleep(100);
  streamingManager.sendError(recordingId, 'Test error message (not real)');

  await sleep(100);
  streamingManager.sendComplete(recordingId, 'Test complete', { success: true });

  // Wait for completion event to be sent
  await sleep(1500);

  // Summary
  logSection('Test 1 Summary');
  log(`Total events received: ${events.length}`, 'blue');

  const eventTypes = events.reduce((acc, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  log('Event breakdown:', 'blue');
  for (const [type, count] of Object.entries(eventTypes)) {
    log(`  ${type}: ${count}`, 'cyan');
  }

  // Verify connection was closed
  const stillConnected = streamingManager.isConnected(recordingId);
  if (stillConnected) {
    log('⚠ Warning: Connection still open after complete event', 'yellow');
  } else {
    log('✓ Connection properly closed after complete event', 'green');
  }
}

/**
 * Test 2: Simulate Job Processing with Streaming
 */
async function testJobProcessingWithStreaming(recordingId: string) {
  logSection('TEST 2: Job Processing Simulation');

  const supabase = createAdminClient();

  log('Checking for existing jobs...', 'blue');

  const { data: existingJobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, type, status')
    .eq('payload->>recordingId', recordingId)
    .order('created_at', { ascending: false })
    .limit(5);

  if (jobsError) {
    log(`Error fetching jobs: ${jobsError.message}`, 'red');
    return;
  }

  if (!existingJobs || existingJobs.length === 0) {
    log('No jobs found for this recording', 'yellow');
    log('Create jobs by calling the finalize endpoint', 'blue');
    return;
  }

  log(`Found ${existingJobs.length} jobs:`, 'green');
  existingJobs.forEach((job) => {
    log(`  - ${job.type}: ${job.status}`, 'cyan');
  });

  // Monitor job status changes
  log('\nMonitoring jobs for status changes (30 seconds)...', 'blue');
  log('(Start the worker with: yarn worker:dev)', 'yellow');

  const startTime = Date.now();
  const duration = 30000; // 30 seconds
  let lastStatuses = existingJobs.reduce((acc, job) => {
    acc[job.id] = job.status;
    return acc;
  }, {} as Record<string, string>);

  while (Date.now() - startTime < duration) {
    await sleep(2000); // Poll every 2 seconds

    for (const job of existingJobs) {
      const { data: currentJob } = await supabase
        .from('jobs')
        .select('id, type, status, progress_percent, progress_message, error')
        .eq('id', job.id)
        .single();

      if (currentJob && currentJob.status !== lastStatuses[job.id]) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log(`[+${elapsed}s] Job ${currentJob.type}: ${lastStatuses[job.id]} → ${currentJob.status}`, 'green');

        if (currentJob.progress_message) {
          log(`  Message: ${currentJob.progress_message}`, 'cyan');
        }
        if (currentJob.progress_percent !== null) {
          log(`  Progress: ${currentJob.progress_percent}%`, 'cyan');
        }
        if (currentJob.error) {
          log(`  Error: ${currentJob.error}`, 'red');
        }

        lastStatuses[job.id] = currentJob.status;
      }
    }
  }

  log('\nMonitoring complete', 'blue');

  // Final status
  log('\nFinal job statuses:', 'blue');
  for (const job of existingJobs) {
    const { data: finalJob } = await supabase
      .from('jobs')
      .select('id, type, status')
      .eq('id', job.id)
      .single();

    if (finalJob) {
      const statusColor = finalJob.status === 'completed' ? 'green' : finalJob.status === 'failed' ? 'red' : 'yellow';
      log(`  ${finalJob.type}: ${finalJob.status}`, statusColor);
    }
  }
}

/**
 * Test 3: Check Recording Status
 */
async function testRecordingStatus(recordingId: string) {
  logSection('TEST 3: Recording Status Check');

  const supabase = createAdminClient();

  const { data: recording, error } = await supabase
    .from('recordings')
    .select('id, title, status, storage_path_raw, error_message, created_at, updated_at')
    .eq('id', recordingId)
    .single();

  if (error || !recording) {
    log(`Recording not found: ${error?.message || 'Unknown error'}`, 'red');
    return;
  }

  log('Recording Details:', 'blue');
  log(`  ID: ${recording.id}`, 'cyan');
  log(`  Title: ${recording.title || '(untitled)'}`, 'cyan');
  log(`  Status: ${recording.status}`, recording.status === 'completed' ? 'green' : 'yellow');
  log(`  Storage Path: ${recording.storage_path_raw || '(none)'}`, 'cyan');
  if (recording.error_message) {
    log(`  Error: ${recording.error_message}`, 'red');
  }
  log(`  Created: ${new Date(recording.created_at).toLocaleString()}`, 'gray');
  log(`  Updated: ${new Date(recording.updated_at).toLocaleString()}`, 'gray');

  // Check for related data
  log('\nChecking related data...', 'blue');

  // Transcript
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('id, text')
    .eq('recording_id', recordingId)
    .maybeSingle();

  if (transcript) {
    log(`  ✓ Transcript found (${transcript.text.length} chars)`, 'green');
  } else {
    log(`  ✗ No transcript`, 'yellow');
  }

  // Document
  const { data: document } = await supabase
    .from('documents')
    .select('id, markdown, status')
    .eq('recording_id', recordingId)
    .maybeSingle();

  if (document) {
    log(`  ✓ Document found (${document.markdown.length} chars, status: ${document.status})`, 'green');
  } else {
    log(`  ✗ No document`, 'yellow');
  }

  // Chunks
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('id')
    .eq('recording_id', recordingId);

  if (chunks && chunks.length > 0) {
    log(`  ✓ Embeddings found (${chunks.length} chunks)`, 'green');
  } else {
    log(`  ✗ No embeddings`, 'yellow');
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main test runner
 */
async function main() {
  const recordingId = process.argv[2];

  if (!recordingId) {
    console.error('Usage: yarn tsx scripts/test-sse-stream.ts <recording-id>');
    process.exit(1);
  }

  logSection('SSE Streaming & Job Processing Test');
  log(`Recording ID: ${recordingId}`, 'blue');
  log(`Timestamp: ${new Date().toISOString()}`, 'gray');

  try {
    // Test 1: Internal streaming manager
    await testStreamingManagerInternal(recordingId);

    // Test 2: Job processing monitoring
    await testJobProcessingWithStreaming(recordingId);

    // Test 3: Recording status
    await testRecordingStatus(recordingId);

    // Final summary
    logSection('All Tests Complete');
    log('Review the output above for any issues', 'blue');
    log('\nNext steps:', 'yellow');
    log('  1. If jobs are stuck, start the worker: yarn worker:dev', 'cyan');
    log('  2. If events not received, check streaming manager logs', 'cyan');
    log('  3. If recording failed, check error_message and job errors', 'cyan');
    log('  4. For full integration test: yarn tsx scripts/test-processing-flow.ts', 'cyan');

    process.exit(0);
  } catch (error) {
    log(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

main();
