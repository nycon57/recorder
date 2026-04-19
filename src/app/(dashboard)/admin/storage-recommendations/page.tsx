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
    <div className="trbd-page">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="trbd-page-title tracking-tight">
          Storage Recommendations
        </h1>
        <p className="text-muted-foreground">
          AI-powered optimization suggestions to reduce costs and improve
          performance
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
