import { Metadata } from 'next';

import AlertSummaryCards from './components/AlertSummaryCards';
import ActiveAlertsList from './components/ActiveAlertsList';
import AlertConfiguration from './components/AlertConfiguration';

export const metadata: Metadata = {
  title: 'Storage Alerts | Admin',
  description: 'Monitor and manage storage-related alerts and notifications',
};

export default function StorageAlertsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Storage Alerts</h1>
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
