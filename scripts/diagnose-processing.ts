#!/usr/bin/env tsx

/**
 * Diagnostic Script for Recording Processing Issues
 *
 * Investigates the complete state of a recording and its processing pipeline:
 * - Recording metadata and status
 * - Job queue entries (transcription, doc generation, embeddings)
 * - Generated outputs (transcripts, documents, chunks)
 * - Storage file existence
 */

import { resolve } from 'path';

import * as dotenv from 'dotenv';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const RECORDING_ID = '80e70735-9b25-4c8a-8345-c7d41545ccc7';

type RecordingRow = Database['public']['Tables']['recordings']['Row'];
type JobRow = Database['public']['Tables']['jobs']['Row'];
type TranscriptRow = Database['public']['Tables']['transcripts']['Row'];
type DocumentRow = Database['public']['Tables']['documents']['Row'];
type TranscriptChunkRow = Database['public']['Tables']['transcript_chunks']['Row'];

interface StorageFileEntry {
  metadata: { size?: number } | null;
  created_at: string | null;
  updated_at: string | null;
}

interface JobPayloadRef {
  recording_id?: string;
  recordingId?: string;
}

function getJobPayloadRef(payload: Json): JobPayloadRef {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    return {};
  }

  const payloadRecord = payload as Record<string, Json | undefined>;

  return {
    recording_id: typeof payloadRecord.recording_id === 'string' ? payloadRecord.recording_id : undefined,
    recordingId: typeof payloadRecord.recordingId === 'string' ? payloadRecord.recordingId : undefined
  };
}

function getTranscriptWordCount(transcript: TranscriptRow): number {
  const trimmedText = transcript.text.trim();

  if (trimmedText.length === 0) {
    return 0;
  }

  return trimmedText.split(/\s+/).length;
}

// Initialize Supabase Admin Client
const supabase = createAdminClient();

interface DiagnosticReport {
  recording?: RecordingRow;
  jobs: JobRow[];
  transcript?: TranscriptRow;
  document?: DocumentRow;
  chunkCount: number;
  storageFile?: StorageFileEntry;
  issues: string[];
  recommendations: string[];
}

