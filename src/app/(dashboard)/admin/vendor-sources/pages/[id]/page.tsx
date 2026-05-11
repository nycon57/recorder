/**
 * /admin/vendor-sources/pages/[id] — Single vendor page detail
 *
 * Defense-in-depth: calls requireSystemAdmin itself in addition to the
 * parent layout guard.
 *
 * Fetches via the new GET /api/admin/vendor-sources/pages/[id] endpoint
 * (added in TRIB-149 alongside the existing DELETE).
 *
 * TRIB-149
 */

import { redirect, notFound } from 'next/navigation';

import { canAccessSystemAdminPage } from '@/lib/auth/system-admin-page-guard';

import { PageDetailClient } from './page-detail-client';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VendorPageDetailPage({ params }: Props) {
  const hasAccess = await canAccessSystemAdminPage();

  if (!hasAccess) {
    redirect('/dashboard');
  }

  const { id } = await params;

  if (!id || typeof id !== 'string') {
    notFound();
  }

  return <PageDetailClient pageId={id} />;
}
