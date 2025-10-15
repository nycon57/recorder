"use client"

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FileType, Share2, Download, Trash2, MoreVertical } from 'lucide-react';

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

interface TextCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * TextCard Component
 * Displays text note content with preview snippet
 */
export function TextCard({ item, onDelete, onShare, onDownload }: TextCardProps) {
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
    uploading: 'Saving',
    uploaded: 'Saved',
    transcribing: 'Processing',
    transcribed: 'Processed',
    doc_generating: 'Processing',
    completed: 'Ready',
    error: 'Failed',
  }[item.status] || item.status;

  // Extract text preview from description or metadata
  const getPreview = () => {
    if (item.description) {
      return item.description.substring(0, 120);
    }
    if (item.metadata && typeof item.metadata === 'object' && 'content' in item.metadata) {
      const content = String(item.metadata.content);
      return content.substring(0, 120);
    }
    return 'No preview available';
  };

  const preview = getPreview();

  // Estimate word count
  const estimateWordCount = () => {
    const text = item.description || (item.metadata && typeof item.metadata === 'object' && 'content' in item.metadata ? String(item.metadata.content) : '');
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  };

  const wordCount = estimateWordCount();

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <Link href={`/library/${item.id}`} className="block">
        {/* Text preview */}
        <div className="relative aspect-video bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 overflow-hidden">
          <div className="w-full h-full flex items-center justify-center p-6">
            <div className="w-full max-w-[80%] space-y-1">
              <FileType className="w-8 h-8 text-emerald-600 mb-4" />

              {/* Preview text snippet */}
              <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                {preview}
                {preview.length >= 120 && '...'}
              </p>
            </div>
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Status */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs">
              <span className={cn('w-2 h-2 rounded-full mr-1.5', statusColor)} />
              {statusText}
            </Badge>
          </div>

          {/* Word count */}
          {wordCount > 0 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="text-xs">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </Badge>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/library/${item.id}`}>
              <h3 className="font-medium text-sm line-clamp-2 hover:text-primary transition-colors">
                {item.title || 'Untitled Note'}
              </h3>
            </Link>

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 border-emerald-200">
                <FileType className="w-3 h-3 mr-1" />
                Text Note
              </Badge>
              {wordCount > 0 && (
                <span>{wordCount} words</span>
              )}
              <span>•</span>
              <span>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Actions */}
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
