'use client';

import * as React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Image as ImageIcon, Expand, Pencil, Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/app/components/ui/button';
import { ThumbnailLightbox, ThumbnailEditModal } from '../modals';

interface ThumbnailHeroProps {
  /** URL of the thumbnail image */
  thumbnailUrl: string | null;
  /** Title for accessibility */
  title?: string | null;
  /** Content type for fallback icon */
  contentType?: string | null;
  /** Additional CSS classes */
  className?: string;
  /** Enable hover actions (default: true) */
  editable?: boolean;
  /** Recording ID - required for edit/delete actions */
  recordingId?: string;
  /** Callback after thumbnail changes */
  onThumbnailChange?: () => void;
}

/**
 * ThumbnailHero - Premium hero image display for content detail views
 *
 * Features:
 * - Cinematic aspect ratio with elegant rounded corners
 * - Aurora-inspired gradient overlay on hover
 * - Smooth reveal animation on load
 * - Graceful fallback with content-type icon
 * - Dark mode native design
 * - Hover actions: View (lightbox), Edit (crop/replace/delete), Delete
 */
export default function ThumbnailHero({
  thumbnailUrl,
  title,
  contentType,
  className,
  editable = true,
  recordingId,
  onThumbnailChange,
}: ThumbnailHeroProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Modal states
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [editModalOpen, setEditModalOpen] = React.useState(false);
  const [editModalInitialTab, setEditModalInitialTab] = React.useState<'crop' | 'replace' | 'delete'>('crop');

  const showFallback = !thumbnailUrl || imageError;
  const showHoverActions = editable && thumbnailUrl && !imageError && recordingId;

  // Get appropriate icon for fallback
  const FallbackIcon = contentType === 'document' ? FileText : ImageIcon;

  const handleThumbnailChange = () => {
    onThumbnailChange?.();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          'relative w-full overflow-hidden rounded-xl',
          // Aspect ratio - cinema-style 2.35:1 for dramatic effect
          'aspect-[2.35/1]',
          // Base styling
          'bg-gradient-to-br from-[#042222] via-[#03624c]/20 to-[#042222]',
          // Subtle border
          'ring-1 ring-white/5',
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background texture layer */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            mixBlendMode: 'overlay',
          }}
        />

        {showFallback ? (
          // Fallback state - elegant placeholder
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full bg-accent/5 blur-3xl" />
            </div>

            {/* Icon container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className="relative z-10 flex flex-col items-center gap-3"
            >
              <div className="p-4 rounded-2xl bg-white/5 ring-1 ring-white/10 backdrop-blur-sm">
                <FallbackIcon className="w-8 h-8 text-muted-foreground/60" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-medium text-muted-foreground/40 tracking-wide uppercase">
                {contentType || 'Document'}
              </span>
            </motion.div>
          </div>
        ) : (
          // Image state
          <>
            {/* Loading shimmer */}
            {!imageLoaded && (
              <div className="absolute inset-0">
                <div
                  className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent"
                  style={{ animationDuration: '1.5s' }}
                />
              </div>
            )}

            {/* Main image */}
            <motion.div
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{
                opacity: imageLoaded ? 1 : 0,
                scale: imageLoaded ? 1 : 1.02
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-0"
            >
              <Image
                src={thumbnailUrl}
                alt={title || 'Content thumbnail'}
                fill
                className="object-cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
                priority
              />

              {/* Gradient overlays for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/20" />

              {/* Top vignette */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-background/40 to-transparent" />
            </motion.div>

            {/* Hover aurora effect */}
            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute bottom-0 left-1/4 w-1/2 h-1/3 bg-accent/10 blur-3xl rounded-full" />
            </div>

            {/* Hover actions overlay */}
            <AnimatePresence>
              {showHoverActions && isHovered && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center gap-3 z-10"
                >
                  {/* View button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxOpen(true);
                    }}
                    className="gap-2 bg-white/90 hover:bg-white text-black hover:shadow-[0_0_15px_rgba(0,223,130,0.3)] transition-shadow"
                  >
                    <Expand className="w-4 h-4" />
                    View
                  </Button>

                  {/* Edit button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModalInitialTab('crop');
                      setEditModalOpen(true);
                    }}
                    className="gap-2 bg-white/90 hover:bg-white text-black hover:shadow-[0_0_15px_rgba(0,223,130,0.3)] transition-shadow"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </Button>

                  {/* Delete button */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModalInitialTab('delete');
                      setEditModalOpen(true);
                    }}
                    className="gap-2 bg-white/90 hover:bg-white text-black hover:shadow-[0_0_15px_rgba(255,100,100,0.3)] transition-shadow"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Corner accent decorations */}
        <div className="absolute top-3 left-3 w-6 h-6 border-l border-t border-white/10 rounded-tl-lg" />
        <div className="absolute top-3 right-3 w-6 h-6 border-r border-t border-white/10 rounded-tr-lg" />
        <div className="absolute bottom-3 left-3 w-6 h-6 border-l border-b border-white/10 rounded-bl-lg" />
        <div className="absolute bottom-3 right-3 w-6 h-6 border-r border-b border-white/10 rounded-br-lg" />
      </motion.div>

      {/* Modals */}
      {thumbnailUrl && recordingId && (
        <>
          <ThumbnailLightbox
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
            thumbnailUrl={thumbnailUrl}
            title={title}
          />

          <ThumbnailEditModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            thumbnailUrl={thumbnailUrl}
            recordingId={recordingId}
            onThumbnailChange={handleThumbnailChange}
            initialTab={editModalInitialTab}
          />
        </>
      )}
    </>
  );
}
