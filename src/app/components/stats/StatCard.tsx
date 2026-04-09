'use client';

import React, { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  /**
   * Card title
   */
  title: string;

  /**
   * Main value to display
   */
  value: string | number;

  /**
   * Optional description or secondary text
   */
  description?: string;

  /**
   * Icon component from lucide-react
   */
  icon?: LucideIcon;

  /**
   * Icon background color classes
   */
  iconBg?: string;

  /**
   * Icon color classes
   */
  iconColor?: string;

  /**
   * Whether the card is in loading state
   */
  loading?: boolean;

  /**
   * Optional trend indicator (e.g., "+12.5%" or "-3.2%")
   */
  trend?: ReactNode;

  /**
   * Additional CSS classes for the card
   */
  className?: string;

  /**
   * Card variant for different visual styles
   */
  variant?: 'default' | 'compact';
}

/**
 * StatCard Component
 * Reusable card for displaying statistics with icon, value, and optional trend
 *
 * Features:
 * - Customizable icon with background colors
 * - Loading skeleton state
 * - Trend indicators
 * - Hover animations
 * - Compact variant for dense layouts
 */
export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg = 'bg-primary/10',
  iconColor = 'text-primary',
  loading = false,
  trend,
  className,
  variant = 'default',
}: StatCardProps) {
  if (loading) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-4 w-4 rounded-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className={cn('mb-2', variant === 'compact' ? 'h-6 w-[100px]' : 'h-8 w-[120px]')} />
          <Skeleton className="h-3 w-[80px]" />
        </CardContent>
      </Card>
    );
  }

  const isCompact = variant === 'compact';

  return (
    <Card
      className={cn(
        'overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg',
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className={cn('font-medium', isCompact ? 'text-xs' : 'text-sm')}>
          {title}
        </CardTitle>
        {Icon && (
          <div
            className={cn(
              'inline-flex items-center justify-center rounded-lg transition-transform duration-200 hover:scale-110',
              iconBg,
              isCompact ? 'p-1.5' : 'p-2'
            )}
          >
            <Icon className={cn(iconColor, isCompact ? 'size-3' : 'size-4')} />
          </div>
        )}
      </CardHeader>
      <CardContent className={cn(isCompact ? 'pb-3' : 'pb-4')}>
        <div className={cn('font-bold mb-1', isCompact ? 'text-xl' : 'text-2xl')}>
          {value}
        </div>
        {(description || trend) && (
          <div className="flex items-center gap-2">
            {description && (
              <p className={cn('text-muted-foreground', isCompact ? 'text-[10px]' : 'text-xs')}>
                {description}
              </p>
            )}
            {trend && <div className="text-xs">{trend}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
