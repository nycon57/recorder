/**
 * Color Utilities for Tribora Design System
 *
 * Provides utilities for calculating accessible text colors based on background luminance
 * and generating CSS custom properties for dynamic badge/tag colors.
 *
 * Uses WCAG 2.0 relative luminance formula for contrast calculations.
 */

import type { CSSProperties } from 'react';

/**
 * Calculate accessible text color based on background luminance
 * Uses WCAG 2.0 relative luminance formula
 *
 * @param hexColor - Hex color string (with or without #)
 * @returns Black (#000000) for light backgrounds, white (#ffffff) for dark backgrounds
 *
 * @example
 * getContrastColor('#00df82') // Returns '#000000' (black text on bright green)
 * getContrastColor('#03624c') // Returns '#ffffff' (white text on dark green)
 */
export function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');

  // Handle shorthand hex (e.g., #abc -> #aabbcc)
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  // WCAG 2.0 relative luminance formula
  // Coefficients represent human eye sensitivity to RGB
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // 0.5 threshold provides good contrast for most colors
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Generate CSS custom properties for dynamic badge/tag colors
 * These properties are consumed by the [data-slot="colored-badge"] selector in globals.css
 *
 * @param bgColor - Background color in hex format
 * @returns React CSSProperties object with --badge-bg and --badge-text custom properties
 *
 * @example
 * <span style={generateColorVars('#00df82')}>Tag</span>
 * // Results in: style="--badge-bg: #00df82; --badge-text: #000000"
 */
export function generateColorVars(bgColor: string): CSSProperties {
  return {
    '--badge-bg': bgColor,
    '--badge-text': getContrastColor(bgColor),
  } as CSSProperties;
}

/**
 * Check if a color is considered "dark" (for choosing light/dark overlays)
 *
 * @param hexColor - Hex color string
 * @returns true if the color is dark (luminance <= 0.5)
 */
export function isDarkColor(hexColor: string): boolean {
  return getContrastColor(hexColor) === '#ffffff';
}

/**
 * Check if a color is considered "light" (for choosing light/dark overlays)
 *
 * @param hexColor - Hex color string
 * @returns true if the color is light (luminance > 0.5)
 */
export function isLightColor(hexColor: string): boolean {
  return getContrastColor(hexColor) === '#000000';
}

/**
 * Generate a semi-transparent version of a color for hover/overlay states
 *
 * @param hexColor - Hex color string
 * @param opacity - Opacity value between 0 and 1
 * @returns RGBA color string
 *
 * @example
 * withOpacity('#00df82', 0.15) // Returns 'rgba(0, 223, 130, 0.15)'
 */
export function withOpacity(hexColor: string, opacity: number): string {
  const hex = hexColor.replace('#', '');
  const fullHex =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Tribora brand colors for reference
 * Use these constants instead of hardcoding color values
 */
export const BRAND_COLORS = {
  /** Primary brand color - Bangladesh Green */
  primary: '#03624c',
  /** Secondary supporting green - Mountain Meadow */
  secondary: '#2cc295',
  /** Accent bright highlights - Caribbean Green */
  accent: '#00df82',
  /** Dark mode background - Full Black */
  backgroundDark: '#030e10',
  /** Light mode background - Anti-Flash White */
  backgroundLight: '#f1f7f7',
  /** Card surfaces in dark mode - Dark Green */
  surfaceDark: '#042222',
  /** Elevated surfaces - Pine */
  surfaceElevated: '#06302c',
} as const;

/**
 * Default colors for tags by category (optional predefined palette)
 */
export const TAG_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
] as const;
