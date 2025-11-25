/**
 * Analytics Service - Phase 8
 *
 * Provides comprehensive analytics and insights for the knowledge management platform.
 * Tracks storage usage, access patterns, processing performance, content insights, and usage trends.
 *
 * Design Principles:
 * - Efficient queries using database views and materialized aggregations
 * - Multi-layer caching (in-memory + Redis) for expensive analytics
 * - Incremental aggregation for real-time metrics
 * - Time-series support for trend analysis
 *
 * @module AnalyticsService
 */

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ContentType, JobType, RecordingStatus } from '@/lib/types/database';

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface StorageAnalytics {
  /** Total storage in bytes across all content types */
  totalBytes: number;
  /** Total storage in GB (for display) */
  totalGb: number;
  /** Breakdown by content type */
  byContentType: Array<{
    contentType: ContentType;
    bytes: number;
    gb: number;
    count: number;
    percentOfTotal: number;
  }>;
  /** Storage trend over time (daily for last 30 days) */
  trend: Array<{
    date: string;
    bytes: number;
    gb: number;
  }>;
  /** Top 10 largest files */
  largestFiles: Array<{
    id: string;
    title: string | null;
    contentType: ContentType;
    fileSize: number;
    fileSizeGb: number;
    createdAt: string;
  }>;
  /** Storage projection (next 30 days based on trend) */
  projection: {
    estimatedBytes30Days: number;
    estimatedGb30Days: number;
    growthRatePerDay: number;
    daysUntilLimit: number | null; // null if no limit or not approaching limit
  };
  /** Cost estimate based on Supabase pricing ($0.021/GB/month) */
  costEstimate: {
    currentMonthly: number;
    projectedMonthly: number;
    currency: 'USD';
  };
}

export interface AccessAnalytics {
  /** Most viewed items (recordings/documents) */
  mostViewed: Array<{
    id: string;
    title: string | null;
    contentType: ContentType;
    viewCount: number;
    uniqueUsers: number;
    lastViewedAt: string;
    period: 'all_time' | 'last_30_days' | 'last_7_days';
  }>;
  /** Most searched queries */
  topSearches: Array<{
    query: string;
    searchCount: number;
    avgResultCount: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    lastSearchedAt: string;
  }>;
  /** Peak usage times (hour of day) */
  peakUsageTimes: Array<{
    hour: number; // 0-23
    activityCount: number;
    primaryActivity: 'search' | 'upload' | 'view' | 'chat';
  }>;
  /** User engagement metrics */
  engagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    avgSessionDurationMin: number;
    avgActionsPerSession: number;
  };
}

export interface ProcessingPerformance {
  /** Average processing time by job type (in seconds) */
  avgProcessingTime: Array<{
    jobType: JobType;
    avgTimeSeconds: number;
    p50TimeSeconds: number;
    p95TimeSeconds: number;
    p99TimeSeconds: number;
    sampleSize: number;
  }>;
  /** Success/failure rates */
  successRates: Array<{
    jobType: JobType;
    totalJobs: number;
    successfulJobs: number;
    failedJobs: number;
    successRate: number;
    avgRetries: number;
  }>;
  /** Current job queue status */
  queueStatus: {
    pendingJobs: number;
    processingJobs: number;
    avgWaitTimeSeconds: number;
    oldestPendingJobAge: number | null; // seconds
    estimatedCompletionTime: number | null; // seconds
  };
  /** Processing throughput (jobs per hour) */
  throughput: {
    last1Hour: number;
    last24Hours: number;
    last7Days: number;
  };
}

