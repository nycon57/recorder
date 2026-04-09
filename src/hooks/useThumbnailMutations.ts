'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/app/components/ui/use-toast';

interface UpdateThumbnailParams {
  thumbnailData: string; // Base64 encoded image data
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface ThumbnailUpdateResponse {
  data: {
    thumbnailUrl: string;
    storagePath: string;
  };
}

interface ThumbnailDeleteResponse {
  data: {
    success: boolean;
    message: string;
  };
}

/**
 * Hook for thumbnail mutations (update and delete)
 *
 * @param recordingId - The ID of the content/recording
 * @param onSuccess - Optional callback after successful mutation
 */
export function useThumbnailMutations(
  recordingId: string,
  onSuccess?: () => void
) {
  const queryClient = useQueryClient();

  /**
   * Update thumbnail (crop or replace)
   */
  const updateThumbnail = useMutation({
    mutationFn: async ({ thumbnailData, mimeType }: UpdateThumbnailParams): Promise<ThumbnailUpdateResponse> => {
      const response = await fetch(`/api/recordings/${recordingId}/thumbnail`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailData, mimeType }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update thumbnail';
        try {
          const error = await response.json();
          errorMessage = error.error?.message || errorMessage;
        } catch {
          // Response body is not JSON, use default message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ description: 'Thumbnail updated successfully' });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['recording', recordingId] });
      queryClient.invalidateQueries({ queryKey: ['content', recordingId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update thumbnail',
        description: error.message,
      });
    },
  });

  /**
   * Delete thumbnail
   */
  const deleteThumbnail = useMutation({
    mutationFn: async (): Promise<ThumbnailDeleteResponse> => {
      const response = await fetch(`/api/recordings/${recordingId}/thumbnail`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete thumbnail';
        try {
          const error = await response.json();
          errorMessage = error.error?.message || errorMessage;
        } catch {
          // Response body is not JSON, use default message
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({ description: 'Thumbnail removed' });
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['recording', recordingId] });
      queryClient.invalidateQueries({ queryKey: ['content', recordingId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to remove thumbnail',
        description: error.message,
      });
    },
  });

  return {
    updateThumbnail,
    deleteThumbnail,
    isUpdating: updateThumbnail.isPending,
    isDeleting: deleteThumbnail.isPending,
    isLoading: updateThumbnail.isPending || deleteThumbnail.isPending,
  };
}
