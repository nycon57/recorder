'use client';

import React, { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface StatsGridProps {
  /**
   * Child stat cards
   */
  children: ReactNode;

  /**
   * Number of columns for different breakpoints
   */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };

  /**
   * Gap between cards
   */
  gap?: 'sm' | 'md' | 'lg';

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * StatsGrid Component
 * Responsive grid layout wrapper for StatCard components
 *
 * Features:
 * - Responsive column layout
 * - Configurable gaps
 * - Stagger animation support
 */
export function StatsGrid({
  children,
  columns = { sm: 2, md: 2, lg: 4 },
  gap = 'md',
  className,
}: StatsGridProps) {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  // Static mappings for Tailwind grid columns (required for proper tree-shaking)
  const gridColsMap: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };

  const mdGridColsMap: Record<number, string> = {
    1: 'md:grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-3',
    4: 'md:grid-cols-4',
    5: 'md:grid-cols-5',
    6: 'md:grid-cols-6',
  };

  const lgGridColsMap: Record<number, string> = {
    1: 'lg:grid-cols-1',
    2: 'lg:grid-cols-2',
    3: 'lg:grid-cols-3',
    4: 'lg:grid-cols-4',
    5: 'lg:grid-cols-5',
    6: 'lg:grid-cols-6',
  };

  const xlGridColsMap: Record<number, string> = {
    1: 'xl:grid-cols-1',
    2: 'xl:grid-cols-2',
    3: 'xl:grid-cols-3',
    4: 'xl:grid-cols-4',
    5: 'xl:grid-cols-5',
    6: 'xl:grid-cols-6',
  };

  // Build grid column classes using static mappings
  const gridColClasses = [];

  if (columns.sm && gridColsMap[columns.sm]) {
    gridColClasses.push(gridColsMap[columns.sm]);
  }

  if (columns.md && mdGridColsMap[columns.md]) {
    gridColClasses.push(mdGridColsMap[columns.md]);
  }

  if (columns.lg && lgGridColsMap[columns.lg]) {
    gridColClasses.push(lgGridColsMap[columns.lg]);
  }

  if (columns.xl && xlGridColsMap[columns.xl]) {
    gridColClasses.push(xlGridColsMap[columns.xl]);
  }

  return (
    <div
      className={cn(
        'grid',
        ...gridColClasses,
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
