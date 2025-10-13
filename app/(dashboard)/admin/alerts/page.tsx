'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Component imports
import AlertsList from '../components/AlertsList';

export default function AlertsPage() {
  const [criticalCount, setCriticalCount] = useState<number>(0);

  // Set page title
  useEffect(() => {
    document.title = 'System Alerts - Admin - Record';
  }, []);

  // Fetch critical alerts count for display
  useEffect(() => {
    const fetchCriticalCount = async () => {
      try {
        const response = await fetch('/api/admin/alerts');
        if (!response.ok) return;

        const data = await response.json();
        const alerts = data.alerts || [];
        const critical = alerts.filter(
          (alert: any) => alert.severity === 'critical' && alert.status === 'active'
        );
        setCriticalCount(critical.length);
      } catch (err) {
        console.error('Error fetching critical alerts count:', err);
      }
    };

    fetchCriticalCount();

    // Update count every 10 seconds
    const interval = setInterval(fetchCriticalCount, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center relative">
            <AlertTriangle className="h-6 w-6 text-primary" />
            {criticalCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                {criticalCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">System Alerts</h1>
            <p className="text-muted-foreground">Critical system notifications</p>
          </div>
        </div>
      </div>

      {/* Alerts List Component */}
      <AlertsList />

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center border-t pt-4">
        Alerts auto-refresh every 10 seconds
      </div>
    </div>
  );
}
