# Phase 6 Admin Dashboard - Architecture Diagram

## Component Hierarchy

```
AdminDashboardPage (page.tsx)
├── Header Section
│   ├── Icon (Server)
│   ├── Title: "Admin Dashboard"
│   └── Description: "System monitoring and analytics"
│
├── Critical Alerts Banner (conditional)
│   └── Alert (variant: destructive)
│       ├── AlertTriangle Icon
│       ├── AlertTitle
│       └── AlertDescription
│
├── Summary Cards Grid (4 columns on desktop)
│   ├── Card 1: Total Searches
│   ├── Card 2: P95 Latency
│   ├── Card 3: Cache Hit Rate
│   └── Card 4: Active Jobs
│
└── Tabs Component
    ├── TabsList
    │   ├── TabsTrigger: Real-Time
    │   ├── TabsTrigger: Analytics
    │   ├── TabsTrigger: Job Queue
    │   └── TabsTrigger: Alerts (with badge)
    │
    ├── TabsContent: Real-Time
    │   ├── RealTimeMetrics Component
    │   │   ├── Header
    │   │   ├── Live Badge
    │   │   └── Metrics Grid (4 columns)
    │   │       ├── MetricCard: Active Searches
    │   │       ├── MetricCard: QPS
    │   │       ├── MetricCard: Avg Latency
    │   │       └── MetricCard: Cache Hit Rate
    │   │
    │   └── Quick Charts Grid (2 columns)
    │       ├── MetricsChart: Search Latency
    │       └── MetricsChart: Cache Performance
    │
    ├── TabsContent: Analytics
    │   ├── Header with Time Range Selector
    │   │   └── Buttons: 1h, 24h, 7d, 30d
    │   │
    │   └── Charts Grid
    │       ├── MetricsChart: Search Volume (full width)
    │       ├── Grid (2 columns)
    │       │   ├── MetricsChart: P95 Latency
    │       │   └── MetricsChart: P99 Latency
    │       ├── Grid (2 columns)
    │       │   ├── MetricsChart: Cache Hit Rate
    │       │   └── MetricsChart: Reranking Usage
    │       └── MetricsChart: Embedding Generation (full width)
    │
    ├── TabsContent: Job Queue
    │   └── JobsQueue Component
    │       ├── Header with Refresh Button
    │       ├── Metrics Cards Grid (4 columns)
    │       │   ├── Card: Pending Jobs
    │       │   ├── Card: Processing Jobs
    │       │   ├── Card: Completed Jobs
    │       │   └── Card: Failed Jobs
    │       ├── Filter Tabs
    │       │   ├── Button: All
    │       │   ├── Button: Pending
    │       │   ├── Button: Processing
    │       │   └── Button: Failed
    │       └── Jobs Table
    │           ├── TableHeader
    │           └── TableBody
    │               └── TableRow (per job)
    │                   ├── Status Cell (icon + badge)
    │                   ├── Type Cell
    │                   ├── Attempts Cell
    │                   ├── Created Cell
    │                   ├── Duration Cell
    │                   └── Actions Cell (retry button)
    │
    └── TabsContent: Alerts
        └── AlertsList Component
            ├── Header with Status Badge
            ├── Critical Alerts Section
            │   └── Alert (variant: destructive)
            │       ├── Metric Name + Status Badge
            │       ├── Message + Value/Threshold
            │       ├── Timestamp
            │       └── Actions
            │           ├── Acknowledge Button
            │           └── Resolve Button
            ├── Warning Alerts Section
            │   └── Alert (variant: warning)
            │       └── [same structure as critical]
            ├── Info Alerts Section
            │   └── Alert (variant: default)
            │       └── [same structure as critical]
            ├── All Clear Alert (conditional)
            │   └── Alert (variant: success)
            └── Acknowledged/Resolved Section (expandable)
                └── details element
                    └── Alert items (muted)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    AdminDashboardPage                        │
│                                                               │
│  useEffect (10s interval)                                    │
│  └─> fetch('/api/admin/metrics')                            │
│      └─> setSummary(data)                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           ├─> Summary Cards (display data)
           └─> Critical Alerts Banner (conditional)

┌─────────────────────────────────────────────────────────────┐
│                   RealTimeMetrics                            │
│                                                               │
│  useEffect (2s interval)                                     │
│  └─> fetch('/api/admin/metrics/realtime')                   │
│      ├─> setPreviousMetrics(metrics)                        │
│      ├─> setMetrics(data)                                   │
│      └─> calculateTrends()                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           └─> 4 Metric Cards (with trend indicators)

┌─────────────────────────────────────────────────────────────┐
│                    MetricsChart                              │
│                                                               │
│  Props: metric, timeRange, chartType                        │
│                                                               │
│  useEffect (depends on metric + timeRange)                  │
│  └─> fetch(`/api/admin/analytics?metric=${metric}&...`)    │
│      └─> setData(response.data)                            │
│                                                               │
│  renderChart()                                               │
│  ├─> LineChart (line)                                       │
│  ├─> AreaChart (area)                                       │
│  └─> BarChart (bar)                                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           └─> Recharts ResponsiveContainer

┌─────────────────────────────────────────────────────────────┐
│                     AlertsList                               │
│                                                               │
│  useEffect (10s interval)                                    │
│  └─> fetch('/api/admin/alerts')                            │
│      └─> setAlerts(data.alerts)                            │
│                                                               │
│  handleAcknowledge(alertId)                                 │
│  └─> POST `/api/admin/alerts/${alertId}/acknowledge`       │
│      └─> fetchAlerts() (refresh)                           │
│                                                               │
│  handleResolve(alertId)                                     │
│  └─> POST `/api/admin/alerts/${alertId}/resolve`           │
│      └─> fetchAlerts() (refresh)                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           ├─> Group by severity
           ├─> Group by status
           └─> Render alert sections

┌─────────────────────────────────────────────────────────────┐
│                      JobsQueue                               │
│                                                               │
│  useEffect (5s interval)                                     │
│  └─> fetch('/api/admin/jobs')                              │
│      ├─> setJobs(data.jobs)                                │
│      └─> setMetrics(data.metrics)                          │
│                                                               │
│  handleRetry(jobId)                                         │
│  └─> POST `/api/admin/jobs/${jobId}/retry`                 │
│      └─> fetchJobs() (refresh)                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
           │
           ├─> Metrics Cards (display counts)
           ├─> Filter jobs by status
           └─> Render jobs table
```

