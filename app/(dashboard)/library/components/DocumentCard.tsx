"use client"

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Share2, Download, Trash2, MoreVertical } from 'lucide-react';

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

interface DocumentCardProps {
  item: ContentItem;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * DocumentCard Component
 * Displays uploaded document content (PDF, DOCX, DOC)
 */
export function DocumentCard({ item, onDelete, onShare, onDownload }: DocumentCardProps) {
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
    transcribed: 'Processed',
    doc_generating: 'Processing',
    completed: 'Ready',
    error: 'Failed',
  }[item.status] || item.status;

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Estimate page count (rough estimate: 1 page ≈ 2500 characters)
  const estimatePages = (size: number | null) => {
    if (!size) return null;
    const chars = size / 2; // Rough estimate
    const pages = Math.ceil(chars / 2500);
    return pages > 0 ? pages : null;
  };

  const pages = estimatePages(item.file_size);

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg">
      <Link href={`/library/${item.id}`} className="block">
        {/* Document preview */}
        <div className="relative aspect-video bg-gradient-to-br from-blue-500/20 to-blue-500/5 overflow-hidden">
          <div className="w-full h-full flex flex-col items-center justify-center p-6">
            <FileText className="w-16 h-16 text-blue-600 mb-3" />

            {/* Document preview lines */}
            <div className="w-full max-w-[60%] space-y-2">
              <div className="h-1.5 bg-blue-600/20 rounded w-full" />
              <div className="h-1.5 bg-blue-600/20 rounded w-4/5" />
              <div className="h-1.5 bg-blue-600/20 rounded w-full" />
              <div className="h-1.5 bg-blue-600/20 rounded w-3/4" />
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

          {/* Page count estimate */}
          {pages && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="text-xs">
                ~{pages} {pages === 1 ? 'page' : 'pages'}
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
                {item.title || item.original_filename || 'Untitled Document'}
              </h3>
            </Link>

            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-700 border-blue-200">
                <FileText className="w-3 h-3 mr-1" />
                {item.file_type?.toUpperCase() || 'Document'}
              </Badge>
              {item.file_size && (
                <span>{formatFileSize(item.file_size)}</span>
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
