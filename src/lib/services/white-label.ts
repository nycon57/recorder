/**
 * White-Label Configuration Service
 *
 * CRUD operations for vendor white-label configs. Each vendor org
 * gets at most one config row (UNIQUE on vendor_org_id).
 *
 * Uses supabaseAdmin (service_role) — callers must enforce auth.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type {
  WhiteLabelConfig,
  WhiteLabelBranding,
  WhiteLabelVoiceConfig,
} from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateWhiteLabelInput {
  branding?: WhiteLabelBranding;
  voice_config?: WhiteLabelVoiceConfig;
  knowledge_scope?: string[] | null;
  custom_domain?: string | null;
}

export interface UpdateWhiteLabelInput {
  branding?: WhiteLabelBranding;
  voice_config?: WhiteLabelVoiceConfig;
  knowledge_scope?: string[] | null;
  custom_domain?: string | null;
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cast a raw DB row to the typed WhiteLabelConfig interface. */
function toTyped(row: Record<string, unknown>): WhiteLabelConfig {
  return row as unknown as WhiteLabelConfig;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get the white-label config for a vendor org.
 * Returns null when no config exists (org is not a vendor).
 */
export async function getWhiteLabelConfig(
  orgId: string
): Promise<WhiteLabelConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('white_label_configs')
    .select('*')
    .eq('vendor_org_id', orgId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[white-label] getWhiteLabelConfig error:', error);
    throw new Error('Failed to fetch white-label config');
  }

  return data ? toTyped(data) : null;
}

/**
 * Create a new white-label config for a vendor org.
 * Throws if a config already exists (UNIQUE constraint).
 */
export async function createWhiteLabelConfig(
  orgId: string,
  input: CreateWhiteLabelInput
): Promise<WhiteLabelConfig> {
  const { data, error } = await supabaseAdmin
    .from('white_label_configs')
    .insert({
      vendor_org_id: orgId,
      branding: (input.branding ?? {}) as Record<string, unknown>,
      voice_config: (input.voice_config ?? {}) as Record<string, unknown>,
      knowledge_scope: input.knowledge_scope ?? null,
      custom_domain: input.custom_domain ?? null,
    })
    .select()
    .single();

  if (error) {
    // UNIQUE violation → 23505
    if (error.code === '23505') {
      throw new Error('CONFLICT');
    }
    console.error('[white-label] createWhiteLabelConfig error:', error);
    throw new Error('Failed to create white-label config');
  }

  return toTyped(data);
}

/**
 * Update an existing white-label config. Supports partial updates.
 * JSONB fields are replaced wholesale (not deep-merged) — callers
 * should merge before calling if partial JSONB update is desired.
 */
export async function updateWhiteLabelConfig(
  orgId: string,
  input: UpdateWhiteLabelInput
): Promise<WhiteLabelConfig> {
  // Build the update payload — only include fields that were provided
  const updates: Record<string, unknown> = {};

  if (input.branding !== undefined) {
    updates.branding = input.branding as Record<string, unknown>;
  }
  if (input.voice_config !== undefined) {
    updates.voice_config = input.voice_config as Record<string, unknown>;
  }
  if (input.knowledge_scope !== undefined) {
    updates.knowledge_scope = input.knowledge_scope;
  }
  if (input.custom_domain !== undefined) {
    updates.custom_domain = input.custom_domain;
  }
  if (input.is_active !== undefined) {
    updates.is_active = input.is_active;
  }

  const { data, error } = await supabaseAdmin
    .from('white_label_configs')
    .update(updates)
    .eq('vendor_org_id', orgId)
    .select()
    .single();

  if (error) {
    // No matching row
    if (error.code === 'PGRST116') {
      throw new Error('NOT_FOUND');
    }
    console.error('[white-label] updateWhiteLabelConfig error:', error);
    throw new Error('Failed to update white-label config');
  }

  return toTyped(data);
}

/**
 * Soft-delete: sets is_active = false.
 */
export async function deactivateWhiteLabelConfig(
  orgId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('white_label_configs')
    .update({ is_active: false })
    .eq('vendor_org_id', orgId);

  if (error) {
    console.error('[white-label] deactivateWhiteLabelConfig error:', error);
    throw new Error('Failed to deactivate white-label config');
  }
}

/**
 * Resolve a white-label config by custom domain.
 * Used for future SDK custom domain routing.
 */
export async function resolveWhiteLabelByDomain(
  domain: string
): Promise<WhiteLabelConfig | null> {
  const { data, error } = await supabaseAdmin
    .from('white_label_configs')
    .select('*')
    .eq('custom_domain', domain)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[white-label] resolveWhiteLabelByDomain error:', error);
    throw new Error('Failed to resolve white-label config by domain');
  }

  return data ? toTyped(data) : null;
}
