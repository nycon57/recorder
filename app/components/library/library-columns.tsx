'use client';

import * as React from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ColumnDef } from '@tanstack/react-table';
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
  ArrowUpDown,
} from 'lucide-react';

import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { TagBadge } from '@/app/components/tags/TagBadge';
import { FavoriteButton } from '@/app/components/favorites/FavoriteButton';

import type { ContentItem } from '@/app/components/content/ContentCard';

/**
 * Helper functions for formatting
 */
function formatFileSize(bytes: number | null) {
  if (!bytes) return '-';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getContentIcon(type: string | null) {
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
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
    case 'transcribing':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Props for action handlers
 */
interface LibraryColumnActions {
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * Create column definitions for the library table
 */
export function createLibraryColumns(actions: LibraryColumnActions): ColumnDef<ContentItem>[] {
  return [
    // Selection column
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // Thumbnail column
    {
      id: 'thumbnail',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-center w-10 h-10 rounded bg-muted overflow-hidden">
            {item.thumbnail_url ? (
              <img
                src={item.thumbnail_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground">
                {getContentIcon(item.content_type)}
              </div>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },

    // Title column
    {
      accessorKey: 'title',
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const item = row.original;
        const title = item.title || item.original_filename || 'Untitled';
        return (
          <Link
            href={`/library/${item.id}`}
            className="group hover:underline flex items-center gap-2 font-medium"
          >
            <span className="truncate max-w-md">{title}</span>
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </Link>
        );
      },
    },

    // Type column
    {
      accessorKey: 'content_type',
      header: 'Type',
      cell: ({ row }) => {
        const type = row.original.content_type;
        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {getContentIcon(type)}
            <span className="capitalize text-sm">{type || 'Unknown'}</span>
          </div>
        );
      },
    },

    // Status column
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const item = row.original;
        if (item.deleted_at) {
          return (
            <Badge variant="secondary" className="bg-destructive/10 text-destructive border-destructive/20">
              <Trash2 className="w-3 h-3 mr-1" />
              Trashed
            </Badge>
          );
        }
        return (
          <Badge variant={getStatusVariant(item.status)}>
            {item.status}
          </Badge>
        );
      },
    },

    // Size column
    {
      accessorKey: 'file_size',
      header: () => <div className="text-right">Size</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {formatFileSize(row.original.file_size)}
        </div>
      ),
    },

    // Duration column
    {
      accessorKey: 'duration_sec',
      header: () => <div className="text-right">Duration</div>,
      cell: ({ row }) => (
        <div className="text-right text-sm text-muted-foreground">
          {formatDuration(row.original.duration_sec)}
        </div>
      ),
    },

    // Created column
    {
      accessorKey: 'created_at',
      header: ({ column }) => (
        <Button
          variant="ghost"
          className="-ml-4"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(row.original.created_at), { addSuffix: true })}
        </span>
      ),
    },

    // Tags column
    {
      id: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = (row.original as any).tags ?? [];
        if (tags.length === 0) return null;

        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 2).map((tag: any) => (
              <TagBadge key={tag.id} tag={tag} size="sm" />
            ))}
            {tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{tags.length - 2}
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    },

    // Favorite column
    {
      id: 'favorite',
      header: '',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <FavoriteButton
            recordingId={row.original.id}
            isFavorite={(row.original as any).is_favorite || false}
            size="sm"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },

    // Actions column
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
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
                {actions.onShare && (
                  <DropdownMenuItem onClick={() => actions.onShare!(item.id)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </DropdownMenuItem>
                )}
                {actions.onDownload && (
                  <DropdownMenuItem onClick={() => actions.onDownload!(item.id)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                )}
                {actions.onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => actions.onDelete!(item.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Move to Trash
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
