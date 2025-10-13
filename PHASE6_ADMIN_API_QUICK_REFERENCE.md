# Phase 6 Admin API - Quick Reference Guide

## Authentication

All endpoints require admin privileges (owner or admin role).

**Headers Required**:
```
Authorization: Bearer <clerk-token>
```

## Endpoints

### 1. System Metrics

```http
GET /api/admin/metrics?timeRange=24h
```

**Query Parameters**:
- `timeRange`: `1h` | `24h` | `7d` | `30d` (default: `24h`)

**Response**: System-wide metrics (search, cache, jobs, quotas, alerts)

---

### 2. Analytics

```http
GET /api/admin/analytics?timeRange=7d&metric=all&granularity=day
```

**Query Parameters**:
- `timeRange`: `24h` | `7d` | `30d` | `90d` (default: `7d`)
- `metric`: `searches` | `latency` | `cache` | `usage` | `all` (default: `all`)
- `orgId`: UUID (optional - filter to specific org)
- `granularity`: `hour` | `day` | `week` (default: `day`)

**Response**: Time-series analytics data

---

### 3. Quota Management

#### List Organizations
```http
GET /api/admin/quotas?nearLimit=true&limitThreshold=0.9&page=1&limit=50
```

**Query Parameters**:
- `planTier`: `free` | `starter` | `professional` | `enterprise` (optional)
- `nearLimit`: `true` | `false` (default: `false`)
- `limitThreshold`: 0.0-1.0 (default: 0.9)
- `page`: number (default: 1)
- `limit`: number (default: 50)

#### Update Quota
```http
POST /api/admin/quotas
Content-Type: application/json

{
  "orgId": "uuid",
  "planTier": "professional",
  "searchesPerMonth": 10000,
  "storageGb": 100,
  "recordingsPerMonth": 1000,
  "aiRequestsPerMonth": 5000,
  "connectorsAllowed": 10,
  "apiRateLimit": 100,
  "searchRateLimit": 20
}
```

#### Reset Quota Usage
```http
PUT /api/admin/quotas/reset
Content-Type: application/json

{
  "orgId": "uuid",
  "quotaType": "search" // or "recording", "ai", "all"
}
```

---

### 4. Alert Management

#### List Incidents
```http
GET /api/admin/alerts?status=open&severity=critical&page=1&limit=50
```

**Query Parameters**:
- `status`: `open` | `acknowledged` | `resolved` (optional)
- `severity`: `info` | `warning` | `critical` (optional)
- `page`: number (default: 1)
- `limit`: number (default: 50)

#### Acknowledge Alert
```http
POST /api/admin/alerts/acknowledge
Content-Type: application/json

{
  "incidentId": "uuid",
  "notes": "Investigating root cause..."
}
```

#### Resolve Alert
```http
PUT /api/admin/alerts/resolve
Content-Type: application/json

{
  "incidentId": "uuid",
  "notes": "Fixed by restarting service"
}
```

---

### 5. A/B Testing Experiments

#### List Experiments
```http
GET /api/admin/experiments?status=running&feature=reranking&page=1&limit=50
```

**Query Parameters**:
- `status`: `draft` | `running` | `paused` | `completed` (optional)
- `feature`: `search_ranking` | `chunking` | `reranking` | `all` (optional)
- `page`: number (default: 1)
- `limit`: number (default: 50)

#### Create Experiment
```http
POST /api/admin/experiments
Content-Type: application/json

{
  "name": "Test New Chunking Strategy",
  "description": "Comparing semantic vs fixed chunking",
  "feature": "chunking",
  "variants": [
    {
      "name": "control",
      "config": { "strategy": "fixed", "size": 512 }
    },
    {
      "name": "semantic",
      "config": { "strategy": "semantic", "threshold": 0.7 }
    }
  ],
  "trafficAllocation": {
    "control": 0.5,
    "semantic": 0.5
  }
}
```

#### Update Experiment
```http
PUT /api/admin/experiments
Content-Type: application/json

{
  "experimentId": "uuid",
  "status": "paused",
  "description": "Updated description...",
  "trafficAllocation": {
    "control": 0.3,
    "semantic": 0.7
  }
}
```