export interface ContentInsights {
  /** Upload trends */
  uploadTrends: {
    itemsToday: number;
    itemsThisWeek: number;
    itemsThisMonth: number;
    dailyAverage: number;
    weeklyAverage: number;
    trend: Array<{
      date: string;
      count: number;
      contentType: ContentType;
    }>;
  };
  /** Content type distribution */
  contentDistribution: Array<{
    contentType: ContentType;
    count: number;
    totalSizeGb: number;
    percentOfTotal: number;
    avgSizeGb: number;
  }>;
  /** Most used tags */
  topTags: Array<{
    tagId: string;
    tagName: string;
    tagColor: string;
    usageCount: number;
    recentlyUsed: boolean; // used in last 7 days
  }>;
  /** Average document metrics */
  documentMetrics: {
    avgDocumentLengthChars: number;
    avgDocumentLengthWords: number;
    avgTranscriptLengthWords: number;
    avgDurationMinutes: number; // for video/audio
    totalDocuments: number;
  };
  /** Most active users */
  activeUsers: Array<{
    userId: string;
    userName: string | null;
    uploadsCount: number;
    searchesCount: number;
    chatMessagesCount: number;
    lastActiveAt: string;
  }>;
}

export interface UsageTrends {
  /** Daily/weekly/monthly active users */
  activeUsers: {
    dau: Array<{ date: string; count: number }>;
    wau: Array<{ week: string; count: number }>;
    mau: Array<{ month: string; count: number }>;
  };
  /** Feature adoption rates */
  featureAdoption: {
    searchUsage: number; // % of users who have used search
    chatUsage: number; // % of users who have used AI chat
    uploadUsage: number; // % of users who have uploaded content
    recordingUsage: number; // % of users who have created recordings
    sharingUsage: number; // % of users who have shared content
  };
  /** Search vs browse behavior */
  accessPatterns: {
    searchDriven: number; // % of content access via search
    browseDriven: number; // % of content access via browse
    directLink: number; // % of content access via direct link
  };
  /** AI assistant usage */
  aiUsage: {
    totalConversations: number;
    totalMessages: number;
    avgMessagesPerConversation: number;
    activeConversationsLast7Days: number;
    topTools: Array<{
      toolName: string;
      usageCount: number;
      successRate: number;
    }>;
  };
  /** Growth metrics */
  growth: {
    userGrowthRate: number; // % month-over-month
    contentGrowthRate: number; // % month-over-month
    storageGrowthRate: number; // % month-over-month
  };
}

