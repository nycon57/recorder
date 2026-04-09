import { useSwipeable, SwipeableHandlers } from 'react-swipeable';
import { useEffect, useState } from 'react';

interface UseSwipeableTabNavigationProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  enabled?: boolean;
}

/**
 * Custom hook for mobile swipe gestures to navigate between tabs
 * Swipe left: next tab
 * Swipe right: previous tab
 */
export function useSwipeableTabNavigation({
  tabs,
  activeTab,
  onTabChange,
  enabled = true,
}: UseSwipeableTabNavigationProps): SwipeableHandlers {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect if device supports touch
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice(
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-ignore - vendor prefix
        navigator.msMaxTouchPoints > 0
      );
    };

    checkTouchDevice();
    // Re-check on window resize (e.g., responsive mode in DevTools)
    window.addEventListener('resize', checkTouchDevice);
    return () => window.removeEventListener('resize', checkTouchDevice);
  }, []);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (!enabled || !isTouchDevice) return;

      const currentIndex = tabs.indexOf(activeTab);
      const nextIndex = currentIndex + 1;

      if (nextIndex < tabs.length) {
        onTabChange(tabs[nextIndex]);
      }
    },
    onSwipedRight: () => {
      if (!enabled || !isTouchDevice) return;

      const currentIndex = tabs.indexOf(activeTab);
      const prevIndex = currentIndex - 1;

      if (prevIndex >= 0) {
        onTabChange(tabs[prevIndex]);
      }
    },
    preventScrollOnSwipe: false, // Allow vertical scrolling
    trackMouse: false, // Only track touch, not mouse
    trackTouch: true,
    delta: 50, // Minimum swipe distance (pixels)
  });

  // Return empty handlers if disabled or not a touch device
  if (!enabled || !isTouchDevice) {
    return {
      ref: () => {},
    } as SwipeableHandlers;
  }

  return handlers;
}
