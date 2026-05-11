'use client';

/* global HTMLAudioElement, HTMLVideoElement */

import {
  Upload,
  X,
  AlertCircle,
  FileIcon,
  Video,
  Music,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import {
  useReducer,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import {
  validateFileForUpload,
  formatFileSize,
  getContentTypeFromMimeType,
  CONTENT_TYPE_LABELS,
  type ContentType,
} from '@/lib/types/content';

interface FileUploadStepProps {
  onNext: (data: {
    file: File;
    contentType: ContentType;
    thumbnail?: string; // Base64 data URL
    durationSec?: number;
  }) => void;
  onCancel?: () => void;
  initialFileData?: {
    file: File;
    contentType: ContentType;
    thumbnail?: string;
    durationSec?: number;
  } | null;
}

interface FileUploadStepState {
  file: File | null;
  error: string | null;
  isDragging: boolean;
  thumbnail: string | null;
  durationSec: number | undefined;
  isExtracting: boolean;
}

const createInitialFileUploadStepState = (
  initialFileData: FileUploadStepProps['initialFileData'],
): FileUploadStepState => ({
  file: initialFileData?.file || null,
  error: null,
  isDragging: false,
  thumbnail: initialFileData?.thumbnail || null,
  durationSec: initialFileData?.durationSec,
  isExtracting: false,
});

const fileUploadStepReducer = (
  state: FileUploadStepState,
  patch: Partial<FileUploadStepState>,
): FileUploadStepState => ({
  ...state,
  ...patch,
});

/**
 * Step 1: File Selection and Validation
 *
 * Features:
 * - Drag & drop file upload
 * - Click to browse file selection
 * - File validation (type, size)
 * - Auto thumbnail extraction for videos
 * - File preview player
 * - Duration extraction for video/audio
 */
export default function FileUploadStep(
  props: Parameters<typeof useFileUploadStepImplementation>[0],
) {
  return useFileUploadStepImplementation(props);
}

function useFileUploadStepImplementation({
  onNext,
  onCancel,
  initialFileData,
}: FileUploadStepProps) {
  const [
    { file, error, isDragging, thumbnail, durationSec, isExtracting },
    updateStepState,
  ] = useReducer(
    fileUploadStepReducer,
    initialFileData,
    createInitialFileUploadStepState,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const videoObjectUrl = useMemo(() => {
    if (!file?.type.startsWith('video/')) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const audioObjectUrl = useMemo(() => {
    if (!file?.type.startsWith('audio/')) return null;
    return URL.createObjectURL(file);
  }, [file]);

  /**
   * Cleanup object URLs when previews change or unmount
   */
  useEffect(() => {
    return () => {
      if (videoObjectUrl) {
        URL.revokeObjectURL(videoObjectUrl);
      }
      if (audioObjectUrl) {
        URL.revokeObjectURL(audioObjectUrl);
      }
    };
  }, [videoObjectUrl, audioObjectUrl]);

  /**
   * Extract thumbnail from video file
   */
  const extractVideoThumbnail = useCallback(
    async (videoFile: File): Promise<string | null> => {
      return new Promise((resolve) => {
        try {
          const video = document.createElement('video');
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(null);
            return;
          }

          video.preload = 'metadata';
          video.muted = true;
          video.playsInline = true;

          video.onloadedmetadata = () => {
            // Set canvas dimensions to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Seek to 1 second or 10% of duration (whichever is less)
            const seekTime = Math.min(1, video.duration * 0.1);
            video.currentTime = seekTime;
          };

          video.onseeked = () => {
            try {
              // Draw video frame to canvas
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              // Convert canvas to data URL
              const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

              // Cleanup
              URL.revokeObjectURL(video.src);
              resolve(dataUrl);
            } catch (err) {
              console.error(
                '[FileUploadStep] Thumbnail extraction failed:',
                err,
              );
              resolve(null);
            }
          };

          video.onerror = () => {
            console.error('[FileUploadStep] Video load error');
            URL.revokeObjectURL(video.src);
            resolve(null);
          };

          video.src = URL.createObjectURL(videoFile);
        } catch (err) {
          console.error('[FileUploadStep] Thumbnail extraction error:', err);
          resolve(null);
        }
      });
    },
    [],
  );

  /**
   * Extract duration from video/audio file
   */
  const extractMediaDuration = useCallback(
    async (mediaFile: File): Promise<number | undefined> => {
      return new Promise((resolve) => {
        try {
          const isVideo = mediaFile.type.startsWith('video/');
          const element = isVideo
            ? document.createElement('video')
            : document.createElement('audio');

          element.preload = 'metadata';
          element.muted = true;
          if ('playsInline' in element) {
            (element as HTMLVideoElement).playsInline = true;
          }

          element.onloadedmetadata = () => {
            const duration = element.duration;
            URL.revokeObjectURL(element.src);
            resolve(
              duration && isFinite(duration) ? Math.round(duration) : undefined,
            );
          };

          element.onerror = () => {
            console.error('[FileUploadStep] Media duration extraction failed');
            URL.revokeObjectURL(element.src);
            resolve(undefined);
          };

          element.src = URL.createObjectURL(mediaFile);
        } catch (err) {
          console.error('[FileUploadStep] Duration extraction error:', err);
          resolve(undefined);
        }
      });
    },
    [],
  );

  /**
   * Process selected file
   */
  const processFile = useCallback(
    async (selectedFile: File) => {
      updateStepState({
        error: null,
        isExtracting: true,
        thumbnail: null,
        durationSec: undefined,
      });

      // Validate file
      const validation = validateFileForUpload(selectedFile);
      if (!validation.valid) {
        updateStepState({
          error: validation.error || 'Invalid file',
          isExtracting: false,
        });
        return;
      }

      console.log('[FileUploadStep] Processing file', {
        name: selectedFile.name,
        type: selectedFile.type,
        size: selectedFile.size,
        contentType: validation.contentType,
      });

      updateStepState({ file: selectedFile });

      // Extract thumbnail for video files
      if (selectedFile.type.startsWith('video/')) {
        const thumbnailData = await extractVideoThumbnail(selectedFile);
        updateStepState({ thumbnail: thumbnailData });
      }

      // Extract duration for video/audio files
      if (
        selectedFile.type.startsWith('video/') ||
        selectedFile.type.startsWith('audio/')
      ) {
        const duration = await extractMediaDuration(selectedFile);
        updateStepState({ durationSec: duration });
      }

      updateStepState({ isExtracting: false });
    },
    [extractVideoThumbnail, extractMediaDuration],
  );

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
    },
    [processFile],
  );

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateStepState({ isDragging: true });
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateStepState({ isDragging: false });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateStepState({ isDragging: false });

      const droppedFile = e.dataTransfer.files?.[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile],
  );

  /**
   * Handle clicking the drop zone
   */
  const handleDropZoneOpen = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Remove selected file
   */
  const handleRemove = useCallback(() => {
    updateStepState({
      file: null,
      thumbnail: null,
      durationSec: undefined,
      error: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /**
   * Proceed to next step
   */
  const handleNext = useCallback(() => {
    if (!file) return;

    const contentType = getContentTypeFromMimeType(file.type);
    if (!contentType) {
      updateStepState({ error: 'Unable to determine content type' });
      return;
    }

    onNext({
      file,
      contentType,
      thumbnail: thumbnail || undefined,
      durationSec,
    });
  }, [file, thumbnail, durationSec, onNext]);

  /**
   * Get icon for file type
   */
  const getFileIcon = () => {
    if (!file) return <Upload className="size-12 text-muted-foreground" />;

    if (file.type.startsWith('video/')) {
      return <Video className="size-12 text-foreground" />;
    }
    if (file.type.startsWith('audio/')) {
      return <Music className="size-12 text-foreground" />;
    }
    if (file.type.includes('pdf') || file.type.includes('document')) {
      return <FileText className="size-12 text-foreground" />;
    }
    return <FileIcon className="size-12 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Upload File</h2>
        <p className="text-sm text-muted-foreground">
          Select a file to upload and process. Supported formats: videos, audio,
          documents, and text files.
        </p>
      </div>

      {/* Drop Zone */}
      {!file && (
        <div
          className={cn(
            'border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer bg-background',
            isDragging
              ? 'border-foreground bg-muted/20'
              : 'border-border hover:border-foreground/40 hover:bg-muted/30',
          )}
          onClick={handleDropZoneOpen}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              handleDropZoneOpen();
            }
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
        >
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <Upload
              className={cn(
                'size-16 mb-4 transition-colors',
                isDragging ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
            <p className="text-base font-medium text-foreground mb-2">
              {isDragging
                ? 'Drop file here'
                : 'Click to browse or drag and drop'}
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              MP4, MOV, WEBM, MP3, WAV, PDF, DOCX, TXT, MD
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Max size: 500 MB for video, 100 MB for audio, 50 MB for documents
            </p>
          </div>
        </div>
      )}

      {/* File Input (Hidden) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".mp4,.mov,.webm,.avi,.mp3,.wav,.m4a,.ogg,.pdf,.docx,.doc,.txt,.md"
        onChange={handleFileSelect}
      />

      {/* File Preview */}
      {file && (
        <div className="p-6 rounded-lg border bg-background">
          <div className="space-y-4">
            {/* File Info Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-x-3 flex-1 min-w-0">
                <div className="flex-shrink-0">{getFileIcon()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-x-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                    {durationSec && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-sm text-muted-foreground">
                          {Math.floor(durationSec / 60)}:
                          {String(durationSec % 60).padStart(2, '0')}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm text-muted-foreground">
                      {
                        CONTENT_TYPE_LABELS[
                          getContentTypeFromMimeType(file.type) || 'document'
                        ]
                      }
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="flex-shrink-0"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Loading State */}
            {isExtracting && (
              <div className="flex items-center gap-x-2 text-sm text-muted-foreground">
                <div className="size-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                <span>Processing file…</span>
              </div>
            )}

            {/* Video Preview */}
            {file.type.startsWith('video/') &&
              !isExtracting &&
              videoObjectUrl && (
                <div className="space-y-3">
                  {thumbnail && (
                    <div className="relative rounded-lg overflow-hidden bg-zinc-950">
                      <Image
                        src={thumbnail}
                        alt="Video thumbnail"
                        width={640}
                        height={360}
                        className="w-full h-auto"
                        unoptimized
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/20">
                        <div className="size-16 rounded-full bg-white/90 flex items-center justify-center">
                          <Video className="size-8 text-zinc-900" />
                        </div>
                      </div>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    src={videoObjectUrl}
                    controls
                    className="w-full rounded-lg bg-zinc-950"
                    playsInline
                  />
                </div>
              )}

            {/* Audio Preview */}
            {file.type.startsWith('audio/') &&
              !isExtracting &&
              audioObjectUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center py-8 bg-muted rounded-lg">
                    <Music className="size-16 text-muted-foreground" />
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioObjectUrl}
                    controls
                    className="w-full"
                  />
                </div>
              )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg border bg-destructive/10 border-destructive/20">
          <div className="flex items-start gap-x-3">
            <AlertCircle className="size-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onCancel} disabled={isExtracting}>
          Cancel
        </Button>
        <Button
          onClick={handleNext}
          disabled={!file || isExtracting}
          className="min-w-[120px]"
        >
          {isExtracting ? (
            <div className="flex items-center gap-x-2">
              <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing…</span>
            </div>
          ) : (
            'Next'
          )}
        </Button>
      </div>
    </div>
  );
}
