/**
 * Animation Utilities
 *
 * Reusable Framer Motion variants and animation configurations
 * All animations respect prefers-reduced-motion
 */

import { Variants } from 'framer-motion';

/**
 * Check if user prefers reduced motion
 */
export const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Container animation for staggered children
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
  exit: { opacity: 0 },
};

/**
 * Faster stagger for large lists
 */
export const staggerContainerFast: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.02,
    },
  },
};

/**
 * Item animation for staggered lists (fade + slide up)
 */
export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Fade in animation
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * Fade in with slide from bottom
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

/**
 * Fade in with slide from top
 */
export const fadeInDown: Variants = {
  hidden: {
    opacity: 0,
    y: -24,
  },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

/**
 * Scale animation (for modals, popovers)
 */
export const scaleIn: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15,
    },
  },
};

/**
 * Card hover animation config
 */
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  hover: {
    scale: 1.02,
    y: -4,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

/**
 * Button press animation config
 */
export const buttonPress = {
  rest: { scale: 1 },
  tap: {
    scale: 0.97,
    transition: {
      duration: 0.1,
      ease: 'easeInOut',
    },
  },
};

/**
 * Page transition variants
 */
export const pageTransition: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

/**
 * Layout transition config (for view mode switches)
 */
export const layoutTransition = {
  type: 'spring',
  stiffness: 350,
  damping: 30,
};

/**
 * Smooth height animation config
 */
export const heightTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/**
 * Get animation variants that respect reduced motion
 * @param variants - The animation variants to use
 * @returns Variants with reduced motion support
 */
export const withReducedMotion = (variants: Variants): Variants => {
  if (prefersReducedMotion()) {
    // Simplify all animations to just opacity changes
    const simplified: Variants = {};
    Object.keys(variants).forEach((key) => {
      const variant = variants[key];
      if (typeof variant === 'object' && variant !== null) {
        simplified[key] = {
          opacity: variant.opacity ?? 1,
          transition: { duration: 0.01 },
        };
      }
    });
    return simplified;
  }
  return variants;
};

/**
 * Hover lift effect with shadow (for cards)
 */
export const hoverLift = {
  whileHover: {
    y: -4,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
};

/**
 * Thumbnail zoom effect
 */
export const thumbnailZoom = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      duration: 0.3,
      ease: 'easeOut',
    },
  },
};

/**
 * Stagger delay calculator
 * @param index - Item index
 * @param baseDelay - Base delay in seconds
 * @returns Calculated delay
 */
export const calculateStaggerDelay = (index: number, baseDelay = 0.05): number => {
  return index * baseDelay;
};
