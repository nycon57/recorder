'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

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
import { buttonVariants } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tag } from '@/lib/types/database';
import { staggerItem } from '@/lib/utils/animations';

import TagBadge from './TagBadge';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

interface RecordingCardProps {
  recording: Recording;
  index?: number;
}

export default function RecordingCard({ recording }: RecordingCardProps) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-primary/10 text-primary';
      case 'transcribed':
        return 'bg-accent/10 text-accent';
      case 'uploading':
      case 'uploaded':
      case 'transcribing':
      case 'doc_generating':
        return 'bg-secondary/10 text-secondary';
      case 'error':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
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

      // Refresh the page to show updated list
      router.refresh();
    } catch (error) {
      console.error('Error deleting recording:', error);
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      className="bg-card rounded-lg border border-border overflow-hidden"
      variants={staggerItem}
      whileHover={{
        y: -6,
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        transition: { duration: 0.2 },
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Thumbnail */}
      <Link href={`/library/${recording.id}`}>
        <motion.div className="aspect-video bg-muted relative group cursor-pointer overflow-hidden">
          {recording.thumbnail_url ? (
            <motion.img
              src={recording.thumbnail_url}
              alt={recording.title || 'Recording thumbnail'}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl opacity-50">🎥</span>
            </div>
          )}
          <motion.div
            className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileHover={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-card rounded-full p-4">
                <svg
                  className="w-8 h-8 text-foreground"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </motion.div>
          </motion.div>

          {/* Duration Badge */}
          {recording.duration_sec && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
              {formatDuration(recording.duration_sec)}
            </div>
          )}
        </motion.div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Link href={`/library/${recording.id}`}>
            <h3 className="font-semibold text-foreground hover:text-primary cursor-pointer line-clamp-2">
              {recording.title || `Recording ${recording.id.slice(0, 8)}`}
            </h3>
          </Link>
        </div>

        {recording.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {recording.description}
          </p>
        )}

        {/* Tags */}
        {recording.tags && recording.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {recording.tags.map((tag) => (
              <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span
            className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(recording.status)}`}
          >
            {getStatusLabel(recording.status)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(recording.created_at)}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-4 flex space-x-2">
          <Link
            href={`/library/${recording.id}`}
            className="flex-1 text-center px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition text-sm"
          >
            View
          </Link>
          <motion.button
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={isDeleting}
            className="px-3 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition text-sm disabled:opacity-50"
            whileTap={{ scale: 0.97 }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </motion.button>
        </div>
      </div>

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
    </motion.div>
  );
}
