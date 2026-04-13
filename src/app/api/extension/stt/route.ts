/**
 * POST /api/extension/stt
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Accepts a multipart form upload with an `audio` file field and proxies
 * it to ElevenLabs Scribe v2 for speech-to-text transcription.
 *
 * Returns: { text: string, language_code?: string }
 *
 * Replaces the Deepgram token endpoint — single-vendor approach using
 * ElevenLabs for both STT and TTS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireOrg, errors } from '@/lib/utils/api';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Max audio file size: 25MB (ElevenLabs limit) */
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

export function OPTIONS() {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest) {
  try {
    await requireOrg();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Unauthorized') return errors.unauthorized();
    return errors.forbidden();
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('[extension/stt] ELEVENLABS_API_KEY is not set');
    return errors.internalError();
  }

  // Parse the multipart form data
  let audioFile: File;
  try {
    const formData = await request.formData();
    const file = formData.get('audio');
    if (!file || !(file instanceof File)) {
      return errors.badRequest('audio file field is required');
    }
    audioFile = file;
  } catch {
    return errors.badRequest('Invalid multipart form data');
  }

  if (audioFile.size === 0) {
    return errors.badRequest('Audio file is empty');
  }

  if (audioFile.size > MAX_AUDIO_SIZE) {
    return errors.badRequest('Audio file exceeds 25MB limit');
  }

  // Forward to ElevenLabs Scribe v2
  const elevenLabsUrl = 'https://api.elevenlabs.io/v1/speech-to-text';

  let elevenLabsResponse: Response;
  try {
    const formData = new FormData();
    formData.append('file', audioFile, audioFile.name || 'recording.webm');
    formData.append('model_id', 'scribe_v1');
    formData.append('language_code', 'en');

    elevenLabsResponse = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
    });
  } catch (networkErr) {
    console.error('[extension/stt] ElevenLabs network error:', networkErr);
    return errors.internalError();
  }

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text().catch(() => '');
    console.error(
      `[extension/stt] ElevenLabs returned ${elevenLabsResponse.status}:`,
      errorText,
    );
    return errors.internalError();
  }

  let result: { text?: string; language_code?: string };
  try {
    result = await elevenLabsResponse.json();
  } catch {
    console.error('[extension/stt] Failed to parse ElevenLabs response');
    return errors.internalError();
  }

  const transcript = result.text ?? '';
  console.log(`[extension/stt] Transcribed (${transcript.length} chars): "${transcript.slice(0, 100)}"`);

  return NextResponse.json(
    {
      text: transcript,
      language_code: result.language_code,
    },
    { headers: CORS_HEADERS },
  );
}
