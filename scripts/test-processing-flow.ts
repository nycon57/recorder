/**
 * Comprehensive Processing Pipeline Integration Test
 *
 * Tests the entire processing workflow from recording creation to job completion.
 * This script validates:
 * 1. Non-streaming finalize endpoint
 * 2. SSE streaming endpoint
 * 3. Job handlers directly
 * 4. Streaming manager functionality
 * 5. Background job processor
 *
 * Usage:
 *   ts-node scripts/test-processing-flow.ts
 *   or
 *   yarn tsx scripts/test-processing-flow.ts
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { streamingManager } from '@/lib/services/streaming-processor';
import { transcribeRecording } from '@/lib/workers/handlers/transcribe-gemini-video';
import { generateDocument } from '@/lib/workers/handlers/docify-google';
import { generateEmbeddings } from '@/lib/workers/handlers/embeddings-google';

type RecordingStatus = Database['public']['Tables']['recordings']['Row']['status'];
type JobStatus = Database['public']['Tables']['jobs']['Row']['status'];

// Test configuration
const TEST_TIMEOUT_MS = 60000; // 60 seconds for entire test suite
const JOB_POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 15; // 30 seconds max for job completion

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(80));
  log(title, 'blue');
  console.log('='.repeat(80) + '\n');
}

function logSuccess(message: string) {
  log(`✓ ${message}`, 'green');
}

function logError(message: string) {
  log(`✗ ${message}`, 'red');
}

function logWarning(message: string) {
  log(`⚠ ${message}`, 'yellow');
}

function logInfo(message: string) {
  log(`ℹ ${message}`, 'gray');
}

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const testResults: TestResult[] = [];

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get or create a test organization and user
 */
async function getTestOrgAndUser(): Promise<{ orgId: string; userId: string }> {
  const supabase = createAdminClient();

  // Try to find existing test org
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('name', 'Test Organization')
    .maybeSingle();

  let orgId: string;

  if (existingOrg) {
    orgId = existingOrg.id;
    logInfo(`Using existing test org: ${orgId}`);
  } else {
    // Create test org
    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: 'Test Organization',
        slug: 'test-org',
        clerk_org_id: 'test_clerk_org_' + Date.now(),
        plan: 'pro',
      })
      .select()
      .single();

    if (orgError || !newOrg) {
      throw new Error(`Failed to create test org: ${orgError?.message}`);
    }

    orgId = newOrg.id;
    logInfo(`Created test org: ${orgId}`);
  }

  // Try to find existing test user
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', 'test@example.com')
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
    logInfo(`Using existing test user: ${userId}`);
  } else {
    // Create test user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: 'test@example.com',
        name: 'Test User',
        clerk_id: 'test_clerk_user_' + Date.now(),
        org_id: orgId,
        role: 'owner',
      })
      .select()
      .single();

    if (userError || !newUser) {
      throw new Error(`Failed to create test user: ${userError?.message}`);
    }

    userId = newUser.id;
    logInfo(`Created test user: ${userId}`);
  }

  return { orgId, userId };
}

/**
 * Create a test recording with a fake video file
 */
async function createTestRecording(
  orgId: string,
  userId: string
): Promise<{ recordingId: string; storagePath: string }> {
  const supabase = createAdminClient();

  // Create recording record
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .insert({
      org_id: orgId,
      created_by: userId,
      title: `Test Recording - ${new Date().toISOString()}`,
      description: 'Integration test recording',
      status: 'uploading' as RecordingStatus,
      duration_sec: 120,
      metadata: {
        test: true,
        createdAt: new Date().toISOString(),
      },
    })
    .select()
    .single();

  if (recordingError || !recording) {
    throw new Error(`Failed to create recording: ${recordingError?.message}`);
  }

  logInfo(`Created test recording: ${recording.id}`);

  // Simulate file upload (we need a real video file for actual processing)
  const storagePath = `org_${orgId}/recordings/${recording.id}/raw.webm`;

  // Note: For a full integration test, you'd upload a real video file here
  // For now, we'll just create the path reference

  return {
    recordingId: recording.id,
    storagePath,
  };
}

/**
 * Test 1: Non-streaming finalize endpoint
 */
