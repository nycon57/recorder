import { Metadata } from 'next';

import {
  ActionPlanOverview,
  RecommendationsList,
  ImplementationTracker,
} from '@/app/components/admin';

export const metadata: Metadata = {
  title: 'Storage Recommendations | Admin',
  description: 'AI-powered optimization recommendations and action plans',
};

export default function StorageRecommendationsPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-normal tracking-tight">Storage Recommendations</h1>
        <p className="text-muted-foreground">
          AI-powered optimization suggestions to reduce costs and improve performance
        </p>
      </div>

      {/* Action Plan Overview */}
      <ActionPlanOverview />

      {/* Recommendations List */}
      <RecommendationsList />

      {/* Implementation Tracker */}
      <ImplementationTracker />
    </div>
  );
}
