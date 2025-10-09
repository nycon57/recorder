'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  duration_sec: number | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface RecordingCardProps {
  recording: Recording;
}

export default function RecordingCard({ recording }: RecordingCardProps) {
  const router = useRouter();
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
        return 'Processing';
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
    if (!confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    setIsDeleting(true);

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
      alert('Failed to delete recording. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden hover:shadow-lg transition-shadow">
      {/* Thumbnail */}
      <Link href={`/recordings/${recording.id}`}>
        <div className="aspect-video bg-muted relative group cursor-pointer">
          {recording.thumbnail_url ? (
            <img
              src={recording.thumbnail_url}
              alt={recording.title || 'Recording thumbnail'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl opacity-50">🎥</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-opacity flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-card rounded-full p-4">
                <svg
                  className="w-8 h-8 text-foreground"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Duration Badge */}
          {recording.duration_sec && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
              {formatDuration(recording.duration_sec)}
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <Link href={`/recordings/${recording.id}`}>
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
            href={`/recordings/${recording.id}`}
            className="flex-1 text-center px-3 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition text-sm"
          >
            View
          </Link>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-3 py-2 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition text-sm disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
