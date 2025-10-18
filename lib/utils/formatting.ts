/**
 * Shared formatting utilities for consistent data display across the application
 */

/**
 * Formats bytes into a human-readable string with appropriate units
 * @param bytes - The number of bytes to format
 * @returns A formatted string (e.g., "1.23 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  // Handle negative values
  const sign = bytes < 0 ? '-' : '';
  const absBytes = Math.abs(bytes);

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));

  // Clamp index to valid range
  const clampedIndex = Math.max(0, Math.min(i, sizes.length - 1));

  return `${sign}${(absBytes / Math.pow(k, clampedIndex)).toFixed(2)} ${sizes[clampedIndex]}`;
}

/**
 * Calculates the percentage of a value relative to a total
 * @param value - The value to calculate percentage for
 * @param total - The total to calculate percentage against
 * @returns The percentage as a number (0-100)
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return (value / total) * 100;
}

/**
 * Formats a number as currency (USD)
 * @param amount - The amount to format
 * @returns A formatted currency string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a percentage value with one decimal place
 * @param value - The percentage value to format
 * @returns A formatted percentage string (e.g., "42.5%")
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Formats a date string into a readable format
 * @param dateString - The ISO date string to format
 * @returns A formatted date string (e.g., "Jan 15, 2024") or empty string for invalid dates
 */
export function formatDate(dateString: string): string {
  // Handle null/undefined/empty input
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Formats a date as a relative time string
 * @param dateString - The ISO date string to format
 * @returns A relative time string (e.g., "2 hours ago" or "in 2 hours") or empty string for invalid dates
 */
export function getRelativeTime(dateString: string): string {
  // Handle null/undefined/empty input
  if (!dateString || (typeof dateString === 'string' && dateString.trim() === '')) {
    return '';
  }

  const date = new Date(dateString);

  // Validate date
  if (isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const absDiffInSeconds = Math.abs(diffInSeconds);
  const isFuture = diffInSeconds < 0;

  if (absDiffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(absDiffInSeconds / 60);
  if (diffInMinutes < 60) {
    const unit = diffInMinutes === 1 ? 'minute' : 'minutes';
    return isFuture ? `in ${diffInMinutes} ${unit}` : `${diffInMinutes} ${unit} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    const unit = diffInHours === 1 ? 'hour' : 'hours';
    return isFuture ? `in ${diffInHours} ${unit}` : `${diffInHours} ${unit} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    const unit = diffInDays === 1 ? 'day' : 'days';
    return isFuture ? `in ${diffInDays} ${unit}` : `${diffInDays} ${unit} ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    const unit = diffInMonths === 1 ? 'month' : 'months';
    return isFuture ? `in ${diffInMonths} ${unit}` : `${diffInMonths} ${unit} ago`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  const unit = diffInYears === 1 ? 'year' : 'years';
  return isFuture ? `in ${diffInYears} ${unit}` : `${diffInYears} ${unit} ago`;
}

/**
 * Formats duration in seconds to MM:SS or HH:MM:SS format
 * @param seconds - The duration in seconds
 * @returns A formatted duration string (e.g., "5:30" or "1:05:30")
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds === 0) {
    return '--:--';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Alias for formatBytes - formats file size in human-readable format
 * @param bytes - The file size in bytes
 * @returns A formatted file size string (e.g., "1.23 MB")
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) {
    return '--';
  }
  return formatBytes(bytes);
}
