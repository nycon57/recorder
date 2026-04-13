/**
 * POST /api/extension/tts
 *
 * Auth required (Better Auth session via requireOrg).
 *
 * Proxies text-to-speech requests to ElevenLabs, streaming MP3 audio
 * back to the Chrome extension. The ElevenLabs API key never leaves
 * the server.
 *
 * Accepts:
 *   {
 *     text: string;
 *     voice?: {
 *       voiceId: string;
 *       modelId: string;
 *       stability: number;
 *       similarityBoost: number;
 *     }
 *   }
 *
 * Returns: streaming audio/mpeg
 *
 * Part of TRIB-26: ElevenLabs streaming TTS.
 */

import { NextRequest } from 'next/server';
import { requireOrg, errors } from '@/lib/utils/api';
import { corsPreflightResponse, withCors } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function OPTIONS() {
  return corsPreflightResponse();
}

/** Default voice config — matches DEFAULT_VOICE_CONFIG in packages/shared/src/tts.ts */
const DEFAULT_VOICE = {
  voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
  modelId: 'eleven_flash_v2_5',
  stability: 0.5,
  similarityBoost: 0.75,
};

const MAX_TEXT_LENGTH = 5000;

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
    console.error('[extension/tts] ELEVENLABS_API_KEY is not set');
    return errors.internalError();
  }

  let text: string;
  let voiceId: string;
  let modelId: string;
  let stability: number;
  let similarityBoost: number;

  try {
    const body = await request.json();
    text = body.text;
    const voice = body.voice ?? {};
    voiceId = voice.voiceId ?? DEFAULT_VOICE.voiceId;
    modelId = voice.modelId ?? DEFAULT_VOICE.modelId;
    stability = voice.stability ?? DEFAULT_VOICE.stability;
    similarityBoost = voice.similarityBoost ?? DEFAULT_VOICE.similarityBoost;
  } catch {
    return errors.badRequest('Invalid JSON body');
  }

  if (!text || typeof text !== 'string') {
    return errors.badRequest('text is required');
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return errors.badRequest(`text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
  }

  console.log(`[extension/tts] Synthesizing ${text.length} chars with voice ${voiceId}`);

  // Call ElevenLabs streaming TTS API
  const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;

  let elevenLabsResponse: Response;
  try {
    elevenLabsResponse = await fetch(elevenLabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
        },
      }),
    });
  } catch (networkErr) {
    console.error('[extension/tts] ElevenLabs network error:', networkErr);
    return errors.internalError();
  }

  if (!elevenLabsResponse.ok) {
    const errorText = await elevenLabsResponse.text().catch(() => '');
    console.error(
      `[extension/tts] ElevenLabs returned ${elevenLabsResponse.status}:`,
      errorText
    );
    return errors.internalError();
  }

  if (!elevenLabsResponse.body) {
    console.error('[extension/tts] ElevenLabs response has no body');
    return errors.internalError();
  }

  // Stream the audio response back to the client
  return new Response(elevenLabsResponse.body, {
    headers: withCors({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache, no-transform',
      'Transfer-Encoding': 'chunked',
    }),
  });
}
