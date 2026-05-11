'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Clock, TrendingUp, DollarSign } from 'lucide-react';

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

interface ActionPlan {
  immediate: number;
  shortTerm: number;
  longTerm: number;
  totalSavings: number;
}

export default function ActionPlanOverview() {
  const {
    data: plan,
    isLoading,
    error,
  } = useQuery<ActionPlan, Error>({
    queryKey: ['analytics', 'recommendations', 'action-plan'],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        '/api/analytics/recommendations/action-plan',
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch action plan');
      }

      const { data } = await response.json();

      return {
        immediate: data.immediate?.count || 0,
        shortTerm: data.shortTerm?.count || 0,
        longTerm: data.longTerm?.count || 0,
        totalSavings: data.totalPotentialSavings || 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          'action-card-1',
          'action-card-2',
          'action-card-3',
          'action-card-4',
        ].map((skeletonId) => (
          <Card key={skeletonId}>
            <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="size-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[60px]" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Error loading action plan: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Immediate Actions */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Immediate Actions
          </CardTitle>
          <AlertCircle className="size-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {plan.immediate}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Implement within 24 hours
          </p>
        </CardContent>
      </Card>

      {/* Short-Term Actions */}
      <Card className="border-yellow-200 dark:border-yellow-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Short-Term Actions
          </CardTitle>
          <Clock className="size-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {plan.shortTerm}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Implement within 1 week
          </p>
        </CardContent>
      </Card>

      {/* Long-Term Strategic */}
      <Card className="border-blue-200 dark:border-blue-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Long-Term Strategic
          </CardTitle>
          <TrendingUp className="size-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {plan.longTerm}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Plan for next quarter
          </p>
        </CardContent>
      </Card>

      {/* Total Potential Savings */}
      <Card className="border-green-200 dark:border-green-900">
        <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Potential Savings
          </CardTitle>
          <DollarSign className="size-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(plan.totalSavings)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Annual cost reduction
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
