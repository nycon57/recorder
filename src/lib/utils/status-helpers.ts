/**
 * Status mapping utilities for consistent status display across the application
 */

/**
 * Recording/Content status types
 */
export type RecordingStatus =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'doc_generating'
  | 'completed'
  | 'error'
  | 'failed';

/**
 * Maps recording status to display-friendly label
 * @param status - The recording status
 * @returns A human-readable status label
 */
export function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    uploading: 'Uploading',
    uploaded: 'Uploaded',
    transcribing: 'Processing',
    transcribed: 'Processing',
    doc_generating: 'Processing',
    completed: 'Ready',
    error: 'Failed',
    failed: 'Failed',
  };

  return statusMap[status] || status;
}

/**
 * Maps recording status to Tailwind CSS color classes
 * @param status - The recording status
 * @returns Tailwind CSS class string for status indicator
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    uploading: 'bg-blue-500',
    uploaded: 'bg-blue-500',
    transcribing: 'bg-yellow-500',
    transcribed: 'bg-yellow-500',
    doc_generating: 'bg-yellow-500',
    completed: 'bg-green-500',
    error: 'bg-red-500',
    failed: 'bg-red-500',
  };

  return colorMap[status] || 'bg-gray-500';
}

/**
 * Maps recording status to Tailwind CSS badge variant classes
 * @param status - The recording status
 * @returns Tailwind CSS classes for badge styling
 */
export function getStatusBadgeColor(status: string): string {
  const badgeColorMap: Record<string, string> = {
    uploading: 'bg-blue-500/10 text-blue-700 border-blue-200',
    uploaded: 'bg-blue-500/10 text-blue-700 border-blue-200',
    transcribing: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    transcribed: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    doc_generating: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    completed: 'bg-green-500/10 text-green-700 border-green-200',
    error: 'bg-red-500/10 text-red-700 border-red-200',
    failed: 'bg-red-500/10 text-red-700 border-red-200',
  };

  return badgeColorMap[status] || 'bg-gray-500/10 text-gray-700 border-gray-200';
}

/**
 * Determines if a status represents a processing state
 * @param status - The recording status
 * @returns True if the status is a processing state
 */
export function isProcessingStatus(status: string): boolean {
  return ['uploading', 'uploaded', 'transcribing', 'transcribed', 'doc_generating'].includes(
    status
  );
}

/**
 * Determines if a status represents a completed state
 * @param status - The recording status
 * @returns True if the status is completed
 */
export function isCompletedStatus(status: string): boolean {
  return status === 'completed';
}

/**
 * Determines if a status represents an error state
 * @param status - The recording status
 * @returns True if the status is an error
 */
export function isErrorStatus(status: string): boolean {
  return ['error', 'failed'].includes(status);
}
