/**
 * Transcription Handler (Google Speech-to-Text)
 *
 * Downloads recording from Supabase Storage, transcribes using Google Speech-to-Text API,
 * saves transcript with word-level timestamps.
 */

import { readFile, unlink , writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

import type { Database } from '@/lib/types/database';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getSpeechClient, GOOGLE_CONFIG } from '@/lib/google/client';

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribePayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
}

interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

/**
 * Transcribe a recording using Google Speech-to-Text
 */
export async function transcribeRecording(job: Job): Promise<void> {
  const payload = job.payload as unknown as TranscribePayload;
  const { recordingId, orgId, storagePath } = payload;

  console.log(`[Transcribe] Starting transcription for recording ${recordingId}`);

  // Initialize Speech client (lazy, supports both file and base64 credentials)
  const speechClient = getSpeechClient();
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

    // Read audio file for Google Speech-to-Text
    const audioBytes = await readFile(tempFilePath);
    const audioBase64 = audioBytes.toString('base64');

    // Transcribe with Google Speech-to-Text
    // Use longRunningRecognize for videos of any length (supports up to 480 minutes with content)
    console.log(`[Transcribe] Calling Google Speech-to-Text API (async)`);
    const [operation] = await speechClient.longRunningRecognize({
      config: {
        encoding: 'WEBM_OPUS', // Adjust based on your audio format
        sampleRateHertz: 48000, // Common for video recordings
        languageCode: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        enableWordTimeOffsets: GOOGLE_CONFIG.ENABLE_WORD_TIME_OFFSETS,
        enableAutomaticPunctuation: true,
        model: GOOGLE_CONFIG.SPEECH_MODEL,
        useEnhanced: true, // Better quality
      },
      audio: {
        content: audioBase64,
      },
    });

    console.log(`[Transcribe] Transcription operation started, waiting for completion...`);

    // Wait for the operation to complete
    const [response] = await operation.promise();

    if (!response.results || response.results.length === 0) {
      throw new Error('No transcription results returned from Google Speech-to-Text');
    }

    // Process results
    const fullTranscript = response.results
      .map(result => result.alternatives?.[0]?.transcript || '')
      .join(' ')
      .trim();

    // Extract word-level timestamps
    const words: WordInfo[] = [];
    const segments: Array<{ start: number; end: number; text: string }> = [];

    const currentSegmentStart = 0;
    const currentSegmentText = '';

    response.results.forEach((result, segmentIndex) => {
      const alternative = result.alternatives?.[0];
      if (!alternative) return;

      const segmentText = alternative.transcript || '';
      const wordInfos = alternative.words || [];

      // Extract words with timestamps
      wordInfos.forEach(wordInfo => {
        const startSec = Number(wordInfo.startTime?.seconds || 0);
        const startNanos = Number(wordInfo.startTime?.nanos || 0);
        const endSec = Number(wordInfo.endTime?.seconds || 0);
        const endNanos = Number(wordInfo.endTime?.nanos || 0);

        words.push({
          word: wordInfo.word || '',
          startTime: startSec + startNanos / 1e9,
          endTime: endSec + endNanos / 1e9,
          confidence: wordInfo.confidence ?? undefined,
        });
      });

      // Create segments (sentence-level)
      if (wordInfos.length > 0) {
        const firstWord = wordInfos[0];
        const lastWord = wordInfos[wordInfos.length - 1];

        const startSec = Number(firstWord.startTime?.seconds || 0);
        const startNanos = Number(firstWord.startTime?.nanos || 0);
        const endSec = Number(lastWord.endTime?.seconds || 0);
        const endNanos = Number(lastWord.endTime?.nanos || 0);

        segments.push({
          start: startSec + startNanos / 1e9,
          end: endSec + endNanos / 1e9,
          text: segmentText,
        });
      }
    });

    // Calculate duration from last word
    const duration = words.length > 0 ? words[words.length - 1].endTime : 0;

    console.log(`[Transcribe] Transcription completed. Duration: ${duration}s, Words: ${words.length}`);

    // Calculate average confidence
    const avgConfidence = words.length > 0
      ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length
      : 0;

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        recording_id: recordingId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json: {
          words,
          segments,
          duration,
        },
        confidence: avgConfidence,
        provider: 'google',
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

    // Enqueue document generation job
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

    console.log(`[Transcribe] Enqueued document generation job for recording ${recordingId}`);

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
