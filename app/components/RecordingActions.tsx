'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';

interface RecordingActionsProps {
  recordingId: string;
}

export default function RecordingActions({
  recordingId,
}: RecordingActionsProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);
    setShowMenu(false);

    try {
      const response = await fetch(`/api/recordings/${recordingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to move recording to trash');
      }

      // Redirect to library after moving to trash
      router.push('/library');
    } catch (error) {
      console.error('Error moving recording to trash:', error);
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
                onClick={() => {
                  setShowMenu(false);
                  setIsDeleteDialogOpen(true);
                }}
                disabled={isDeleting}
                className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-accent disabled:opacity-50"
              >
                {isDeleting ? 'Moving to Trash...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Move to Trash Confirmation Dialog */}
      <ConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Move to Trash?"
        description="This recording will be moved to trash. You can restore it later from the trash page."
        confirmText="Move to Trash"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        useAlertDialog
      />
    </div>
  );
}