---

## API Integration Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ GET /api/admin/metrics (10s)
       │ ┌────────────────────────────┐
       ├─┤ Dashboard Summary          │
       │ │ - totalSearches            │
       │ │ - p95Latency               │
       │ │ - cacheHitRate             │
       │ │ - activeJobs               │
       │ │ - criticalAlerts           │
       │ └────────────────────────────┘
       │
       │ GET /api/admin/metrics/realtime (2s)
       │ ┌────────────────────────────┐
       ├─┤ Real-Time Metrics          │
       │ │ - activeSearches           │
       │ │ - qps                      │
       │ │ - avgLatency               │
       │ │ - cacheHitRate             │
       │ │ - timestamp                │
       │ └────────────────────────────┘
       │
       │ GET /api/admin/analytics?metric={}&timeRange={} (on demand)
       │ ┌────────────────────────────┐
       ├─┤ Time-Series Data           │
       │ │ - Array of { timestamp,    │
       │ │   value }                  │
       │ └────────────────────────────┘
       │
       │ GET /api/admin/alerts (10s)
       │ ┌────────────────────────────┐
       ├─┤ System Alerts              │
       │ │ - Array of AlertItem       │
       │ └────────────────────────────┘
       │
       │ POST /api/admin/alerts/{id}/acknowledge
       │ POST /api/admin/alerts/{id}/resolve
       │
       │ GET /api/admin/jobs (5s)
       │ ┌────────────────────────────┐
       ├─┤ Job Queue                  │
       │ │ - jobs: Array<Job>         │
       │ │ - metrics: {               │
       │ │     pending, processing,   │
       │ │     completed, failed      │
       │ │   }                        │
       │ └────────────────────────────┘
       │
       │ POST /api/admin/jobs/{id}/retry
       │
       ▼
┌──────────────┐
│  API Routes  │
│  (To Be      │
│  Implemented)│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Database    │
│  - system_   │
│    metrics   │
│  - system_   │
│    alerts    │
│  - jobs      │
└──────────────┘
```

---

## State Management Flow

### AdminDashboardPage

```typescript
// Initial State
{
  summary: null,        // Dashboard summary
  loading: true,        // Loading state
  timeRange: '24h'      // Selected time range
}

// Lifecycle
1. Component mounts
2. useEffect: Set document title
3. useEffect: Fetch summary
   - setLoading(false)
   - setSummary(data)
4. Set interval: Fetch every 10s
5. Component unmounts → Clear interval
```

### RealTimeMetrics

```typescript
// Initial State
{
  metrics: null,           // Current metrics
  previousMetrics: null,   // Previous for trend calculation
  loading: true,
  error: null
}

