import { useEffect, useRef, useState } from 'react';

interface SwipeGestureConfig {
  /**
   * Callback when user swipes left (next item/tab)
   */
  onSwipeLeft?: () => void;

  /**
   * Callback when user swipes right (previous item/tab)
   */
  onSwipeRight?: () => void;

  /**
   * Minimum swipe distance in pixels to trigger gesture (default: 50)
   */
  threshold?: number;

  /**
   * Maximum time in ms for gesture to be considered a swipe (default: 300)
   */
  maxDuration?: number;

  /**
   * Whether gestures are enabled (default: true)
   */
  enabled?: boolean;
}

interface TouchPosition {
  x: number;
  y: number;
  time: number;
}

/**
 * useSwipeGesture - Detect horizontal swipe gestures on mobile
 *
 * Provides touch-based navigation for tabs and content.
 * Returns a ref to attach to the swipeable element.
 *
 * @example
 * const swipeRef = useSwipeGesture({
 *   onSwipeLeft: () => setActiveTab(nextTab),
 *   onSwipeRight: () => setActiveTab(prevTab),
 *   threshold: 75,
 * });
 *
 * return <div ref={swipeRef}>Swipeable content</div>;
 */
export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  maxDuration = 300,
  enabled = true,
}: SwipeGestureConfig) {
  const touchStart = useRef<TouchPosition | null>(null);
  const touchEnd = useRef<TouchPosition | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only track single-finger swipes
      if (e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchStart.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchEnd.current = null;
      setIsSwiping(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current || e.touches.length !== 1) return;

      const touch = e.touches[0];
      touchEnd.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      // Calculate horizontal and vertical distances
      const deltaX = Math.abs(touch.clientX - touchStart.current.x);
      const deltaY = Math.abs(touch.clientY - touchStart.current.y);

      // If horizontal swipe is dominant, prevent default scroll
      if (deltaX > deltaY && deltaX > threshold / 2) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!touchStart.current || !touchEnd.current) {
        setIsSwiping(false);
        return;
      }

      const deltaX = touchEnd.current.x - touchStart.current.x;
      const deltaY = touchEnd.current.y - touchStart.current.y;
      const duration = touchEnd.current.time - touchStart.current.time;

      // Check if gesture meets criteria
      const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
      const meetsThreshold = Math.abs(deltaX) > threshold;
      const withinDuration = duration < maxDuration;

      if (isHorizontalSwipe && meetsThreshold && withinDuration) {
        if (deltaX > 0 && onSwipeRight) {
          // Swipe right (previous)
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          // Swipe left (next)
          onSwipeLeft();
        }
      }

      // Reset
      touchStart.current = null;
      touchEnd.current = null;
      setIsSwiping(false);
    };

    const handleTouchCancel = () => {
      touchStart.current = null;
      touchEnd.current = null;
      setIsSwiping(false);
    };

    // Add event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchCancel);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, onSwipeLeft, onSwipeRight, threshold, maxDuration]);

  return { ref: elementRef, isSwiping };
}
