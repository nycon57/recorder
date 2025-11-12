'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

export interface HighlightToolbarProps {
  /**
   * Total number of highlights in the document
   */
  totalHighlights: number;

  /**
   * Current highlight index (0-based)
   */
  currentIndex: number;

  /**
   * Whether highlights are currently visible
   */
  highlightsEnabled: boolean;

  /**
   * Callback when navigating to previous highlight
   */
  onPrevious: () => void;

  /**
   * Callback when navigating to next highlight
   */
  onNext: () => void;

  /**
   * Callback when toggling highlight visibility
   */
  onToggle: () => void;

  /**
   * Callback when closing the toolbar
   */
  onClose: () => void;

  /**
   * Custom className
   */
  className?: string;
}

/**
 * HighlightToolbar Component
 *
 * Floating toolbar for navigating between citation highlights in documents.
 * Provides controls for:
 * - Next/Previous navigation
 * - Toggle highlight visibility
 * - Close toolbar
 * - Keyboard shortcuts (N, P, T, Esc)
 */
export function HighlightToolbar({
  totalHighlights,
  currentIndex,
  highlightsEnabled,
  onPrevious,
  onNext,
  onToggle,
  onClose,
  className,
}: HighlightToolbarProps) {
  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          onNext();
          break;
        case 'p':
          e.preventDefault();
          onPrevious();
          break;
        case 't':
          e.preventDefault();
          onToggle();
          break;
        case 'escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, onToggle, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className={cn(
          'fixed bottom-6 right-6 z-50',
          'rounded-lg border border-border bg-card shadow-lg',
          'flex items-center gap-2 p-2',
          className
        )}
      >
        {/* Highlight info */}
        <div className="flex items-center gap-2 px-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {currentIndex + 1}
          </span>
          <span>of</span>
          <span className="font-medium text-foreground">
            {totalHighlights}
          </span>
          <span className="text-xs">highlights</span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onPrevious}
            disabled={currentIndex === 0}
            aria-label="Previous highlight (P)"
            title="Previous (P)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onNext}
            disabled={currentIndex === totalHighlights - 1}
            aria-label="Next highlight (N)"
            title="Next (N)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Toggle visibility */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          aria-label={highlightsEnabled ? 'Hide highlights (T)' : 'Show highlights (T)'}
          title={highlightsEnabled ? 'Hide (T)' : 'Show (T)'}
        >
          {highlightsEnabled ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
          aria-label="Close toolbar (Esc)"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </motion.div>
    </AnimatePresence>
  );
}
