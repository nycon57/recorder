'use client';

import * as React from 'react';
import Cropper, { Area, Point } from 'react-easy-crop';
import { ZoomIn, ZoomOut, Loader2, Crop } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Slider } from '@/app/components/ui/slider';
import { useThumbnailMutations } from '@/hooks/useThumbnailMutations';

interface ThumbnailCropPaneProps {
  /** URL of the current thumbnail */
  thumbnailUrl: string;
  /** ID of the content/recording */
  recordingId: string;
  /** Callback to close the parent modal */
  onClose: () => void;
  /** Callback after successful crop */
  onCropped?: () => void;
}

// ThumbnailHero uses 2.35:1 aspect ratio
const CROP_ASPECT = 2.35;

/**
 * Create a cropped image from the source image and crop area
 */
async function createCroppedImage(
  imageSrc: string,
  pixelCrop: Area
): Promise<{ base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }> {
  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Set canvas size to cropped dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Convert to base64 JPEG (good compression for thumbnails)
  const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

  return { base64, mimeType: 'image/jpeg' };
}

/**
 * ThumbnailCropPane - Cropping panel using react-easy-crop
 *
 * Features:
 * - Locked 2.35:1 aspect ratio (matches ThumbnailHero)
 * - Zoom slider control
 * - Pan by dragging
 * - Canvas-based crop processing
 * - Loading state during save
 */
export function ThumbnailCropPane({
  thumbnailUrl,
  recordingId,
  onClose,
  onCropped,
}: ThumbnailCropPaneProps) {
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const { updateThumbnail, isUpdating } = useThumbnailMutations(recordingId, () => {
    onCropped?.();
    onClose();
  });

  const onCropComplete = React.useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSaveCrop = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      const { base64, mimeType } = await createCroppedImage(
        thumbnailUrl,
        croppedAreaPixels
      );

      updateThumbnail.mutate({ thumbnailData: base64, mimeType });
    } catch (error) {
      console.error('Failed to crop image:', error);
      setIsProcessing(false);
    }
  };

  const isLoading = isProcessing || isUpdating;

  return (
    <div className="flex flex-col">
      {/* Cropper container */}
      <div className="relative h-[350px] bg-black">
        <Cropper
          image={thumbnailUrl}
          crop={crop}
          zoom={zoom}
          aspect={CROP_ASPECT}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          cropShape="rect"
          showGrid={true}
          classes={{
            containerClassName: 'rounded-t-lg',
            cropAreaClassName: 'border-2 border-accent',
          }}
        />
      </div>

      {/* Zoom control */}
      <div className="px-6 py-4 border-t border-border/50 bg-muted/30">
        <div className="flex items-center gap-4">
          <ZoomOut className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.05}
            onValueChange={([value]) => setZoom(value)}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground w-12 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Footer buttons */}
      <div className="flex justify-end gap-3 p-6 pt-4 border-t border-border/50">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSaveCrop}
          disabled={isLoading || !croppedAreaPixels}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Crop className="mr-2 h-4 w-4" />
              Save Crop
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ThumbnailCropPane;
