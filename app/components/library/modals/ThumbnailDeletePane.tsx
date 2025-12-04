'use client';

import * as React from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';

import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert';
import { Button } from '@/app/components/ui/button';
import { useThumbnailMutations } from '@/hooks/useThumbnailMutations';

interface ThumbnailDeletePaneProps {
  /** ID of the content/recording */
  recordingId: string;
  /** Callback to close the parent modal */
  onClose: () => void;
  /** Callback after successful deletion */
  onDeleted?: () => void;
}

/**
 * ThumbnailDeletePane - Delete confirmation panel for thumbnail removal
 *
 * Features:
 * - Destructive warning alert
 * - Cancel and Delete buttons
 * - Loading state during deletion
 * - Closes modal on success
 */
export function ThumbnailDeletePane({
  recordingId,
  onClose,
  onDeleted,
}: ThumbnailDeletePaneProps) {
  const { deleteThumbnail, isDeleting } = useThumbnailMutations(recordingId, () => {
    onDeleted?.();
    onClose();
  });

  const handleDelete = () => {
    deleteThumbnail.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-semibold">Delete Thumbnail?</AlertTitle>
        <AlertDescription className="mt-2 text-sm">
          This will permanently remove the thumbnail from this content.
          The thumbnail section will be hidden from the detail view.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Thumbnail
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ThumbnailDeletePane;
