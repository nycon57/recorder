import { Metadata } from 'next';

import HealthScoreGauge from './components/HealthScoreGauge';
import ComponentBreakdown from './components/ComponentBreakdown';
import ServiceStatusGrid from './components/ServiceStatusGrid';
import PerformanceMetrics from './components/PerformanceMetrics';

export const metadata: Metadata = {
  title: 'Storage Health | Admin',
  description: 'Monitor storage system health, performance, and capacity planning',
};

export default function StorageHealthPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Storage System Health</h1>
        <p className="text-muted-foreground">
          Monitor system health, service status, and performance metrics
        </p>
      </div>

      {/* Health Score Overview */}
      <HealthScoreGauge />

      {/* Component Health Breakdown */}
      <ComponentBreakdown />

      {/* Service Status Grid */}
      <ServiceStatusGrid />

      {/* Performance Metrics */}
      <PerformanceMetrics />
    </div>
  );
}
