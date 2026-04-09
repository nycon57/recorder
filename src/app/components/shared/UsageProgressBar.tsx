'use client';

import * as React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Progress } from '@/app/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/components/ui/tooltip';

/**
 * Progress bar variant definitions
 * Color-coded based on usage percentage
 */
const progressVariants = cva('transition-all duration-300', {
  variants: {
    status: {
      safe: '[&>div]:bg-green-500 dark:[&>div]:bg-green-600',
      warning: '[&>div]:bg-yellow-500 dark:[&>div]:bg-yellow-600',
      danger: '[&>div]:bg-red-500 dark:[&>div]:bg-red-600',
    },
  },
  defaultVariants: {
    status: 'safe',
  },
});

/**
 * Props for UsageProgressBar component
 */
export interface UsageProgressBarProps {
  /**
   * Current usage value
   */
  current: number;
  /**
   * Maximum allowed value
   */
  max: number;
  /**
   * Label for the usage metric
   */
  label: string;
  /**
   * Unit of measurement (e.g., "GB", "minutes", "requests")
   */
  unit?: string;
  /**
   * Description or additional context
   */
  description?: string;
  /**
   * Show percentage text
   */
  showPercentage?: boolean;
  /**
   * Show current/max values
   */
  showValues?: boolean;
  /**
   * Threshold for warning state (percentage)
   * @default 70
   */
  warningThreshold?: number;
  /**
   * Threshold for danger state (percentage)
   * @default 90
   */
  dangerThreshold?: number;
  /**
   * Additional tooltip content
   */
  tooltipContent?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Size variant
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Get usage status based on percentage
 */
function getUsageStatus(
  percentage: number,
  warningThreshold: number,
  dangerThreshold: number
): 'safe' | 'warning' | 'danger' {
  if (percentage >= dangerThreshold) return 'danger';
  if (percentage >= warningThreshold) return 'warning';
  return 'safe';
}

/**
 * UsageProgressBar Component
 *
 * A visual progress bar for displaying resource usage with color-coded thresholds
 * and detailed tooltip information. Automatically changes color based on usage level:
 * - Green (< 70%): Safe usage
 * - Yellow (70-90%): Warning - approaching limit
 * - Red (> 90%): Danger - near or over limit
 *
 * Features:
 * - Configurable warning and danger thresholds
 * - Optional percentage and value display
 * - Detailed tooltip with usage information
 * - Multiple size variants
 * - Smooth color transitions
 * - Dark mode support
 *
 * @example
 * ```tsx
 * // Basic usage
 * <UsageProgressBar
 *   current={7.5}
 *   max={10}
 *   label="Storage"
 *   unit="GB"
 *   showPercentage
 *   showValues
 * />
 *
 * // With custom thresholds and description
 * <UsageProgressBar
 *   current={450}
 *   max={500}
 *   label="API Requests"
 *   unit="requests"
 *   description="Monthly API quota"
 *   warningThreshold={80}
 *   dangerThreshold={95}
 *   tooltipContent={<div>Resets on the 1st of each month</div>}
 * />
 * ```
 */
export function UsageProgressBar({
  current,
  max,
  label,
  unit = '',
  description,
  showPercentage = true,
  showValues = true,
  warningThreshold = 70,
  dangerThreshold = 90,
  tooltipContent,
  className,
  size = 'md',
}: UsageProgressBarProps) {
  // Calculate percentage (cap at 100 for display)
  const percentage = Math.min((current / max) * 100, 100);
  const actualPercentage = (current / max) * 100; // Can exceed 100%

  // Determine status
  const status = getUsageStatus(actualPercentage, warningThreshold, dangerThreshold);

  // Size classes
  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Status icon
  const StatusIcon = status === 'danger' || status === 'warning' ? AlertTriangle : Info;

  // Tooltip details
  const tooltipDetails = (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="font-semibold text-sm">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Current:</span>
          <span className="font-medium">
            {formatNumber(current)} {unit}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Limit:</span>
          <span className="font-medium">
            {formatNumber(max)} {unit}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground">Remaining:</span>
          <span className="font-medium">
            {formatNumber(Math.max(0, max - current))} {unit}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs pt-1 border-t border-border/50">
          <span className="text-muted-foreground">Usage:</span>
          <span
            className={cn(
              'font-semibold',
              status === 'danger' && 'text-red-500',
              status === 'warning' && 'text-yellow-500',
              status === 'safe' && 'text-green-500'
            )}
          >
            {actualPercentage.toFixed(1)}%
          </span>
        </div>
      </div>
      {tooltipContent && (
        <>
          <div className="border-t border-border/50 pt-2">
            {tooltipContent}
          </div>
        </>
      )}
      {actualPercentage > 100 && (
        <div className="flex items-start gap-2 text-xs text-red-500 bg-red-500/10 rounded p-2">
          <AlertTriangle className="size-3 mt-0.5 shrink-0" />
          <span>You have exceeded your limit</span>
        </div>
      )}
    </div>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('font-medium', textSizeClasses[size])}>
            {label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  'focus:outline-none focus:ring-2 focus:ring-ring rounded-full',
                  status === 'danger' && 'text-red-500',
                  status === 'warning' && 'text-yellow-500',
                  status === 'safe' && 'text-muted-foreground'
                )}
                aria-label={`${label} usage information`}
              >
                <StatusIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltipDetails}
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {showValues && (
            <span className={cn('text-muted-foreground', textSizeClasses[size])}>
              {formatNumber(current)} / {formatNumber(max)} {unit}
            </span>
          )}
          {showPercentage && (
            <span
              className={cn(
                'font-semibold tabular-nums',
                textSizeClasses[size],
                status === 'danger' && 'text-red-500',
                status === 'warning' && 'text-yellow-500',
                status === 'safe' && 'text-green-500'
              )}
            >
              {actualPercentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <Progress
        value={percentage}
        className={cn(
          progressVariants({ status }),
          sizeClasses[size],
          'bg-secondary'
        )}
        aria-label={`${label}: ${actualPercentage.toFixed(1)}% used`}
      />

      {/* Optional description */}
      {description && (
        <p className={cn('text-muted-foreground', textSizeClasses[size])}>
          {description}
        </p>
      )}

      {/* Warning message if over limit */}
      {actualPercentage > 100 && (
        <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 rounded-md px-3 py-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">
            Limit exceeded by {formatNumber(current - max)} {unit}
          </span>
        </div>
      )}
    </div>
  );
}