async function diagnoseRecording(recordingId: string): Promise<DiagnosticReport> {
  const report: DiagnosticReport = {
    jobs: [],
    chunkCount: 0,
    issues: [],
    recommendations: []
  };

  console.log('='.repeat(80));
  console.log('RECORDING PROCESSING DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log(`Recording ID: ${recordingId}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // 1. Fetch Recording Metadata
  console.log('📹 RECORDING METADATA');
  console.log('-'.repeat(80));

  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('*')
    .eq('id', recordingId)
    .single();

  if (recordingError) {
    console.error('❌ Error fetching recording:', recordingError.message);
    report.issues.push(`Cannot fetch recording: ${recordingError.message}`);
    return report;
  }

  if (!recording) {
    console.error('❌ Recording not found');
    report.issues.push('Recording does not exist in database');
    return report;
  }

  report.recording = recording;

  console.log(`Status: ${recording.status}`);
  console.log(`Title: ${recording.title || '(untitled)'}`);
  console.log(`Duration: ${recording.duration_sec ?? 'N/A'}s`);
  console.log(`Storage Path (Raw): ${recording.storage_path_raw || '(none)'}`);
  console.log(`Storage Path (Processed): ${recording.storage_path_processed || '(none)'}`);
  console.log(`Organization ID: ${recording.org_id}`);
  console.log(`Created: ${recording.created_at}`);
  console.log(`Updated: ${recording.updated_at}`);
  console.log(`Error: ${recording.error_message || '(none)'}\n`);

  // Check for issues
  if (!recording.storage_path_raw) {
    report.issues.push('Missing storage_path_raw - recording file not uploaded');
    report.recommendations.push('Check if file upload completed successfully');
  }

  if (recording.status === 'error') {
    report.issues.push(`Recording marked as failed: ${recording.error_message || 'no error message'}`);
  }

  // 2. Check Storage File
  if (recording.storage_path_raw) {
    console.log('💾 STORAGE FILE CHECK');
    console.log('-'.repeat(80));

    const { data: fileData, error: fileError } = await supabase
      .storage
      .from('recordings')
      .list(recording.storage_path_raw.split('/').slice(0, -1).join('/'), {
        search: recording.storage_path_raw.split('/').pop()
      });

    if (fileError) {
      console.log(`❌ Error checking storage: ${fileError.message}`);
      report.issues.push(`Storage error: ${fileError.message}`);
    } else if (!fileData || fileData.length === 0) {
      console.log('❌ File not found in storage');
      report.issues.push('Recording file missing from storage bucket');
      report.recommendations.push('Re-upload the recording file');
    } else {
      const file = fileData[0];
      const fileSizeBytes = typeof file.metadata?.size === 'number' ? file.metadata.size : null;
      report.storageFile = file;
      console.log(`✅ File exists in storage`);
      console.log(`   Size: ${fileSizeBytes === null ? 'Unknown' : `${(fileSizeBytes / 1024 / 1024).toFixed(2)} MB`}`);
      console.log(`   Created: ${file.created_at}`);
      console.log(`   Updated: ${file.updated_at}\n`);
    }
  }

  // 3. Fetch Jobs
  console.log('⚙️  BACKGROUND JOBS');
  console.log('-'.repeat(80));

  // Note: jobs table doesn't have recording_id column, need to filter by payload
  const { data: allJobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  let jobs: JobRow[] = [];
  if (allJobs) {
    // Filter jobs by recording_id in payload
    jobs = allJobs.filter((job) => {
      const payload = getJobPayloadRef(job.payload);
      return (
        job.content_id === recordingId ||
        payload.recording_id === recordingId ||
        payload.recordingId === recordingId
      );
    });
  }

  if (jobsError) {
    console.error('❌ Error fetching jobs:', jobsError.message);
    report.issues.push(`Cannot fetch jobs: ${jobsError.message}`);
  } else if (!jobs || jobs.length === 0) {
    console.log('⚠️  No jobs found for this recording');
    report.issues.push('No jobs created - processing pipeline not initiated');
    report.recommendations.push('Check if finalize endpoint was called');
    report.recommendations.push('Manually create transcribe job if needed');
  } else {
    report.jobs = jobs;

    for (const job of jobs) {
      const statusIcon = job.status === 'completed' ? '✅' :
                        job.status === 'failed' ? '❌' :
                        job.status === 'processing' ? '⏳' : '⏸️';

      console.log(`\n${statusIcon} Job: ${job.type} (${job.status})`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Created: ${job.created_at}`);
      console.log(`   Run After: ${job.run_at || 'N/A'}`);
      console.log(`   Attempts: ${job.attempts || 0} / ${job.max_attempts || 3}`);
      console.log(`   Progress: ${job.progress_percent || 0}%`);

      if (job.error) {
        console.log(`   Error: ${job.error}`);
      }

      // Check for specific issues
      const runAfter = job.run_at ? new Date(job.run_at) : null;
      const now = new Date();

      if (job.status === 'pending' && runAfter && runAfter > now) {
        const delayMinutes = Math.round((runAfter.getTime() - now.getTime()) / 60000);
        report.issues.push(`Job ${job.type} scheduled for future (${delayMinutes}m from now) - likely in retry backoff`);
        report.recommendations.push(`Wait ${delayMinutes} minutes or reset run_at to now() for immediate retry`);
      }

      if (job.status === 'processing') {
        const processingDuration = now.getTime() - new Date(job.created_at).getTime();
        const processingMinutes = Math.round(processingDuration / 60000);

        if (processingMinutes > 10) {
          report.issues.push(`Job ${job.type} stuck in processing for ${processingMinutes} minutes - worker likely died`);
          report.recommendations.push(`Reset job ${job.id} to pending status`);
        }
      }

      if (job.status === 'failed') {
        report.issues.push(`Job ${job.type} failed: ${job.error || 'no error message'}`);

        const attempts = job.attempts || 0;
        const maxAttempts = job.max_attempts || 3;
        if (attempts >= maxAttempts) {
          report.recommendations.push(`Job ${job.type} exhausted retries - investigate error and reset or recreate job`);
        }
      }
    }

    console.log(); // Empty line after jobs
  }

  // 4. Check Transcript
  console.log('📝 TRANSCRIPT');
  console.log('-'.repeat(80));

  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .select('*')
    .eq('content_id', recordingId)
    .single();

  if (transcriptError && transcriptError.code !== 'PGRST116') {
    console.error('❌ Error fetching transcript:', transcriptError.message);
  } else if (!transcript) {
    console.log('⚠️  No transcript found');

    const transcribeJob = jobs?.find(j => j.type === 'transcribe');
    if (!transcribeJob) {
      report.issues.push('No transcript and no transcribe job - pipeline not started');
    } else if (transcribeJob.status === 'completed') {
      report.issues.push('Transcribe job completed but no transcript in database - critical issue');
      report.recommendations.push('Check transcribe job handler logic for database insert issues');
    } else if (transcribeJob.status === 'pending') {
      report.recommendations.push('Transcribe job pending - ensure worker is running');
    }
  } else {
    report.transcript = transcript;
    console.log('✅ Transcript exists');
    console.log(`   Word Count: ${getTranscriptWordCount(transcript)}`);
    console.log(`   Language: ${transcript.language || 'N/A'}`);
    console.log(`   Text Length: ${transcript.text?.length || 0} characters`);
    console.log(`   Timed Words: ${transcript.words_json ? 'Yes' : 'No'}`);
    console.log(`   Created: ${transcript.created_at}\n`);
  }

  // 5. Check Document
  console.log('📄 DOCUMENT');
  console.log('-'.repeat(80));

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('*')
    .eq('content_id', recordingId)
    .single();

  if (documentError && documentError.code !== 'PGRST116') {
    console.error('❌ Error fetching document:', documentError.message);
  } else if (!document) {
    console.log('⚠️  No document found');

    const docJob = jobs?.find(j => j.type === 'doc_generate');
    if (!transcript) {
      report.recommendations.push('Document generation requires transcript first');
    } else if (!docJob) {
      report.issues.push('Transcript exists but no doc_generate job created');
      report.recommendations.push('Check if transcribe job handler creates doc_generate job');
    } else if (docJob.status === 'pending') {
      report.recommendations.push('Doc generation job pending - ensure worker is running');
    }
  } else {
    report.document = document;
    console.log('✅ Document exists');
    console.log(`   Version: ${document.version}`);
    console.log(`   Status: ${document.status}`);
    console.log(`   Markdown Length: ${document.markdown.length} characters`);
    console.log(`   Created: ${document.created_at}\n`);
  }

  // 6. Check Embeddings
  console.log('🔍 EMBEDDINGS (Vector Search)');
  console.log('-'.repeat(80));

  const { data: chunks, error: chunksError, count } = await supabase
    .from('transcript_chunks')
    .select('*', { count: 'exact', head: false })
    .eq('content_id', recordingId);

  if (chunksError) {
    console.error('❌ Error fetching chunks:', chunksError.message);
  } else {
    report.chunkCount = count || 0;

    if (count === 0) {
      console.log('⚠️  No embedding chunks found');

      const embedJob = jobs?.find(j => j.type === 'generate_embeddings');
      if (!transcript) {
        report.recommendations.push('Embeddings require transcript first');
      } else if (!embedJob) {
        report.issues.push('Transcript exists but no generate_embeddings job created');
        report.recommendations.push('Check if doc_generate job handler creates embeddings job');
      } else if (embedJob.status === 'pending') {
        report.recommendations.push('Embeddings job pending - ensure worker is running');
      }
    } else {
      console.log(`✅ ${count} embedding chunks found`);

      if (chunks && chunks.length > 0) {
        const sampleChunk: TranscriptChunkRow = chunks[0];
        console.log(`   Sample chunk text length: ${sampleChunk.chunk_text.length} characters`);
        console.log(`   Has embedding: ${sampleChunk.embedding ? 'Yes' : 'No'}`);
      }
    }
    console.log();
  }

  return report;
}

async function generateSummary(report: DiagnosticReport) {
  console.log('='.repeat(80));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(80));
  console.log();

  if (report.issues.length === 0) {
    console.log('✅ No issues detected - processing pipeline appears healthy');
  } else {
    console.log(`⚠️  ${report.issues.length} Issue(s) Found:`);
    console.log();
    report.issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  }

  if (report.recommendations.length > 0) {
    console.log();
    console.log('💡 Recommendations:');
    console.log();
    report.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log();
  console.log('='.repeat(80));
  console.log();

  // Processing pipeline status
  console.log('📊 PROCESSING PIPELINE STATUS');
  console.log('-'.repeat(80));

  const stages = [
    { name: 'Upload', complete: !!report.recording?.storage_path_raw },
    { name: 'Transcription', complete: !!report.transcript },
    { name: 'Document Generation', complete: !!report.document },
    { name: 'Embeddings', complete: report.chunkCount > 0 }
  ];

  stages.forEach((stage, i) => {
    const icon = stage.complete ? '✅' : '❌';
    const status = stage.complete ? 'COMPLETE' : 'INCOMPLETE';
    console.log(`${i + 1}. ${icon} ${stage.name}: ${status}`);
  });

  console.log();

  // Worker check recommendation
  const hasPendingJobs = report.jobs.some(j => j.status === 'pending');
  if (hasPendingJobs) {
    console.log('⚠️  IMPORTANT: Pending jobs detected. Ensure background worker is running:');
    console.log('   Development: yarn worker:dev');
    console.log('   Production: yarn worker');
    console.log();
  }
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

    const report = await diagnoseRecording(RECORDING_ID);
    await generateSummary(report);

    // Exit with error code if critical issues found
    const hasCriticalIssues = report.issues.some(issue =>
      issue.includes('not found') ||
      issue.includes('missing') ||
      issue.includes('critical')
    );

    process.exit(hasCriticalIssues ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    process.exit(1);
  }
}

// Run the diagnostic
main();