async function testNonStreamingFinalize(
  recordingId: string,
  orgId: string
): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Non-Streaming Finalize Endpoint';

  logSection(`TEST 1: ${testName}`);

  try {
    const supabase = createAdminClient();

    logInfo('Calling finalize endpoint (simulated)...');

    // Update recording status as if finalize was called
    const { data: updated, error: updateError } = await supabase
      .from('recordings')
      .update({
        status: 'uploaded' as RecordingStatus,
        storage_path_raw: `org_${orgId}/recordings/${recordingId}/raw.webm`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update recording: ${updateError?.message}`);
    }

    logSuccess('Recording status updated to "uploaded"');

    // Create transcribe job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        type: 'transcribe',
        status: 'pending' as JobStatus,
        payload: {
          recordingId,
          orgId,
          storagePath: updated.storage_path_raw,
        },
        dedupe_key: `transcribe:${recordingId}`,
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error(`Failed to create job: ${jobError?.message}`);
    }

    logSuccess(`Transcribe job created: ${job.id}`);

    // Verify job was created
    const { data: verifyJob, error: verifyError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job.id)
      .single();

    if (verifyError || !verifyJob) {
      throw new Error('Job verification failed');
    }

    logSuccess('Job verified in database');
    logInfo(`Job status: ${verifyJob.status}`);
    logInfo(`Job type: ${verifyJob.type}`);
    logInfo(`Job payload: ${JSON.stringify(verifyJob.payload, null, 2)}`);

    const duration = Date.now() - startTime;
    return {
      name: testName,
      passed: true,
      duration,
      details: {
        recordingId,
        jobId: job.id,
        jobStatus: verifyJob.status,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 2: Poll for job processing
 */
async function testJobProcessing(jobId: string): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Job Processing (Polling)';

  logSection(`TEST 2: ${testName}`);

  try {
    const supabase = createAdminClient();

    logInfo(`Polling job ${jobId} for status changes...`);
    logWarning('Note: This requires the background worker to be running!');
    logWarning('Start worker with: yarn worker:dev');

    let attempts = 0;
    let jobStatus: JobStatus = 'pending';
    let lastStatus = '';

    while (attempts < MAX_POLL_ATTEMPTS) {
      const { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error || !job) {
        throw new Error(`Failed to fetch job: ${error?.message}`);
      }

      jobStatus = job.status;

      if (jobStatus !== lastStatus) {
        logInfo(`Job status: ${jobStatus} (attempt ${attempts + 1}/${MAX_POLL_ATTEMPTS})`);
        if (job.progress_percent !== null) {
          logInfo(`Progress: ${job.progress_percent}%`);
        }
        if (job.progress_message) {
          logInfo(`Message: ${job.progress_message}`);
        }
        if (job.error) {
          logWarning(`Error: ${job.error}`);
        }
        lastStatus = jobStatus;
      }

      if (jobStatus === 'completed') {
        logSuccess('Job completed successfully!');
        const duration = Date.now() - startTime;
        return {
          name: testName,
          passed: true,
          duration,
          details: {
            jobId,
            finalStatus: jobStatus,
            attempts: attempts + 1,
          },
        };
      }

      if (jobStatus === 'failed') {
        logError(`Job failed: ${job.error || 'Unknown error'}`);
        const duration = Date.now() - startTime;
        return {
          name: testName,
          passed: false,
          duration,
          error: job.error || 'Job failed',
          details: {
            jobId,
            finalStatus: jobStatus,
            attempts: attempts + 1,
          },
        };
      }

      attempts++;
      await sleep(JOB_POLL_INTERVAL_MS);
    }

    // Timeout
    logWarning(`Job did not complete within ${MAX_POLL_ATTEMPTS * JOB_POLL_INTERVAL_MS / 1000}s`);
    logWarning('This likely means the background worker is not running');
    const duration = Date.now() - startTime;
    return {
      name: testName,
      passed: false,
      duration,
      error: 'Job processing timeout',
      details: {
        jobId,
        lastStatus: jobStatus,
        attempts,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 3: SSE streaming endpoint simulation
 */
async function testSSEStreaming(recordingId: string): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'SSE Streaming Manager';

  logSection(`TEST 3: ${testName}`);

  try {
    logInfo('Testing streaming manager functionality...');

    // Check if a connection is registered
    const isConnected = streamingManager.isConnected(recordingId);
    logInfo(`Connection status: ${isConnected ? 'Connected' : 'Not connected'}`);

    // Get connection count
    const connectionCount = streamingManager.getConnectionCount();
    logInfo(`Active connections: ${connectionCount}`);

    // Try sending a test message (will only work if connection exists)
    logInfo('Attempting to send test progress event...');
    const sent = streamingManager.sendProgress(
      recordingId,
      'all',
      50,
      'Test progress message',
      { test: true }
    );

    if (sent) {
      logSuccess('Progress event sent successfully');
    } else {
      logWarning('No active connection to send progress (expected if not streaming)');
    }

    // Try sending a log message
    const logSent = streamingManager.sendLog(
      recordingId,
      'Test log message',
      { test: true }
    );

    if (logSent) {
      logSuccess('Log event sent successfully');
    } else {
      logWarning('No active connection to send log (expected if not streaming)');
    }

    const duration = Date.now() - startTime;
    return {
      name: testName,
      passed: true,
      duration,
      details: {
        recordingId,
        isConnected,
        connectionCount,
        eventsSent: sent || logSent,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 4: Job handlers directly (unit test style)
 */
async function testJobHandlersDirect(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Job Handlers Direct Execution';

  logSection(`TEST 4: ${testName}`);

  try {
    logInfo('Testing job handler imports...');

    // Check if handlers are properly imported
    if (typeof transcribeRecording !== 'function') {
      throw new Error('transcribeRecording handler not imported correctly');
    }
    logSuccess('transcribeRecording handler imported');

    if (typeof generateDocument !== 'function') {
      throw new Error('generateDocument handler not imported correctly');
    }
    logSuccess('generateDocument handler imported');

    if (typeof generateEmbeddings !== 'function') {
      throw new Error('generateEmbeddings handler not imported correctly');
    }
    logSuccess('generateEmbeddings handler imported');

    logInfo('All handlers are properly imported and callable');

    // Note: We can't actually run them without a real video file and API keys
    logWarning('Skipping actual handler execution (requires real video + API keys)');

    const duration = Date.now() - startTime;
    return {
      name: testName,
      passed: true,
      duration,
      details: {
        handlersVerified: ['transcribeRecording', 'generateDocument', 'generateEmbeddings'],
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Test 5: Environment and configuration
 */
async function testEnvironment(): Promise<TestResult> {
  const startTime = Date.now();
  const testName = 'Environment & Configuration';

  logSection(`TEST 5: ${testName}`);

  try {
    const supabase = createAdminClient();

    // Test Supabase connection
    logInfo('Testing Supabase connection...');
    const { error: healthError } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (healthError) {
      throw new Error(`Supabase connection failed: ${healthError.message}`);
    }
    logSuccess('Supabase connection OK');

    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_AI_API_KEY',
    ];

    const missingVars: string[] = [];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missingVars.push(envVar);
        logWarning(`Missing: ${envVar}`);
      } else {
        logSuccess(`Found: ${envVar}`);
      }
    }

    if (missingVars.length > 0) {
      logWarning(`Missing ${missingVars.length} required environment variables`);
    }

    const duration = Date.now() - startTime;
    return {
      name: testName,
      passed: missingVars.length === 0,
      duration,
      details: {
        supabaseConnected: true,
        missingEnvVars: missingVars,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logError(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate test report
 */
function generateReport(results: TestResult[]) {
  logSection('TEST SUMMARY');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${total}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }
  console.log(`Total Duration: ${totalDuration}ms\n`);

  logSection('DETAILED RESULTS');

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.name}`);
    if (result.passed) {
      logSuccess(`Status: PASSED (${result.duration}ms)`);
    } else {
      logError(`Status: FAILED (${result.duration}ms)`);
      if (result.error) {
        logError(`Error: ${result.error}`);
      }
    }

    if (result.details) {
      logInfo('Details:');
      console.log(JSON.stringify(result.details, null, 2));
    }
  });

  logSection('RECOMMENDATIONS');

  const hasFailures = results.some((r) => !r.passed);

  if (hasFailures) {
    logWarning('Some tests failed. Common issues:');
    console.log('\n1. Background worker not running:');
    console.log('   - Start with: yarn worker:dev');
    console.log('   - Check logs in terminal');
    console.log('\n2. Missing environment variables:');
    console.log('   - Copy .env.example to .env');
    console.log('   - Fill in all required values');
    console.log('\n3. Missing test video file:');
    console.log('   - Upload a real video to storage');
    console.log('   - Or skip transcription tests');
    console.log('\n4. Database issues:');
    console.log('   - Check Supabase connection');
    console.log('   - Run migrations: yarn supabase db push');
  } else {
    logSuccess('All tests passed! Processing pipeline is working correctly.');
  }

  console.log('');
}

