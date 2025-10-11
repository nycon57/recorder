'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/app/components/ui/badge';
import { Button, buttonVariants } from '@/app/components/ui/button';
import { TableCell, TableRow } from '@/app/components/ui/table';
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
import { Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import TagBadge from './TagBadge';
import type { Tag } from '@/lib/types/database';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  created_at: string;
  tags?: Tag[];
}

interface RecordingTableRowProps {
  recording: Recording;
}

export default function RecordingTableRow({ recording }: RecordingTableRowProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(date);
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'transcribed':
        return 'secondary';
      case 'uploading':
      case 'uploaded':
      case 'transcribing':
      case 'doc_generating':
        return 'outline';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading';
      case 'uploaded':
        return 'Uploaded';
      case 'transcribing':
        return 'Transcribing';
      case 'transcribed':
        return 'Transcribed';
      case 'doc_generating':
        return 'Generating Doc';
      case 'completed':
        return 'Ready';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);

    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      router.refresh();
    } catch (error) {
      console.error('Error deleting recording:', error);
      setIsDeleting(false);
    }
  };

  return (
    <TableRow>
      {/* Thumbnail */}
      <TableCell>
        <Link href={`/recordings/${recording.id}`}>
          <div className="w-16 h-12 bg-muted rounded overflow-hidden cursor-pointer hover:opacity-80 transition-opacity">
            {recording.thumbnail_url ? (
              <img
                src={recording.thumbnail_url}
                alt={recording.title || 'Recording thumbnail'}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl opacity-50">
                🎥
              </div>
            )}
          </div>
        </Link>
      </TableCell>

      {/* Title */}
      <TableCell className="font-medium max-w-xs">
        <Link
          href={`/recordings/${recording.id}`}
          className="hover:text-primary transition-colors line-clamp-2"
        >
          {recording.title || `Recording ${recording.id.slice(0, 8)}`}
        </Link>
      </TableCell>

      {/* Tags */}
      <TableCell className="max-w-xs">
        {recording.tags && recording.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {recording.tags.map((tag) => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge variant={getStatusVariant(recording.status)}>
          {getStatusLabel(recording.status)}
        </Badge>
      </TableCell>

      {/* Duration */}
      <TableCell className="text-muted-foreground">
        {formatDuration(recording.duration_sec)}
      </TableCell>

      {/* Created */}
      <TableCell className="text-muted-foreground">
        {formatDate(recording.created_at)}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            asChild
          >
            <Link href={`/recordings/${recording.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
            className="hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recording.title || 'this recording'}"?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
}
