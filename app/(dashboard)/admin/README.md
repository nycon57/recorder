# Admin Dashboard - Phase 6 Analytics & Monitoring

Comprehensive admin dashboard for system monitoring, analytics visualization, and administrative controls.

## Overview

The admin dashboard provides real-time visibility into system performance, job processing, alerts, and historical analytics. Built with Next.js 15 App Router, React 19, and shadcn/ui components.

## File Structure

```
app/(dashboard)/admin/
├── page.tsx                        # Main admin dashboard page
├── loading.tsx                     # Loading state with skeletons
├── error.tsx                       # Error boundary
├── components/
│   ├── RealTimeMetrics.tsx        # Live metrics (2s refresh)
│   ├── MetricsChart.tsx           # Recharts wrapper for time-series
│   ├── AlertsList.tsx             # System alerts management
│   └── JobsQueue.tsx              # Job monitoring and retry
└── README.md                       # This file
```

## Components

### 1. Main Dashboard (`page.tsx`)

The main admin page with tabbed interface:

**Features:**
- Real-time summary cards (Total Searches, P95 Latency, Cache Hit Rate, Active Jobs)
- Critical alerts banner
- Four main tabs: Real-Time, Analytics, Job Queue, Alerts
- Auto-refresh every 10 seconds
- Time range selector for analytics (1h, 24h, 7d, 30d)

**State Management:**
- `summary`: Dashboard summary metrics
- `loading`: Loading state for initial fetch
- `timeRange`: Selected time range for analytics charts

**API Dependencies:**
- `GET /api/admin/metrics` - Dashboard summary and job metrics

### 2. Real-Time Metrics (`RealTimeMetrics.tsx`)

Live system metrics with trend indicators.

**Features:**
- Updates every 2 seconds
- Four metric cards: Active Searches, QPS, Avg Latency, Cache Hit Rate
- Trend indicators (up/down arrows with percentage change)
- Live badge indicator
- Automatic error handling

**Props:** None (self-contained)

**API Dependencies:**
- `GET /api/admin/metrics/realtime` - Live metrics data

**Data Structure:**
```typescript
interface MetricsData {
  activeSearches: number;
  qps: number;
  avgLatency: number;
  cacheHitRate: number;
  timestamp: string;
}
```

### 3. Metrics Chart (`MetricsChart.tsx`)

Reusable Recharts wrapper for time-series visualization.

**Props:**
```typescript
interface MetricsChartProps {
  metric: string;                    // Metric identifier
  timeRange: '1h' | '24h' | '7d' | '30d';
  chartType?: 'line' | 'area' | 'bar';
  title?: string;
  description?: string;
}
```

**Features:**
- Responsive design with `ResponsiveContainer`
- Three chart types: Line, Area, Bar
- Custom tooltips with proper formatting
- Automatic axis formatting based on time range
- Loading and error states
- Dark mode support

**API Dependencies:**
- `GET /api/admin/analytics?metric={metric}&timeRange={timeRange}`

**Supported Metrics:**
- `search_latency` - Search response times
- `cache_hit_rate` - Query cache efficiency
- `search_volume` - Total searches
- `p95_latency` - 95th percentile latency
- `p99_latency` - 99th percentile latency
- `rerank_usage` - Reranking usage stats
- `embedding_generation` - Embeddings created

### 4. Alerts List (`AlertsList.tsx`)

System alerts management with action buttons.

**Props:**
```typescript
interface AlertsListProps {
  autoRefresh?: boolean;          // Default: true
  refreshInterval?: number;       // Default: 10000ms
}
```

**Features:**
- Grouped by severity (Critical, Warning, Info)
- Status tracking (Active, Acknowledged, Resolved)
- Action buttons: Acknowledge, Resolve
- Expandable acknowledged/resolved section
- Real-time updates
- Visual severity indicators

**API Dependencies:**
- `GET /api/admin/alerts` - Fetch all alerts
- `POST /api/admin/alerts/{id}/acknowledge` - Acknowledge alert
- `POST /api/admin/alerts/{id}/resolve` - Resolve alert

**Alert Structure:**
```typescript
interface AlertItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}
```

### 5. Jobs Queue (`JobsQueue.tsx`)

Background job monitoring and management.

**Features:**
- Job metrics cards (Pending, Processing, Completed, Failed)
- Filterable job table
- Retry failed jobs
- View error details
- Duration tracking
- Auto-refresh every 5 seconds

