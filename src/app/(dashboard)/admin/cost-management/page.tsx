import { Metadata } from 'next';

import {
  CostOverviewCards,
  CostBreakdown,
  BudgetTracker,
  CostProjections,
  CostAllocationReport,
} from '@/app/components/admin';
import { DocLink } from '@/app/components/docs/doc-link';

export const metadata: Metadata = {
  title: 'Cost Management | Admin',
  description: 'Storage cost tracking, budgets, and projections',
};

export default function CostManagementPage() {
  return (
    <div className="trbd-page">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="trbd-page-title tracking-tight">Cost Management</h1>
          <DocLink href="/docs/platform-runbooks/cost-and-quota-investigation">
            Cost runbook
          </DocLink>
        </div>
        <p className="text-muted-foreground">
          Track storage costs, manage budgets, and forecast future spending
        </p>
      </div>

      {/* Cost Overview Cards */}
      <CostOverviewCards />

      {/* Budget Tracker */}
      <BudgetTracker />

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cost Breakdown */}
        <CostBreakdown />

        {/* Cost Projections */}
        <CostProjections />
      </div>

      {/* Cost Allocation Report */}
      <CostAllocationReport />
    </div>
  );
}
