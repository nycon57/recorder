'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Eye, Trash2 } from 'lucide-react';

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
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/types/database';
import { fadeInUp } from '@/lib/utils/animations';

import TagBadge from './TagBadge';

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
  index?: number;
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
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
    >
      {/* Thumbnail */}
      <TableCell>
        <Link href={`/library/${recording.id}`}>
          <motion.div
            className="w-16 h-12 bg-muted rounded overflow-hidden cursor-pointer"
            whileHover={{ scale: 1.05, opacity: 0.8 }}
            transition={{ duration: 0.2 }}
          >
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
          </motion.div>
        </Link>
      </TableCell>

      {/* Title */}
      <TableCell className="font-medium max-w-xs">
        <Link
          href={`/library/${recording.id}`}
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
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon-sm"
              asChild
            >
              <Link href={`/library/${recording.id}`}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              disabled={isDeleting}
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </motion.div>
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
    </motion.tr>
  );
}
