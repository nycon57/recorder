/**
 * /admin/vendor-sources layout — system-admin guard (TRIB-146)
 *
 * Server-side auth gate. Any non-system-admin request is redirected to
 * /dashboard before the page ever renders. The parent /admin layout still
 * provides the sidebar shell.
 */

import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';

import { requireSystemAdmin } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

interface Props {
  children: ReactNode;
}

export default async function VendorSourcesAdminLayout({ children }: Props) {
  try {
    await requireSystemAdmin();
  } catch {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
