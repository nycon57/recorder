/**
 * Vendor Wiki Resolver
 *
 * Provides lookup utilities for vendor_wiki_pages — the generic knowledge
 * layer describing how third-party apps (Salesforce, HubSpot, etc.) work.
 * Used by the extension query and context routes.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

export type VendorWikiPage =
  Database['public']['Tables']['vendor_wiki_pages']['Row'];

/**
 * Resolve the best-matching vendor wiki page for the given app + screen.
 * Returns null when no page exists.
 */
export async function resolveVendorWikiPage({
  app,
  screen,
}: {
  app: string;
  screen: string;
}): Promise<VendorWikiPage | null> {
  const { data, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('*')
    .eq('app', app.toLowerCase())
    .eq('screen', screen.toLowerCase())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[vendor-wiki-resolver] resolveVendorWikiPage error:', error);
    return null;
  }

  return data ?? null;
}

/**
 * Count all vendor wiki pages currently loaded.
 */
export async function countVendorWikiPages(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('[vendor-wiki-resolver] countVendorWikiPages error:', error);
    return 0;
  }

  return count ?? 0;
}

/**
 * Return distinct app names present in vendor_wiki_pages.
 */
export async function listVendorApps(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('app') as { data: Array<{ app: string }> | null; error: unknown };

  if (error) {
    console.error('[vendor-wiki-resolver] listVendorApps error:', error);
    return [];
  }

  // Deduplicate in application code (Supabase JS client doesn't expose DISTINCT)
  const apps = Array.from(new Set((data ?? []).map((row) => row.app)));
  return apps.sort();
}