// Lifecycle
1. Component mounts
2. fetchMetrics()
   - setPreviousMetrics(metrics)
   - setMetrics(data)
   - setLoading(false)
3. Set interval: Fetch every 2s
4. calculateTrend(current, previous)
5. Component unmounts → Clear interval
```

### MetricsChart

```typescript
// Initial State
{
  data: [],          // Time-series data
  loading: true,
  error: null
}

// Lifecycle
1. Component mounts
2. useEffect(metric, timeRange changed)
   - setLoading(true)
   - fetch data
   - setData(response.data)
   - setLoading(false)
3. No interval (fetch on demand)
```

### AlertsList

```typescript
// Initial State
{
  alerts: [],
  loading: true,
  error: null,
  actionLoading: null    // ID of alert being acted upon
}

// Lifecycle
1. Component mounts
2. fetchAlerts()
3. Set interval: Fetch every 10s (configurable)
4. handleAcknowledge(alertId)
   - setActionLoading(alertId)
   - POST acknowledge
   - fetchAlerts()
   - setActionLoading(null)
5. handleResolve(alertId)
   - Similar to acknowledge
6. Component unmounts → Clear interval
```

### JobsQueue

```typescript
// Initial State
{
  jobs: [],
  metrics: null,
  loading: true,
  error: null,
  retryingJob: null,     // ID of job being retried
  filter: 'all'          // Current filter
}

// Lifecycle
1. Component mounts
2. fetchJobs()
   - setJobs(data.jobs)
   - setMetrics(data.metrics)
3. Set interval: Fetch every 5s
4. handleRetry(jobId)
   - setRetryingJob(jobId)
   - POST retry
   - fetchJobs()
   - setRetryingJob(null)
5. setFilter() → Re-render with filtered jobs
6. Component unmounts → Clear interval
```

---

## Responsive Breakpoint Behavior

### Mobile (< 640px)

```
┌─────────────────────────────────┐
│  Summary Card 1                 │
├─────────────────────────────────┤
│  Summary Card 2                 │
├─────────────────────────────────┤
│  Summary Card 3                 │
├─────────────────────────────────┤
│  Summary Card 4                 │
├─────────────────────────────────┤
│  Tabs (horizontal scroll)       │
├─────────────────────────────────┤
│  Chart 1                        │
├─────────────────────────────────┤
│  Chart 2                        │
├─────────────────────────────────┤
│  Table (horizontal scroll)      │
└─────────────────────────────────┘
```

### Tablet (640px - 1024px)

```
┌────────────────┬────────────────┐
│  Summary 1     │  Summary 2     │
├────────────────┼────────────────┤
│  Summary 3     │  Summary 4     │
├────────────────┴────────────────┤
│  Tabs                            │
├────────────────┬────────────────┤
│  Chart 1       │  Chart 2       │
├────────────────┴────────────────┤
│  Table                           │
└──────────────────────────────────┘
```

### Desktop (> 1024px)

```
┌────────┬────────┬────────┬────────┐
│ Sum 1  │ Sum 2  │ Sum 3  │ Sum 4  │
├────────┴────────┴────────┴────────┤
│  Tabs                              │
├────────┬────────┬────────┬────────┤
│ Metric │ Metric │ Metric │ Metric │
│ Card 1 │ Card 2 │ Card 3 │ Card 4 │
├────────┴────────┼────────┴────────┤
│  Chart 1        │  Chart 2        │
├─────────────────┴─────────────────┤
│  Full Width Chart                 │
├───────────────────────────────────┤
│  Table                             │
└───────────────────────────────────┘
```

---

## Performance Optimization Strategy

### 1. Request Optimization

```
┌─────────────────────────────────────────────────────┐
│  Browser Cache                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │  /api/admin/metrics (TTL: 10s)                │ │
│  │  /api/admin/analytics (TTL: 60s)              │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  API Layer (Next.js)                                 │
│  ┌───────────────────────────────────────────────┐ │
│  │  Deduplicate concurrent requests              │ │
│  │  Return cached response if within TTL         │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Redis Cache                                         │
│  ┌───────────────────────────────────────────────┐ │
│  │  metrics:summary → { ... } (TTL: 10s)         │ │
│  │  metrics:realtime → { ... } (No cache)        │ │
│  │  analytics:{metric}:{range} → [...] (60s)     │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Database (Supabase PostgreSQL)                      │
└─────────────────────────────────────────────────────┘
```

### 2. Component Rendering

```
Initial Load:
1. Skeleton loaders (loading.tsx)
2. Fetch all data in parallel
3. Components render with data

