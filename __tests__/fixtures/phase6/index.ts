/**
 * Phase 6 Test Fixtures
 * Centralized test data for Phase 6 features
 */

export const cacheData = {
  searchResult: {
    key: 'search:org_123:test query',
    value: [
      {
        id: 'chunk_1',
        content: 'This is a cached search result',
        similarity: 0.95,
        recording_id: 'rec_1',
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'chunk_2',
        content: 'Another cached result',
        similarity: 0.87,
        recording_id: 'rec_1',
        created_at: '2024-01-01T00:00:00Z',
      },
    ],
  },
  ttl: 300, // 5 minutes
};

export const analyticsData = {
  searchAnalytics: [
    {
      id: 'search_1',
      org_id: 'org_123',
      user_id: 'user_123',
      query: 'how to deploy',
      result_count: 5,
      latency_ms: 150,
      cache_hit: false,
      search_type: 'semantic',
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'search_2',
      org_id: 'org_123',
      user_id: 'user_123',
      query: 'authentication setup',
      result_count: 3,
      latency_ms: 200,
      cache_hit: false,
      search_type: 'semantic',
      created_at: '2024-01-01T10:05:00Z',
    },
    {
      id: 'search_3',
      org_id: 'org_123',
      user_id: 'user_456',
      query: 'how to deploy',
      result_count: 5,
      latency_ms: 25,
      cache_hit: true,
      search_type: 'semantic',
      created_at: '2024-01-01T10:10:00Z',
    },
  ],

  searchFeedback: [
    {
      id: 'feedback_1',
      search_id: 'search_1',
      result_id: 'chunk_1',
      feedback_type: 'relevant',
      rating: 5,
      created_at: '2024-01-01T10:01:00Z',
    },
    {
      id: 'feedback_2',
      search_id: 'search_1',
      result_id: 'chunk_2',
      feedback_type: 'irrelevant',
      rating: 1,
      created_at: '2024-01-01T10:02:00Z',
    },
    {
      id: 'feedback_3',
      search_id: 'search_2',
      result_id: 'chunk_3',
      feedback_type: 'clicked',
      rating: null,
      created_at: '2024-01-01T10:06:00Z',
    },
  ],

  metrics: {
    latency: {
      p50: 100,
      p95: 300,
      p99: 500,
      avg: 125,
    },
    cacheHitRate: 33.33, // 1 out of 3 searches
    totalSearches: 1000,
  },

  popularQueries: [
    {
      query: 'how to deploy',
      search_count: 150,
      avg_latency: 120,
    },
    {
      query: 'authentication setup',
      search_count: 100,
      avg_latency: 180,
    },
    {
      query: 'database migration',
      search_count: 75,
      avg_latency: 200,
    },
  ],
};

export const quotaData = {
  usageCounters: {
    starter: {
      org_id: 'org_starter',
      api_calls_used: 500,
      api_calls_limit: 1000,
      storage_used: 512 * 1024 * 1024, // 512 MB
      storage_limit: 1024 * 1024 * 1024, // 1 GB
      recordings_used: 5,
      recordings_limit: 10,
      reset_at: '2024-02-01T00:00:00Z',
    },
    pro: {
      org_id: 'org_pro',
      api_calls_used: 5000,
      api_calls_limit: 10000,
      storage_used: 5 * 1024 * 1024 * 1024, // 5 GB
      storage_limit: 10 * 1024 * 1024 * 1024, // 10 GB
      recordings_used: 50,
      recordings_limit: 100,
      reset_at: '2024-02-01T00:00:00Z',
    },
    enterprise: {
      org_id: 'org_enterprise',
      api_calls_used: 50000,
      api_calls_limit: 100000,
      storage_used: 50 * 1024 * 1024 * 1024, // 50 GB
      storage_limit: 100 * 1024 * 1024 * 1024, // 100 GB
      recordings_used: 500,
      recordings_limit: 1000,
      reset_at: '2024-02-01T00:00:00Z',
    },
    exceeded: {
      org_id: 'org_exceeded',
      api_calls_used: 1000,
      api_calls_limit: 1000,
      storage_used: 1024 * 1024 * 1024,
      storage_limit: 1024 * 1024 * 1024,
      recordings_used: 10,
      recordings_limit: 10,
      reset_at: '2024-02-01T00:00:00Z',
    },
  },

  planLimits: {
    starter: {
      api_calls: 1000,
      storage: 1024 * 1024 * 1024, // 1 GB
      recordings: 10,
    },
    pro: {
      api_calls: 10000,
      storage: 10 * 1024 * 1024 * 1024, // 10 GB
      recordings: 100,
    },
    enterprise: {
      api_calls: 100000,
      storage: 100 * 1024 * 1024 * 1024, // 100 GB
      recordings: 1000,
    },
  },
};

