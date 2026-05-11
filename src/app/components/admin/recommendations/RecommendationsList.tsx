'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { formatCurrency } from '@/lib/utils/formatting';

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  savings: number;
  timeframe: 'immediate' | 'short-term' | 'long-term';
  implementation: string;
  status: 'pending' | 'in-progress' | 'completed' | 'dismissed';
}

export default function RecommendationsList() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<
    'all' | 'immediate' | 'short-term' | 'long-term'
  >('all');
  const {
    data: recommendations = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Recommendation[], Error>({
    queryKey: ['analytics', 'recommendations'],
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/analytics/recommendations', {
        signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      const { data } = await response.json();
      return data.recommendations || [];
    },
  });

  const handleAction = async (
    id: string,
    action: 'implement' | 'defer' | 'dismiss',
  ) => {
    try {
      // TODO: Implement actual API call
      console.log(`Action ${action} for recommendation ${id}`);
      // Refresh recommendations after action
      await refetch();
    } catch (err) {
      console.error('Error performing action:', err);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-green-600 dark:text-green-500';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'low':
        return 'text-blue-600 dark:text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low':
        return 'text-green-600 dark:text-green-500';
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-500';
      case 'high':
        return 'text-red-600 dark:text-red-500';
      default:
        return 'text-muted-foreground';
    }
  };

  const getTimeframeBadgeVariant = (
    timeframe: string,
  ): 'default' | 'secondary' | 'destructive' => {
    switch (timeframe) {
      case 'immediate':
        return 'destructive';
      case 'short-term':
        return 'secondary';
      case 'long-term':
        return 'default';
      default:
        return 'default';
    }
  };

  const filteredRecommendations =
    filter === 'all'
      ? recommendations
      : recommendations.filter((r) => r.timeframe === filter);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[300px] mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              'recommendation-skeleton-1',
              'recommendation-skeleton-2',
              'recommendation-skeleton-3',
            ].map((skeletonId) => (
              <Skeleton key={skeletonId} className="h-32 w-full" />
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
            Error loading recommendations: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Optimization Recommendations</CardTitle>
            <CardDescription>
              {filteredRecommendations.length} recommendation
              {filteredRecommendations.length !== 1 ? 's' : ''} available
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === 'immediate' ? 'default' : 'outline'}
              onClick={() => setFilter('immediate')}
            >
              Immediate
            </Button>
            <Button
              size="sm"
              variant={filter === 'short-term' ? 'default' : 'outline'}
              onClick={() => setFilter('short-term')}
            >
              Short-Term
            </Button>
            <Button
              size="sm"
              variant={filter === 'long-term' ? 'default' : 'outline'}
              onClick={() => setFilter('long-term')}
            >
              Long-Term
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredRecommendations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="size-12 mx-auto mb-4 text-green-600" />
            <p className="text-sm">
              No {filter !== 'all' ? filter : ''} recommendations at this time
            </p>
            <p className="text-xs mt-1">Your storage is well optimized!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRecommendations.map((rec) => (
              <Collapsible
                key={rec.id}
                open={expandedId === rec.id}
                onOpenChange={(open) => setExpandedId(open ? rec.id : null)}
              >
                <div className="border rounded-lg p-4 space-y-3">
                  {/* Recommendation Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-sm">{rec.title}</h3>
                        <Badge
                          variant={getTimeframeBadgeVariant(rec.timeframe)}
                        >
                          {rec.timeframe.replace('-', ' ').toUpperCase()}
                        </Badge>
                        {rec.status === 'completed' && (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle2 className="size-3 mr-1" />
                            Completed
                          </Badge>
                        )}
                        {rec.status === 'in-progress' && (
                          <Badge variant="outline" className="text-blue-600">
                            <Clock className="size-3 mr-1" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            Impact:{' '}
                          </span>
                          <span
                            className={`font-medium ${getImpactColor(rec.impact)}`}
                          >
                            {rec.impact.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Effort:{' '}
                          </span>
                          <span
                            className={`font-medium ${getEffortColor(rec.effort)}`}
                          >
                            {rec.effort.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Savings:{' '}
                          </span>
                          <span className="font-medium text-green-600">
                            {formatCurrency(rec.savings)}/year
                          </span>
                        </div>
                      </div>
                    </div>

                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {expandedId === rec.id ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  {/* Expanded Content */}
                  <CollapsibleContent className="space-y-3 pt-3 border-t">
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FileText className="size-4" />
                        Implementation Guide
                      </h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-xs whitespace-pre-line">
                          {rec.implementation}
                        </p>
                      </div>
                    </div>

                    {rec.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleAction(rec.id, 'implement')}
                        >
                          Mark as In Progress
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAction(rec.id, 'defer')}
                        >
                          Defer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAction(rec.id, 'dismiss')}
                        >
                          Dismiss
                        </Button>
                      </div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