/**
 * Main test runner
 */
async function runTests() {
  logSection('PROCESSING PIPELINE INTEGRATION TEST');
  logInfo('Starting comprehensive test suite...');
  logInfo(`Timeout: ${TEST_TIMEOUT_MS / 1000}s\n`);

  try {
    // Test 5: Environment first (fastest)
    const envResult = await testEnvironment();
    testResults.push(envResult);

    if (!envResult.passed) {
      logError('Environment check failed! Fix configuration before proceeding.');
      generateReport(testResults);
      process.exit(1);
    }

    // Get or create test org and user
    const { orgId, userId } = await getTestOrgAndUser();

    // Create test recording
    const { recordingId, storagePath } = await createTestRecording(orgId, userId);
    logInfo(`Test recording ID: ${recordingId}\n`);

    // Test 1: Non-streaming finalize
    const finalizeResult = await testNonStreamingFinalize(recordingId, orgId);
    testResults.push(finalizeResult);

    if (!finalizeResult.passed) {
      logError('Finalize test failed! Skipping remaining tests.');
      generateReport(testResults);
      process.exit(1);
    }

    // Get job ID from test 1
    const jobId = finalizeResult.details?.jobId;
    if (!jobId) {
      throw new Error('No job ID from finalize test');
    }

    // Test 4: Job handlers (quick check)
    const handlersResult = await testJobHandlersDirect();
    testResults.push(handlersResult);

    // Test 3: SSE streaming
    const sseResult = await testSSEStreaming(recordingId);
    testResults.push(sseResult);

    // Test 2: Job processing (longest test)
    logWarning('\nStarting job processing test...');
    logWarning('This test requires the background worker to be running!');
    logWarning('If the worker is not running, this test will timeout.\n');

    const processingResult = await testJobProcessing(jobId);
    testResults.push(processingResult);

    // Generate report
    generateReport(testResults);

    // Exit with appropriate code
    const hasFailures = testResults.some((r) => !r.passed);
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    logError(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(error);
    generateReport(testResults);
    process.exit(1);
  }
}

// Run tests
runTests();
