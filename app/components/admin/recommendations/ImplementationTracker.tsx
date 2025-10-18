'use client';

import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Clock, TrendingUp, Calendar, PlayCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency, formatDate, getRelativeTime } from '@/lib/utils/formatting';

interface ImplementationStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  totalSavingsRealized: number;
  completionRate: number;
}

interface InProgressItem {
  id: string;
  title: string;
  startedAt: string;
  estimatedCompletion: string;
  progress: number;
  estimatedSavings: number;
}

interface HistoryItem {
  id: string;
  title: string;
  completedAt: string;
  actualSavings: number;
  implementationTime: number; // days
}

interface TrackerData {
  stats: ImplementationStats;
  inProgress: InProgressItem[];
  recentHistory: HistoryItem[];
}

export default function ImplementationTracker() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchTrackerData = async () => {
      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/analytics/recommendations/tracker', {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch implementation tracker data');
        }

        const { data: trackerData } = await response.json();
        setData(trackerData);
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching tracker data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load tracker data');
      } finally {
        setLoading(false);
      }
    };

    fetchTrackerData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
            <Skeleton className="h-4 w-[300px] mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading tracker data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Implementation Progress
          </CardTitle>
          <CardDescription>
            Track your optimization journey and realized savings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Completion</span>
                <span className="font-medium">{data.stats.completionRate.toFixed(1)}%</span>
              </div>
              <Progress value={data.stats.completionRate} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {data.stats.completed} of {data.stats.total} recommendations completed
                </span>
                <span>
                  {data.stats.inProgress} in progress
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Completed</p>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <p className="text-2xl font-bold">{data.stats.completed}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">In Progress</p>
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-blue-600" />
                  <p className="text-2xl font-bold">{data.stats.inProgress}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pending</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <p className="text-2xl font-bold">{data.stats.pending}</p>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Savings Realized</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(data.stats.totalSavingsRealized)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* In Progress Items */}
      {data.inProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5" />
              Currently Implementing
            </CardTitle>
            <CardDescription>
              Active optimization initiatives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.inProgress.map((item) => (
                <div key={item.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{item.title}</h4>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Started {formatDate(item.startedAt)}</span>
                        <span>•</span>
                        <span>Est. completion: {formatDate(item.estimatedCompletion)}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {formatCurrency(item.estimatedSavings)}/yr
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{item.progress}%</span>
                    </div>
                    <Progress value={item.progress} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Completions */}
      {data.recentHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Completions
            </CardTitle>
            <CardDescription>
              Latest implemented optimizations and their impact
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentHistory.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-start justify-between gap-4 pb-3 ${
                    index < data.recentHistory.length - 1 ? 'border-b' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{getRelativeTime(item.completedAt)}</span>
                        <span>•</span>
                        <span>Completed in {item.implementationTime} days</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(item.actualSavings)}
                    </p>
                    <p className="text-xs text-muted-foreground">annual savings</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {data.inProgress.length === 0 && data.recentHistory.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4" />
              <p className="text-sm">No implementation activity yet</p>
              <p className="text-xs mt-1">Start implementing recommendations to track your progress here</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
