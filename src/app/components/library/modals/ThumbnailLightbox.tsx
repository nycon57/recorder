'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

import {
  ContentModal,
  ContentModalBody,
  ContentModalHeader,
  ContentModalTitle,
} from '@/app/components/ui/content-modal';
import { Button } from '@/app/components/ui/button';

interface ThumbnailLightboxProps {
  /** Controls the open/closed state */
  open: boolean;
  /** Callback when the modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** URL of the thumbnail to display */
  thumbnailUrl: string;
  /** Optional title for accessibility */
  title?: string | null;
}

/**
 * ThumbnailLightbox - Simple full-size image preview modal
 *
 * Features:
 * - Full-screen darkened overlay
 * - Image displayed at natural size (max 90% viewport)
 * - Click outside or X button to close
 * - Keyboard accessible (Escape to close)
 * - Smooth fade in/out animation
 */
export function ThumbnailLightbox({
  open,
  onOpenChange,
  thumbnailUrl,
  title,
}: ThumbnailLightboxProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setImageLoaded(false);
      setImageError(false);
    }
  }, [open]);

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      size="full"
      glass={false}
      glow={false}
      showCloseButton={false}
      className="bg-black/95 border-none shadow-none"
    >
      {/* Visually hidden title for accessibility */}
      <VisuallyHidden>
        <ContentModalHeader>
          <ContentModalTitle>
            {title || 'Image Preview'}
          </ContentModalTitle>
        </ContentModalHeader>
      </VisuallyHidden>

      <ContentModalBody className="p-0 max-h-[100vh] flex items-center justify-center">
        {/* Close button - top right */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Close</span>
        </Button>

        {/* Image container */}
        <div className="relative flex items-center justify-center w-full h-full min-h-[80vh] p-8">
          <AnimatePresence mode="wait">
            {/* Loading state */}
            {!imageLoaded && !imageError && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
              </motion.div>
            )}

            {/* Error state */}
            {imageError && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-white/60"
              >
                <p>Failed to load image</p>
              </motion.div>
            )}

            {/* Image */}
            <motion.img
              key="image"
              src={thumbnailUrl}
              alt={title || 'Thumbnail preview'}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{
                opacity: imageLoaded ? 1 : 0,
                scale: imageLoaded ? 1 : 0.95,
              }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </AnimatePresence>
        </div>

        {/* Click backdrop to close */}
        <div
          className="absolute inset-0 -z-10"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      </ContentModalBody>
    </ContentModal>
  );
}

export default ThumbnailLightbox;
