/**
 * Simplified Transcription Handler (Manual Upload)
 *
 * This is a temporary handler that expects you to provide transcripts manually
 * or keeps using OpenAI Whisper while you test Gemini for document generation.
 *
 * To use this: Update job-processor.ts to import from './handlers/transcribe-simplified'
 */

import { openai } from '@/lib/openai/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createReadStream } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribePayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

interface WhisperResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  words?: WhisperWord[];
  segments?: WhisperSegment[];
}

/**
 * Keep using OpenAI Whisper for transcription while testing Google Gemini
 * for document generation and embeddings
 */
export async function transcribeRecording(job: Job): Promise<void> {
  const payload = job.payload as unknown as TranscribePayload;
  const { recordingId, orgId, storagePath } = payload;

  console.log(`[Transcribe] Using OpenAI Whisper for transcription (Google for doc gen)`);
  console.log(`[Transcribe] Starting transcription for recording ${recordingId}`);

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  let tempFilePath: string | null = null;

  try {
    // Download video from Supabase Storage
    console.log(`[Transcribe] Downloading video from ${storagePath}`);
    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('recordings')
      .download(storagePath);

    if (downloadError || !videoBlob) {
      throw new Error(`Failed to download video: ${downloadError?.message || 'Unknown error'}`);
    }

    // Save to temp file
    tempFilePath = join(tmpdir(), `${randomUUID()}.webm`);
    const buffer = await videoBlob.arrayBuffer();
    await writeFile(tempFilePath, Buffer.from(buffer));

    console.log(`[Transcribe] Saved to temp file: ${tempFilePath}`);

    // Transcribe with Whisper (STILL USING OPENAI FOR THIS PART)
    console.log(`[Transcribe] Calling OpenAI Whisper API`);
    const transcription = await openai.audio.transcriptions.create({
      file: createReadStream(tempFilePath) as any,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    const whisperResponse = transcription as unknown as WhisperResponse;

    console.log(`[Transcribe] Transcription completed. Duration: ${whisperResponse.duration}s`);

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        recording_id: recordingId,
        text: whisperResponse.text,
        language: whisperResponse.language,
        words_json: {
          words: whisperResponse.words || [],
          segments: whisperResponse.segments || [],
          duration: whisperResponse.duration,
        },
        provider: 'openai', // Still using OpenAI for transcription
      })
      .select()
      .single();

    if (transcriptError) {
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    console.log(`[Transcribe] Saved transcript ${transcript.id}`);

    // Update recording status
    await supabase
      .from('recordings')
      .update({ status: 'transcribed' })
      .eq('id', recordingId);

    // Enqueue document generation job (WILL USE GOOGLE GEMINI)
    await supabase.from('jobs').insert({
      type: 'doc_generate',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
      },
      dedupe_key: `doc_generate:${recordingId}`,
    });

    console.log(`[Transcribe] Enqueued document generation job (will use Google Gemini)`);

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'recording.transcribed',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
      },
    });

  } catch (error) {
    console.error(`[Transcribe] Error:`, error);

    // Update recording status to error
    await supabase
      .from('recordings')
      .update({
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : 'Transcription failed',
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log(`[Transcribe] Cleaned up temp file`);
      } catch (err) {
        console.error(`[Transcribe] Failed to delete temp file:`, err);
      }
    }
  }
}
