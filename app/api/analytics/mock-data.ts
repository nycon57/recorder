/**
 * Mock Data Generators for Analytics API
 *
 * This file contains mock data generators for development and testing.
 * Replace these with real data fetching logic when backend is ready.
 */

export interface AnalyticsMockResult {
  summary: {
    totalStorage: number;
    totalFiles: number;
    totalOrganizations: number;
    totalUsers: number;
  };
  fileTypes: Array<{
    mimeType: string;
    count: number;
    storage: number;
    averageSize: number;
    compressionRate: number;
  }>;
  costs: {
    currentMonth: number;
    lastMonth: number;
    projected: number;
  };
  optimization: {
    compressionRate: number;
    deduplicationSavings: number;
    potentialSavings: number;
  };
  health?: {
    score: number;
    components: Array<{
      name: string;
      status: string;
      health: number;
    }>;
  };
  trends?: {
    storage: Array<{
      date: string;
      storage: number;
      cost: number;
      savings: number;
    }>;
    costs: Array<{
      date: string;
      storage: number;
      cost: number;
      savings: number;
    }>;
    savings: Array<{
      date: string;
      storage: number;
      cost: number;
      savings: number;
    }>;
    growthRate: number;
    costChange: number;
  };
}

export function generateMetrics(includeHealth = false, includeTrends = false, trendDays = 30): AnalyticsMockResult {
  const summary = {
    totalStorage: 52428800000, // 50 GB
    totalFiles: 1250,
    totalOrganizations: 15,
    totalUsers: 145,
  };

  const fileTypes = [
    {
      mimeType: 'video/mp4',
      count: 750,
      storage: 35651584000, // 33 GB
      averageSize: 47535445,
      compressionRate: 42.5,
    },
    {
      mimeType: 'video/webm',
      count: 450,
      storage: 15099494400, // 14 GB
      averageSize: 33554432,
      compressionRate: 38.2,
    },
    {
      mimeType: 'audio/mpeg',
      count: 50,
      storage: 1677721600, // 1.6 GB
      averageSize: 33554432,
      compressionRate: 55.8,
    },
  ];

  const costs = {
    currentMonth: 2450.75,
    lastMonth: 2315.50,
    projected: 2680.25,
  };

  const optimization = {
    compressionRate: 42.3,
    deduplicationSavings: 850,
    potentialSavings: 1250,
  };

  let result: AnalyticsMockResult = {
    summary,
    fileTypes,
    costs,
    optimization,
  };

  if (includeHealth) {
    result.health = {
      score: 87,
      components: [
        { name: 'Database', status: 'healthy', health: 95 },
        { name: 'Storage', status: 'healthy', health: 92 },
        { name: 'API', status: 'healthy', health: 98 },
        { name: 'Jobs', status: 'degraded', health: 75 },
      ],
    };
  }

  if (includeTrends) {
    const trends = {
      storage: [] as Array<{ date: string; storage: number; cost: number; savings: number }>,
      costs: [] as Array<{ date: string; storage: number; cost: number; savings: number }>,
      savings: [] as Array<{ date: string; storage: number; cost: number; savings: number }>,
      growthRate: 8.5,
      costChange: 5.8,
    };

    for (let i = 0; i < trendDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (trendDays - i));
      const dateString = date.toISOString().split('T')[0];

      // Storage trend - focus on storage metric
      trends.storage.push({
        date: dateString,
        storage: 45000000000 + (i * 250000000),
        cost: 2200 + (i * 9),
        savings: 650 + (i * 7),
      });

      // Cost trend - focus on cost metric with different growth pattern
      trends.costs.push({
        date: dateString,
        storage: 45000000000 + (i * 250000000),
        cost: 2000 + (i * 12),
        savings: 650 + (i * 7),
      });

      // Savings trend - focus on savings metric with different growth pattern
      trends.savings.push({
        date: dateString,
        storage: 45000000000 + (i * 250000000),
        cost: 2200 + (i * 9),
        savings: 500 + (i * 10),
      });
    }

    result.trends = trends;
  }

  return result;
}

