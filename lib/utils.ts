import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  // Validate input: handle 0, NaN, negative, or non-finite values
  if (bytes === 0) return '0 Bytes';
  if (!Number.isFinite(bytes) || bytes < 0 || Number.isNaN(bytes)) {
    return '0 Bytes';
  }

  const k = 1024;
  // Ensure decimals is a safe non-negative integer
  const dm = Math.max(0, Math.floor(Number.isFinite(decimals) ? decimals : 2));
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  // Compute index and clamp to valid array bounds
  const i = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(k))), sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
