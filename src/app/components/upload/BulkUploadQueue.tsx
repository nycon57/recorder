'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  FileVideo,
  FileAudio,
  FileText,
  File,
  Pause,
  Play,
  RotateCcw,
  X,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn, formatBytes } from '@/lib/utils';
import type { ContentType, FileType } from '@/lib/types/database';

export type UploadStatus = 'pending' | 'uploading' | 'paused' | 'success' | 'error';

export interface UploadFile {
  id: string;
  file: File;
  contentType: ContentType;
  fileType: FileType;
  status: UploadStatus;
  progress: number;
  error?: string;
  recordingId?: string;
  retryCount?: number;
  uploadSpeed?: number;
  timeRemaining?: number;
  startTime?: number;
}

interface BulkUploadQueueProps {
  files: UploadFile[];
  onRemove: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onPause?: (fileId: string) => void;
  onResume?: (fileId: string) => void;
  onClearCompleted?: () => void;
  maxConcurrent?: number;
  className?: string;
}

const CONTENT_TYPE_ICONS = {
  recording: FileVideo,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  text: File,
};

const CONTENT_TYPE_COLORS = {
  recording: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  video: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  audio: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  document: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  text: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
};

export function BulkUploadQueue({
  files,
  onRemove,
  onRetry,
  onPause,
  onResume,
  onClearCompleted,
  maxConcurrent = 5,
  className,
}: BulkUploadQueueProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const uploadingCount = files.filter(f => f.status === 'uploading').length;
  const pendingCount = files.filter(f => f.status === 'pending').length;
  const successCount = files.filter(f => f.status === 'success').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const totalProgress = files.length > 0
    ? files.reduce((sum, f) => sum + f.progress, 0) / files.length
    : 0;

  const toggleErrorExpanded = (fileId: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const formatTimeRemaining = (seconds?: number) => {
    if (!seconds || seconds === Infinity) return '';
    if (seconds < 60) return `${Math.round(seconds)}s remaining`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m remaining`;
    return `${Math.round(seconds / 3600)}h remaining`;
  };

  const formatSpeed = (bytesPerSecond?: number) => {
    if (!bytesPerSecond) return '';
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-600" />;
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Summary Stats */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">{files.length} files</span>
          {uploadingCount > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {uploadingCount} uploading
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge variant="outline">{pendingCount} pending</Badge>
          )}
          {successCount > 0 && (
            <Badge variant="default" className="gap-1 bg-green-600">
              <CheckCircle2 className="h-3 w-3" />
              {successCount} complete
            </Badge>
          )}
          {errorCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {errorCount} failed
            </Badge>
          )}
        </div>
        {onClearCompleted && successCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearCompleted}
            className="h-7 text-xs"
          >
            Clear completed
          </Button>
        )}
      </div>

      {/* Overall Progress */}
      {uploadingCount > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{Math.round(totalProgress)}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Uploading {Math.min(uploadingCount, maxConcurrent)} of {pendingCount + uploadingCount} files
            (max {maxConcurrent} concurrent)
          </p>
        </div>
      )}

      {/* File List */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {files.map((file) => {
            const Icon = CONTENT_TYPE_ICONS[file.contentType] || File;
            const colorClass = CONTENT_TYPE_COLORS[file.contentType];
            const isErrorExpanded = expandedErrors.has(file.id);

            return (
              <div
                key={file.id}
                className={cn(
                  'p-3 rounded-lg border bg-card transition-all',
                  file.status === 'error' && 'border-destructive/50 bg-destructive/5',
                  file.status === 'success' && 'border-green-600/50 bg-green-50/50 dark:bg-green-900/10'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* File Icon */}
                  <div className={cn('p-2 rounded-md shrink-0', colorClass)}>
                    <Icon className="h-4 w-4" />
                  </div>

                  {/* File Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {file.file.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(file.file.size)}
                          </span>
                          {file.status === 'uploading' && file.uploadSpeed && (
                            <>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-xs text-muted-foreground">
                                {formatSpeed(file.uploadSpeed)}
                              </span>
                              {file.timeRemaining && (
                                <span className="text-xs text-muted-foreground">
                                  • {formatTimeRemaining(file.timeRemaining)}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex items-center gap-1">
                        {getStatusIcon(file.status)}

                        {file.status === 'pending' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onRemove(file.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove from queue</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {file.status === 'uploading' && onPause && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onPause(file.id)}
                                >
                                  <Pause className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Pause upload</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {file.status === 'paused' && onResume && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onResume(file.id)}
                                >
                                  <Play className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resume upload</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {file.status === 'error' && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => onRetry(file.id)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Retry upload
                                {file.retryCount && file.retryCount > 0 && (
                                  <span> (attempt {file.retryCount + 1})</span>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {(file.status === 'uploading' || file.status === 'paused') && (
                      <Progress
                        value={file.progress}
                        className={cn(
                          'h-1.5',
                          file.status === 'paused' && 'opacity-50'
                        )}
                      />
                    )}

                    {/* Error Message */}
                    {file.status === 'error' && file.error && (
                      <div className="space-y-1">
                        <button
                          onClick={() => toggleErrorExpanded(file.id)}
                          className="text-xs text-destructive hover:underline text-left"
                        >
                          {isErrorExpanded
                            ? file.error
                            : file.error.length > 50
                            ? file.error.substring(0, 50) + '...'
                            : file.error}
                        </button>
                      </div>
                    )}

                    {/* Success Message */}
                    {file.status === 'success' && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Upload complete • Processing...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}