Subsequent Updates:
1. In-place spinners (small)
2. Fetch in background
3. Update without layout shift
```

### 3. Memory Management

```typescript
// Cleanup intervals on unmount
useEffect(() => {
  const interval = setInterval(fetchData, refreshRate);
  return () => clearInterval(interval);  // ✅ Prevents memory leaks
}, []);

// Memoize expensive calculations
const trends = useMemo(
  () => calculateTrends(current, previous),
  [current, previous]
);

// Conditional rendering
{data.length > 0 && <Chart data={data} />}  // ✅ Don't render empty charts
```

---

## Error Handling Strategy

```
┌─────────────────────────────────────────────────────┐
│  Error Boundary (error.tsx)                         │
│  Catches: Component errors, render failures         │
│  Action: Display error page with reset button       │
└─────────────────────────────────────────────────────┘
                      │
                      │ Error not caught
                      ▼
┌─────────────────────────────────────────────────────┐
│  Component Error Handling                            │
│  Catches: API errors, fetch failures                 │
│  Action: Display inline error message + retry       │
└─────────────────────────────────────────────────────┘
                      │
                      │ Error continues
                      ▼
┌─────────────────────────────────────────────────────┐
│  Graceful Degradation                                │
│  Show: Empty state with explanation                  │
│  Allow: Other components continue to function        │
└─────────────────────────────────────────────────────┘
```

### Error Examples

```typescript
// API Error (Component Level)
try {
  const response = await fetch('/api/admin/metrics');
  if (!response.ok) throw new Error('Failed to fetch');
  setData(response.json());
} catch (err) {
  setError(err.message);  // Show inline error
}

// Render Error (Boundary)
<ErrorBoundary fallback={<ErrorPage />}>
  <AdminDashboard />
</ErrorBoundary>

// Empty State (Graceful)
{data.length === 0 ? (
  <EmptyState message="No data available" />
) : (
  <Chart data={data} />
)}
```

---

## Future Architecture Considerations

### WebSocket Integration (Phase 7+)

```
Current (Polling):
Browser → API → DB (every 2s)

Future (WebSocket):
Browser ←→ WebSocket Server ←→ DB
         (Push updates in real-time)

Benefits:
- Lower latency
- Reduced server load
- True real-time updates
- Better scalability
```

### Component Code Splitting

```typescript
// Current: All components loaded upfront

// Future: Lazy load tab content
const RealTimeMetrics = lazy(() => import('./components/RealTimeMetrics'));
const JobsQueue = lazy(() => import('./components/JobsQueue'));

<Suspense fallback={<Loading />}>
  {activeTab === 'realtime' && <RealTimeMetrics />}
  {activeTab === 'jobs' && <JobsQueue />}
</Suspense>
```

### Server Components (Next.js 15)

```typescript
// Current: All client components

// Future: Mixed client/server
export default async function AdminPage() {
  // Server-side data fetching
  const summary = await getMetricsSummary();

  return (
    <>
      <SummaryCards data={summary} />  {/* Server */}
      <RealTimeMetrics />               {/* Client */}
    </>
  );
}
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────┐
│  Middleware (middleware.ts)                          │
│  ┌───────────────────────────────────────────────┐ │
│  │  Route: /admin/*                              │ │
│  │  Check: Clerk authentication                  │ │
│  │  Redirect: → /sign-in if not authenticated    │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  API Routes (/api/admin/*)                           │
│  ┌───────────────────────────────────────────────┐ │
│  │  requireOrg()                                 │ │
│  │  ├─> Get userId, orgId, role from Clerk      │ │
│  │  └─> Check role === 'owner' || 'admin'       │ │
│  │      └─> Throw 403 if not authorized         │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│  Database (Supabase)                                 │
│  ┌───────────────────────────────────────────────┐ │
│  │  RLS Policies: org_id check                   │ │
│  │  Service Role: Bypass RLS (admin client)      │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Role-Based Access

```typescript
// API Route Protection
export const GET = apiHandler(async (request) => {
  const { userId, orgId, role } = await requireOrg();

  // Only owners and admins can access
  if (role !== 'owner' && role !== 'admin') {
    throw errors.forbidden('Admin access required');
  }

  // Proceed with data fetching
});
```

---

**Document Version:** 1.0
**Last Updated:** October 13, 2025
**Status:** Complete
