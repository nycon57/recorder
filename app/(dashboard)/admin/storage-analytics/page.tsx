import { Metadata } from 'next';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  PlatformOverviewCards,
  StorageDistribution,
  StorageTrends,
  JobQueueStatus,
  FileTypeAnalytics,
} from '@/app/components/admin';

export const metadata: Metadata = {
  title: 'Storage Analytics | Admin',
  description: 'Platform storage metrics, optimization analytics, and cost tracking',
};

export default function StorageAnalyticsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-normal tracking-tight">Storage Analytics</h1>
        <p className="text-muted-foreground">
          Platform-wide storage metrics, optimization effectiveness, and cost tracking
        </p>
      </div>

      {/* Platform Overview - Hero Metrics */}
      <PlatformOverviewCards />

      {/* Tabbed Content */}
      <Tabs defaultValue="distribution" className="space-y-6">
        <TabsList>
          <TabsTrigger value="distribution">Storage Distribution</TabsTrigger>
          <TabsTrigger value="trends">Trends & Growth</TabsTrigger>
          <TabsTrigger value="jobs">Job Processing</TabsTrigger>
          <TabsTrigger value="files">File Types</TabsTrigger>
        </TabsList>

        <TabsContent value="distribution" className="space-y-6">
          <StorageDistribution />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <StorageTrends />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-6">
          <JobQueueStatus />
        </TabsContent>

        <TabsContent value="files" className="space-y-6">
          <FileTypeAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
