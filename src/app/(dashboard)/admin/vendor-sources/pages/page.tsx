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

import { canAccessSystemAdminPage } from '@/lib/auth/system-admin-page-guard';

import { PagesPageClient } from './pages-page-client';

export const dynamic = 'force-dynamic';

export default async function VendorSourcesPagesPage() {
  const hasAccess = await canAccessSystemAdminPage();

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <PagesPageClient />;
}
