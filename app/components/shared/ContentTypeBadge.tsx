'use client';

import {
  Video,
  Music,
  FileText,
  StickyNote,
  Camera,
  LucideIcon,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils/cn';

/**
 * Content Type definitions with consistent colors
 */
export type ContentType = 'recording' | 'video' | 'audio' | 'document' | 'text';

/**
 * Content Type Configuration
 * Centralized color scheme for all content types
 */
const contentTypeConfig: Record<
  ContentType,
  {
    label: string;
    icon: LucideIcon;
    bg: string;
    text: string;
    border: string;
    hoverBg: string;
  }
> = {
  recording: {
    label: 'Recording',
    icon: Camera,
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
    hoverBg: 'hover:bg-blue-500/20 dark:hover:bg-blue-500/30',
  },
  video: {
    label: 'Video',
    icon: Video,
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-500/20',
    hoverBg: 'hover:bg-violet-500/20 dark:hover:bg-violet-500/30',
  },
  audio: {
    label: 'Audio',
    icon: Music,
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/20',
    hoverBg: 'hover:bg-orange-500/20 dark:hover:bg-orange-500/30',
  },
  document: {
    label: 'Document',
    icon: FileText,
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/20',
    hoverBg: 'hover:bg-sky-500/20 dark:hover:bg-sky-500/30',
  },
  text: {
    label: 'Note',
    icon: StickyNote,
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    hoverBg: 'hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30',
  },
};

/**
 * ContentTypeBadge Component
 *
 * Consistent badge component for displaying content types
 * Uses centralized color scheme from design system
 *
 * @param type - Content type (recording, video, audio, document, text)
 * @param showIcon - Whether to show the icon (default: true)
 * @param size - Badge size (default, sm, lg)
 * @param variant - Badge variant (default, outline)
 * @param className - Additional CSS classes
 */
interface ContentTypeBadgeProps {
  type: ContentType;
  showIcon?: boolean;
  size?: 'default' | 'sm' | 'lg';
  variant?: 'default' | 'outline';
  className?: string;
}

export function ContentTypeBadge({
  type,
  showIcon = true,
  size = 'default',
  variant = 'default',
  className,
}: ContentTypeBadgeProps) {
  const config = contentTypeConfig[type];
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
      ? `border ${config.border} bg-transparent ${config.hoverBg}`
      : `${config.bg} border border-transparent ${config.hoverBg}`,
    sizeClasses[size],
    className
  );

  return (
    <span className={baseClasses}>
      {showIcon && <Icon className={iconSizes[size]} aria-hidden="true" />}
      <span>{config.label}</span>
    </span>
  );
}

/**
 * ContentTypeIcon Component
 *
 * Standalone icon for content type
 * Useful for smaller displays or icon-only indicators
 */
interface ContentTypeIconProps {
  type: ContentType;
  size?: 'sm' | 'default' | 'lg';
  showBackground?: boolean;
  className?: string;
}

export function ContentTypeIcon({
  type,
  size = 'default',
  showBackground = true,
  className,
}: ContentTypeIconProps) {
  const config = contentTypeConfig[type];
  const Icon = config.icon;

  const iconSizes = {
    sm: 'h-4 w-4',
    default: 'h-5 w-5',
    lg: 'h-6 w-6',
  };

  const bgSizes = {
    sm: 'p-1.5',
    default: 'p-2',
    lg: 'p-2.5',
  };

  if (showBackground) {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-lg',
          config.bg,
          bgSizes[size],
          className
        )}
        title={config.label}
      >
        <Icon className={cn(iconSizes[size], config.text)} aria-label={config.label} />
      </div>
    );
  }

  return (
    <Icon
      className={cn(iconSizes[size], config.text, className)}
      aria-label={config.label}
      title={config.label}
    />
  );
}

/**
 * getContentTypeColor
 *
 * Utility function to get color classes for a content type
 * Useful for custom components that need consistent theming
 */
export function getContentTypeColor(type: ContentType) {
  return contentTypeConfig[type];
}

/**
 * getContentTypeLabel
 *
 * Get the display label for a content type
 */
export function getContentTypeLabel(type: ContentType): string {
  return contentTypeConfig[type].label;
}
