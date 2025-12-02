/**
 * Content type helpers, constants, and utilities for multi-format knowledge management.
 * Supports recordings, videos, audio, documents, and text notes.
 */

import type { ContentType, FileType } from './database';

// Re-export types for convenience
export type { ContentType, FileType };

/**
 * Content type constants for use throughout the application
 */
export const CONTENT_TYPES = {
  RECORDING: 'recording' as const,
  VIDEO: 'video' as const,
  AUDIO: 'audio' as const,
  DOCUMENT: 'document' as const,
  TEXT: 'text' as const,
};

/**
 * File extension to content type mapping
 */
export const FILE_EXTENSION_TO_CONTENT_TYPE: Record<FileType, ContentType> = {
  // Video formats
  mp4: 'video',
  mov: 'video',
  webm: 'recording', // Default for recordings, but can also be uploaded video
  avi: 'video',
  // Audio formats
  mp3: 'audio',
  wav: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  // Document formats
  pdf: 'document',
  docx: 'document',
  doc: 'document',
  // Text formats
  txt: 'text',
  md: 'text',
};

/**
 * MIME type to file extension mapping
 */
export const MIME_TYPE_TO_FILE_TYPE: Record<string, FileType> = {
  // Video
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  // Audio
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
  // Documents
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/msword': 'doc',
  // Text
  'text/plain': 'txt',
  'text/markdown': 'md',
};

/**
 * File type to MIME type mapping (reverse of above)
 */
export const FILE_TYPE_TO_MIME_TYPE: Record<FileType, string> = {
  // Video
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  // Documents
  pdf: 'application/pdf',
  docx:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  // Text
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Content type to icon mapping (using emoji or icon names)
 */
export const CONTENT_TYPE_ICONS: Record<ContentType, string> = {
  recording: 'VideoIcon',
  video: 'FileVideoIcon',
  audio: 'AudioLinesIcon',
  document: 'FileTextIcon',
  text: 'FileEditIcon',
};

/**
 * Content type to emoji mapping for quick visual reference
 */
export const CONTENT_TYPE_EMOJI: Record<ContentType, string> = {
  recording: '🎬',
  video: '📹',
  audio: '🎵',
  document: '📄',
  text: '📝',
};

/**
 * Content type to color mapping (Tailwind color classes)
 */
export const CONTENT_TYPE_COLORS: Record<
  ContentType,
  { bg: string; text: string; border: string }
> = {
  recording: {
    bg: 'bg-purple-100 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-300 dark:border-purple-700',
  },
  video: {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-300 dark:border-blue-700',
  },
  audio: {
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-300 dark:border-green-700',
  },
  document: {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-300 dark:border-orange-700',
  },
  text: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-300 dark:border-yellow-700',
  },
};

/**
 * Content type to display name mapping
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  recording: 'Screen Recording',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  text: 'Text Note',
};

/**
 * File size limits in bytes per content type
 */
export const FILE_SIZE_LIMITS: Record<ContentType, number> = {
  recording: 500 * 1024 * 1024, // 500 MB
  video: 500 * 1024 * 1024, // 500 MB
  audio: 100 * 1024 * 1024, // 100 MB
  document: 50 * 1024 * 1024, // 50 MB
  text: 1 * 1024 * 1024, // 1 MB
};

/**
 * Human-readable file size limit labels
 */
export const FILE_SIZE_LIMIT_LABELS: Record<ContentType, string> = {
  recording: '500 MB',
  video: '500 MB',
  audio: '100 MB',
  document: '50 MB',
  text: '1 MB',
};

/**
 * Maximum duration limits in seconds per content type
 *
 * Videos >30 minutes are automatically split into segments for processing.
 * Gemini context window (~1M tokens) supports ~58 minutes, but we use 60 min
 * as a user-friendly limit with automatic segmentation for longer videos.
 *
 * Segmentation threshold: 30 minutes (videos shorter go through single-pass)
 * Maximum supported: 60 minutes (videos longer are rejected)
 */
export const DURATION_LIMITS: Record<ContentType, number | null> = {
  recording: 60 * 60, // 60 minutes (with automatic segmentation for >30 min)
  video: 60 * 60, // 60 minutes (with automatic segmentation for >30 min)
  audio: 60 * 60, // 60 minutes (audio-only is less resource-intensive)
  document: null, // Not applicable
  text: null, // Not applicable
};

/**
 * Human-readable duration limit labels
 */
export const DURATION_LIMIT_LABELS: Record<ContentType, string | null> = {
  recording: '60 minutes',
  video: '60 minutes',
  audio: '60 minutes',
  document: null,
  text: null,
};

/**
 * Accepted file extensions per content type for file input
 */
export const ACCEPTED_FILE_EXTENSIONS: Record<ContentType, string[]> = {
  recording: ['.webm'], // Internal use only
  video: ['.mp4', '.mov', '.webm', '.avi'],
  audio: ['.mp3', '.wav', '.m4a', '.ogg'],
  document: ['.pdf', '.docx', '.doc'],
  text: ['.txt', '.md'],
};

/**
 * Helper function to get content type from MIME type
 */
export function getContentTypeFromMimeType(
  mimeType: string
): ContentType | null {
  const fileType = MIME_TYPE_TO_FILE_TYPE[mimeType];
  if (!fileType) return null;
  return FILE_EXTENSION_TO_CONTENT_TYPE[fileType];
}

