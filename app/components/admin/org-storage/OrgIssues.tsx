'use client';

import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils/formatting';

interface Issue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  type: 'quota' | 'compression' | 'migration' | 'retention' | 'cost';
  message: string;
  description: string;
  recommendation: string;
  affectedFiles?: number;
  potentialSavings?: number;
}

interface OrgIssuesProps {
  organizationId: string;
}

export default function OrgIssues({ organizationId }: OrgIssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const fetchIssues = async () => {
      // Abort previous request before creating new one
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new AbortController for this fetch
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(`/api/analytics/organizations/${organizationId}/issues`, {
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch organization issues');
        }

        const { data } = await response.json();
        setIssues(data.issues || []);
        setError(null);

        // Only start polling if not in error state
        if (!interval) {
          interval = setInterval(fetchIssues, 60000);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }

        console.error('Error fetching issues:', err);
        setError(err instanceof Error ? err.message : 'Failed to load issues');

        // Clear interval on error to stop polling
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [organizationId]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (severity: string): 'destructive' | 'default' | 'secondary' => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'quota':
        return 'Quota';
      case 'compression':
        return 'Compression';
      case 'migration':
        return 'Migration';
      case 'retention':
        return 'Retention';
      case 'cost':
        return 'Cost';
      default:
        return 'General';
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Error loading issues: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Storage Issues
        </CardTitle>
        <CardDescription>
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'} requiring attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <p className="text-sm">No storage issues detected</p>
            <p className="text-xs mt-1">This organization's storage is well optimized</p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="border rounded-lg p-4 space-y-2"
              >
                {/* Issue Header */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getIcon(issue.severity)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getBadgeVariant(issue.severity)} className="text-xs">
                        {issue.severity.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getTypeLabel(issue.type)}
                      </Badge>
                      {issue.affectedFiles && (
                        <span className="text-xs text-muted-foreground">
                          {issue.affectedFiles} files affected
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium">{issue.message}</p>
                    <p className="text-xs text-muted-foreground">{issue.description}</p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="bg-muted/50 rounded-md p-3 ml-7">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-3 w-3 text-green-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Recommendation</p>
                      <p className="text-xs text-muted-foreground">{issue.recommendation}</p>
                      {issue.potentialSavings && issue.potentialSavings > 0 && (
                        <p className="text-xs font-medium text-green-600 mt-1">
                          Potential savings: {formatCurrency(issue.potentialSavings)}/year
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
