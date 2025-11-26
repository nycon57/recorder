'use client';

import React from 'react';
import useSWR from 'swr';
import { Brain, TrendingUp, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { ConceptBadge, ConceptTypeLabel } from './ConceptBadge';
import { ConceptsEmptyStateCompact } from './ConceptsEmptyState';
import type { Concept, ConceptType } from '@/lib/validations/knowledge';
import { CONCEPT_TYPES } from '@/lib/validations/knowledge';

/**
 * API Response Types
 */
interface ConceptsAPIResponse {
  success: boolean;
  data: {
    concepts: Concept[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  };
}

interface ConceptTypeBreakdown {
  type: ConceptType;
  count: number;
  percentage: number;
}

/**
 * Component Props
 */
interface KnowledgeInsightsCardProps {
  className?: string;
  onConceptClick?: (conceptId: string) => void;
  showTrending?: boolean;
}

/**
 * Fetcher function for SWR
 */
const fetcher = async (url: string): Promise<ConceptsAPIResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch concepts');
  }
  return res.json();
};

/**
 * Calculate concept type breakdown
 */
function calculateTypeBreakdown(concepts: Concept[]): ConceptTypeBreakdown[] {
  const total = concepts.length;
  if (total === 0) return [];

  const typeMap = new Map<ConceptType, number>();

  // Count concepts by type
  concepts.forEach((concept) => {
    const current = typeMap.get(concept.conceptType) || 0;
    typeMap.set(concept.conceptType, current + 1);
  });

  // Convert to array and calculate percentages
  const breakdown = Array.from(typeMap.entries())
    .map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending

  return breakdown;
}

/**
 * Get trending concepts (most mentions in the last week)
 * For now, we'll use last_seen_at as a proxy for trending
 */
function getTrendingConcepts(concepts: Concept[], limit: number = 3): Concept[] {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return concepts
    .filter((c) => new Date(c.lastSeenAt) >= oneWeekAgo)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, limit);
}

/**
 * KnowledgeInsightsCard - Dashboard widget for knowledge graph insights
 *
 * Displays:
 * - Total concepts count
 * - Top 5 most mentioned concepts (with ConceptBadge)
 * - Breakdown by concept type
 * - Optional: trending concepts (most new mentions this week)
 */
export function KnowledgeInsightsCard({
  className,
  onConceptClick,
  showTrending = false,
}: KnowledgeInsightsCardProps) {
  // Fetch concepts from API
  const { data, error, isLoading } = useSWR<ConceptsAPIResponse>(
    '/api/knowledge/concepts?limit=50&sort=mention_count_desc',
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  const concepts = data?.data?.concepts || [];
  const totalConcepts = data?.data?.pagination?.total || 0;
  const topConcepts = concepts.slice(0, 5);
  const typeBreakdown = calculateTypeBreakdown(concepts);
  const trendingConcepts = showTrending ? getTrendingConcepts(concepts) : [];

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <CardTitle>Knowledge Insights</CardTitle>
          </div>
          <CardDescription>Extracted concepts from your content</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex flex-wrap gap-2 mt-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-destructive" />
            <CardTitle>Knowledge Insights</CardTitle>
          </div>
          <CardDescription className="text-destructive">
            Failed to load insights
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Empty state
  if (totalConcepts === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="size-5 text-primary" />
            <CardTitle>Knowledge Insights</CardTitle>
          </div>
          <CardDescription>Extracted concepts from your content</CardDescription>
        </CardHeader>
        <CardContent>
          <ConceptsEmptyStateCompact variant="no-concepts" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        className
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center rounded-lg bg-primary/10 p-2">
            <Brain className="size-5 text-primary" />
          </div>
          <div>
            <CardTitle>Knowledge Insights</CardTitle>
            <CardDescription>{totalConcepts} concepts extracted</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Concepts */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-yellow-500" />
            Top Concepts
          </h4>
          <div className="flex flex-wrap gap-2">
            {topConcepts.map((concept) => (
              <ConceptBadge
                key={concept.id}
                name={concept.name}
                type={concept.conceptType}
                size="sm"
                showIcon
                onClick={
                  onConceptClick ? () => onConceptClick(concept.id) : undefined
                }
              />
            ))}
          </div>
        </div>

        {/* Type Breakdown */}
        {typeBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Breakdown by Type</h4>
            <div className="space-y-2">
              {typeBreakdown.map((item) => (
                <div
                  key={item.type}
                  className="flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <ConceptTypeLabel type={item.type} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-muted-foreground">
                      {item.count}
                    </span>
                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trending Concepts (Optional) */}
        {showTrending && trendingConcepts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="size-4 text-green-500" />
              Trending This Week
            </h4>
            <div className="flex flex-wrap gap-2">
              {trendingConcepts.map((concept) => (
                <div
                  key={concept.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                >
                  <ConceptBadge
                    name={concept.name}
                    type={concept.conceptType}
                    size="sm"
                    showIcon={false}
                    onClick={
                      onConceptClick
                        ? () => onConceptClick(concept.id)
                        : undefined
                    }
                    className="border-0"
                  />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    {concept.mentionCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{totalConcepts}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{typeBreakdown.length}</p>
              <p className="text-xs text-muted-foreground">Types</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {concepts.reduce((sum, c) => sum + c.mentionCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Mentions</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading skeleton for the card
 */
export function KnowledgeInsightsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Concepts Skeleton */}
        <div>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20" />
            ))}
          </div>
        </div>

        {/* Type Breakdown Skeleton */}
        <div>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-24" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-1.5 w-12 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Stats Skeleton */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-8 w-12 mx-auto mb-1" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
