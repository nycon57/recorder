/**
 * /admin/vendor-sources layout — system-admin guard (TRIB-146)
 *
 * Server-side auth gate. Any non-system-admin request is redirected to
 * /dashboard before the page ever renders. The parent /admin layout still
 * provides the sidebar shell.
 */

import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { canAccessSystemAdminPage } from '@/lib/auth/system-admin-page-guard';

export const dynamic = 'force-dynamic';

interface Props {
  children: ReactNode;
}

export default async function VendorSourcesAdminLayout({ children }: Props) {
  const hasAccess = await canAccessSystemAdminPage();

  if (!hasAccess) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
