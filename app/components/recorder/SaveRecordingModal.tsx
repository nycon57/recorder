'use client';

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Upload, Loader2, X, Image as ImageIcon } from 'lucide-react';
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

interface SaveRecordingModalProps {
  isOpen: boolean;
  recordingBlob: Blob | null;
  onClose: () => void;
  onSaveComplete?: () => void;
}

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

export function SaveRecordingModal({
  isOpen,
  recordingBlob,
  onClose,
  onSaveComplete,
}: SaveRecordingModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Create video URL for preview
  useEffect(() => {
    if (recordingBlob && isOpen) {
      const url = URL.createObjectURL(recordingBlob);
      setVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [recordingBlob, isOpen]);

  // Auto-generate title on mount
  useEffect(() => {
    if (isOpen && !title) {
      setTitle(`Recording ${new Date().toLocaleString()}`);
    }
  }, [isOpen]);

  // Handle thumbnail file selection
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setThumbnail(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setThumbnailPreview(e.target?.result as string);
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

    canvas.toBlob((blob) => {
      if (!blob) return;

      const file = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
      setThumbnail(file);
      setThumbnailPreview(URL.createObjectURL(blob));
      toast.success('Thumbnail captured from video');
    }, 'image/jpeg', 0.9);
  };

  const handleSubmit = async (startProcessing: boolean) => {
    if (!recordingBlob) return;

    setIsUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Parse tags into array
      const tagsArray = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      // Step 1: Create recording metadata and get upload URL
      setUploadProgress(10);
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
      setUploadProgress(20);

      // Step 2: Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnail) {
        try {
          const thumbnailUploadResponse = await fetch('/api/recordings/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recordingId,
              thumbnailData: await blobToBase64(thumbnail),
              mimeType: thumbnail.type,
            }),
          });

          if (thumbnailUploadResponse.ok) {
            const { data: thumbnailData } = await thumbnailUploadResponse.json();
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

      setUploadProgress(40);

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

      setUploadProgress(70);

      // Step 4: Finalize upload
      const finalizeResponse = await fetch(`/api/recordings/${recordingId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startProcessing }),
      });

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize recording');
      }

      setUploadProgress(100);

      toast.success(
        startProcessing
          ? 'Recording saved and processing started'
          : 'Recording saved successfully'
      );

      onSaveComplete?.();
      handleClose();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      toast.error('Failed to save recording');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (isUploading) return;
    setTitle('');
    setDescription('');
    setTags('');
    setThumbnail(null);
    setThumbnailPreview('');
    setUploadProgress(0);
    setError('');
    onClose();
  };

  return (
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
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="h-full w-full"
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
              onChange={(e) => setTitle(e.target.value)}
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
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
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
              onChange={(e) => setTags(e.target.value)}
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
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-cover"
                />
                {!isUploading && (
                  <button
                    onClick={() => {
                      setThumbnail(null);
                      setThumbnailPreview('');
                    }}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full hover:bg-black/70"
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
                <span className="text-muted-foreground">Uploading...</span>
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
                Saving...
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
                Processing...
              </>
            ) : (
              'Save & Process'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
