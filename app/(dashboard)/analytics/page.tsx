'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Search,
  ArrowUp,
  ArrowDown,
  Calendar,
  Eye,
  Download,
  Filter,
  Sparkles,
  Activity
} from 'lucide-react';

import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';

// Import chart components
import {
  SearchVolumeChart,
  SearchTypesChart,
  SearchLatencyChart,
  ActivityHeatmap,
} from '@/app/components/analytics';

interface AnalyticsSummary {
  totalSearches: number;
  searchesTrend: number;
  mostActiveDay: {
    day: string;
    count: number;
  };
  avgSearchTime: number;
  topQueryType: {
    type: string;
    count: number;
    percentage: number;
  };
}

interface TopQuery {
  query: string;
  count: number;
  lastSearched: string;
  avgFeedback: number | null;
}

interface TopRecording {
  id: string;
  title: string;
  viewCount: number;
  duration: number;
  lastViewed: string;
}

type TimeRange = '7d' | '30d' | '90d' | 'all';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topQueries, setTopQueries] = useState<TopQuery[]>([]);
  const [topRecordings, setTopRecordings] = useState<TopRecording[]>([]);

  // Set page title
  useEffect(() => {
    document.title = 'My Analytics - Record';
  }, []);

  // ✅ Use memoized URL to trigger refetch when timeRange changes
  const analyticsUrl = useMemo(
    () => `/api/analytics/user?timeRange=${timeRange}`,
    [timeRange]
  );

  interface AnalyticsResponse {
    data: {
      summary: AnalyticsSummary;
      topQueries?: TopQuery[];
      topRecordings?: TopRecording[];
    };
  }

  // ✅ Use abort-safe data fetching (prevents race conditions when switching time ranges)
  const { loading } = useFetchWithAbort<AnalyticsResponse>(analyticsUrl, {
    onSuccess: (data) => {
      setSummary(data.data.summary);
      setTopQueries(data.data.topQueries || []);
      setTopRecordings(data.data.topRecordings || []);
    },
    onError: (err) => {
      console.error('Error fetching analytics:', err);
    },
  });

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'all': return 'All time';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-normal tracking-tight">My Analytics</h1>
            <p className="text-muted-foreground">Insights into your search and recording activity</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4" />
            Filter
          </Button>

          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Searches */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Searches
              </CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.totalSearches.toLocaleString() ?? '0'}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {summary && summary.searchesTrend > 0 ? (
                    <>
                      <ArrowUp className="h-3 w-3 text-green-500" />
                      <span className="text-xs text-green-500 font-medium">
                        +{summary.searchesTrend}%
                      </span>
                    </>
                  ) : summary && summary.searchesTrend < 0 ? (
                    <>
                      <ArrowDown className="h-3 w-3 text-red-500" />
                      <span className="text-xs text-red-500 font-medium">
                        {summary.searchesTrend}%
                      </span>
                    </>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    vs previous period
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Most Active Day */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Most Active Day
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.mostActiveDay.day ?? 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.mostActiveDay.count ?? 0} searches
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Search Time */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Search Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {summary?.avgSearchTime ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">ms</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Response latency
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Top Query Type */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Top Query Type
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold capitalize">
                  {summary?.topQueryType.type ?? 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary?.topQueryType.percentage ?? 0}% of searches
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="queries">
            <Search className="h-4 w-4" />
            Top Queries
          </TabsTrigger>
          <TabsTrigger value="recordings">
            <Eye className="h-4 w-4" />
            Top Recordings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          {/* Search Volume Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Search Volume Over Time</CardTitle>
              <CardDescription>
                Number of searches performed over {getTimeRangeLabel(timeRange).toLowerCase()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SearchVolumeChart timeRange={timeRange} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Search Types Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Search Types Distribution</CardTitle>
                <CardDescription>
                  Breakdown by search mode
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchTypesChart timeRange={timeRange} />
              </CardContent>
            </Card>

            {/* Search Latency */}
            <Card>
              <CardHeader>
                <CardTitle>Search Latency</CardTitle>
                <CardDescription>
                  Average response time over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SearchLatencyChart timeRange={timeRange} />
              </CardContent>
            </Card>
          </div>

          {/* Activity Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Heatmap</CardTitle>
              <CardDescription>
                Search activity by day and time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityHeatmap timeRange={timeRange} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Queries Tab */}
        <TabsContent value="queries" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Queries</CardTitle>
              <CardDescription>
                Most frequently searched queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : topQueries.length === 0 ? (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No search queries yet. Start searching to see insights!
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Query</TableHead>
                      <TableHead className="text-center">Search Count</TableHead>
                      <TableHead className="text-center">Last Searched</TableHead>
                      <TableHead className="text-center">Feedback</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topQueries.map((query, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium max-w-md truncate">
                          {query.query}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{query.count}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDate(query.lastSearched)}
                        </TableCell>
                        <TableCell className="text-center">
                          {query.avgFeedback !== null ? (
                            <Badge variant={query.avgFeedback > 0 ? 'default' : 'destructive'}>
                              {query.avgFeedback > 0 ? (
                                <>
                                  <TrendingUp className="h-3 w-3" />
                                  Good
                                </>
                              ) : (
                                <>
                                  <TrendingUp className="h-3 w-3 rotate-180" />
                                  Poor
                                </>
                              )}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">No feedback</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Recordings Tab */}
        <TabsContent value="recordings" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Most Viewed Recordings</CardTitle>
              <CardDescription>
                Recordings you view most often
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : topRecordings.length === 0 ? (
                <div className="text-center py-12">
                  <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    No recordings viewed yet. View recordings to see insights!
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center">View Count</TableHead>
                      <TableHead className="text-center">Duration</TableHead>
                      <TableHead className="text-center">Last Viewed</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topRecordings.map((recording) => (
                      <TableRow key={recording.id}>
                        <TableCell className="font-medium max-w-md truncate">
                          {recording.title || 'Untitled Recording'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            <Eye className="h-3 w-3" />
                            {recording.viewCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDuration(recording.duration)}
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDate(recording.lastViewed)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                          >
                            <a href={`/library/${recording.id}`}>View</a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
