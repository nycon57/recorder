import { Metadata } from 'next';

import CostOverviewCards from './components/CostOverviewCards';
import CostBreakdown from './components/CostBreakdown';
import BudgetTracker from './components/BudgetTracker';
import CostProjections from './components/CostProjections';
import CostAllocationReport from './components/CostAllocationReport';

export const metadata: Metadata = {
  title: 'Cost Management | Admin',
  description: 'Storage cost tracking, budgets, and projections',
};

export default function CostManagementPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Cost Management</h1>
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
