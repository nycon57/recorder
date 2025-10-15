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
 * Centralized status indicators with icons and colors
 */
const statusConfig: Record<
  RecordingStatus,
  {
    label: string;
    icon: LucideIcon;
    bg: string;
    text: string;
    border: string;
    animate?: boolean;
  }
> = {
  uploading: {
    label: 'Uploading',
    icon: Upload,
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
    animate: true,
  },
  transcribing: {
    label: 'Transcribing',
    icon: Sparkles,
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-500/20',
    animate: true,
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
    animate: true,
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-muted-foreground/20',
    animate: false,
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    animate: false,
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    bg: 'bg-destructive/10',
    text: 'text-destructive',
    border: 'border-destructive/20',
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

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    default: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  };

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors duration-200',
    config.text,
    variant === 'outline'
      ? `border ${config.border} bg-transparent`
      : `${config.bg} border border-transparent`,
    sizeClasses[size],
    className
  );

  const iconClasses = cn(
    iconSizes[size],
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

  const dotSizes = {
    sm: 'h-2 w-2',
    default: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  };

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <span
        className={cn(
          'rounded-full',
          dotSizes[size],
          config.bg.replace('/10', '').replace('/20', ''),
          config.animate && 'animate-pulse'
        )}
        aria-label={config.label}
        title={config.label}
      />
      {showLabel && (
        <span className={cn('text-sm font-medium', config.text)}>{config.label}</span>
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

  const getStepColor = (status: ProcessingStep['status']) => {
    switch (status) {
      case 'completed':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'active':
        return 'text-primary';
      case 'failed':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => {
        const Icon = getStepIcon(step.status);
        const color = getStepColor(step.status);
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
                'flex items-center justify-center h-6 w-6 rounded-full border-2 bg-background z-10',
                step.status === 'completed'
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : step.status === 'active'
                  ? 'border-primary bg-primary/10'
                  : step.status === 'failed'
                  ? 'border-destructive bg-destructive/10'
                  : 'border-muted-foreground/30'
              )}
            >
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  color,
                  step.status === 'active' && 'animate-spin'
                )}
              />
            </div>

            {/* Content */}
            <div className="flex-1 pb-4">
              <p className={cn('text-sm font-medium', color)}>{step.label}</p>
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
 * Utility function to get status configuration
 */
export function getStatusConfig(status: RecordingStatus) {
  return statusConfig[status];
}