export const experimentData = {
  experiments: [
    {
      id: 'exp_1',
      name: 'Search Algorithm Test',
      description: 'Testing new semantic search algorithm',
      is_active: true,
      variants: ['control', 'variant_a', 'variant_b'],
      traffic_allocation: { control: 50, variant_a: 25, variant_b: 25 },
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'exp_2',
      name: 'Reranking Model Test',
      description: 'Testing ML-based reranking',
      is_active: true,
      variants: ['control', 'ml_rerank'],
      traffic_allocation: { control: 70, ml_rerank: 30 },
      created_at: '2024-01-05T00:00:00Z',
    },
  ],

  assignments: [
    {
      id: 'assign_1',
      experiment_id: 'exp_1',
      user_id: 'user_123',
      variant: 'control',
      assigned_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'assign_2',
      experiment_id: 'exp_1',
      user_id: 'user_456',
      variant: 'variant_a',
      assigned_at: '2024-01-01T10:05:00Z',
    },
  ],

  metrics: [
    {
      id: 'metric_1',
      experiment_id: 'exp_1',
      variant: 'control',
      metric_name: 'search_latency',
      value: 150,
      user_id: 'user_123',
      recorded_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'metric_2',
      experiment_id: 'exp_1',
      variant: 'variant_a',
      metric_name: 'search_latency',
      value: 120,
      user_id: 'user_456',
      recorded_at: '2024-01-01T10:05:00Z',
    },
  ],

  results: {
    exp_1: {
      control: {
        mean: 150,
        stddev: 25,
        count: 500,
      },
      variant_a: {
        mean: 120,
        stddev: 20,
        count: 250,
      },
      variant_b: {
        mean: 140,
        stddev: 22,
        count: 250,
      },
    },
  },
};

export const adminMetrics = {
  systemMetrics: {
    totalSearches: 10000,
    cacheHitRate: 65.5,
    avgLatency: 125,
    p95Latency: 300,
    p99Latency: 500,
    activeUsers: 150,
    activeOrganizations: 25,
    totalQuotaUsage: 75.2,
    redisStatus: 'healthy',
    databaseStatus: 'healthy',
    timestamp: '2024-01-15T12:00:00Z',
  },

  quotaSummary: [
    {
      org_id: 'org_1',
      org_name: 'Acme Corp',
      plan: 'pro',
      api_calls_percent: 65,
      storage_percent: 80,
      recordings_percent: 50,
    },
    {
      org_id: 'org_2',
      org_name: 'Tech Startup',
      plan: 'starter',
      api_calls_percent: 95,
      storage_percent: 70,
      recordings_percent: 90,
    },
  ],

  alerts: [
    {
      id: 'alert_1',
      severity: 'critical',
      message: 'Organization org_2 approaching API quota limit',
      created_at: '2024-01-15T11:30:00Z',
      acknowledged: false,
      resolved: false,
    },
    {
      id: 'alert_2',
      severity: 'warning',
      message: 'Cache hit rate below 50% threshold',
      created_at: '2024-01-15T11:45:00Z',
      acknowledged: true,
      resolved: false,
    },
  ],
};

