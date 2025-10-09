'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RecordingActionsProps {
  recordingId: string;
}

export default function RecordingActions({
  recordingId,
}: RecordingActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recording?')) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      router.push('/dashboard');
    } catch (error) {
      console.error('Error deleting recording:', error);
      alert('Failed to delete recording. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2 hover:bg-accent rounded-lg transition"
      >
        <svg
          className="w-6 h-6 text-muted-foreground"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg shadow-lg border border-border z-20">
            <div className="py-1">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Recording'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
