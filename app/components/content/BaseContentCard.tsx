"use client"

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Video,
  FileVideo,
  Music,
  FileText,
  File,
  Share2,
  Download,
  Trash2,
  MoreVertical,
  Play,
} from 'lucide-react';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ContentType } from '@/lib/types/database';
import { formatDuration, formatFileSize } from '@/lib/utils/formatting';
import { getStatusColor, getStatusLabel } from '@/lib/utils/status-helpers';

/**
 * Content item interface for library display
 */
export interface ContentItem {
  id: string;
  title: string | null;
  description: string | null;
  content_type: ContentType | null;
  file_type: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  duration_sec: number | null;
  file_size: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
  created_by: string;
  org_id: string;
  metadata?: any;
}

interface BaseContentCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * Configuration for content type-specific rendering
 */
const contentTypeConfig = {
  recording: {
    icon: Video,
    label: 'Recording',
    gradient: 'from-primary/20 to-primary/5',
    badgeColor: 'bg-primary/10 text-primary border-primary/20',
    playIconColor: 'text-primary',
  },
  video: {
    icon: FileVideo,
    label: 'Video',
    gradient: 'from-violet-500/20 to-violet-500/5',
    badgeColor: 'bg-violet-500/10 text-violet-700 border-violet-200',
    playIconColor: 'text-violet-600',
  },
  audio: {
    icon: Music,
    label: 'Audio',
    gradient: 'from-orange-500/20 to-orange-500/5',
    badgeColor: 'bg-orange-500/10 text-orange-700 border-orange-200',
    playIconColor: 'text-orange-600',
    showWaveform: true,
  },
  document: {
    icon: FileText,
    label: 'Document',
    gradient: 'from-blue-500/20 to-blue-500/5',
    badgeColor: 'bg-blue-500/10 text-blue-700 border-blue-200',
    playIconColor: 'text-blue-600',
  },
  text: {
    icon: File,
    label: 'Text',
    gradient: 'from-green-500/20 to-green-500/5',
    badgeColor: 'bg-green-500/10 text-green-700 border-green-200',
    playIconColor: 'text-green-600',
  },
};

/**
 * BaseContentCard Component
 * Unified card component for displaying all content types (recording, video, audio, document, text)
 *
 * Features:
 * - Type-specific icons and color schemes
 * - Thumbnail preview with play icon overlay (for media)
 * - Waveform visualization (for audio)
 * - Status indicator
 * - Duration and file size display
 * - Hover actions (Share, Download, Delete)
 * - Click to navigate to detail page
 */
export function BaseContentCard({ item, onDelete, onShare, onDownload }: BaseContentCardProps) {
  const contentType = (item.content_type || 'recording') as keyof typeof contentTypeConfig;
  const config = contentTypeConfig[contentType] || contentTypeConfig.recording;
  const Icon = config.icon;

  const statusColor = getStatusColor(item.status);
  const statusText = getStatusLabel(item.status);

  const renderThumbnail = () => {
    const hasMedia = contentType === 'recording' || contentType === 'video';

    // For audio, render waveform
    if (contentType === 'audio' && config.showWaveform) {
      return (
        <div className={cn('relative aspect-video bg-gradient-to-br overflow-hidden', config.gradient)}>
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Icon className="w-16 h-16 mb-2" style={{ color: config.playIconColor.replace('text-', '') }} />
            <div className="flex gap-1 items-end h-8">
              {/* Waveform visualization */}
              {[20, 35, 50, 30, 45, 25, 40, 55, 30, 20, 35, 50].map((height, i) => (
                <div
                  key={i}
                  className={cn('w-1 rounded-full transition-all', config.playIconColor.replace('text-', 'bg-') + '/40 group-hover:' + config.playIconColor.replace('text-', 'bg-'))}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>

          {renderOverlay()}
        </div>
      );
    }

    // For media with thumbnails or documents/text
    return (
      <div className="relative aspect-video bg-muted overflow-hidden">
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.title || config.label}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', config.gradient)}>
            <Icon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}

        {/* Play overlay for media */}
        {(hasMedia || contentType === 'audio') && renderOverlay()}
      </div>
    );
  };

  const renderOverlay = () => (
    <>
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
          <Play className={cn('w-8 h-8 ml-1', config.playIconColor)} />
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute top-2 left-2">
        <Badge variant="secondary" className="text-xs">
          <span className={cn('w-2 h-2 rounded-full mr-1.5', statusColor)} />
          {statusText}
        </Badge>
      </div>

      {/* Duration */}
      {item.duration_sec && (
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="text-xs font-mono">
            {formatDuration(item.duration_sec)}
          </Badge>
        </div>
      )}
    </>
  );

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <Link href={`/library/${item.id}`} className="block">
        {renderThumbnail()}
      </Link>

      {/* Card content */}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/library/${item.id}`}>
              <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
                {item.title || item.original_filename || `Untitled ${config.label}`}
              </h3>
            </Link>

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
              <Badge variant="outline" className={cn('text-xs', config.badgeColor)}>
                <Icon className="w-3 h-3 mr-1" />
                {item.file_type?.toUpperCase() || config.label}
              </Badge>

              {item.file_size && (
                <>
                  <span>{formatFileSize(item.file_size)}</span>
                  <span>•</span>
                </>
              )}

              <span>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.preventDefault()}
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onShare && (
                <DropdownMenuItem onClick={() => onShare(item.id)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
              )}
              {onDownload && (
                <DropdownMenuItem onClick={() => onDownload(item.id)}>
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </DropdownMenuItem>
              )}
              {(onShare || onDownload) && onDelete && <DropdownMenuSeparator />}
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(item.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
