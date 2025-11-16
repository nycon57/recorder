'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Edit,
  Trash2,
  Share2,
  RefreshCw,
  FileText,
  Clock,
  Calendar,
  HardDrive,
  FileType as FileTypeIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/app/components/ui/button';
import { formatFileSize } from '@/lib/types/content';
import type { ContentType, FileType, RecordingStatus } from '@/lib/types/database';
import type { Tag } from '@/lib/types/database';
import TagBadge from '@/app/components/TagBadge';
import ContentTypeBadge from './ContentTypeBadge';

interface MetadataSidebarProps {
  recordingId: string;
  contentType: ContentType | null;
  fileType: FileType | null;
  status: RecordingStatus;
  fileSize?: number | null;
  duration?: number | null;
  createdAt: string;
  completedAt?: string | null;
  originalFilename?: string | null;
  deletedAt?: string | null;
  tags?: Tag[];
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onReprocess?: () => void;
  onDownload?: () => void;
}

export default function MetadataSidebar({
  recordingId,
  contentType,
  fileType,
  status,
  fileSize,
  duration,
  createdAt,
  completedAt,
  originalFilename,
  deletedAt,
  tags = [],
  onEdit,
  onDelete,
  onShare,
  onReprocess,
  onDownload,
}: MetadataSidebarProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isTrashed = !!deletedAt;

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds == null) return 'N/A';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadgeVariant = (status: RecordingStatus) => {
    switch (status) {
      case 'uploading':
        return 'secondary';
      case 'uploaded':
      case 'transcribing':
      case 'transcribed':
      case 'doc_generating':
        return 'outline';
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: RecordingStatus) => {
    switch (status) {
      case 'uploading':
        return 'Uploading';
      case 'uploaded':
        return 'Uploaded';
      case 'transcribing':
        return 'Processing';
      case 'transcribed':
        return 'Processing';
      case 'doc_generating':
        return 'Processing';
      case 'completed':
        return 'Ready';
      case 'error':
        return 'Failed';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: RecordingStatus) => {
    switch (status) {
      case 'uploading':
      case 'transcribing':
      case 'doc_generating':
        return <Loader2 className="size-3 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="size-3" />;
      case 'error':
        return <AlertCircle className="size-3" />;
      default:
        return null;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);

    try {
      if (onDelete) {
        onDelete();
      } else {
        // Use permanent=true query param for trashed items
        const url = isTrashed
          ? `/api/library/${recordingId}?permanent=true`
          : `/api/library/${recordingId}`;

        const response = await fetch(url, {
          method: 'DELETE',
        });

        if (!response.ok) {
          // Try to get error details from response
          let errorMessage = 'Failed to delete content';
          try {
            const contentType = response.headers.get('content-type');
            console.log('[MetadataSidebar] Delete failed:', {
              status: response.status,
              statusText: response.statusText,
              contentType,
            });

            if (contentType?.includes('application/json')) {
              const errorData = await response.json();
              console.error('[MetadataSidebar] API Error response:', errorData);
              // API error format: { code, message, details, requestId }
              errorMessage = errorData.message || errorData.code || errorMessage;
            } else {
              const textResponse = await response.text();
              console.error('[MetadataSidebar] Non-JSON error response:', textResponse);
              errorMessage = textResponse || `Failed to delete content: ${response.status} ${response.statusText}`;
            }
          } catch (parseError) {
            // If parsing fails, use status text
            console.error('[MetadataSidebar] Error parsing response:', parseError);
            errorMessage = `Failed to delete content: ${response.status} ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        if (isTrashed) {
          // Permanent delete - redirect to library
          toast.success('Content permanently deleted');
          router.push('/library');
        } else {
          // Soft delete - refresh to show trashed state
          toast.success('Content moved to trash');
          router.refresh();
        }
      }
    } catch (error) {
      console.error('Delete failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete content';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Content Type & Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Content Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Content Type */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Type</p>
              <ContentTypeBadge
                contentType={contentType}
                className="w-full justify-center"
              />
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Status</p>
              <Badge
                variant={getStatusBadgeVariant(status)}
                className="w-full justify-center gap-1.5"
              >
                {getStatusIcon(status)}
                {getStatusLabel(status)}
              </Badge>
            </div>

            {/* File Type */}
            {fileType && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Format</p>
                <div className="flex items-center gap-2 text-sm">
                  <FileTypeIcon className="size-4 text-muted-foreground" />
                  <span className="uppercase font-medium">{fileType}</span>
                </div>
              </div>
            )}

            {/* Duration */}
            {duration && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Duration</p>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="size-4 text-muted-foreground" />
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>
            )}

            {/* File Size */}
            {fileSize && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">File Size</p>
                <div className="flex items-center gap-2 text-sm">
                  <HardDrive className="size-4 text-muted-foreground" />
                  <span>{formatFileSize(fileSize)}</span>
                </div>
              </div>
            )}

            {/* Original Filename */}
            {originalFilename && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">
                  Original File
                </p>
                <p className="text-xs font-mono truncate" title={originalFilename}>
                  {originalFilename}
                </p>
              </div>
            )}

            <Separator />

            {/* Created Date */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Created</p>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="size-4 text-muted-foreground" />
                <span>{formatDate(createdAt)}</span>
              </div>
            </div>

            {/* Completed Date */}
            {completedAt && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Completed</p>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                  <span>{formatDate(completedAt)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tags */}
        {tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <TagBadge
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    size="sm"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {onDownload && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onDownload}
              >
                <Download className="size-4" />
                Download
              </Button>
            )}

            {onEdit && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onEdit}
              >
                <Edit className="size-4" />
                Edit Details
              </Button>
            )}

            {onShare && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onShare}
              >
                <Share2 className="size-4" />
                Share
              </Button>
            )}

            {onReprocess && status !== 'uploading' && status !== 'error' && (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onReprocess}
              >
                <RefreshCw className="size-4" />
                Reprocess
              </Button>
            )}

            <Separator />

            <Button
              variant="outline"
              className="w-full justify-start text-red-500 hover:text-red-500"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {isTrashed ? 'Delete Forever' : 'Move to Trash'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={isTrashed ? 'text-red-500' : ''}>
              {isTrashed ? 'Permanently Delete?' : 'Move to Trash?'}
            </AlertDialogTitle>
            {isTrashed ? (
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Are you sure you want to permanently delete this content?</p>
                  <p className="font-semibold text-red-500">
                    ⚠️ This action cannot be undone. All associated data will be permanently removed:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Original file</li>
                    <li>Transcripts and documents</li>
                    <li>Search embeddings</li>
                    <li>All metadata</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                Are you sure you want to move this content to trash? You can restore it later from the trash page.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              {isTrashed ? 'Delete Forever' : 'Move to Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
