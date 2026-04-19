import { Metadata } from 'next';

import {
  AlertSummaryCards,
  ActiveAlertsList,
  AlertConfiguration,
} from '@/app/components/admin';

export const metadata: Metadata = {
  title: 'Storage Alerts | Admin',
  description: 'Monitor and manage storage-related alerts and notifications',
};

export default function StorageAlertsPage() {
  return (
    <div className="trbd-page">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="trbd-page-title tracking-tight">Storage Alerts</h1>
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
