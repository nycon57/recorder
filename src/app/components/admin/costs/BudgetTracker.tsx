'use client';

import { useEffect, useState, useRef } from 'react';
import { DollarSign, AlertTriangle, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatting';

interface BudgetData {
  monthlyBudget: number;
  currentSpend: number;
  percentUsed: number;
  daysIntoMonth: number;
  daysInMonth: number;
  projectedSpend: number;
  status: 'on-track' | 'warning' | 'over-budget';
  alerts: {
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
}

export default function BudgetTracker() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let errorCount = 0;

    const fetchBudgetData = async () => {
      // Abort previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/analytics/costs/budget', {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch budget data');
        }

        const { data: budgetData } = await response.json();
        setData(budgetData);
        setError(null);
        errorCount = 0; // Reset error count on success
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching budget data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load budget data');

        // Stop auto-refresh after persistent errors
        errorCount++;
        if (errorCount >= 3 && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          console.warn('Auto-refresh stopped due to persistent errors');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchBudgetData();

    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(fetchBudgetData, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'on-track':
        return 'text-green-600 dark:text-green-500';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'over-budget':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string): { variant: 'default' | 'secondary' | 'destructive'; label: string } => {
    switch (status) {
      case 'on-track':
        return { variant: 'default', label: 'On Track' };
      case 'warning':
        return { variant: 'secondary', label: 'Warning' };
      case 'over-budget':
        return { variant: 'destructive', label: 'Over Budget' };
      default:
        return { variant: 'default', label: 'Unknown' };
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading budget data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const statusBadge = getStatusBadge(data.status);
  const expectedSpend = data.daysInMonth > 0
    ? (data.monthlyBudget * data.daysIntoMonth) / data.daysInMonth
    : 0;
  const isOverPace = data.currentSpend > expectedSpend;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Monthly Budget Tracker
            </CardTitle>
            <CardDescription>
              Day {data.daysIntoMonth} of {data.daysInMonth} • {formatPercentage(data.daysInMonth > 0 ? (data.daysIntoMonth / data.daysInMonth) * 100 : 0)} through month
            </CardDescription>
          </div>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Budget Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Budget Usage</span>
            <span className={`font-semibold ${getStatusColor(data.status)}`}>
              {formatCurrency(data.currentSpend)} / {formatCurrency(data.monthlyBudget)}
            </span>
          </div>
          <Progress
            value={data.percentUsed}
            className={`h-3 ${
              data.status === 'over-budget'
                ? '[&>div]:bg-red-600'
                : data.status === 'warning'
                ? '[&>div]:bg-yellow-600'
                : ''
            }`}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatPercentage(data.percentUsed)} used</span>
            <span>{formatCurrency(data.monthlyBudget - data.currentSpend)} remaining</span>
          </div>
        </div>

        {/* Spending Pace */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Expected Spend</p>
            <p className="text-lg font-semibold">{formatCurrency(expectedSpend)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Actual Spend</p>
            <p className={`text-lg font-semibold ${isOverPace ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(data.currentSpend)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Projected (EOM)</p>
            <p className="text-lg font-semibold">{formatCurrency(data.projectedSpend)}</p>
          </div>
        </div>

        {/* Pace Indicator */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          {isOverPace ? (
            <>
              <TrendingUp className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-orange-600">Spending Above Pace</p>
                <p className="text-xs text-muted-foreground">
                  {expectedSpend > 0
                    ? `You're ${formatPercentage(((data.currentSpend - expectedSpend) / expectedSpend) * 100)} ahead of expected spending for day ${data.daysIntoMonth}`
                    : `Current spending: ${formatCurrency(data.currentSpend)}`}
                </p>
              </div>
            </>
          ) : (
            <>
              <TrendingUp className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600">Spending On Pace</p>
                <p className="text-xs text-muted-foreground">
                  Your spending is tracking well with the monthly budget
                </p>
              </div>
            </>
          )}
        </div>

        {/* Budget Alerts */}
        {data.alerts.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium">Budget Alerts</p>
            <div className="space-y-2">
              {data.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
