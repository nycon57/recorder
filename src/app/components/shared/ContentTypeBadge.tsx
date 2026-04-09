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
import { contentTypeColors, badgeSize, badgeIconSize, iconSize } from '@/lib/design-tokens';

/**
 * Content Type definitions with consistent colors
 */
export type ContentType = 'recording' | 'video' | 'audio' | 'document' | 'text';

/**
 * Content Type Configuration
 * Uses centralized design tokens for colors
 */
const contentTypeConfig: Record<
  ContentType,
  {
    label: string;
    icon: LucideIcon;
  }
> = {
  recording: {
    label: 'Recording',
    icon: Camera,
  },
  video: {
    label: 'Video',
    icon: Video,
  },
  audio: {
    label: 'Audio',
    icon: Music,
  },
  document: {
    label: 'Document',
    icon: FileText,
  },
  text: {
    label: 'Note',
    icon: StickyNote,
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
  const colors = contentTypeColors[type];
  const Icon = config.icon;

  const baseClasses = cn(
    'inline-flex items-center gap-1.5 font-medium rounded-full transition-colors duration-200',
    colors.text,
    variant === 'outline'
      ? `border ${colors.border} bg-transparent ${colors.hover}`
      : `${colors.bg} border border-transparent ${colors.hover}`,
    badgeSize[size],
    className
  );

  return (
    <span className={baseClasses}>
      {showIcon && <Icon className={badgeIconSize[size]} aria-hidden="true" />}
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
  const colors = contentTypeColors[type];
  const Icon = config.icon;

  const iconSizeMap = {
    sm: iconSize.default,
    default: iconSize.md,
    lg: iconSize.lg,
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
          colors.bg,
          bgSizes[size],
          className
        )}
        title={config.label}
      >
        <Icon className={cn(iconSizeMap[size], colors.text)} aria-label={config.label} />
      </div>
    );
  }

  return (
    <Icon
      className={cn(iconSizeMap[size], colors.text, className)}
    />
  );
}

/**
 * getContentTypeColor
 *
 * Utility function to get color classes for a content type
 * Uses design tokens for consistent theming
 */
export function getContentTypeColor(type: ContentType) {
  return contentTypeColors[type];
}

/**
 * getContentTypeLabel
 *
 * Get the display label for a content type
 */
export function getContentTypeLabel(type: ContentType): string {
  return contentTypeConfig[type].label;
}
