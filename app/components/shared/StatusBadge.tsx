'use client';

import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Upload,
  Sparkles,
  LucideIcon,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { statusColors, badgeSize, badgeIconSize } from '@/lib/design-tokens';

/**
 * Status type definitions
 */
export type RecordingStatus =
  | 'uploading'
  | 'transcribing'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'pending';

/**
 * Status Configuration
 * Uses centralized design tokens for consistent colors
 */
const statusConfig: Record<
  RecordingStatus,
  {
    label: string;
    icon: LucideIcon;
    colorKey: keyof typeof statusColors;
    animate?: boolean;
  }
> = {
  uploading: {
    label: 'Uploading',
    icon: Upload,
    colorKey: 'info',
    animate: true,
  },
  transcribing: {
    label: 'Transcribing',
    icon: Sparkles,
    colorKey: 'processing',
    animate: true,
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    colorKey: 'warning',
    animate: true,
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    colorKey: 'neutral',
    animate: false,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    colorKey: 'success',
    animate: false,
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    colorKey: 'error',
    animate: false,
  },
};

/**
 * StatusBadge Component
 *
 * Consistent badge component for displaying processing status
 * Includes animated icons for in-progress states
 *
 * @param status - Recording status
 * @param showIcon - Whether to show the icon (default: true)
 * @param size - Badge size (default, sm, lg)
 * @param variant - Badge variant (default, outline)
 * @param className - Additional CSS classes
 */
interface StatusBadgeProps {
  status: RecordingStatus;
  showIcon?: boolean;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline';
  progress?: number; // Optional progress percentage (0-100)
  className?: string;
}

export function StatusBadge({
  status,
  showIcon = true,
  size = 'default',
  variant = 'default',
  progress,
  className,
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const colors = statusColors[config.colorKey];

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors duration-200',
    colors.text,
    variant === 'outline'
      ? `border ${colors.border} bg-transparent`
      : `${colors.bg} border border-transparent`,
    badgeSize[size],
    className
  );

  const iconClasses = cn(
    badgeIconSize[size],
    config.animate && (status === 'processing' || status === 'uploading')
      ? 'animate-spin'
      : '',
    config.animate && status === 'transcribing' ? 'animate-pulse' : ''
  );

  return (
    <span className={baseClasses}>
      {showIcon && <Icon className={iconClasses} aria-hidden="true" />}
      <span>
        {config.label}
        {progress !== undefined && progress > 0 && ` (${progress}%)`}
      </span>
    </span>
  );
}

/**
 * StatusIndicator Component
 *
 * Simple colored dot indicator for status
 * Useful for compact displays or table rows
 */
interface StatusIndicatorProps {
  status: RecordingStatus;
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function StatusIndicator({
  status,
  size = 'default',
  showLabel = false,
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const colors = statusColors[config.colorKey];

  const dotSizes = {
    sm: 'size-2',
    default: 'size-2.5',
    lg: 'size-3',
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'rounded-full',
          dotSizes[size],
          colors.solid,
          config.animate && 'animate-pulse'
        )}
        aria-label={config.label}
        title={config.label}
      />
      {showLabel && (
        <span className={cn('text-sm font-medium', colors.text)}>{config.label}</span>
      )}
    </div>
  );
}

/**
 * ProcessingSteps Component
 *
 * Visual representation of processing pipeline stages
 * Shows current step with status indicators
 */
interface ProcessingStep {
  label: string;
  status: 'completed' | 'active' | 'pending' | 'failed';
  description?: string;
}

interface ProcessingStepsProps {
  steps: ProcessingStep[];
  className?: string;
}

export function ProcessingSteps({ steps, className }: ProcessingStepsProps) {
  const getStepIcon = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return CheckCircle2;
      case 'active':
        return Loader2;
      case 'failed':
        return XCircle;
      default:
        return Clock;
    }
  };

  const getStepColors = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return statusColors.success;
      case 'active':
        return { ...statusColors.info, text: 'text-primary' };
      case 'failed':
        return statusColors.error;
      default:
        return statusColors.neutral;
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.status);
        const colors = getStepColors(step.status);
        const isLast = index === steps.length - 1;

        return (
          <div key={index} className="relative flex gap-3">
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-[11px] top-8 bottom-0 w-px bg-border" />
            )}

            {/* Icon */}
            <div
              className={cn(
                'flex items-center justify-center size-6 rounded-full border-2 bg-background z-10',
                step.status === 'completed'
                  ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20'
                  : step.status === 'active'
                  ? 'border-primary bg-primary/10 dark:bg-primary/20'
                  : step.status === 'failed'
                  ? 'border-destructive bg-destructive/10 dark:bg-destructive/20'
                  : 'border-muted-foreground/30 dark:border-muted-foreground/20'
              )}
            >
              <Icon
                className={cn(
                  badgeIconSize.default,
                  colors.text,
                  step.status === 'active' && 'animate-spin'
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <p className={cn('text-sm font-medium', colors.text)}>{step.label}</p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * getStatusConfig
 *
 * Utility function to get status configuration with colors from design tokens
 */
export function getStatusConfig(status: RecordingStatus) {
  const config = statusConfig[status];
  const colors = statusColors[config.colorKey];
  return {
    ...config,
    bg: colors.bg,
    text: colors.text,
    border: colors.border,
    solid: colors.solid,
  };
}
