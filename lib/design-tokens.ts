/**
 * Design System Tokens
 *
 * Centralized design tokens for consistent UI patterns across the application.
 * Use these tokens instead of hardcoded values to ensure consistency.
 *
 * @see REGISTRY.md for component standards
 */

/**
 * Card Surface Variants
 * Standardized patterns for card-like containers
 */
export const cardSurface = {
  /** Default card - subtle border and shadow */
  default: 'bg-card text-card-foreground border border-border rounded-xl shadow-sm',
  /** Flat card - border only, no shadow */
  flat: 'bg-card text-card-foreground border border-border rounded-lg',
  /** Elevated card - more prominent shadow */
  elevated: 'bg-card text-card-foreground border border-border rounded-xl shadow-md',
  /** Prominent card - for featured content */
  prominent: 'bg-card text-card-foreground border border-border rounded-xl shadow-lg',
  /** Muted card - subtle background */
  muted: 'bg-muted/50 text-card-foreground border border-border rounded-lg',
  /** Ghost card - minimal styling */
  ghost: 'bg-transparent text-card-foreground border border-border/50 rounded-lg',
  /** Interactive card - with hover state */
  interactive: 'bg-card text-card-foreground border border-border rounded-lg shadow-sm hover:shadow-md hover:border-border/80 transition-all',
} as const;

/**
 * Semantic Status Colors
 * Consistent color scheme for status indicators
 */
export const statusColors = {
  /** Info - blue tones for informational states */
  info: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
    solid: 'bg-blue-500',
  },
  /** Success - green/emerald tones for positive states */
  success: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    solid: 'bg-emerald-500',
  },
  /** Warning - amber/yellow tones for caution states */
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
    solid: 'bg-amber-500',
  },
  /** Error - red/destructive tones for error states */
  error: {
    bg: 'bg-destructive/10 dark:bg-destructive/20',
    text: 'text-destructive dark:text-red-400',
    border: 'border-destructive/20',
    solid: 'bg-destructive',
  },
  /** Neutral - muted tones for inactive/pending states */
  neutral: {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-muted-foreground/20',
    solid: 'bg-muted-foreground',
  },
  /** Processing - violet tones for active processing */
  processing: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-500/20',
    solid: 'bg-violet-500',
  },
} as const;

/**
 * Content Type Colors
 * Consistent color scheme for different content types
 */
export const contentTypeColors = {
  /** Recording - blue (camera/screen capture) */
  recording: {
    bg: 'bg-blue-500/10 dark:bg-blue-500/20',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
    hover: 'hover:bg-blue-500/20 dark:hover:bg-blue-500/30',
  },
  /** Video - violet (uploaded videos) */
  video: {
    bg: 'bg-violet-500/10 dark:bg-violet-500/20',
    text: 'text-violet-700 dark:text-violet-400',
    border: 'border-violet-500/20',
    hover: 'hover:bg-violet-500/20 dark:hover:bg-violet-500/30',
  },
  /** Audio - orange (audio files) */
  audio: {
    bg: 'bg-orange-500/10 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-500/20',
    hover: 'hover:bg-orange-500/20 dark:hover:bg-orange-500/30',
  },
  /** Document - sky (PDFs, docs) */
  document: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/20',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/20',
    hover: 'hover:bg-sky-500/20 dark:hover:bg-sky-500/30',
  },
  /** Text - emerald (text notes) */
  text: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    hover: 'hover:bg-emerald-500/20 dark:hover:bg-emerald-500/30',
  },
} as const;

/**
 * Icon Size Standards
 * Consistent icon sizes across the application
 */
export const iconSize = {
  /** Extra small - 12px, for inline or tight spaces */
  xs: 'size-3',
  /** Small - 14px, for compact UI */
  sm: 'size-3.5',
  /** Default - 16px, standard size */
  default: 'size-4',
  /** Medium - 20px, for emphasis */
  md: 'size-5',
  /** Large - 24px, for prominent icons */
  lg: 'size-6',
  /** Extra large - 32px, for hero sections */
  xl: 'size-8',
} as const;

/**
 * Icon Size for Badge Components
 * Maps badge sizes to icon sizes
 */
export const badgeIconSize = {
  sm: 'size-3',
  default: 'size-3.5',
  lg: 'size-4',
} as const;

/**
 * Spacing Scale
 * Standard spacing values for consistent layouts
 */
export const spacing = {
  /** Page padding - responsive */
  page: 'px-4 sm:px-6 lg:px-8',
  /** Section gap */
  section: 'space-y-8',
  /** Card content padding */
  card: 'p-6',
  /** Card header/footer padding */
  cardSection: 'px-6',
  /** Compact padding */
  compact: 'p-4',
  /** Tight padding */
  tight: 'p-3',
  /** Inline gap */
  inline: 'gap-2',
  /** Stack gap */
  stack: 'gap-4',
} as const;

/**
 * Badge Size Classes
 * Consistent badge sizing across all badge components
 */
export const badgeSize = {
  sm: 'text-xs px-2 py-0.5',
  default: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
} as const;

/**
 * Alert/Notice Variants
 * For info boxes, warnings, and alerts
 */
export const alertVariant = {
  info: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
  success: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
  warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  error: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
} as const;

/**
 * Type exports for TypeScript support
 */
export type CardSurfaceVariant = keyof typeof cardSurface;
export type StatusColorKey = keyof typeof statusColors;
export type ContentTypeColorKey = keyof typeof contentTypeColors;
export type IconSizeKey = keyof typeof iconSize;
export type SpacingKey = keyof typeof spacing;
export type BadgeSizeKey = keyof typeof badgeSize;
export type AlertVariantKey = keyof typeof alertVariant;
