'use client';

import { AlertTriangle, RefreshCw, X, FileX } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

/**
 * UploadError Component
 *
 * Error state for file upload failures
 * Provides contextual error messages and retry options
 */
interface UploadErrorProps {
  fileName?: string;
  errorMessage?: string;
  errorCode?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  suggestions?: string[];
}

export function UploadError({
  fileName = 'File',
  errorMessage = 'The file could not be uploaded.',
  errorCode,
  onRetry,
  onCancel,
  suggestions = [],
}: UploadErrorProps) {
  const getErrorDetails = () => {
    // Map common error codes to user-friendly messages
    const errorDetails: Record<string, { title: string; message: string; tips: string[] }> = {
      FILE_TOO_LARGE: {
        title: 'File Too Large',
        message: 'The file exceeds the maximum size limit.',
        tips: [
          'Video files must be under 500MB',
          'Audio files must be under 100MB',
          'Documents must be under 50MB',
          'Try compressing the file before uploading',
        ],
      },
      UNSUPPORTED_FORMAT: {
        title: 'Unsupported File Format',
        message: 'This file type is not supported.',
        tips: [
          'Supported video formats: MP4, MOV, WEBM',
          'Supported audio formats: MP3, WAV, M4A',
          'Supported documents: PDF, DOCX, TXT',
          'Convert the file to a supported format',
        ],
      },
      NETWORK_ERROR: {
        title: 'Network Error',
        message: 'Upload failed due to connection issues.',
        tips: [
          'Check your internet connection',
          'Try uploading again',
          'For large files, ensure you have a stable connection',
        ],
      },
      QUOTA_EXCEEDED: {
        title: 'Storage Quota Exceeded',
        message: 'You have reached your storage limit.',
        tips: [
          'Delete some existing files to free up space',
          'Upgrade your plan for more storage',
          'Check your organization\'s storage usage',
        ],
      },
      PROCESSING_ERROR: {
        title: 'Processing Error',
        message: 'The file could not be processed.',
        tips: [
          'The file might be corrupted',
          'Try re-exporting the file',
          'Ensure the file is not password-protected',
        ],
      },
    };

    return errorDetails[errorCode || ''] || {
      title: 'Upload Failed',
      message: errorMessage,
      tips: suggestions.length > 0 ? suggestions : [
        'Please check your connection and try again',
        'Ensure the file is not corrupted',
        'Contact support if the issue persists',
      ],
    };
  };

  const details = getErrorDetails();

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <div className="p-6 space-y-4">
        {/* Error header */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-lg font-semibold text-destructive">
              {details.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {fileName}
            </p>
          </div>
          {onCancel && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          )}
        </div>

        {/* Error message */}
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertDescription>{details.message}</AlertDescription>
        </Alert>

        {/* Error code */}
        {errorCode && (
          <div className="text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
            Error Code: {errorCode}
          </div>
        )}

        {/* Suggestions */}
        {details.tips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Suggestions:</h4>
            <ul className="space-y-1.5">
              {details.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Upload
            </Button>
          )}
          {onCancel && (
            <Button onClick={onCancel} variant="ghost">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * BatchUploadError Component
 *
 * Shows errors for multiple failed uploads
 */
interface BatchUploadErrorProps {
  errors: Array<{
    fileName: string;
    error: string;
    errorCode?: string;
  }>;
  onRetryAll?: () => void;
  onDismiss?: () => void;
}

export function BatchUploadError({ errors, onRetryAll, onDismiss }: BatchUploadErrorProps) {
  return (
    <Card className="border-destructive/50">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-2">
              <FileX className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold">
                {errors.length} {errors.length === 1 ? 'Upload' : 'Uploads'} Failed
              </h3>
              <p className="text-sm text-muted-foreground">
                The following files could not be uploaded
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Error list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {errors.map((error, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20"
            >
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{error.fileName}</p>
                <p className="text-xs text-muted-foreground">{error.error}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {onRetryAll && (
          <div className="flex gap-2 pt-2">
            <Button onClick={onRetryAll} variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry All
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
