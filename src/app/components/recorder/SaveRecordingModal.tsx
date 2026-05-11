'use client';

/* global HTMLVideoElement */

import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { useReducer, useEffect, useRef, type ChangeEvent } from 'react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import ReprocessStreamModal from '@/app/components/ReprocessStreamModal';

interface SaveRecordingModalProps {
  isOpen: boolean;
  recordingBlob: Blob | null;
  onClose: () => void;
  onSaveComplete?: () => void;
}

interface SaveRecordingState {
  title: string;
  description: string;
  tags: string;
  thumbnail: File | null;
  thumbnailPreview: string;
  isUploading: boolean;
  uploadProgress: number;
  error: string;
  videoUrl: string;
  isProcessingModalOpen: boolean;
  processingRecordingId: string;
  processingTitle: string;
}

const initialSaveRecordingState: SaveRecordingState = {
  title: '',
  description: '',
  tags: '',
  thumbnail: null,
  thumbnailPreview: '',
  isUploading: false,
  uploadProgress: 0,
  error: '',
  videoUrl: '',
  isProcessingModalOpen: false,
  processingRecordingId: '',
  processingTitle: '',
};

const saveRecordingReducer = (
  state: SaveRecordingState,
  patch: Partial<SaveRecordingState>,
): SaveRecordingState => ({
  ...state,
  ...patch,
});

// Helper function to convert Blob to base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function SaveRecordingModal(
  props: Parameters<typeof useSaveRecordingModalImplementation>[0],
) {
  return useSaveRecordingModalImplementation(props);
}

