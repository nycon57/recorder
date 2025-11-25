"use client"

import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  FileVideo,
  FileAudio,
  FileText,
  File,
  Video,
  MoreVertical,
  Share2,
  Download,
  Trash2,
  ExternalLink,
} from 'lucide-react';

import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { TagBadge } from '@/app/components/tags/TagBadge';
import { FavoriteButton } from '@/app/components/favorites/FavoriteButton';
import { cn } from '@/lib/utils';

import type { ContentItem } from '@/app/components/content/ContentCard';

interface LibraryTableProps {
  items: ContentItem[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * LibraryTable Component
 * Displays library items in a table format with selection, sorting, and actions
 *
 * Features:
 * - Row selection with checkboxes
 * - Inline actions menu
 * - Status badges
 * - Thumbnail previews
 * - Tags display
 * - Favorites toggle
 * - Responsive design
 */
export function LibraryTable({
  items,
  selectedIds,
  onSelect,
  onSelectAll,
  onDelete,
  onShare,
  onDownload,
}: LibraryTableProps) {
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getContentIcon = (type: string | null) => {
    switch (type) {
      case 'recording':
        return <Video className="h-4 w-4" />;
      case 'video':
        return <FileVideo className="h-4 w-4" />;
      case 'audio':
        return <FileAudio className="h-4 w-4" />;
      case 'document':
        return <FileText className="h-4 w-4" />;
      case 'text':
        return <FileText className="h-4 w-4" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
      case 'transcribing':
        return 'secondary';
      case 'uploading':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                // @ts-expect-error - indeterminate is a valid HTML prop but not in the type
                indeterminate={someSelected ? true : undefined}
                onCheckedChange={onSelectAll}
                aria-label="Select all items"
              />
            </TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-32">Type</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-24 text-right">Size</TableHead>
            <TableHead className="w-24 text-right">Duration</TableHead>
            <TableHead className="w-40">Created</TableHead>
            <TableHead className="w-48">Tags</TableHead>
            <TableHead className="w-12"></TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                No items found
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                data-state={selectedIds.includes(item.id) ? 'selected' : undefined}
                className={cn(
                  'cursor-pointer',
                  selectedIds.includes(item.id) && 'bg-muted/50',
                  item.deleted_at && 'opacity-60'
                )}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={(checked) => onSelect(item.id, !!checked)}
                    aria-label={`Select ${item.title || 'item'}`}
                  />
                </TableCell>

                <TableCell>
                  <div className="flex items-center justify-center w-10 h-10 rounded bg-muted">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="text-muted-foreground">
                        {getContentIcon(item.content_type)}
                      </div>
                    )}
                  </div>
                </TableCell>

                <TableCell className="font-medium">
                  <Link
                    href={`/library/${item.id}`}
                    className="group hover:underline flex items-center gap-2"
                  >
                    <span className="truncate max-w-md">
                      {item.title || item.original_filename || 'Untitled'}
                    </span>
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </Link>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {getContentIcon(item.content_type)}
                    <span className="capitalize text-sm">
                      {item.content_type || 'Unknown'}
                    </span>
                  </div>
                </TableCell>

                <TableCell>
                  {item.deleted_at ? (
                    <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Trashed
                    </Badge>
                  ) : (
                    <Badge variant={getStatusColor(item.status) as any}>
                      {item.status}
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatFileSize(item.file_size)}
                </TableCell>

                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDuration(item.duration_sec)}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </TableCell>

                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(item as any).tags?.slice(0, 2).map((tag: any) => (
                      <TagBadge key={tag.id} tag={tag} size="sm" />
                    ))}
                    {(item as any).tags?.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{(item as any).tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <FavoriteButton
                    recordingId={item.id}
                    isFavorite={(item as any).is_favorite || false}
                    size="sm"
                  />
                </TableCell>

                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/library/${item.id}`}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
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
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDelete(item.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Move to Trash
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
