'use client';

import { useEffect } from 'react';
import { Activity } from 'lucide-react';

// Component imports
import RealTimeMetrics from '../components/RealTimeMetrics';
import MetricsChart from '../components/MetricsChart';

export default function MetricsPage() {
  // Set page title
  useEffect(() => {
    document.title = 'Real-Time Metrics - Admin - Record';
  }, []);

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Real-Time Metrics</h1>
            <p className="text-muted-foreground">Live system performance metrics</p>
          </div>
        </div>
      </div>

      {/* Real-Time Metrics Component */}
      <RealTimeMetrics />

      {/* Quick Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <MetricsChart
          metric="search_latency"
          timeRange="1h"
          chartType="line"
          title="Search Latency"
          description="Last hour, updated every minute"
        />
        <MetricsChart
          metric="cache_hit_rate"
          timeRange="1h"
          chartType="area"
          title="Cache Performance"
          description="Hit rate over last hour"
        />
      </div>

      {/* Footer Info */}
      <div className="text-xs text-muted-foreground text-center border-t pt-4">
        Real-time metrics auto-refresh every 2 seconds
      </div>
    </div>
  );
}