/**
 * Helper function to get file type from MIME type
 */
export function getFileTypeFromMimeType(mimeType: string): FileType | null {
  return MIME_TYPE_TO_FILE_TYPE[mimeType] || null;
}

/**
 * Helper function to get file type from file extension
 */
export function getFileTypeFromExtension(filename: string): FileType | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (!ext) return null;

  // Find matching file type
  for (const [fileType, extensions] of Object.entries(
    ACCEPTED_FILE_EXTENSIONS
  )) {
    if (extensions.includes(`.${ext}`)) {
      return ext as FileType;
    }
  }

  return null;
}

/**
 * Helper function to validate file type
 */
export function isValidFileType(
  mimeType: string,
  contentType?: ContentType
): boolean {
  const fileType = MIME_TYPE_TO_FILE_TYPE[mimeType];
  if (!fileType) return false;

  // If content type is specified, verify the file type matches
  if (contentType) {
    const expectedContentType = FILE_EXTENSION_TO_CONTENT_TYPE[fileType];
    return expectedContentType === contentType;
  }

  return true;
}

/**
 * Helper function to validate file size
 */
export function isValidFileSize(size: number, contentType: ContentType): boolean {
  return size <= FILE_SIZE_LIMITS[contentType];
}

/**
 * Helper function to validate duration
 * Returns true if duration is valid (within limits or no limit applies)
 */
export function isValidDuration(
  durationSeconds: number | null | undefined,
  contentType: ContentType
): boolean {
  const limit = DURATION_LIMITS[contentType];
  // If no limit or no duration provided, consider it valid
  if (limit === null || durationSeconds === null || durationSeconds === undefined) {
    return true;
  }
  return durationSeconds <= limit;
}

/**
 * Get duration limit for content type
 */
export function getDurationLimit(contentType: ContentType): number | null {
  return DURATION_LIMITS[contentType];
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDurationSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

/**
 * Helper function to format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Helper function to get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ? `.${ext}` : '';
}

/**
 * Helper function to determine if content type requires transcription
 */
export function requiresTranscription(contentType: ContentType): boolean {
  return ['recording', 'video', 'audio'].includes(contentType);
}

/**
 * Helper function to determine if content type requires text extraction
 */
export function requiresTextExtraction(contentType: ContentType): boolean {
  return contentType === 'document';
}

/**
 * Helper function to get processing jobs for content type
 */
export function getProcessingJobs(
  contentType: ContentType,
  fileType?: FileType
): Array<'transcribe' | 'extract_audio' | 'extract_text_pdf' | 'extract_text_docx' | 'process_text_note'> {
  switch (contentType) {
    case 'recording':
      return ['transcribe'];
    case 'video':
      return ['extract_audio', 'transcribe'];
    case 'audio':
      return ['transcribe'];
    case 'document':
      // Determine PDF vs DOCX based on file type
      if (fileType === 'pdf') {
        return ['extract_text_pdf'];
      } else if (fileType === 'docx' || fileType === 'doc') {
        return ['extract_text_docx'];
      }
      // Default to PDF if fileType not specified (backwards compatibility)
      return ['extract_text_pdf'];
    case 'text':
      return ['process_text_note'];
    default:
      return [];
  }
}

/**
 * Content type categories for grouping
 */
export const CONTENT_TYPE_CATEGORIES = {
  MEDIA: ['recording', 'video', 'audio'] as ContentType[],
  DOCUMENTS: ['document', 'text'] as ContentType[],
  ALL: ['recording', 'video', 'audio', 'document', 'text'] as ContentType[],
};

/**
 * Upload validation result type
 */
export interface UploadValidationResult {
  valid: boolean;
  error?: string;
  contentType?: ContentType;
  fileType?: FileType;
}

/**
 * Validate file for upload
 * @param file - The file to validate
 * @param durationSeconds - Optional duration in seconds (for video/audio files)
 */
export function validateFileForUpload(
  file: File,
  durationSeconds?: number
): UploadValidationResult {
  // Check MIME type
  const fileType = getFileTypeFromMimeType(file.type);
  if (!fileType) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type}`,
    };
  }

  const contentType = FILE_EXTENSION_TO_CONTENT_TYPE[fileType];
  if (!contentType) {
    return {
      valid: false,
      error: `Unable to determine content type for file: ${file.name}`,
    };
  }

  // Check file size
  if (!isValidFileSize(file.size, contentType)) {
    return {
      valid: false,
      error: `File size exceeds limit of ${FILE_SIZE_LIMIT_LABELS[contentType]} for ${CONTENT_TYPE_LABELS[contentType]} files`,
    };
  }

  // Check duration (if provided) for video/audio content
  if (durationSeconds !== undefined && !isValidDuration(durationSeconds, contentType)) {
    const maxDuration = DURATION_LIMIT_LABELS[contentType];
    const actualDuration = formatDurationSeconds(durationSeconds);
    return {
      valid: false,
      error: `${CONTENT_TYPE_LABELS[contentType]} duration (${actualDuration}) exceeds maximum of ${maxDuration}. Please trim or split into shorter segments.`,
    };
  }

  return {
    valid: true,
    contentType,
    fileType,
  };
}
