/**
 * /admin/vendor-sources/new — New ingest form (full-page variant)
 *
 * Defense-in-depth: calls requireSystemAdmin itself in addition to the
 * parent layout guard at /admin/vendor-sources/layout.tsx.
 *
 * On success the form navigates to /admin/vendor-sources where the dashboard
 * auto-polls for the new syncing source.
 *
 * TRIB-149
 */

import { redirect } from 'next/navigation';

import { canAccessSystemAdminPage } from '@/lib/auth/system-admin-page-guard';

import { NewIngestFormPage } from './new-ingest-form-page';

export const dynamic = 'force-dynamic';

export default async function NewVendorSourcePage() {
  const hasAccess = await canAccessSystemAdminPage();

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <NewIngestFormPage />;
}
