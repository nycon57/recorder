import { Metadata } from 'next';

import {
  AlertSummaryCards,
  ActiveAlertsList,
  AlertConfiguration,
} from '@/app/components/admin';
import { DocLink } from '@/app/components/docs/doc-link';

export const metadata: Metadata = {
  title: 'Storage Alerts | Admin',
  description: 'Monitor and manage storage-related alerts and notifications',
};

export default function StorageAlertsPage() {
  return (
    <div className="trbd-page">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="trbd-page-title tracking-tight">Storage Alerts</h1>
          <DocLink href="/docs/system-admin/storage-alerts">
            Alert configuration guide
          </DocLink>
        </div>
        <p className="text-muted-foreground">
          Monitor storage anomalies, cost overruns, and system health issues
        </p>
      </div>

      {/* Alert Summary */}
      <AlertSummaryCards />

      {/* Active Alerts */}
      <ActiveAlertsList />

      {/* Alert Configuration */}
      <AlertConfiguration />
    </div>
  );
}