**API Dependencies:**
- `GET /api/admin/jobs` - Fetch jobs and metrics
- `POST /api/admin/jobs/{id}/retry` - Retry failed job

**Job Structure:**
```typescript
interface Job {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attemptCount: number;
  maxAttempts: number;
  createdAt: string;
  runAfter: string;
  processingStartedAt?: string;
  completedAt?: string;
  error?: string;
  payload?: any;
}
```

## API Integration Points

### Required API Routes

The admin dashboard expects the following API routes to be implemented:

1. **`GET /api/admin/metrics`**
   - Returns dashboard summary and job metrics
   - Response:
     ```json
     {
       "summary": {
         "totalSearches": 1234,
         "p95Latency": 145,
         "cacheHitRate": 85.5,
         "activeJobs": 5,
         "criticalAlerts": 2
       }
     }
     ```

2. **`GET /api/admin/metrics/realtime`**
   - Returns live metrics (updated frequently)
   - Response:
     ```json
     {
       "activeSearches": 12,
       "qps": 15.5,
       "avgLatency": 120,
       "cacheHitRate": 85.5,
       "timestamp": "2025-10-13T10:30:00Z"
     }
     ```

3. **`GET /api/admin/analytics?metric={metric}&timeRange={timeRange}`**
   - Returns time-series data for charts
   - Response:
     ```json
     {
       "data": [
         { "timestamp": "2025-10-13T10:00:00Z", "value": 120 },
         { "timestamp": "2025-10-13T10:01:00Z", "value": 125 }
       ]
     }
     ```

4. **`GET /api/admin/alerts`**
   - Returns all system alerts
   - Response:
     ```json
     {
       "alerts": [
         {
           "id": "alert-123",
           "severity": "critical",
           "metric": "p95_latency",
           "message": "Latency exceeded threshold",
           "value": 500,
           "threshold": 300,
           "status": "active",
           "triggeredAt": "2025-10-13T10:00:00Z"
         }
       ]
     }
     ```

5. **`POST /api/admin/alerts/{id}/acknowledge`**
   - Acknowledges an alert

6. **`POST /api/admin/alerts/{id}/resolve`**
   - Resolves an alert

7. **`GET /api/admin/jobs`**
   - Returns jobs and metrics
   - Response:
     ```json
     {
       "jobs": [...],
       "metrics": {
         "pending": 5,
         "processing": 2,
         "completed": 100,
         "failed": 3,
         "totalJobs": 110
       }
     }
     ```

8. **`POST /api/admin/jobs/{id}/retry`**
   - Retries a failed job

## UI/UX Decisions

### Design Patterns

1. **Mobile-First Responsive Design**
   - Grid layouts collapse gracefully on mobile
   - Tables use horizontal scroll on small screens
   - Cards stack vertically on mobile

2. **Loading States**
   - Skeleton loaders for initial page load
   - Inline loading indicators for component refreshes
   - Shimmer effects for better perceived performance

3. **Error Handling**
   - Error boundary for catastrophic failures
   - Inline error messages for component failures
   - Graceful degradation when API is unavailable

4. **Auto-Refresh Strategy**
   - Dashboard: 10s (summary metrics)
   - Real-time metrics: 2s (live data)
   - Alerts: 10s (system alerts)
   - Jobs: 5s (queue status)

5. **Visual Hierarchy**
   - Critical alerts prominently displayed at top
   - Severity colors: Red (critical), Yellow (warning), Blue (info)
   - Icons for quick visual scanning
   - Badge indicators for counts

### Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus indicators
- Color contrast ratios meet WCAG AA standards
- Screen reader friendly status updates

### Color Scheme

Uses shadcn/ui theme tokens for consistency:
- Primary: `hsl(var(--primary))`
- Destructive: `hsl(var(--destructive))`
- Warning: Yellow-500/600
- Success: Green-500/600
- Muted: `hsl(var(--muted))`

## Responsive Design

### Breakpoints (Tailwind defaults)

- **Mobile**: < 640px
  - Single column layout
  - Stacked cards
  - Simplified tables

- **Tablet**: 640px - 1024px
  - 2-column grid for metrics
  - Collapsible sidebar (if applicable)

- **Desktop**: > 1024px
  - 4-column grid for metrics
  - Side-by-side charts
  - Full table display

