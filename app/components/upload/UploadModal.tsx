'use client';

import { useState, useCallback, useRef } from 'react';
import {
  AudioLinesIcon,
  CheckCircle2Icon,
  FileEditIcon,
  FileTextIcon,
  FileVideoIcon,
  UploadCloudIcon,
  XCircleIcon,
  XIcon,
  Loader2Icon,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Progress } from '@/app/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import {
  validateFileForUpload,
  formatFileSize,
  CONTENT_TYPE_COLORS,
  CONTENT_TYPE_LABELS,
  FILE_SIZE_LIMIT_LABELS,
} from '@/lib/types/content';
import {
  fetchWithRetry,
  showErrorToast,
  getAcceptedFileTypesMessage,
  logError
} from '@/lib/utils/error-handler';
import type { ContentType, FileType } from '@/lib/types/database';

/**
 * File upload status for tracking individual file states
 */
type FileStatus = 'pending' | 'uploading' | 'success' | 'error';

/**
 * Extended file interface with upload metadata
 */
interface UploadFile {
  id: string;
  file: File;
  contentType: ContentType;
  fileType: FileType;
  status: FileStatus;
  progress: number;
  error?: string;
  recordingId?: string;
  retryCount?: number;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (recordingIds: string[]) => void;
}

/**
 * Content type to icon component mapping
 */
const CONTENT_TYPE_ICON_MAP: Record<ContentType, typeof FileVideoIcon> = {
  recording: FileVideoIcon,
  video: FileVideoIcon,
  audio: AudioLinesIcon,
  document: FileTextIcon,
  text: FileEditIcon,
};

/**
 * Beautiful, feature-rich file upload modal component
 * Supports drag-and-drop, multi-file selection, validation, and progress tracking
 */