function useSaveRecordingModalImplementation({
  isOpen,
  recordingBlob,
  onClose,
  onSaveComplete,
}: SaveRecordingModalProps) {
  const [
    {
      title,
      description,
      tags,
      thumbnail,
      thumbnailPreview,
      isUploading,
      uploadProgress,
      error,
      videoUrl,
      isProcessingModalOpen,
      processingRecordingId,
      processingTitle,
    },
    updateSaveState,
  ] = useReducer(saveRecordingReducer, initialSaveRecordingState);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Create video URL for preview
  useEffect(() => {
    if (recordingBlob && isOpen) {
      const url = URL.createObjectURL(recordingBlob);
      updateSaveState({ videoUrl: url });
      return () => URL.revokeObjectURL(url);
    }
  }, [recordingBlob, isOpen]);

  // Auto-generate title on mount
  useEffect(() => {
    if (isOpen && !title) {
      updateSaveState({ title: `Recording ${new Date().toLocaleString()}` });
    }
  }, [isOpen, title]);

  // Handle thumbnail file selection
  const handleThumbnailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    updateSaveState({ thumbnail: file });

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      updateSaveState({ thumbnailPreview: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  // Capture thumbnail from video
  const captureThumbnailFromVideo = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
        updateSaveState({
          thumbnail: file,
          thumbnailPreview: URL.createObjectURL(blob),
        });
        toast.success('Thumbnail captured from video');
      },
      'image/jpeg',
      0.9,
    );
  };

  const handleSubmit = async (startProcessing: boolean) => {
    if (!recordingBlob) return;

    updateSaveState({
      isUploading: true,
      error: '',
      uploadProgress: 0,
    });

    try {
      // Parse tags into array
      const tagsArray = tags.split(',').flatMap((__item, __index, __array) => {
        const __mapped = __item.trim();
        return __mapped.length > 0 ? [__mapped] : [];
      });

      // Step 1: Create recording metadata and get upload URL
      updateSaveState({ uploadProgress: 10 });
      const createResponse = await fetch('/api/recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || `Recording ${new Date().toLocaleString()}`,
          description: description || null,
          metadata: {
            tags: tagsArray,
            recordedAt: new Date().toISOString(),
          },
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create recording');
      }

      const { data } = await createResponse.json();
      const { recording, uploadUrl } = data;
      const recordingId = recording.id;
      updateSaveState({ uploadProgress: 20 });

      // Step 2: Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnail) {
        try {
          const thumbnailUploadResponse = await fetch(
            '/api/recordings/thumbnail',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recordingId,
                thumbnailData: await blobToBase64(thumbnail),
                mimeType: thumbnail.type,
              }),
            },
          );

          if (thumbnailUploadResponse.ok) {
            const { data: thumbnailData } =
              await thumbnailUploadResponse.json();
            thumbnailUrl = thumbnailData.thumbnailUrl;
            console.log('Thumbnail uploaded:', thumbnailUrl);
          } else {
            console.warn('Failed to upload thumbnail, continuing without it');
          }
        } catch (err) {
          console.error('Thumbnail upload error:', err);
          // Continue without thumbnail
        }
      }

      updateSaveState({ uploadProgress: 40 });

      // Step 3: Upload video blob to storage
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: recordingBlob,
        headers: {
          'Content-Type': 'video/webm',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload recording');
      }

      updateSaveState({ uploadProgress: 70 });

      // Step 4: Finalize upload
      const finalizeResponse = await fetch(
        `/api/recordings/${recordingId}/finalize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startProcessing }),
        },
      );

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize recording');
      }

      updateSaveState({ uploadProgress: 100 });

      if (startProcessing) {
        // Open streaming modal instead of closing immediately
        updateSaveState({
          processingRecordingId: recordingId,
          processingTitle: title || `Recording ${new Date().toLocaleString()}`,
          isProcessingModalOpen: true,
        });
        // Don't call handleClose() yet - let streaming modal handle it
      } else {
        // Save only - close immediately
        toast.success(
          'Upload successful! Your recording has been saved and is ready to view in your library.',
        );
        onSaveComplete?.();
        handleClose();
      }
    } catch (err) {
      console.error('Upload error:', err);
      updateSaveState({
        error: err instanceof Error ? err.message : 'Upload failed',
      });
      toast.error('Failed to save recording');
    } finally {
      updateSaveState({ isUploading: false });
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    updateSaveState(initialSaveRecordingState);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save Recording</DialogTitle>
            <DialogDescription>
              Add details about your recording before saving
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Video preview */}
            {videoUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-950">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="size-full"
                  aria-label="Recording preview"
                />
              </div>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => updateSaveState({ title: e.target.value })}
                placeholder="My Recording"
                disabled={isUploading}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) =>
                  updateSaveState({ description: e.target.value })
                }
                placeholder="Add a description…"
                rows={3}
                disabled={isUploading}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => updateSaveState({ tags: e.target.value })}
                placeholder="tutorial, demo, walkthrough (comma-separated)"
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
            </div>

            {/* Thumbnail */}
            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={captureThumbnailFromVideo}
                  disabled={isUploading || !videoUrl}
                >
                  <ImageIcon className="size-4 mr-2" />
                  Capture from Video
                </Button>
                <Label
                  htmlFor="thumbnail-upload"
                  className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                >
                  <Upload className="size-4 mr-2" />
                  Upload Image
                </Label>
                <input
                  id="thumbnail-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailChange}
                  disabled={isUploading}
                />
              </div>
              {thumbnailPreview && (
                <div className="relative size-32 rounded-lg overflow-hidden border border-border">
                  <Image
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    fill
                    sizes="128px"
                    className="object-cover"
                    unoptimized
                  />
                  {!isUploading && (
                    <button
                      onClick={() => {
                        updateSaveState({
                          thumbnail: null,
                          thumbnailPreview: '',
                        });
                      }}
                      className="absolute top-1 right-1 p-1 bg-zinc-950/50 rounded-full hover:bg-zinc-950/70"
                    >
                      <X className="size-3 text-white" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading…</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isUploading || !title.trim()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Save Only'
              )}
            </Button>
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isUploading || !title.trim()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Processing…
                </>
              ) : (
                'Save & Process'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Streaming Processing Modal */}
      <ReprocessStreamModal
        open={isProcessingModalOpen}
        onOpenChange={(open) => {
          updateSaveState({ isProcessingModalOpen: open });
          if (!open) {
            // Modal closed - finalize and notify completion
            onSaveComplete?.();
            handleClose();
          }
        }}
        recordingId={processingRecordingId}
        step="all"
        recordingTitle={processingTitle}
        mode="finalize"
      />
    </>
  );
}
