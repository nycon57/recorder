"use client"

import Link from 'next/link';
import {
  Video,
  FileVideo,
  Music,
  FileText,
  File,
  Play,
  FileCheck,
  Tag as TagIcon,
  Clock,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { Card, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/app/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { ContentType } from '@/lib/types/database';
import { formatDuration, formatFileSize, formatDate } from '@/lib/utils/formatting';
import { getStatusLabel, getStatusBadgeColor } from '@/lib/utils/status-helpers';

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
  deleted_at?: string | null;
  duration_sec: number | null;
  file_size: number | null;
  thumbnail_url: string | null;
  original_filename: string | null;
  created_by: string;
  org_id: string;
  metadata?: {
    has_transcript?: boolean;
    has_document?: boolean;
    tags?: Array<{ id: string; name: string; color: string }>;
    collection_name?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

interface BaseContentCardProps {
  item: ContentItem;
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
 * Tag color mappings for visual variety
 */
const tagColorMap: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  green: 'bg-green-100 text-green-700 border-green-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  pink: 'bg-pink-100 text-pink-700 border-pink-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
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
 * - Transcript and document indicators with tooltips
 * - Tag display (first 1-2 tags)
 * - Collection name display
 * - Enhanced hover states with progressive disclosure
 * - Hover card with additional details
 * - Click to navigate to detail page
 */
export function BaseContentCard({ item }: BaseContentCardProps) {
  const contentType = (item.content_type || 'recording') as keyof typeof contentTypeConfig;
  const config = contentTypeConfig[contentType] || contentTypeConfig.recording;
  const Icon = config.icon;

  const statusText = getStatusLabel(item.status);

  // Extract metadata
  const hasTranscript = item.metadata?.has_transcript ?? false;
  const hasDocument = item.metadata?.has_document ?? false;
  const tags = item.metadata?.tags ?? [];

  // Display first 2 tags
  const displayTags = tags.slice(0, 2);
  const hiddenTagsCount = tags.length - displayTags.length;

  const renderThumbnail = () => {
    const hasMedia = contentType === 'recording' || contentType === 'video';

    // For audio, render waveform
    if (contentType === 'audio' && 'showWaveform' in config && config.showWaveform) {
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
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
          <Play className={cn('w-8 h-8 ml-1', config.playIconColor)} />
        </div>
      </div>

      {/* Trash indicator (if deleted) - Top Right for prominence */}
      {item.deleted_at && (
        <div className="absolute top-2 right-2">
          <Badge className="text-xs font-medium backdrop-blur-sm bg-red-500 text-white border-red-500 shadow-lg">
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            Trashed
          </Badge>
        </div>
      )}

      {/* Status indicator (if not deleted) - Top Right for prominence */}
      {!item.deleted_at && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className={cn('text-xs font-medium backdrop-blur-sm shadow-lg', getStatusBadgeColor(item.status))}>
            {item.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
            {['uploading', 'transcribing', 'transcribed', 'doc_generating'].includes(item.status) && (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            )}
            {['error', 'failed'].includes(item.status) && <AlertCircle className="w-3.5 h-3.5 mr-1" />}
            {statusText}
          </Badge>
        </div>
      )}

      {/* Duration/File Size - Bottom Right */}
      {(item.duration_sec || item.file_size) && (
        <div className="absolute bottom-2 right-2">
          <Badge variant="secondary" className="text-xs font-mono backdrop-blur-sm bg-background/90 shadow-md">
            {item.duration_sec ? formatDuration(item.duration_sec) : formatFileSize(item.file_size)}
          </Badge>
        </div>
      )}
    </>
  );

  const cardTitle = item.title || item.original_filename || `Untitled ${config.label}`;
  const cardDescription = item.description;

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 p-0 gap-2 h-full",
      item.deleted_at && "opacity-70 border-red-500/20"
    )}>
      <Link href={`/library/${item.id}`} className="block">
        {renderThumbnail()}
      </Link>

      {/* Card content */}
      <CardContent className="pt-2 pb-4 px-4 flex flex-col">
        {/* Trash indicator - Always visible when deleted */}
        {item.deleted_at && (
          <div className="mb-2">
            <Badge className="text-xs font-medium bg-red-500/10 text-red-500 border-red-500/30">
              <Trash2 className="w-3 h-3 mr-1" />
              In Trash
            </Badge>
          </div>
        )}

        {/* Title and Description */}
        <div className="space-y-1.5 mb-3">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Link href={`/library/${item.id}`}>
                <h3 className="font-semibold text-sm leading-tight line-clamp-2 hover:text-primary transition-colors">
                  {cardTitle}
                </h3>
              </Link>
            </HoverCardTrigger>
            <HoverCardContent className="w-80" side="top">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{cardTitle}</h4>
                {item.description && (
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Icon className="w-3 h-3" />
                    <span>{config.label}</span>
                    {item.file_size && (
                      <>
                        <span>•</span>
                        <span>{formatFileSize(item.file_size)}</span>
                      </>
                    )}
                  </div>
                  <div>
                    Created {formatDate(item.created_at)}
                  </div>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <TagIcon className="w-3 h-3" />
                      <span>{tags.map(t => t.name).join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            </HoverCardContent>
          </HoverCard>

          {/* Description - Show directly on card */}
          {cardDescription && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {cardDescription}
            </p>
          )}
        </div>

        {/* Metadata Grid - Organized Sections - Always at bottom */}
        <div className="space-y-2 mt-auto">
          {/* Tags Row */}
          {displayTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <TagIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              {displayTags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className={cn(
                    'text-[10px] px-2 py-0.5 h-5 font-medium',
                    tagColorMap[tag.color] || tagColorMap.gray
                  )}
                >
                  {tag.name}
                </Badge>
              ))}
              {hiddenTagsCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 bg-muted font-medium cursor-help">
                      +{hiddenTagsCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{tags.slice(2).map(t => t.name).join(', ')}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Content Indicators Row */}
          {(hasTranscript || hasDocument) && (
            <div className="flex items-center gap-2">
              {hasTranscript && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors cursor-help">
                      <FileText className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">Transcript</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Has transcript available</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {hasDocument && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-700 dark:text-green-300 hover:bg-green-500/20 transition-colors cursor-help">
                      <FileCheck className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium">AI Doc</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Has AI-generated document</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Type and Created Date Row - Always at the bottom */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="font-medium">{config.label}</span>
            </div>
            <span className="text-muted-foreground/40">•</span>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formatDate(item.created_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
