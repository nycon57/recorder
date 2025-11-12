'use client';

import * as React from 'react';
import {
  Video,
  Mic,
  FileText,
  File,
  Monitor,
  LucideIcon
} from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import type { ContentType } from '@/lib/types/database';

interface ContentTypeBadgeProps {
  contentType: ContentType | null;
  className?: string;
  showIcon?: boolean;
}

interface ContentTypeConfig {
  label: string;
  icon: LucideIcon;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}

const contentTypeConfig: Record<NonNullable<ContentType>, ContentTypeConfig> = {
  recording: {
    label: 'Screen Recording',
    icon: Monitor,
    variant: 'default',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  },
  video: {
    label: 'Video',
    icon: Video,
    variant: 'secondary',
    className: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20',
  },
  audio: {
    label: 'Audio',
    icon: Mic,
    variant: 'secondary',
    className: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20',
  },
  document: {
    label: 'Document',
    icon: FileText,
    variant: 'secondary',
    className: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20 hover:bg-orange-500/20',
  },
  text: {
    label: 'Text Note',
    icon: File,
    variant: 'outline',
    className: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20 hover:bg-slate-500/20',
  },
};

export default function ContentTypeBadge({
  contentType,
  className = '',
  showIcon = true,
}: ContentTypeBadgeProps) {
  if (!contentType) {
    return (
      <Badge variant="outline" className={`border-dashed ${className}`}>
        <File className="size-3 mr-1" />
        Unknown
      </Badge>
    );
  }

  const config = contentTypeConfig[contentType];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`${config.className} ${className}`}
    >
      {showIcon && <Icon className="size-3 mr-1" />}
      {config.label}
    </Badge>
  );
}

/**
 * Compact version for use in tables and tight spaces
 */
export function ContentTypeBadgeCompact({
  contentType,
  className = '',
}: Omit<ContentTypeBadgeProps, 'showIcon'>) {
  if (!contentType) {
    return (
      <Badge variant="outline" className={`size-6 p-0 flex items-center justify-center border-dashed ${className}`}>
        <File className="size-3" />
      </Badge>
    );
  }

  const config = contentTypeConfig[contentType];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={`size-6 p-0 flex items-center justify-center ${config.className} ${className}`}
      title={config.label}
    >
      <Icon className="size-3" />
    </Badge>
  );
}
