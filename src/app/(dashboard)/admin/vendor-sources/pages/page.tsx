/**
 * /admin/vendor-sources/pages — Paginated vendor_wiki_pages browser
 *
 * Defense-in-depth: calls requireSystemAdmin itself in addition to the
 * parent layout guard.
 *
 * App filter list is sourced from the snapshot endpoint (existing GET
 * /api/admin/vendor-sources) — avoids a separate lookup and reuses
 * the data already available to the dashboard.
 *
 * TRIB-149
 */

import { redirect } from 'next/navigation';

import { requireSystemAdmin } from '@/lib/utils/api';

import { PagesPageClient } from './pages-page-client';

export const dynamic = 'force-dynamic';

export default async function VendorSourcesPagesPage() {
  try {
    await requireSystemAdmin();
  } catch {
    redirect('/dashboard');
  }

  return <PagesPageClient />;
}
