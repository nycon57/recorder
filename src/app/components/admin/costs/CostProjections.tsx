'use client';

import { useEffect, useState, useRef } from 'react';
import { TrendingUp, Calendar, DollarSign, AlertCircle } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatting';

interface ProjectionData {
  currentMonth: number;
  nextMonth: number;
  next3Months: number;
  next6Months: number;
  nextYear: number;
  growthRate: number;
  confidence: 'high' | 'medium' | 'low';
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
}

export default function CostProjections() {
  const [data, setData] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchProjections = async () => {
      // Abort previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/analytics/costs/projections', {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch cost projections');
        }

        const { data: projectionsData } = await response.json();
        setData(projectionsData);
        setError(null);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching projections:', err);
        setError(err instanceof Error ? err.message : 'Failed to load projections');
      } finally {
        setLoading(false);
      }
    };

    fetchProjections();

    // Auto-refresh every 60 seconds
    intervalRef.current = setInterval(fetchProjections, 60000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getConfidenceBadge = (confidence: string): { variant: 'default' | 'secondary' | 'outline'; label: string } => {
    switch (confidence) {
      case 'high':
        return { variant: 'default', label: 'High Confidence' };
      case 'medium':
        return { variant: 'secondary', label: 'Medium Confidence' };
      case 'low':
        return { variant: 'outline', label: 'Low Confidence' };
      default:
        return { variant: 'secondary', label: 'Unknown' };
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'positive':
        return 'text-green-600 dark:text-green-500';
      case 'negative':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-4 w-[250px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading projections: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const confidenceBadge = getConfidenceBadge(data.confidence);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cost Projections
            </CardTitle>
            <CardDescription>
              Forecasted spending based on current trends
            </CardDescription>
          </div>
          <Badge variant={confidenceBadge.variant}>{confidenceBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Projection Timeline */}
        <div className="space-y-4">
          {/* Current Month */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Current Month</span>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(data.currentMonth)}</span>
          </div>

          {/* Next Month */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next Month</span>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(data.nextMonth)}</span>
          </div>

          {/* Next 3 Months */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next 3 Months</span>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(data.next3Months)}</span>
          </div>

          {/* Next 6 Months */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Next 6 Months</span>
            </div>
            <span className="text-sm font-semibold">{formatCurrency(data.next6Months)}</span>
          </div>

          {/* Next Year */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Projected Annual</span>
            </div>
            <span className="text-sm font-semibold text-primary">{formatCurrency(data.nextYear)}</span>
          </div>
        </div>

        {/* Growth Rate */}
        <div className="flex items-center justify-between p-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">Average Growth Rate</span>
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-3 w-3 ${data.growthRate > 0 ? 'text-red-600' : 'text-green-600'}`} />
            <span className={`text-sm font-semibold ${data.growthRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.growthRate > 0 ? '+' : ''}{data.growthRate.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Contributing Factors */}
        {data.factors.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Contributing Factors</p>
            </div>
            <div className="space-y-2">
              {data.factors.map((factor, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <div className={`mt-1 ${getImpactColor(factor.impact)}`}>
                    {factor.impact === 'positive' ? '↓' : factor.impact === 'negative' ? '↑' : '•'}
                  </div>
                  <div className="flex-1">
                    <p className={`text-xs font-medium ${getImpactColor(factor.impact)}`}>
                      {factor.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Projections are based on historical data and current trends. Actual costs may vary based on usage patterns and optimization efforts.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
