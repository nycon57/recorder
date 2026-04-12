/**
 * GET /api/sdk/init
 *
 * Returns vendor branding, voice config, and knowledge scope for the
 * embeddable SDK widget. Authenticated via API key only (not session).
 *
 * The API key's `white_label_config_id` is used to look up the vendor's
 * config row. This keeps the SDK from needing a full session while still
 * scoping data to the correct vendor.
 *
 * Response:
 *   {
 *     branding: WhiteLabelBranding,
 *     voiceConfig: WhiteLabelVoiceConfig,
 *     knowledgeScope: string[] | null
 *   }
 *
 * CORS: Allows any origin since SDK is embedded on vendor sites.
 */

import { NextRequest, NextResponse } from 'next/server';

import { validateApiKey } from '@/lib/services/vendor-api-keys';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { CORS_HEADERS, corsPreflightResponse } from '@/lib/utils/cors';
import type {
  WhiteLabelBranding,
  WhiteLabelVoiceConfig,
} from '@/lib/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── OPTIONS (preflight) ────────────────────────────────────────────────────

export function OPTIONS() {
  return corsPreflightResponse();
}

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer sk_live_')) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    const rawKey = authHeader.slice('Bearer '.length);
    const keyData = await validateApiKey(rawKey);

    if (!keyData) {
      return NextResponse.json(
        { error: 'Invalid or revoked API key' },
        { status: 401, headers: CORS_HEADERS },
      );
    }

    // Fetch the white-label config associated with this API key
    const { data: config, error } = await supabaseAdmin
      .from('white_label_configs')
      .select('branding, voice_config, knowledge_scope')
      .eq('id', keyData.configId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('[sdk/init] Failed to fetch config:', error);
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500, headers: CORS_HEADERS },
      );
    }

    if (!config) {
      // Config not found or inactive — return empty defaults
      return NextResponse.json(
        {
          branding: {},
          voiceConfig: {},
          knowledgeScope: null,
        },
        { headers: CORS_HEADERS },
      );
    }

    const row = config as {
      branding: WhiteLabelBranding;
      voice_config: WhiteLabelVoiceConfig;
      knowledge_scope: string[] | null;
    };

    return NextResponse.json(
      {
        branding: row.branding ?? {},
        voiceConfig: row.voice_config ?? {},
        knowledgeScope: row.knowledge_scope ?? null,
      },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error('[sdk/init] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
