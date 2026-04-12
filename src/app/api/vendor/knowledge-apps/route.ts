/**
 * Vendor Knowledge Apps API — TRIB-53
 *
 * Returns the distinct list of app names from vendor_wiki_pages.
 * Used by the vendor admin knowledge scoping page.
 *
 * Auth: requireAdmin() — only org owners/admins.
 */

import {
  apiHandler,
  requireAdmin,
  successResponse,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export const GET = apiHandler(async () => {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from('vendor_wiki_pages')
    .select('app');

  if (error) {
    console.error('[vendor/knowledge-apps] Error fetching apps:', error);
    throw new Error('Failed to fetch vendor wiki apps');
  }

  // Extract distinct app names
  const apps = [...new Set((data ?? []).map((row) => row.app as string))].sort();

  return successResponse(apps);
});