export const rateLimitData = {
  requests: [
    {
      identifier: 'user_123',
      timestamp: Date.now(),
      score: Date.now(),
    },
    {
      identifier: 'user_123',
      timestamp: Date.now() - 10000,
      score: Date.now() - 10000,
    },
    {
      identifier: 'user_123',
      timestamp: Date.now() - 30000,
      score: Date.now() - 30000,
    },
  ],

  limits: {
    user: 100,
    org: 1000,
    ip: 50,
  },

  windowMs: 60000, // 1 minute
};

// Helper functions for generating test data

export function generateSearchAnalytics(count: number, orgId: string = 'org_123') {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      id: `search_${i}`,
      org_id: orgId,
      user_id: `user_${i % 10}`,
      query: `test query ${i}`,
      result_count: Math.floor(Math.random() * 10),
      latency_ms: Math.floor(Math.random() * 500) + 50,
      cache_hit: Math.random() > 0.5,
      search_type: 'semantic' as const,
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
}

export function generateSearchFeedback(searchIds: string[]) {
  const feedbackTypes: Array<'relevant' | 'irrelevant' | 'clicked'> = [
    'relevant',
    'irrelevant',
    'clicked',
  ];

  return searchIds.flatMap((searchId, i) =>
    Array(Math.floor(Math.random() * 3))
      .fill(null)
      .map((_, j) => ({
        id: `feedback_${i}_${j}`,
        search_id: searchId,
        result_id: `chunk_${j}`,
        feedback_type: feedbackTypes[j % feedbackTypes.length],
        rating: feedbackTypes[j % feedbackTypes.length] === 'relevant' ? 5 : 1,
        created_at: new Date(Date.now() - i * 60000).toISOString(),
      }))
  );
}

export function generateUsageCounters(orgId: string, plan: keyof typeof quotaData.planLimits) {
  const limits = quotaData.planLimits[plan];
  return {
    org_id: orgId,
    api_calls_used: Math.floor(limits.api_calls * Math.random()),
    api_calls_limit: limits.api_calls,
    storage_used: Math.floor(limits.storage * Math.random()),
    storage_limit: limits.storage,
    recordings_used: Math.floor(limits.recordings * Math.random()),
    recordings_limit: limits.recordings,
    reset_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Next month
  };
}

export function generateExperimentMetrics(
  experimentId: string,
  variants: string[],
  count: number
) {
  return variants.flatMap(variant =>
    Array(count)
      .fill(null)
      .map((_, i) => ({
        id: `metric_${variant}_${i}`,
        experiment_id: experimentId,
        variant,
        metric_name: 'search_latency',
        value: Math.floor(Math.random() * 300) + 50,
        user_id: `user_${i}`,
        recorded_at: new Date(Date.now() - i * 60000).toISOString(),
      }))
  );
}

// Mock API responses

export const mockApiResponses = {
  searchSuccess: {
    results: [
      {
        id: 'chunk_1',
        content: 'Mock search result content',
        similarity: 0.95,
        recording_id: 'rec_1',
      },
    ],
    cacheHit: false,
    latency: 150,
    quota: {
      used: 501,
      limit: 1000,
      remaining: 499,
    },
  },

  rateLimitExceeded: {
    error: 'Rate limit exceeded. Please try again later.',
    retryAfter: 60,
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'Retry-After': '60',
    },
  },

  quotaExceeded: {
    error: 'API quota exceeded. Please upgrade your plan or wait until quota resets.',
    quota: {
      used: 1000,
      limit: 1000,
      remaining: 0,
      resetAt: '2024-02-01T00:00:00Z',
    },
  },

  metricsSuccess: {
    totalSearches: 10000,
    cacheHitRate: 65.5,
    avgLatency: 125,
    p95Latency: 300,
    p99Latency: 500,
    timeRange: '7d',
  },
};