export interface AnalyticsTimeRange {
  start: Date;
  end: Date;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsSummary {
  orgId: string;
  generatedAt: Date;
  timeRange: AnalyticsTimeRange;
  storage: StorageAnalytics;
  access: AccessAnalytics;
  processing: ProcessingPerformance;
  content: ContentInsights;
  trends: UsageTrends;
}

// =====================================================
// CACHING CONFIGURATION
// =====================================================

const CACHE_TTL = {
  STORAGE: 300000, // 5 minutes
  ACCESS: 600000, // 10 minutes
  PROCESSING: 180000, // 3 minutes
  CONTENT: 600000, // 10 minutes
  TRENDS: 3600000, // 1 hour
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const analyticsCache = new Map<string, CacheEntry<any>>();

// =====================================================
// ANALYTICS SERVICE
// =====================================================

export class AnalyticsService {
  /**
   * Get comprehensive analytics summary
   */
  static async getSummary(
    orgId: string,
    timeRange?: Partial<AnalyticsTimeRange>
  ): Promise<AnalyticsSummary> {
    const range: AnalyticsTimeRange = {
      start: timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: 30 days ago
      end: timeRange?.end || new Date(),
      granularity: timeRange?.granularity || 'day',
    };

    // Fetch all analytics in parallel for better performance
    const [storage, access, processing, content, trends] = await Promise.all([
      this.getStorageAnalytics(orgId, range),
      this.getAccessAnalytics(orgId, range),
      this.getProcessingPerformance(orgId, range),
      this.getContentInsights(orgId, range),
      this.getUsageTrends(orgId, range),
    ]);

    return {
      orgId,
      generatedAt: new Date(),
      timeRange: range,
      storage,
      access,
      processing,
      content,
      trends,
    };
  }

  /**
   * Get storage usage analytics
   */
  static async getStorageAnalytics(
    orgId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<StorageAnalytics> {
    const cacheKey = `storage:${orgId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}`;
    const cached = this.getFromCache<StorageAnalytics>(cacheKey, CACHE_TTL.STORAGE);
    if (cached) return cached;

    const supabase = supabaseAdmin;

    // Get total storage and breakdown by content type
    const { data: storageByType, error: storageError } = await supabase.rpc(
      'get_storage_by_content_type',
      { p_org_id: orgId }
    );

    if (storageError) {
      console.error('[AnalyticsService] Error fetching storage by type:', storageError);
      throw storageError;
    }

    const totalBytes = storageByType?.reduce((sum: number, item: any) => sum + (item.total_bytes || 0), 0) || 0;
    const totalGb = totalBytes / (1024 * 1024 * 1024);

    const byContentType = (storageByType || []).map((item: any) => ({
      contentType: item.content_type as ContentType,
      bytes: item.total_bytes || 0,
      gb: (item.total_bytes || 0) / (1024 * 1024 * 1024),
      count: item.count || 0,
      percentOfTotal: totalBytes > 0 ? ((item.total_bytes || 0) / totalBytes) * 100 : 0,
    }));

    // Get storage trend over time
    const { data: trendData, error: trendError } = await supabase.rpc(
      'get_storage_trend',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
        p_granularity: timeRange.granularity,
      }
    );

    if (trendError) {
      console.error('[AnalyticsService] Error fetching storage trend:', trendError);
    }

    const trend = (trendData || []).map((item: any) => ({
      date: item.date,
      bytes: item.total_bytes || 0,
      gb: (item.total_bytes || 0) / (1024 * 1024 * 1024),
    }));

    // Get top 10 largest files
    const { data: largestFiles, error: largestError } = await supabase
      .from('content')
      .select('id, title, content_type, file_size, created_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .not('file_size', 'is', null)
      .order('file_size', { ascending: false })
      .limit(10);

    if (largestError) {
      console.error('[AnalyticsService] Error fetching largest files:', largestError);
    }

    const largestFilesFormatted = (largestFiles || []).map(file => ({
      id: file.id,
      title: file.title,
      contentType: file.content_type as ContentType,
      fileSize: file.file_size || 0,
      fileSizeGb: (file.file_size || 0) / (1024 * 1024 * 1024),
      createdAt: file.created_at,
    }));

    // Calculate storage projection
    const projection = this.calculateStorageProjection(trend);

    // Calculate cost estimate (Supabase pricing: ~$0.021/GB/month)
    const SUPABASE_STORAGE_COST_PER_GB = 0.021;
    const costEstimate = {
      currentMonthly: totalGb * SUPABASE_STORAGE_COST_PER_GB,
      projectedMonthly: projection.estimatedGb30Days * SUPABASE_STORAGE_COST_PER_GB,
      currency: 'USD' as const,
    };

    const result: StorageAnalytics = {
      totalBytes,
      totalGb,
      byContentType,
      trend,
      largestFiles: largestFilesFormatted,
      projection,
      costEstimate,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get access pattern analytics
   */
  static async getAccessAnalytics(
    orgId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<AccessAnalytics> {
    const cacheKey = `access:${orgId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}`;
    const cached = this.getFromCache<AccessAnalytics>(cacheKey, CACHE_TTL.ACCESS);
    if (cached) return cached;

    const supabase = supabaseAdmin;

    // Get most viewed items (from shares and audit logs)
    const { data: mostViewedData, error: viewError } = await supabase.rpc(
      'get_most_viewed_items',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
        p_limit: 20,
      }
    );

    if (viewError) {
      console.error('[AnalyticsService] Error fetching most viewed:', viewError);
    }

    const mostViewed = (mostViewedData || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      contentType: item.content_type as ContentType,
      viewCount: item.view_count || 0,
      uniqueUsers: item.unique_users || 0,
      lastViewedAt: item.last_viewed_at,
      period: this.getPeriodLabel(timeRange),
    }));

    // Get top searches
    const { data: topSearchesData, error: searchError } = await supabase
      .from('search_analytics')
      .select('query, query_hash')
      .eq('org_id', orgId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (searchError) {
      console.error('[AnalyticsService] Error fetching top searches:', searchError);
    }

    const topSearches = this.aggregateSearches(topSearchesData || []);

    // Get peak usage times
    const { data: peakTimesData, error: peakError } = await supabase.rpc(
      'get_peak_usage_times',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (peakError) {
      console.error('[AnalyticsService] Error fetching peak times:', peakError);
    }

    const peakUsageTimes = (peakTimesData || []).map((item: any) => ({
      hour: item.hour,
      activityCount: item.activity_count || 0,
      primaryActivity: item.primary_activity || 'search',
    }));

    // Get user engagement metrics
    const engagement = await this.calculateEngagementMetrics(orgId, timeRange);

    const result: AccessAnalytics = {
      mostViewed,
      topSearches,
      peakUsageTimes,
      engagement,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get processing performance analytics
   */
  static async getProcessingPerformance(
    orgId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<ProcessingPerformance> {
    const cacheKey = `processing:${orgId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}`;
    const cached = this.getFromCache<ProcessingPerformance>(cacheKey, CACHE_TTL.PROCESSING);
    if (cached) return cached;

    const supabase = supabaseAdmin;

    // Get average processing times by job type
    const { data: processingTimes, error: timesError } = await supabase.rpc(
      'get_processing_times_by_job_type',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (timesError) {
      console.error('[AnalyticsService] Error fetching processing times:', timesError);
    }

    const avgProcessingTime = (processingTimes || []).map((item: any) => ({
      jobType: item.job_type as JobType,
      avgTimeSeconds: item.avg_time_seconds || 0,
      p50TimeSeconds: item.p50_time_seconds || 0,
      p95TimeSeconds: item.p95_time_seconds || 0,
      p99TimeSeconds: item.p99_time_seconds || 0,
      sampleSize: item.sample_size || 0,
    }));

    // Get success rates
    const { data: successRatesData, error: ratesError } = await supabase.rpc(
      'get_job_success_rates',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (ratesError) {
      console.error('[AnalyticsService] Error fetching success rates:', ratesError);
    }

    const successRates = (successRatesData || []).map((item: any) => ({
      jobType: item.job_type as JobType,
      totalJobs: item.total_jobs || 0,
      successfulJobs: item.successful_jobs || 0,
      failedJobs: item.failed_jobs || 0,
      successRate: item.success_rate || 0,
      avgRetries: item.avg_retries || 0,
    }));

    // Get current queue status
    const queueStatus = await this.getQueueStatus(orgId);

    // Get processing throughput
    const throughput = await this.getProcessingThroughput(orgId);

    const result: ProcessingPerformance = {
      avgProcessingTime,
      successRates,
      queueStatus,
      throughput,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get content insights
   */
  static async getContentInsights(
    orgId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<ContentInsights> {
    const cacheKey = `content:${orgId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}`;
    const cached = this.getFromCache<ContentInsights>(cacheKey, CACHE_TTL.CONTENT);
    if (cached) return cached;

    const supabase = supabaseAdmin;

    // Get upload trends
    const uploadTrends = await this.getUploadTrends(orgId, timeRange);

    // Get content distribution
    const { data: distributionData, error: distError } = await supabase.rpc(
      'get_content_distribution',
      { p_org_id: orgId }
    );

    if (distError) {
      console.error('[AnalyticsService] Error fetching content distribution:', distError);
    }

    const totalItems = (distributionData || []).reduce((sum: number, item: any) => sum + (item.count || 0), 0);
    const contentDistribution = (distributionData || []).map((item: any) => ({
      contentType: item.content_type as ContentType,
      count: item.count || 0,
      totalSizeGb: (item.total_size_bytes || 0) / (1024 * 1024 * 1024),
      percentOfTotal: totalItems > 0 ? ((item.count || 0) / totalItems) * 100 : 0,
      avgSizeGb: item.count > 0 ? (item.total_size_bytes || 0) / (1024 * 1024 * 1024) / item.count : 0,
    }));

    // Get most used tags
    const { data: tagsData, error: tagsError } = await supabase.rpc(
      'get_top_tags',
      {
        p_org_id: orgId,
        p_limit: 20,
      }
    );

    if (tagsError) {
      console.error('[AnalyticsService] Error fetching top tags:', tagsError);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const topTags = (tagsData || []).map((item: any) => ({
      tagId: item.tag_id,
      tagName: item.tag_name,
      tagColor: item.tag_color,
      usageCount: item.usage_count || 0,
      recentlyUsed: new Date(item.last_used_at) > sevenDaysAgo,
    }));

    // Get document metrics
    const documentMetrics = await this.getDocumentMetrics(orgId);

    // Get most active users
    const activeUsers = await this.getMostActiveUsers(orgId, timeRange);

    const result: ContentInsights = {
      uploadTrends,
      contentDistribution,
      topTags,
      documentMetrics,
      activeUsers,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Get usage trends
   */
  static async getUsageTrends(
    orgId: string,
    timeRange: AnalyticsTimeRange
  ): Promise<UsageTrends> {
    const cacheKey = `trends:${orgId}:${timeRange.start.getTime()}:${timeRange.end.getTime()}`;
    const cached = this.getFromCache<UsageTrends>(cacheKey, CACHE_TTL.TRENDS);
    if (cached) return cached;

    const supabase = supabaseAdmin;

    // Get active users (DAU/WAU/MAU)
    const activeUsers = await this.getActiveUsersTrends(orgId, timeRange);

    // Get feature adoption rates
    const featureAdoption = await this.getFeatureAdoption(orgId);

    // Get access patterns
    const accessPatterns = await this.getAccessPatterns(orgId, timeRange);

    // Get AI usage
    const aiUsage = await this.getAIUsage(orgId, timeRange);

    // Get growth metrics
    const growth = await this.getGrowthMetrics(orgId);

    const result: UsageTrends = {
      activeUsers,
      featureAdoption,
      accessPatterns,
      aiUsage,
      growth,
    };

    this.setCache(cacheKey, result);
    return result;
  }

  /**
   * Export analytics data to CSV/JSON
   */
  static async exportAnalytics(
    orgId: string,
    format: 'csv' | 'json',
    section?: 'storage' | 'access' | 'processing' | 'content' | 'trends'
  ): Promise<string> {
    const summary = await this.getSummary(orgId);

    const data = section ? summary[section] : summary;

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else {
      // Convert to CSV format
      return this.convertToCSV(data);
    }
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private static calculateStorageProjection(trend: Array<{ date: string; bytes: number; gb: number }>) {
    if (trend.length < 2) {
      return {
        estimatedBytes30Days: trend[0]?.bytes || 0,
        estimatedGb30Days: trend[0]?.gb || 0,
        growthRatePerDay: 0,
        daysUntilLimit: null,
      };
    }

    // Calculate daily growth rate using linear regression
    const n = trend.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    trend.forEach((point, index) => {
      sumX += index;
      sumY += point.bytes;
      sumXY += index * point.bytes;
      sumX2 += index * index;
    });

    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const growthRatePerDay = slope;

    const currentBytes = trend[trend.length - 1].bytes;
    const estimatedBytes30Days = Math.max(0, currentBytes + (growthRatePerDay * 30));
    const estimatedGb30Days = estimatedBytes30Days / (1024 * 1024 * 1024);

    return {
      estimatedBytes30Days,
      estimatedGb30Days,
      growthRatePerDay,
      daysUntilLimit: null, // Will be calculated based on org quota
    };
  }

  private static aggregateSearches(searches: any[]): Array<{
    query: string;
    searchCount: number;
    avgResultCount: number;
    avgLatencyMs: number;
    cacheHitRate: number;
    lastSearchedAt: string;
  }> {
    const queryMap = new Map<string, any[]>();

    searches.forEach(search => {
      const existing = queryMap.get(search.query) || [];
      existing.push(search);
      queryMap.set(search.query, existing);
    });

    const aggregated = Array.from(queryMap.entries()).map(([query, items]) => {
      const searchCount = items.length;
      const avgResultCount = items.reduce((sum, s) => sum + (s.results_count || 0), 0) / searchCount;
      const avgLatencyMs = items.reduce((sum, s) => sum + (s.latency_ms || 0), 0) / searchCount;
      const cacheHits = items.filter(s => s.cache_hit).length;
      const cacheHitRate = cacheHits / searchCount;
      const lastSearchedAt = items.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0].created_at;

      return {
        query,
        searchCount,
        avgResultCount,
        avgLatencyMs,
        cacheHitRate,
        lastSearchedAt,
      };
    });

    return aggregated.sort((a, b) => b.searchCount - a.searchCount).slice(0, 20);
  }

  private static async calculateEngagementMetrics(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    // Get DAU/WAU/MAU
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dau, wau, mau] = await Promise.all([
      this.getActiveUsersCount(orgId, oneDayAgo, now),
      this.getActiveUsersCount(orgId, oneWeekAgo, now),
      this.getActiveUsersCount(orgId, oneMonthAgo, now),
    ]);

    return {
      dailyActiveUsers: dau,
      weeklyActiveUsers: wau,
      monthlyActiveUsers: mau,
      avgSessionDurationMin: 0, // TODO: Implement session tracking
      avgActionsPerSession: 0, // TODO: Implement action tracking
    };
  }

  private static async getActiveUsersCount(orgId: string, start: Date, end: Date): Promise<number> {
    const supabase = supabaseAdmin;

    const { count, error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('last_active_at', start.toISOString())
      .lte('last_active_at', end.toISOString());

    if (error) {
      console.error('[AnalyticsService] Error fetching active users:', error);
      return 0;
    }

    return count || 0;
  }

  private static async getQueueStatus(orgId: string) {
    const supabase = supabaseAdmin;

    const { data: queueData, error } = await supabase.rpc('get_queue_status', { p_org_id: orgId });

    if (error || !queueData || queueData.length === 0) {
      return {
        pendingJobs: 0,
        processingJobs: 0,
        avgWaitTimeSeconds: 0,
        oldestPendingJobAge: null,
        estimatedCompletionTime: null,
      };
    }

    const stats = queueData[0];
    return {
      pendingJobs: stats.pending_jobs || 0,
      processingJobs: stats.processing_jobs || 0,
      avgWaitTimeSeconds: stats.avg_wait_time_seconds || 0,
      oldestPendingJobAge: stats.oldest_pending_job_age || null,
      estimatedCompletionTime: stats.estimated_completion_time || null,
    };
  }

  private static async getProcessingThroughput(orgId: string) {
    const supabase = supabaseAdmin;
    const now = new Date();

    const [last1Hour, last24Hours, last7Days] = await Promise.all([
      this.getCompletedJobsCount(orgId, new Date(now.getTime() - 60 * 60 * 1000), now),
      this.getCompletedJobsCount(orgId, new Date(now.getTime() - 24 * 60 * 60 * 1000), now),
      this.getCompletedJobsCount(orgId, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now),
    ]);

    return {
      last1Hour,
      last24Hours: last24Hours / 24,
      last7Days: last7Days / (7 * 24),
    };
  }

  private static async getCompletedJobsCount(orgId: string, start: Date, end: Date): Promise<number> {
    const supabase = supabaseAdmin;

    const { count, error } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString());

    if (error) {
      console.error('[AnalyticsService] Error fetching completed jobs:', error);
      return 0;
    }

    return count || 0;
  }

  private static async getUploadTrends(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [today, thisWeek, thisMonth] = await Promise.all([
      this.getUploadCount(orgId, oneDayAgo, now),
      this.getUploadCount(orgId, oneWeekAgo, now),
      this.getUploadCount(orgId, oneMonthAgo, now),
    ]);

    // Get daily trend
    const { data: trendData, error: trendError } = await supabase.rpc(
      'get_upload_trend',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (trendError) {
      console.error('[AnalyticsService] Error fetching upload trend:', trendError);
    }

    const trend = (trendData || []).map((item: any) => ({
      date: item.date,
      count: item.count || 0,
      contentType: item.content_type as ContentType,
    }));

    return {
      itemsToday: today,
      itemsThisWeek: thisWeek,
      itemsThisMonth: thisMonth,
      dailyAverage: thisMonth / 30,
      weeklyAverage: thisMonth / 4,
      trend,
    };
  }

  private static async getUploadCount(orgId: string, start: Date, end: Date): Promise<number> {
    const supabase = supabaseAdmin;

    const { count, error } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (error) {
      console.error('[AnalyticsService] Error fetching upload count:', error);
      return 0;
    }

    return count || 0;
  }

  private static async getDocumentMetrics(orgId: string) {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase.rpc('get_document_metrics', { p_org_id: orgId });

    if (error || !data || data.length === 0) {
      return {
        avgDocumentLengthChars: 0,
        avgDocumentLengthWords: 0,
        avgTranscriptLengthWords: 0,
        avgDurationMinutes: 0,
        totalDocuments: 0,
      };
    }

    const metrics = data[0];
    return {
      avgDocumentLengthChars: metrics.avg_document_length_chars || 0,
      avgDocumentLengthWords: metrics.avg_document_length_words || 0,
      avgTranscriptLengthWords: metrics.avg_transcript_length_words || 0,
      avgDurationMinutes: metrics.avg_duration_minutes || 0,
      totalDocuments: metrics.total_documents || 0,
    };
  }

  private static async getMostActiveUsers(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase.rpc(
      'get_most_active_users',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
        p_limit: 10,
      }
    );

    if (error) {
      console.error('[AnalyticsService] Error fetching most active users:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      userId: item.user_id,
      userName: item.user_name,
      uploadsCount: item.uploads_count || 0,
      searchesCount: item.searches_count || 0,
      chatMessagesCount: item.chat_messages_count || 0,
      lastActiveAt: item.last_active_at,
    }));
  }

  private static async getActiveUsersTrends(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    const { data: dauData, error: dauError } = await supabase.rpc(
      'get_dau_trend',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (dauError) {
      console.error('[AnalyticsService] Error fetching DAU trend:', dauError);
    }

    const dau = (dauData || []).map((item: any) => ({
      date: item.date,
      count: item.count || 0,
    }));

    // For simplicity, return empty arrays for WAU/MAU (can be implemented similarly)
    return {
      dau,
      wau: [],
      mau: [],
    };
  }

  private static async getFeatureAdoption(orgId: string) {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase.rpc('get_feature_adoption', { p_org_id: orgId });

    if (error || !data || data.length === 0) {
      return {
        searchUsage: 0,
        chatUsage: 0,
        uploadUsage: 0,
        recordingUsage: 0,
        sharingUsage: 0,
      };
    }

    const adoption = data[0];
    return {
      searchUsage: adoption.search_usage || 0,
      chatUsage: adoption.chat_usage || 0,
      uploadUsage: adoption.upload_usage || 0,
      recordingUsage: adoption.recording_usage || 0,
      sharingUsage: adoption.sharing_usage || 0,
    };
  }

  private static async getAccessPatterns(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    // Query activity_log to determine access patterns
    const { data, error } = await supabase
      .from('activity_log')
      .select('action, metadata')
      .eq('org_id', orgId)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())
      .in('action', ['search', 'view', 'browse']);

    if (error) {
      console.error('[AnalyticsService] Error fetching access patterns:', error);
      return {
        searchDriven: 0,
        browseDriven: 0,
        directLink: 0,
      };
    }

    const total = data?.length || 0;
    if (total === 0) {
      return {
        searchDriven: 0,
        browseDriven: 0,
        directLink: 0,
      };
    }

    const searchCount = data?.filter(a => a.action === 'search').length || 0;
    const browseCount = data?.filter(a => a.action === 'browse').length || 0;
    const directLinkCount = total - searchCount - browseCount;

    return {
      searchDriven: (searchCount / total) * 100,
      browseDriven: (browseCount / total) * 100,
      directLink: (directLinkCount / total) * 100,
    };
  }

  private static async getAIUsage(orgId: string, timeRange: AnalyticsTimeRange) {
    const supabase = supabaseAdmin;

    const { data, error } = await supabase.rpc(
      'get_ai_usage',
      {
        p_org_id: orgId,
        p_start_date: timeRange.start.toISOString(),
        p_end_date: timeRange.end.toISOString(),
      }
    );

    if (error || !data || data.length === 0) {
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgMessagesPerConversation: 0,
        activeConversationsLast7Days: 0,
        topTools: [],
      };
    }

    const usage = data[0];
    return {
      totalConversations: usage.total_conversations || 0,
      totalMessages: usage.total_messages || 0,
      avgMessagesPerConversation: usage.avg_messages_per_conversation || 0,
      activeConversationsLast7Days: usage.active_conversations_last_7_days || 0,
      topTools: usage.top_tools || [],
    };
  }

  private static async getGrowthMetrics(orgId: string) {
    const supabase = supabaseAdmin;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get user count for current and last month
    const [thisMonthUsers, lastMonthUsers] = await Promise.all([
      this.getActiveUsersCount(orgId, thisMonthStart, now),
      this.getActiveUsersCount(orgId, lastMonthStart, lastMonthEnd),
    ]);

    // Get content count for current and last month
    const [thisMonthContent, lastMonthContent] = await Promise.all([
      this.getUploadCount(orgId, thisMonthStart, now),
      this.getUploadCount(orgId, lastMonthStart, lastMonthEnd),
    ]);

    // Get storage size for current and last month
    const { data: thisMonthStorage } = await supabase
      .from('content')
      .select('file_size')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .lte('created_at', now.toISOString());

    const { data: lastMonthStorage } = await supabase
      .from('content')
      .select('file_size')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .lte('created_at', lastMonthEnd.toISOString());

    const thisMonthStorageBytes = (thisMonthStorage || []).reduce((sum, r) => sum + (r.file_size || 0), 0);
    const lastMonthStorageBytes = (lastMonthStorage || []).reduce((sum, r) => sum + (r.file_size || 0), 0);

    // Calculate growth rates
    const calculateGrowthRate = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      userGrowthRate: calculateGrowthRate(thisMonthUsers, lastMonthUsers),
      contentGrowthRate: calculateGrowthRate(thisMonthContent, lastMonthContent),
      storageGrowthRate: calculateGrowthRate(thisMonthStorageBytes, lastMonthStorageBytes),
    };
  }

  private static getPeriodLabel(timeRange: AnalyticsTimeRange): 'all_time' | 'last_30_days' | 'last_7_days' {
    const daysDiff = (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000);
    if (daysDiff <= 7) return 'last_7_days';
    if (daysDiff <= 30) return 'last_30_days';
    return 'all_time';
  }

  private static convertToCSV(data: any): string {
    // Simple CSV conversion (can be enhanced)
    const rows: string[] = [];

    function flattenObject(obj: any, prefix = ''): any {
      const flattened: any = {};
      for (const key in obj) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          Object.assign(flattened, flattenObject(value, newKey));
        } else if (Array.isArray(value)) {
          flattened[newKey] = JSON.stringify(value);
        } else {
          flattened[newKey] = value;
        }
      }
      return flattened;
    }

    const flattened = flattenObject(data);
    const headers = Object.keys(flattened);
    rows.push(headers.join(','));
    rows.push(headers.map(h => flattened[h]).join(','));

    return rows.join('\n');
  }

  // Cache helpers
  private static getFromCache<T>(key: string, ttl: number): T | null {
    const entry = analyticsCache.get(key);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > ttl) {
      analyticsCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private static setCache<T>(key: string, data: T): void {
    analyticsCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear all analytics cache
   */
  static clearCache(): void {
    analyticsCache.clear();
    console.log('[AnalyticsService] Cleared analytics cache');
  }
}
