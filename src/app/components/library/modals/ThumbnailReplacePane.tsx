'use client';

import * as React from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import { useThumbnailMutations } from '@/hooks/useThumbnailMutations';

interface ThumbnailReplacePaneProps {
  /** ID of the content/recording */
  recordingId: string;
  /** Callback to close the parent modal */
  onClose: () => void;
  /** Callback after successful upload */
  onUploaded?: () => void;
}

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type ValidMimeType = typeof VALID_TYPES[number];

/**
 * ThumbnailReplacePane - Upload panel for replacing thumbnail
 *
 * Features:
 * - Drag-and-drop zone
 * - Click to browse files
 * - File validation (type and size)
 * - Preview before upload
 * - Loading state during upload
 */
export function ThumbnailReplacePane({
  recordingId,
  onClose,
  onUploaded,
}: ThumbnailReplacePaneProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const { updateThumbnail, isUpdating } = useThumbnailMutations(recordingId, () => {
    onUploaded?.();
    onClose();
  });

  // Cleanup preview URL on unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const validateFile = (file: File): string | null => {
    if (!VALID_TYPES.includes(file.type as ValidMimeType)) {
      return 'Invalid file type. Please upload a JPEG, PNG, or WebP image.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Please upload an image smaller than 5MB.';
    }
    return null;
  };

  const handleFile = (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
      updateThumbnail.mutate({
        thumbnailData: base64,
        mimeType: selectedFile.type as ValidMimeType,
      });
    };
    reader.readAsDataURL(selectedFile);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUpdating}
      />

      {!previewUrl ? (
        // Drag-and-drop zone
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
            isDragging && 'border-accent bg-accent/5',
            !isDragging && 'border-border hover:border-accent/50 hover:bg-muted/30',
            error && 'border-destructive/50'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Upload className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Drag and drop an image here
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, or WebP (max 5MB)
            </p>
          </div>
        </div>
      ) : (
        // Preview section
        <div className="space-y-4">
          <div className="relative aspect-[2.35/1] rounded-xl overflow-hidden bg-muted">
            <img
              src={previewUrl}
              alt="Thumbnail preview"
              className="w-full h-full object-cover"
            />
            {/* Remove preview button */}
            <button
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              disabled={isUpdating}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ImageIcon className="w-4 h-4" />
            <span className="truncate">{selectedFile?.name}</span>
            <span className="flex-shrink-0">
              ({((selectedFile?.size ?? 0) / 1024).toFixed(1)} KB)
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Action buttons */}
      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={previewUrl ? handleClear : onClose}
          disabled={isUpdating}
        >
          {previewUrl ? 'Clear' : 'Cancel'}
        </Button>
        {previewUrl && (
          <Button
            onClick={handleUpload}
            disabled={isUpdating || !selectedFile}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default ThumbnailReplacePane;
