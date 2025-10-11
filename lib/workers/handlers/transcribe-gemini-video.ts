/**
 * Video Transcription Handler (Gemini Video Understanding)
 *
 * Downloads recording from Supabase Storage, sends to Gemini 2.5 Flash for
 * multimodal analysis (audio + visual), and stores transcript with visual events.
 */

import { getGoogleAI, GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { readFile, unlink } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

type Job = Database['public']['Tables']['jobs']['Row'];

interface TranscribePayload {
  recordingId: string;
  orgId: string;
  storagePath: string;
}

interface VisualEvent {
  timestamp: string; // "MM:SS" format
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string; // UI element name
  location?: string; // e.g., "top right", "menu bar"
  description: string; // Full description of the visual event
  confidence?: number; // Optional confidence score
}

interface AudioSegment {
  timestamp: string; // "MM:SS" format
  startTime: number; // Seconds
  endTime: number; // Seconds
  speaker?: string; // "narrator" | "system" | etc.
  text: string;
}

interface GeminiVideoResponse {
  audioTranscript: AudioSegment[];
  visualEvents: VisualEvent[];
  combinedNarrative: string;
  duration: number; // Total duration in seconds
  keyMoments?: Array<{
    timestamp: string;
    description: string;
  }>;
}

/**
 * Transcribe a video recording using Gemini video understanding
 */
export async function transcribeRecording(job: Job): Promise<void> {
  const payload = job.payload as unknown as TranscribePayload;
  const { recordingId, orgId, storagePath } = payload;

  console.log(
    `[Transcribe-Video] Starting video transcription for recording ${recordingId}`
  );

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'transcribing' })
    .eq('id', recordingId);

  let tempFilePath: string | null = null;

  try {
    // Download video from Supabase Storage
    console.log(`[Transcribe-Video] Downloading video from ${storagePath}`);
    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('recordings')
      .download(storagePath);

    if (downloadError || !videoBlob) {
      throw new Error(
        `Failed to download video: ${downloadError?.message || 'Unknown error'}`
      );
    }

    // Get file size
    const fileSize = videoBlob.size;
    console.log(
      `[Transcribe-Video] Video size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Save to temp file
    tempFilePath = join(tmpdir(), `${randomUUID()}.webm`);
    const buffer = await videoBlob.arrayBuffer();
    await writeFile(tempFilePath, Buffer.from(buffer));

    console.log(`[Transcribe-Video] Saved to temp file: ${tempFilePath}`);

    // Read video file as base64
    const videoBytes = await readFile(tempFilePath);
    const videoBase64 = videoBytes.toString('base64');

    console.log(`[Transcribe-Video] Prepared ${videoBytes.length} bytes for Gemini`);

    // Determine method based on file size
    const use20MBLimit = fileSize < 20 * 1024 * 1024;

    console.log(
      `[Transcribe-Video] Using ${use20MBLimit ? 'inline' : 'File API'} method`
    );

    // Call Gemini API
    const googleAI = getGoogleAI();
    const model = googleAI.getGenerativeModel({
      model: GOOGLE_CONFIG.DOCIFY_MODEL, // gemini-2.5-flash
    });

    // Structured prompt for video analysis
    const prompt = `Analyze this screen recording tutorial video and extract comprehensive information:

**TASK 1: AUDIO TRANSCRIPTION**
Transcribe all spoken content with precise timestamps (MM:SS format).
For each segment, provide:
- timestamp: exact time when speech starts
- text: the spoken words
- speaker: identify if multiple speakers (e.g., "narrator", "interviewer")

**TASK 2: VISUAL EVENTS**
Extract key visual actions that occur on screen:
- UI elements clicked (button text, icon description, location)
- Text typed into form fields (field name, value if visible)
- Screen/page transitions (what changed)
- Mouse movements to important areas
- Any visual elements referenced in narration
- Pop-ups, modals, notifications that appear

For each visual event, provide:
- timestamp: when it occurred (MM:SS)
- type: 'click' | 'type' | 'navigate' | 'scroll' | 'other'
- target: specific UI element name (e.g., "Settings button", "Email field")
- location: where on screen (e.g., "top right corner", "sidebar", "menu bar")
- description: full description of what happened

**TASK 3: COMBINED NARRATIVE**
Create a unified narrative that merges audio and visual, making it clear WHAT was done and WHERE/HOW.
Example: "At 00:15, the instructor says 'now we configure settings' while clicking the gear icon in the top right corner, then selecting 'Advanced Options' from the dropdown menu."

**TASK 4: KEY MOMENTS**
Identify the 3-5 most important moments in the video (major steps, critical actions).

**OUTPUT FORMAT (JSON):**
Return ONLY valid JSON matching this structure:
{
  "audioTranscript": [
    {
      "timestamp": "00:05",
      "startTime": 5.0,
      "endTime": 8.5,
      "speaker": "narrator",
      "text": "First, we open the settings panel"
    }
  ],
  "visualEvents": [
    {
      "timestamp": "00:05",
      "type": "click",
      "target": "Settings gear icon",
      "location": "top right corner",
      "description": "User clicks the gear icon to open settings"
    }
  ],
  "combinedNarrative": "Complete merged narrative here...",
  "duration": 125.5,
  "keyMoments": [
    {"timestamp": "00:05", "description": "Opening settings panel"}
  ]
}

IMPORTANT: Return ONLY the JSON object, no markdown formatting or explanatory text.`;

    console.log(`[Transcribe-Video] Sending video to Gemini for analysis...`);

    // Send video to Gemini
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'video/webm',
          data: videoBase64,
        },
      },
      { text: prompt },
    ]);

    const responseText = result.response.text();
    console.log(
      `[Transcribe-Video] Received response (${responseText.length} chars)`
    );

    // Parse JSON response (strip markdown if present)
    let parsedResponse: GeminiVideoResponse;
    try {
      // Remove markdown code blocks if present
      const jsonText = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      parsedResponse = JSON.parse(jsonText);
      console.log(
        `[Transcribe-Video] Parsed response: ${parsedResponse.audioTranscript.length} audio segments, ${parsedResponse.visualEvents.length} visual events`
      );
    } catch (parseError) {
      console.error(`[Transcribe-Video] Failed to parse JSON:`, parseError);
      console.error(`[Transcribe-Video] Raw response:`, responseText);
      throw new Error(
        `Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
      );
    }

    // Convert audio transcript to compatible format (similar to words_json structure)
    const fullTranscript = parsedResponse.audioTranscript
      .map(seg => seg.text)
      .join(' ')
      .trim();

    // Build words_json compatible structure
    const words_json = {
      segments: parsedResponse.audioTranscript.map(seg => ({
        start: seg.startTime,
        end: seg.endTime,
        text: seg.text,
      })),
      duration: parsedResponse.duration,
      words: [], // Gemini doesn't provide word-level timestamps, leave empty
    };

    // Prepare video metadata
    const video_metadata = {
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
      provider: 'gemini-video',
      duration: parsedResponse.duration,
      file_size_mb: (fileSize / 1024 / 1024).toFixed(2),
      processed_at: new Date().toISOString(),
      visual_events_count: parsedResponse.visualEvents.length,
      audio_segments_count: parsedResponse.audioTranscript.length,
      key_moments_count: parsedResponse.keyMoments?.length || 0,
    };

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .insert({
        recording_id: recordingId,
        text: fullTranscript,
        language: GOOGLE_CONFIG.SPEECH_LANGUAGE,
        words_json,
        visual_events: parsedResponse.visualEvents,
        video_metadata,
        confidence: 0.95, // Gemini is generally high confidence
        provider: 'gemini-video',
      })
      .select()
      .single();

    if (transcriptError) {
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    console.log(`[Transcribe-Video] Saved transcript ${transcript.id}`);
    console.log(
      `[Transcribe-Video] - Audio: ${fullTranscript.substring(0, 100)}...`
    );
    console.log(
      `[Transcribe-Video] - Visual events: ${parsedResponse.visualEvents.length}`
    );
    console.log(
      `[Transcribe-Video] - Duration: ${parsedResponse.duration}s`
    );

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

    console.log(
      `[Transcribe-Video] Enqueued document generation job for recording ${recordingId}`
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'recording.transcribed',
      payload: {
        recordingId,
        transcriptId: transcript.id,
        orgId,
        hasVisualContext: true,
        visualEventsCount: parsedResponse.visualEvents.length,
      },
    });
  } catch (error) {
    console.error(`[Transcribe-Video] Error:`, error);

    // Update recording status to error
    await supabase
      .from('recordings')
      .update({
        status: 'error',
        metadata: {
          error:
            error instanceof Error
              ? error.message
              : 'Video transcription failed',
          errorType: 'transcription',
          timestamp: new Date().toISOString(),
        },
      })
      .eq('id', recordingId);

    throw error;
  } finally {
    // Clean up temp file
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
        console.log(`[Transcribe-Video] Cleaned up temp file`);
      } catch (err) {
        console.error(`[Transcribe-Video] Failed to delete temp file:`, err);
      }
    }
  }
}
