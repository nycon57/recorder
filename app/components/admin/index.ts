/**
 * Admin components
 * Components for admin dashboard and management
 */

// Admin navigation
export { default as AdminNavigation } from './AdminNavigation';

// Storage analytics
export { default as StorageDistribution } from './storage/StorageDistribution';
export { default as StorageTrends } from './storage/StorageTrends';
export { default as FileTypeAnalytics } from './storage/FileTypeAnalytics';
export { default as JobQueueStatus } from './storage/JobQueueStatus';
export { default as PlatformOverviewCards } from './storage/PlatformOverviewCards';

// Health monitoring
export { default as HealthScoreGauge } from './health/HealthScoreGauge';
export { default as ServiceStatusGrid } from './health/ServiceStatusGrid';
export { default as ComponentBreakdown } from './health/ComponentBreakdown';
export { default as PerformanceMetrics } from './health/PerformanceMetrics';

// Alerts
export { default as AlertSummaryCards } from './alerts/AlertSummaryCards';
export { default as ActiveAlertsList } from './alerts/ActiveAlertsList';
export { default as AlertConfiguration } from './alerts/AlertConfiguration';

// Recommendations
export { default as RecommendationsList } from './recommendations/RecommendationsList';
export { default as ActionPlanOverview } from './recommendations/ActionPlanOverview';
export { default as ImplementationTracker } from './recommendations/ImplementationTracker';

// Cost management
export { default as CostBreakdown } from './costs/CostBreakdown';
export { default as CostAllocationReport } from './costs/CostAllocationReport';
export { default as BudgetTracker } from './costs/BudgetTracker';
export { default as CostProjections } from './costs/CostProjections';
export { default as CostOverviewCards } from './costs/CostOverviewCards';

// Organization storage
export { default as OrgStorageOverview } from './org-storage/OrgStorageOverview';
export { default as TopFilesTable } from './org-storage/TopFilesTable';
export { default as AdminActionsPanel } from './org-storage/AdminActionsPanel';
export { default as OrgIssues } from './org-storage/OrgIssues';