export function generateDistribution() {
  return {
    tiers: {
      hot: 35651584000,
      warm: 15099494400,
      cold: 1677721600,
      glacier: 0,
    },
    providers: {
      supabase: 50000000000,
      cloudflare_r2: 2428800000,
    },
    tierPercentages: {
      hot: 68,
      warm: 28.8,
      cold: 3.2,
      glacier: 0,
    },
    migration: {
      inProgress: 5,
      pending: 12,
      completed: 145,
      failed: 2,
    },
  };
}

export function generateJobStats() {
  return {
    pending: 8,
    processing: 3,
    completed: 1247,
    failed: 12,
    activeJobs: 11,
    avgProcessingTime: 45.3,
    recentJobs: [
      {
        id: '1',
        type: 'transcribe',
        status: 'processing',
        progress: 65,
        startedAt: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: '2',
        type: 'doc_generate',
        status: 'completed',
        progress: 100,
        startedAt: new Date(Date.now() - 300000).toISOString(),
        completedAt: new Date(Date.now() - 180000).toISOString(),
      },
      {
        id: '3',
        type: 'generate_embeddings',
        status: 'pending',
        progress: 0,
        startedAt: null,
      },
    ],
    byType: [
      { type: 'transcribe', total: 450, success: 445, failed: 5, avgDuration: 125.5, successRate: 98.9 },
      { type: 'doc_generate', total: 420, success: 418, failed: 2, avgDuration: 45.2, successRate: 99.5 },
      { type: 'generate_embeddings', total: 415, success: 410, failed: 5, avgDuration: 32.8, successRate: 98.8 },
    ],
  };
}

export function generateAlerts() {
  return {
    alerts: [
      {
        id: '1',
        severity: 'critical' as const,
        type: 'storage_quota',
        message: 'Storage quota exceeded for Organization "Acme Corp"',
        details: 'Organization has used 102% of allocated storage (51GB / 50GB)',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        acknowledged: false,
      },
      {
        id: '2',
        severity: 'warning' as const,
        type: 'cost_threshold',
        message: 'Monthly cost approaching budget limit',
        details: 'Current spend: $2,450 / Budget: $3,000 (82%)',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
        acknowledged: true,
      },
      {
        id: '3',
        severity: 'info' as const,
        type: 'optimization',
        message: 'New optimization recommendations available',
        details: '5 new recommendations with potential savings of $850/year',
        createdAt: new Date(Date.now() - 14400000).toISOString(),
        acknowledged: false,
      },
    ],
    stats: {
      critical: 1,
      warning: 3,
      info: 2,
      resolved: 45,
    },
  };
}

export function generateAlertConfig() {
  return {
    storageThreshold: 90,
    costThreshold: 1000,
    enableEmailNotifications: true,
    enableSlackNotifications: false,
    checkInterval: 15,
  };
}

export function generateHealth() {
  return {
    overallScore: 87,
    status: 'healthy' as const,
    lastChecked: new Date().toISOString(),
    components: [
      {
        id: '1',
        name: 'Database',
        status: 'healthy' as const,
        health: 95,
        message: 'All connections optimal',
        lastChecked: new Date().toISOString(),
        uptime: 99.8,
      },
      {
        id: '2',
        name: 'Storage Service',
        status: 'healthy' as const,
        health: 92,
        message: 'Operating normally',
        lastChecked: new Date().toISOString(),
        uptime: 99.5,
      },
      {
        id: '3',
        name: 'API Gateway',
        status: 'healthy' as const,
        health: 98,
        message: 'All endpoints responding',
        lastChecked: new Date().toISOString(),
        uptime: 99.9,
      },
      {
        id: '4',
        name: 'Job Processor',
        status: 'degraded' as const,
        health: 75,
        message: 'Higher than normal queue depth',
        lastChecked: new Date().toISOString(),
        uptime: 98.2,
      },
    ],
    performance: {
      apiResponseTime: 145,
      jobProcessingTime: 52,
      storageLatency: 23,
      throughput: 1250,
    },
    services: [
      { name: 'Supabase', status: 'operational' as const, uptime: 99.9, lastChecked: new Date().toISOString() },
      { name: 'OpenAI', status: 'operational' as const, uptime: 99.8, lastChecked: new Date().toISOString() },
      { name: 'Clerk', status: 'operational' as const, uptime: 99.9, lastChecked: new Date().toISOString() },
      { name: 'Cloudflare R2', status: 'operational' as const, uptime: 99.7, lastChecked: new Date().toISOString() },
    ],
  };
}