### Grid Layouts

```typescript
// Metrics cards
"grid gap-4 md:grid-cols-2 lg:grid-cols-4"

// Charts
"grid gap-4 md:grid-cols-2"

// Tables
// Horizontal scroll on mobile via Table component
```

## Performance Considerations

### Optimization Techniques

1. **Memoization**
   - Chart components re-render only when data changes
   - Expensive calculations cached

2. **Debouncing**
   - Time range selector debounced
   - Filter changes debounced

3. **Lazy Loading**
   - Charts load only when tab is active
   - Large tables paginated (future enhancement)

4. **Request Deduplication**
   - Multiple components share metrics endpoint
   - Fetch requests deduplicated via browser cache

5. **Code Splitting**
   - Recharts loaded only when needed
   - Heavy components lazy-loaded

### Bundle Size

- Recharts: ~200KB (already included)
- lucide-react: Icons tree-shaken
- shadcn/ui: Minimal CSS-in-JS

## Testing Checklist

### Manual Testing

- [ ] Dashboard loads without errors
- [ ] Summary cards display correct data
- [ ] Real-time metrics update every 2s
- [ ] Charts render for all time ranges
- [ ] Alerts display by severity
- [ ] Alert actions work (acknowledge, resolve)
- [ ] Jobs table filters correctly
- [ ] Job retry functionality works
- [ ] Loading states appear correctly
- [ ] Error states handled gracefully
- [ ] Responsive on mobile devices
- [ ] Dark mode displays correctly
- [ ] Auto-refresh works without memory leaks

### Automated Testing (Future)

```typescript
// Example test structure
describe('AdminDashboard', () => {
  it('should render summary cards', () => {});
  it('should fetch metrics on mount', () => {});
  it('should handle API errors', () => {});
  it('should update metrics on interval', () => {});
});
```

## Usage

### Accessing the Dashboard

```typescript
// Navigate to:
/admin

// Or link from navbar:
<Link href="/admin">Admin Dashboard</Link>
```

### Embedding Components

```typescript
// Use RealTimeMetrics elsewhere
import RealTimeMetrics from '@/app/(dashboard)/admin/components/RealTimeMetrics';

<RealTimeMetrics />
```

```typescript
// Use MetricsChart standalone
import MetricsChart from '@/app/(dashboard)/admin/components/MetricsChart';

<MetricsChart
  metric="search_latency"
  timeRange="24h"
  chartType="line"
  title="Search Performance"
  description="Last 24 hours"
/>
```

## Future Enhancements

### Planned Features

1. **Quotas Tab**
   - Per-org quota usage
   - Billing integration
   - Usage forecasting

2. **User Management**
   - User activity logs
   - Role management
   - Session monitoring

3. **Export Functionality**
   - Export metrics to CSV
   - Download chart data
   - PDF reports

4. **Custom Alerts**
   - Create custom alert rules
   - Notification channels (email, Slack)
   - Alert history

5. **Advanced Analytics**
   - Cohort analysis
   - Funnel visualization
   - A/B test results

6. **Performance Profiling**
   - Query performance insights
   - Slow query analysis
   - Database optimization suggestions

## Troubleshooting

### Common Issues

**Issue: Metrics not updating**
- Check API routes are implemented
- Verify network requests in DevTools
- Check browser console for errors

**Issue: Charts not rendering**
- Verify recharts is installed: `yarn add recharts`
- Check data format matches expected structure
- Inspect ResponsiveContainer parent has height

**Issue: High memory usage**
- Auto-refresh intervals may be too aggressive
- Clear intervals on component unmount
- Reduce data retention in state

**Issue: Slow initial load**
- Implement server-side data fetching
- Add route-level caching
- Optimize API query performance

## Dependencies

### NPM Packages

- `react` (^19.2.0)
- `react-dom` (^19.2.0)
- `next` (^15.x)
- `recharts` (^3.2.1) - Charts
- `lucide-react` - Icons
- `@radix-ui/react-tabs` - Tabs component
- `@radix-ui/react-dialog` - Modals
- `class-variance-authority` - Variant management
- `tailwindcss` - Styling

### Internal Dependencies

- `@/app/components/ui/*` - shadcn/ui components
- `@/lib/utils/cn` - Class name utility

## License

Part of the Record project. See root LICENSE file.

## Contact

For questions or issues, please open a GitHub issue or contact the development team.
