/**
 * Animation Utilities
 *
 * Reusable Framer Motion animation variants and configurations
 * for consistent, smooth animations throughout the chat interface.
 */

import { useState, useEffect } from 'react';
import type { Variants, Transition } from 'framer-motion';

/**
 * Easing presets
 */
export const easings = {
  // Standard easing for most animations
  standard: [0.4, 0, 0.2, 1],
  // Emphasized easing for important elements
  emphasized: [0.4, 0, 0, 1],
  // Decelerated easing for exit animations
  decelerated: [0, 0, 0.2, 1],
  // Accelerated easing for entrance animations
  accelerated: [0.4, 0, 1, 1],
  // Spring-like bounce
  bounce: [0.68, -0.55, 0.265, 1.55],
};

/**
 * Duration presets (in seconds)
 */
export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
  slower: 0.5,
};

/**
 * Message animation variants
 */
export const messageVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: durations.fast,
      ease: easings.decelerated,
    },
  },
};

/**
 * Collapsible section variants
 */
export const collapsibleVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: durations.normal,
        ease: easings.emphasized,
      },
      opacity: {
        duration: durations.fast,
        ease: easings.decelerated,
      },
    },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: {
        duration: durations.normal,
        ease: easings.emphasized,
      },
      opacity: {
        duration: durations.normal,
        ease: easings.accelerated,
        delay: 0.1,
      },
    },
  },
};

/**
 * Button hover/tap variants
 */
export const buttonVariants: Variants = {
  idle: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: {
      duration: durations.fast,
      ease: easings.emphasized,
    },
  },
  tap: {
    scale: 0.95,
    transition: {
      duration: durations.fast,
      ease: easings.emphasized,
    },
  },
};

/**
 * Icon button variants (smaller scale changes)
 */
export const iconButtonVariants: Variants = {
  idle: {
    scale: 1,
    rotate: 0,
  },
  hover: {
    scale: 1.1,
    transition: {
      duration: durations.fast,
      ease: easings.emphasized,
    },
  },
  tap: {
    scale: 0.9,
    rotate: -5,
    transition: {
      duration: durations.fast,
      ease: easings.emphasized,
    },
  },
};

/**
 * Fade in/out variants
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: durations.normal,
      ease: easings.standard,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: durations.fast,
      ease: easings.decelerated,
    },
  },
};

/**
 * Slide in from bottom variants
 */
export const slideUpVariants: Variants = {
  hidden: {
    y: 50,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: durations.fast,
      ease: easings.decelerated,
    },
  },
};

/**
 * Scale and fade variants (for modals, dropdowns)
 */
export const scaleVariants: Variants = {
  hidden: {
    scale: 0.8,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    transition: {
      duration: durations.fast,
      ease: easings.decelerated,
    },
  },
};

/**
 * Stagger children animation
 */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
};

/**
 * Pulse animation (for notifications, badges)
 */
export const pulseVariants: Variants = {
  idle: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.1, 1],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Shimmer animation (for loading states)
 */
export const shimmerTransition: Transition = {
  duration: 1.5,
  repeat: Infinity,
  ease: 'linear',
};

/**
 * Bounce entrance animation
 */
export const bounceVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: durations.slow,
      ease: easings.bounce,
    },
  },
};

/**
 * Shake animation (for errors)
 */
export const shakeVariants: Variants = {
  idle: {
    x: 0,
  },
  shake: {
    x: [-10, 10, -10, 10, 0],
    transition: {
      duration: 0.4,
      ease: 'easeInOut',
    },
  },
};

/**
 * Rotate variants (for icons)
 */
export const rotateVariants: Variants = {
  idle: {
    rotate: 0,
  },
  rotate90: {
    rotate: 90,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
  rotate180: {
    rotate: 180,
    transition: {
      duration: durations.normal,
      ease: easings.emphasized,
    },
  },
  spin: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/**
 * Notification/Toast variants (slide in from top)
 */
export const toastVariants: Variants = {
  hidden: {
    y: -100,
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    y: -100,
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: durations.normal,
      ease: easings.decelerated,
    },
  },
};

/**
 * Page transition variants
 */
export const pageVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: durations.slow,
      ease: easings.emphasized,
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: durations.normal,
      ease: easings.decelerated,
    },
  },
};

/**
 * Confetti/celebration animation
 */
export const celebrationVariants: Variants = {
  idle: {
    scale: 1,
    rotate: 0,
    y: 0,
  },
  celebrate: {
    scale: [1, 1.2, 1],
    rotate: [0, 10, -10, 0],
    y: [0, -20, 0],
    transition: {
      duration: 0.6,
      ease: 'easeInOut',
    },
  },
};

/**
 * Helper function to create spring animation
 */
export const springTransition = (
  stiffness: number = 400,
  damping: number = 30
): Transition => ({
  type: 'spring',
  stiffness,
  damping,
});

/**
 * Helper function to create custom duration transition
 */
export const customDuration = (
  duration: number,
  ease: number[] | string = easings.emphasized
): Transition => ({
  duration,
  ease,
});

/**
 * Accessibility-friendly reduced motion hook
 * Updates dynamically when user changes OS accessibility settings
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
}

/**
 * Get animation variants with reduced motion support
 * Note: Use usePrefersReducedMotion() hook in components instead of this function
 */
export const getVariants = (variants: Variants, prefersReducedMotion: boolean): Variants => {
  if (prefersReducedMotion) {
    // Return simplified animations for reduced motion preference
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return variants;
};
