/**
 * Recording configuration and limits
 */

export const RECORDING_LIMITS = {
  // Maximum recording duration in milliseconds (30 minutes)
  MAX_DURATION_MS: 30 * 60 * 1000,

  // Maximum file size in bytes (500 MB)
  MAX_FILE_SIZE_BYTES: 500 * 1024 * 1024,

  // Warning threshold for file size (400 MB - warn before hitting limit)
  WARN_FILE_SIZE_BYTES: 400 * 1024 * 1024,

  // Warning threshold for duration (25 minutes - warn before hitting limit)
  WARN_DURATION_MS: 25 * 60 * 1000,
} as const;

// Human-readable labels for limits
export const RECORDING_LIMITS_LABELS = {
  MAX_DURATION: '30 minutes',
  MAX_FILE_SIZE: '500 MB',
  WARN_DURATION: '25 minutes',
  WARN_FILE_SIZE: '400 MB',
} as const;

// Format duration in ms to human-readable string
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

// Format file size in bytes to human-readable string
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