export function generateRecommendations() {
  return {
    recommendations: [
      {
        id: '1',
        title: 'Migrate old recordings to cold storage',
        description: 'Move recordings older than 90 days to cold storage tier to reduce costs',
        impact: 'high' as const,
        effort: 'low' as const,
        savings: 850,
        timeframe: 'immediate' as const,
        implementation: '1. Identify recordings older than 90 days\n2. Create migration job batch\n3. Monitor migration progress\n4. Verify data integrity',
        status: 'pending' as const,
      },
      {
        id: '2',
        title: 'Enable compression for uncompressed files',
        description: 'Apply compression to 150 uncompressed video files',
        impact: 'high' as const,
        effort: 'low' as const,
        savings: 650,
        timeframe: 'immediate' as const,
        implementation: '1. Queue files for compression\n2. Apply optimal compression settings\n3. Validate quality\n4. Replace originals',
        status: 'pending' as const,
      },
      {
        id: '3',
        title: 'Implement retention policies',
        description: 'Set up automated deletion for recordings older than 2 years',
        impact: 'medium' as const,
        effort: 'medium' as const,
        savings: 425,
        timeframe: 'short-term' as const,
        implementation: '1. Define retention policy rules\n2. Notify affected organizations\n3. Implement soft delete with grace period\n4. Monitor and adjust',
        status: 'pending' as const,
      },
    ],
  };
}

export function generateActionPlan() {
  return {
    immediate: { count: 2 },
    shortTerm: { count: 3 },
    longTerm: { count: 2 },
    totalSavings: 2850,
  };
}

export function generateImplementationTracker() {
  return {
    stats: {
      total: 12,
      completed: 7,
      inProgress: 2,
      pending: 3,
      totalSavingsRealized: 3250,
      completionRate: 58.3,
    },
    inProgress: [
      {
        id: '1',
        title: 'Migrate recordings to cold storage',
        startedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        estimatedCompletion: new Date(Date.now() + 86400000 * 2).toISOString(),
        progress: 65,
        estimatedSavings: 850,
      },
    ],
    recentHistory: [
      {
        id: '1',
        title: 'Enable compression for video files',
        completedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        actualSavings: 720,
        implementationTime: 3,
      },
      {
        id: '2',
        title: 'Implement deduplication',
        completedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
        actualSavings: 1250,
        implementationTime: 7,
      },
    ],
  };
}

export function generateCostOverview() {
  return {
    currentMonth: 2450.75,
    lastMonth: 2315.50,
    yearToDate: 27850.25,
    projectedMonth: 2680.25,
    changePercent: 5.8,
    savingsFromOptimization: 850,
  };
}

export function generateBudget() {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysIntoMonth = now.getDate();

  return {
    monthlyBudget: 3000,
    currentSpend: 2450.75,
    percentUsed: 81.7,
    daysIntoMonth,
    daysInMonth,
    projectedSpend: 2680.25,
    status: 'warning' as const,
    alerts: [
      {
        id: '1',
        message: 'Spending is 12% above pace for this point in the month',
        severity: 'warning' as const,
      },
    ],
  };
}

export function generateCostBreakdown() {
  return {
    byOrganization: [
      { name: 'Acme Corp', cost: 850, percentage: 34.7, trend: 8.2 },
      { name: 'TechStart Inc', cost: 620, percentage: 25.3, trend: 5.1 },
      { name: 'Global Solutions', cost: 480, percentage: 19.6, trend: -2.3 },
      { name: 'Others', cost: 500.75, percentage: 20.4, trend: 3.2 },
    ],
    byTier: [
      { name: 'Hot Storage', cost: 1680, percentage: 68.6, trend: 7.5 },
      { name: 'Warm Storage', cost: 560, percentage: 22.9, trend: 3.2 },
      { name: 'Cold Storage', cost: 210.75, percentage: 8.6, trend: -1.5 },
    ],
    byProvider: [
      { name: 'Supabase Storage', cost: 2200, percentage: 89.8, trend: 5.5 },
      { name: 'Cloudflare R2', cost: 250.75, percentage: 10.2, trend: 12.3 },
    ],
    totalCost: 2450.75,
  };
}