#### Delete Experiment
```http
DELETE /api/admin/experiments?experimentId=uuid
```

**Note**: Can only delete `draft` or `completed` experiments. Must pause `running` experiments first.

---

## Response Format

### Success Response
```json
{
  "data": { ... },
  "requestId": "req_1234567890_abcdef"
}
```

### Error Response
```json
{
  "code": "FORBIDDEN",
  "message": "Admin privileges required",
  "details": {},
  "requestId": "req_1234567890_abcdef"
}
```

## HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not authorized (not admin)
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limited
- `500 Internal Server Error` - Server error

## Common Error Codes

- `UNAUTHORIZED` - No valid session
- `FORBIDDEN` - Not admin/owner
- `BAD_REQUEST` - Invalid parameters
- `VALIDATION_ERROR` - Schema validation failed
- `NOT_FOUND` - Resource doesn't exist
- `INTERNAL_ERROR` - Server error
- `RATE_LIMIT_EXCEEDED` - Too many requests

## Usage Examples

### cURL

```bash
# Get metrics
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.example.com/api/admin/metrics?timeRange=24h"

# Update quota
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"orgId":"uuid","searchesPerMonth":10000}' \
  "https://api.example.com/api/admin/quotas"
```

### JavaScript/TypeScript

```typescript
// Fetch metrics
const response = await fetch('/api/admin/metrics?timeRange=24h', {
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
  },
});

const { data } = await response.json();

// Update quota
const response = await fetch('/api/admin/quotas', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${clerkToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    orgId: 'uuid',
    searchesPerMonth: 10000,
  }),
});

const { data } = await response.json();
```

### React Hook Example

```typescript
import { useAuth } from '@clerk/nextjs';

function useAdminMetrics(timeRange: string) {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const token = await getToken();
        const response = await fetch(
          `/api/admin/metrics?timeRange=${timeRange}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch metrics');
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchMetrics();
  }, [timeRange, getToken]);

  return { data, loading, error };
}
```

## Best Practices

### 1. Always Handle Errors
```typescript
try {
  const response = await fetch('/api/admin/metrics');
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.code, error.message);
  }
} catch (err) {
  console.error('Network Error:', err);
}
```

### 2. Use TypeScript Types
```typescript
interface MetricsResponse {
  timeRange: string;
  generatedAt: string;
  search: {
    totalSearches: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    cacheHitRate: number;
  };
  // ... other fields
}

const { data } = await response.json() as { data: MetricsResponse };
```

### 3. Implement Pagination
```typescript
async function fetchAllOrganizations() {
  let page = 1;
  let hasMore = true;
  const allOrgs = [];

  while (hasMore) {
    const response = await fetch(
      `/api/admin/quotas?page=${page}&limit=50`
    );
    const { data } = await response.json();

    allOrgs.push(...data.organizations);
    hasMore = data.pagination.hasMore;
    page++;
  }

  return allOrgs;
}
```

### 4. Cache Responses
```typescript
// Use SWR or React Query for automatic caching
import useSWR from 'swr';

function useMetrics(timeRange: string) {
  const { data, error } = useSWR(
    `/api/admin/metrics?timeRange=${timeRange}`,
    fetcher,
    { refreshInterval: 60000 } // Refresh every minute
  );

  return { data, loading: !data && !error, error };
}
```

## Rate Limits

**Current**: Not implemented (uses global limits)
**Recommended**:
- Metrics: 60 requests/minute
- Analytics: 30 requests/minute
- Quotas: 100 requests/minute
- Alerts: 100 requests/minute
- Experiments: 60 requests/minute

## Support

For issues or questions:
1. Check error response details
2. Verify admin role in organization
3. Review request ID in logs
4. Check database constraints

## Related Documentation

- [Phase 6 Implementation Report](./PHASE6_ADMIN_API_IMPLEMENTATION_REPORT.md)
- [Phase 6 Summary](./PHASE6_ADMIN_API_SUMMARY.md)
- [Database Schema](./supabase/migrations/027_phase6_analytics_polish.sql)
- [API Utilities](./lib/utils/api.ts)
- [Validation Schemas](./lib/validations/api.ts)