export default function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle file selection from input or drag-drop
   */
  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;

    const newFiles: UploadFile[] = [];

    Array.from(fileList).forEach((file) => {
      const validation = validateFileForUpload(file);

      if (validation.valid && validation.contentType && validation.fileType) {
        newFiles.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          contentType: validation.contentType,
          fileType: validation.fileType,
          status: 'pending',
          progress: 0,
        });
      } else {
        // Add as error file to show validation message
        newFiles.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          contentType: 'video', // Fallback
          fileType: 'mp4', // Fallback
          status: 'error',
          progress: 0,
          error: validation.error || 'Invalid file',
        });
      }
    });

    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  /**
   * Handle drag events
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = e.dataTransfer.files;
      handleFiles(droppedFiles);
    },
    [handleFiles]
  );

  /**
   * Handle file input change
   */
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  /**
   * Remove file from upload list
   */
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  /**
   * Retry failed upload
   */
  const retryFile = useCallback(async (fileId: string) => {
    const fileToRetry = files.find((f) => f.id === fileId);
    if (!fileToRetry) return;

    // Reset status and retry
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: 'pending', error: undefined }
          : f
      )
    );

    // Upload the file
    await uploadFile(fileToRetry);
  }, [files]);

  /**
   * Upload a single file with retry logic
   */
  const uploadFile = async (uploadFile: UploadFile): Promise<string | null> => {
    try {
      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: 'uploading', progress: 0 }
            : f
        )
      );

      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('contentType', uploadFile.contentType);
      formData.append('fileType', uploadFile.fileType);

      // Use fetchWithRetry for automatic retry on network errors
      const result = await fetchWithRetry(
        '/api/library/upload',
        {
          method: 'POST',
          body: formData,
        },
        {
          maxAttempts: 3,
          shouldRetry: (error) => {
            // Retry on network errors and 5xx errors, but not on validation errors
            return error.code === 'NETWORK_ERROR' ||
                   (error.statusCode !== undefined && error.statusCode >= 500);
          },
        }
      );

      const recordingId = result.data?.recording?.id || result.data?.recordingId;

      // Update to success
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'success',
                progress: 100,
                recordingId,
              }
            : f
        )
      );

      return recordingId;
    } catch (error: any) {
      let errorMessage = 'Upload failed';

      // Provide more specific error messages
      if (error.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.code === 'FILE_TOO_LARGE') {
        errorMessage = `File exceeds maximum size limit.`;
      } else if (error.code === 'INVALID_FILE_TYPE') {
        errorMessage = 'File type not supported.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Log error for debugging
      logError(error, {
        fileName: uploadFile.file.name,
        fileSize: uploadFile.file.size,
        contentType: uploadFile.contentType
      });

      // Update to error
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: errorMessage,
                retryCount: (f.retryCount || 0) + 1,
              }
            : f
        )
      );

      return null;
    }
  };

  /**
   * Upload all valid files
   */
  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.status === 'pending');

    if (validFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Upload files sequentially to avoid overwhelming the server
      const recordingIds: string[] = [];

      for (const file of validFiles) {
        const recordingId = await uploadFile(file);
        if (recordingId) {
          recordingIds.push(recordingId);
        }
      }

      // Call completion handler
      if (onUploadComplete && recordingIds.length > 0) {
        onUploadComplete(recordingIds);
      }

      // Auto-close after successful uploads
      setTimeout(() => {
        handleClose();
      }, 1500);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!isUploading) {
      setFiles([]);
      setIsDragging(false);
      onClose();
    }
  };

  /**
   * Open file browser
   */
  const openFileBrowser = () => {
    fileInputRef.current?.click();
  };

  /**
   * Calculate overall upload progress
   */
  const overallProgress =
    files.length > 0
      ? files.reduce((sum, f) => sum + f.progress, 0) / files.length
      : 0;

  const hasValidFiles = files.some((f) => f.status === 'pending');
  const hasUploadedFiles = files.some((f) => f.status === 'success');
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".mp4,.mov,.webm,.avi,.mp3,.wav,.m4a,.ogg,.pdf,.docx,.doc,.txt,.md"
        onChange={handleFileInputChange}
      />

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent
          className="w-full max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
          showCloseButton={!isUploading}
        >
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>
              Upload videos, audio, documents, or text files to your knowledge
              library.
            </DialogDescription>
          </DialogHeader>

          {/* Accepted File Types Alert */}
          <Alert variant="default" className="bg-muted/50">
            <AlertDescription className="text-xs">
              {getAcceptedFileTypesMessage()}
            </AlertDescription>
          </Alert>

          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileBrowser}
            className={`
              relative flex flex-col items-center justify-center
              min-h-[160px] sm:min-h-[200px] px-4 sm:px-6 py-6 sm:py-8
              rounded-lg border-2 border-dashed
              transition-all duration-200 cursor-pointer
              touch-manipulation active:scale-[0.98]
              ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-accent/30'
              }
            `}
          >
            <UploadCloudIcon
              className={`size-10 sm:size-12 mb-3 sm:mb-4 transition-colors ${
                isDragging ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <p className="text-sm sm:text-base font-medium text-foreground mb-1 text-center">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 text-center">
              or tap to browse
            </p>

            {/* File type hints */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-w-full">
              {[
                { type: 'video', label: 'Video', limit: '500MB' },
                { type: 'audio', label: 'Audio', limit: '100MB' },
                { type: 'document', label: 'PDF/DOCX', limit: '50MB' },
                { type: 'text', label: 'Text', limit: '1MB' },
              ].map((item) => {
                const colors =
                  CONTENT_TYPE_COLORS[item.type as ContentType];
                return (
                  <span
                    key={item.type}
                    className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md ${colors.bg} ${colors.text} whitespace-nowrap`}
                  >
                    {item.label} ({item.limit})
                  </span>
                );
              })}
            </div>
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="space-y-3 max-h-[250px] sm:max-h-[300px] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  Selected Files ({files.length})
                </h3>
                {isUploading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2Icon className="size-3 animate-spin" />
                    Uploading {Math.round(overallProgress)}%
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {files.map((uploadFile) => {
                  const Icon =
                    CONTENT_TYPE_ICON_MAP[uploadFile.contentType] ||
                    FileVideoIcon;
                  const colors = CONTENT_TYPE_COLORS[uploadFile.contentType];

                  return (
                    <div
                      key={uploadFile.id}
                      className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card"
                    >
                      {/* File Icon */}
                      <div
                        className={`flex-shrink-0 p-1.5 sm:p-2 rounded-md ${colors.bg}`}
                      >
                        <Icon className={`size-4 sm:size-5 ${colors.text}`} />
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-foreground truncate">
                              {uploadFile.file.name}
                            </p>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
                              <span className="text-[10px] sm:text-xs text-muted-foreground">
                                {formatFileSize(uploadFile.file.size)}
                              </span>
                              <span
                                className={`text-[10px] sm:text-xs ${colors.text} font-medium`}
                              >
                                {CONTENT_TYPE_LABELS[uploadFile.contentType]}
                              </span>
                            </div>
                          </div>

                          {/* Status Icon & Action Buttons */}
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            {uploadFile.status === 'pending' && (
                              <button
                                onClick={() => removeFile(uploadFile.id)}
                                disabled={isUploading}
                                className="p-1 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation min-h-[48px] sm:min-h-0"
                                aria-label="Remove file"
                              >
                                <XIcon className="size-4" />
                              </button>
                            )}
                            {uploadFile.status === 'uploading' && (
                              <Loader2Icon className="size-4 animate-spin text-primary" />
                            )}
                            {uploadFile.status === 'success' && (
                              <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" />
                            )}
                            {uploadFile.status === 'error' && (
                              <XCircleIcon className="size-4 text-destructive" />
                            )}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {uploadFile.status === 'uploading' && (
                          <Progress
                            value={uploadFile.progress}
                            className="h-1.5 mt-2"
                          />
                        )}

                        {/* Error Message with Retry */}
                        {uploadFile.status === 'error' && uploadFile.error && (
                          <div className="mt-2 space-y-1.5">
                            <p className="text-[10px] sm:text-xs text-destructive">
                              {uploadFile.error}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryFile(uploadFile.id)}
                              disabled={isUploading}
                              className="h-7 text-xs px-2 touch-manipulation min-h-[44px] sm:min-h-[28px]"
                            >
                              Retry Upload
                            </Button>
                          </div>
                        )}

                        {/* Success Message */}
                        {uploadFile.status === 'success' && (
                          <p className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 mt-2">
                            Upload complete! Processing...
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Overall Progress */}
          {isUploading && files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Progress</span>
                <span className="font-medium text-foreground">
                  {Math.round(overallProgress)}%
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}

          {/* Summary Messages */}
          {hasUploadedFiles && !isUploading && (
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2Icon className="size-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Upload Complete
                </p>
                <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                  Your files are being processed and will appear in your library
                  shortly.
                </p>
              </div>
            </div>
          )}

          {hasErrors && !isUploading && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <XCircleIcon className="size-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Some files failed to upload
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  Please check the error messages above and try again.
                </p>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isUploading}
              className="w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[40px]"
            >
              {hasUploadedFiles && !isUploading ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!hasValidFiles || isUploading}
              className="w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[40px]"
            >
              {isUploading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloudIcon className="size-4" />
                  Upload {files.filter((f) => f.status === 'pending').length}{' '}
                  {files.filter((f) => f.status === 'pending').length === 1
                    ? 'File'
                    : 'Files'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