export function generateCostProjections() {
  return {
    currentMonth: 2450.75,
    nextMonth: 2680,
    next3Months: 8250,
    next6Months: 16800,
    nextYear: 34500,
    growthRate: 8.5,
    confidence: 'medium' as const,
    factors: [
      {
        name: 'User Growth',
        impact: 'negative' as const,
        description: '15% increase in active users expected',
      },
      {
        name: 'Cold Storage Migration',
        impact: 'positive' as const,
        description: 'Migration project will reduce hot storage costs',
      },
      {
        name: 'Compression Improvements',
        impact: 'positive' as const,
        description: 'Better compression algorithms being deployed',
      },
    ],
  };
}

export function generateCostAllocation() {
  return {
    entries: [
      {
        organizationId: '550e8400-e29b-41d4-a716-446655440001',
        organizationName: 'Acme Corp',
        totalCost: 850,
        storage: 18000000000, // 18 GB
        tier: 'hot' as const,
        userCount: 45,
        recordingCount: 450,
        costPerUser: 18.89,
        costPerGB: 0.047,
        trend: 8.2,
      },
      {
        organizationId: '550e8400-e29b-41d4-a716-446655440002',
        organizationName: 'TechStart Inc',
        totalCost: 620,
        storage: 13000000000, // 13 GB
        tier: 'hot' as const,
        userCount: 32,
        recordingCount: 325,
        costPerUser: 19.38,
        costPerGB: 0.048,
        trend: 5.1,
      },
      {
        organizationId: '550e8400-e29b-41d4-a716-446655440003',
        organizationName: 'Global Solutions',
        totalCost: 480,
        storage: 11000000000, // 11 GB
        tier: 'warm' as const,
        userCount: 28,
        recordingCount: 280,
        costPerUser: 17.14,
        costPerGB: 0.044,
        trend: -2.3,
      },
    ],
    totalCost: 2450.75,
    period: 'Current Month',
    generatedAt: new Date().toISOString(),
  };
}

export function generateOrgMetrics(organizationId: string) {
  return {
    name: 'Acme Corp',
    totalStorage: 18000000000,
    recordingCount: 450,
    userCount: 45,
    monthlyCost: 850,
    growthRate: 8.2,
    compressionRate: 45.2,
    tier: 'hot' as const,
  };
}

export function generateOrgTopFiles(organizationId: string, limit: number) {
  const files = [];
  for (let i = 0; i < limit; i++) {
    files.push({
      id: `file-${i + 1}`,
      title: `Recording ${i + 1} - Team Meeting`,
      size: 50000000 + Math.random() * 100000000,
      uploadedAt: new Date(Date.now() - Math.random() * 86400000 * 90).toISOString(),
      userName: ['John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Williams'][Math.floor(Math.random() * 4)],
      userId: `user-${Math.floor(Math.random() * 45) + 1}`,
      mimeType: 'video/mp4',
      compressionRate: 35 + Math.random() * 20,
      tier: ['hot', 'warm', 'cold'][Math.floor(Math.random() * 3)] as 'hot' | 'warm' | 'cold',
    });
  }
  return { files: files.sort((a, b) => b.size - a.size) };
}

export function generateOrgIssues(organizationId: string) {
  return {
    issues: [
      {
        id: '1',
        severity: 'critical' as const,
        type: 'quota' as const,
        message: 'Storage quota exceeded',
        description: 'Organization has used 102% of allocated storage (18.4GB / 18GB)',
        recommendation: 'Upgrade storage plan or delete old recordings',
        affectedFiles: 25,
        potentialSavings: 150,
      },
      {
        id: '2',
        severity: 'warning' as const,
        type: 'compression' as const,
        message: 'Uncompressed files detected',
        description: '45 video files are not compressed, wasting storage space',
        recommendation: 'Enable automatic compression for all new uploads',
        affectedFiles: 45,
        potentialSavings: 280,
      },
    ],
  };
}
