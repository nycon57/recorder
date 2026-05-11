'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, AlertCircle, Info, TrendingUp } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
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
  const {
    data: issues = [],
    isLoading,
    error,
  } = useQuery<Issue[], Error>({
    queryKey: ['analytics', 'organizations', organizationId, 'issues'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/analytics/organizations/${organizationId}/issues`,
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch organization issues');
      }

      const { data } = await response.json();
      return data.issues || [];
    },
    refetchInterval: 60000,
  });

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="size-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="size-4 text-yellow-600" />;
      case 'info':
        return <Info className="size-4 text-blue-600" />;
      default:
        return <Info className="size-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (
    severity: string,
  ): 'destructive' | 'default' | 'secondary' => {
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-4 w-[250px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {['org-issue-1', 'org-issue-2', 'org-issue-3'].map((skeletonId) => (
              <Skeleton key={skeletonId} className="h-24 w-full" />
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
          <p className="text-sm text-destructive">
            Error loading issues: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-5" />
          Storage Issues
        </CardTitle>
        <CardDescription>
          {issues.length} {issues.length === 1 ? 'issue' : 'issues'} requiring
          attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="size-12 mx-auto mb-4 text-green-600" />
            <p className="text-sm">No storage issues detected</p>
            <p className="text-xs mt-1">
              This organization's storage is well optimized
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {issues.map((issue) => (
              <div key={issue.id} className="border rounded-lg p-4 space-y-2">
                {/* Issue Header */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getIcon(issue.severity)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={getBadgeVariant(issue.severity)}
                        className="text-xs"
                      >
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
                    <p className="text-xs text-muted-foreground">
                      {issue.description}
                    </p>
                  </div>
                </div>

                {/* Recommendation */}
                <div className="bg-muted/50 rounded-md p-3 ml-7">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="size-3 text-green-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Recommendation</p>
                      <p className="text-xs text-muted-foreground">
                        {issue.recommendation}
                      </p>
                      {issue.potentialSavings && issue.potentialSavings > 0 && (
                        <p className="text-xs font-medium text-green-600 mt-1">
                          Potential savings:{' '}
                          {formatCurrency(issue.potentialSavings)}/year
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
