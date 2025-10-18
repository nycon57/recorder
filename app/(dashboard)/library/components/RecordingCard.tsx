"use client"

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Video, Share2, Download, Trash2, MoreVertical, Play } from 'lucide-react';

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

import { ContentItem } from './ContentCard';

interface RecordingCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * RecordingCard Component
 * Displays screen recording content with video thumbnail and metadata
 *
 * Features:
 * - Video thumbnail preview with play icon overlay
 * - Recording badge indicator
 * - Status indicator (processing, completed, failed)
 * - Duration display
 * - Relative timestamp
 * - Hover actions (Share, Download, Delete)
 * - Click to navigate to detail page
 */
export function RecordingCard({ item, onDelete, onShare, onDownload }: RecordingCardProps) {
  const statusColor = {
    uploading: 'bg-blue-500',
    uploaded: 'bg-blue-500',
    transcribing: 'bg-yellow-500',
    transcribed: 'bg-yellow-500',
    doc_generating: 'bg-yellow-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
  }[item.status] || 'bg-gray-500';

  const statusText = {
    uploading: 'Uploading',
    uploaded: 'Uploaded',
    transcribing: 'Processing',
    transcribed: 'Processing',
    doc_generating: 'Processing',
    completed: 'Ready',
    error: 'Failed',
  }[item.status] || item.status;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <Link href={`/library/${item.id}`} className="block">
        {/* Thumbnail with play overlay */}
        <div className="relative aspect-video bg-muted overflow-hidden">
          {item.thumbnail_url ? (
            <img
              src={item.thumbnail_url}
              alt={item.title || 'Recording'}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <Video className="w-12 h-12 text-muted-foreground" />
            </div>
          )}

          {/* Play icon overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-primary ml-1" />
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
        </div>
      </Link>

      {/* Card content */}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/library/${item.id}`}>
              <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
                {item.title || 'Untitled Recording'}
              </h3>
            </Link>

            {/* Metadata */}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs">
                <Video className="w-3 h-3 mr-1" />
                Recording
              </Badge>
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
