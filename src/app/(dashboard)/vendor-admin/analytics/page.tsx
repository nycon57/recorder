/**
 * Vendor Admin — Usage Analytics (TRIB-57)
 *
 * Server Component that renders the analytics dashboard for vendor orgs.
 * Shows query volume, top questions, top apps, and knowledge gap reports.
 *
 * Auth: requireAdmin() — org owner/admin only. Redirects if no white-label config.
 */

import { redirect } from 'next/navigation';
import { BarChart3 } from 'lucide-react';

import { requireAdmin } from '@/lib/utils/api';
import { getWhiteLabelConfig } from '@/lib/services/white-label';
import { AnalyticsCharts } from './analytics-charts';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Vendor Analytics | Tribora',
  description: 'Usage analytics for your vendor integration',
};

export default async function VendorAnalyticsPage() {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const config = await getWhiteLabelConfig(orgId);
  if (!config) {
    redirect('/vendor-admin');
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-normal tracking-tight">
          <BarChart3 className="h-7 w-7" />
          Usage Analytics
        </h1>
        <p className="mt-1 text-muted-foreground">
          See how your customers are using the training assistant.
        </p>
      </header>

      <AnalyticsCharts />
    </div>
  );
}
