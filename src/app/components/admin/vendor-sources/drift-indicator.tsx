'use client';

/**
 * DriftIndicator
 *
 * Displays days-since-last-success relative to the source's freshness_target.
 * Color codes: green < 50% of budget, amber 50-100%, red > 100%.
 * Drift is ALWAYS shown as absolute days text — color is supplementary only.
 * Tooltip shows the raw freshness_target for operator reference.
 *
 * TRIB-152
 */

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';

export type DriftLevel = 'healthy' | 'warning' | 'critical';

interface DriftIndicatorProps {
  daysSinceSuccess: number | null;
  freshnessTarget: string;
  className?: string;
}

function parseDays(target: string): number | null {
  const m = /^(\d+)\s*day/i.exec(target.trim());
  return m ? parseInt(m[1], 10) : null;
}

export function getDriftLevel(
  daysSinceSuccess: number | null,
  targetDays: number | null
): DriftLevel {
  if (daysSinceSuccess === null || targetDays === null) return 'critical';
  const pct = daysSinceSuccess / targetDays;
  if (pct < 0.5) return 'healthy';
  if (pct <= 1.0) return 'warning';
  return 'critical';
}

const LEVEL_CLASSES: Record<DriftLevel, string> = {
  healthy: 'text-green-700 dark:text-green-400',
  warning: 'text-amber-700 dark:text-amber-400',
  critical: 'text-red-700 dark:text-red-400',
};

const LEVEL_LABEL: Record<DriftLevel, string> = {
  healthy: 'Within budget',
  warning: 'Approaching stale',
  critical: 'Past freshness target',
};

export function DriftIndicator({
  daysSinceSuccess,
  freshnessTarget,
  className = '',
}: DriftIndicatorProps) {
  const targetDays = parseDays(freshnessTarget);
  const level = getDriftLevel(daysSinceSuccess, targetDays);
  const colorClass = LEVEL_CLASSES[level];

  const label =
    daysSinceSuccess === null
      ? 'Never synced'
      : `${daysSinceSuccess}d`;

  const pctText =
    daysSinceSuccess !== null && targetDays !== null
      ? ` (${Math.round((daysSinceSuccess / targetDays) * 100)}%)`
      : '';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 font-mono text-xs font-medium tabular-nums ${colorClass} ${className}`}
          aria-label={`${LEVEL_LABEL[level]}: ${label}${pctText}`}
        >
          <span
            className="inline-block size-1.5 rounded-full bg-current"
            aria-hidden="true"
          />
          {label}{pctText}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">
          {LEVEL_LABEL[level]}
          {targetDays !== null ? ` — target: ${freshnessTarget}` : ''}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
