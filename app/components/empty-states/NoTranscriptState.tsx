'use client';

import { Loader2, Clock, Sparkles, RefreshCw } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';

/**
 * NoTranscriptState Component
 *
 * Empty state for recordings that are still being transcribed
 * Shows processing status and estimated time
 */
interface NoTranscriptStateProps {
  status?: 'uploading' | 'transcribing' | 'processing' | 'failed';
  progress?: number;
  estimatedTime?: string;
  onRetry?: () => void;
}

export function NoTranscriptState({
  status = 'transcribing',
  progress = 0,
  estimatedTime,
  onRetry,
}: NoTranscriptStateProps) {
  if (status === 'failed') {
    return (
      <Card className="border-dashed border-2 border-destructive/50">
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-4 mb-4">
            <RefreshCw className="h-12 w-12 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Transcription Failed</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            We encountered an error while transcribing this recording. This could be due to audio quality issues or temporary service problems.
          </p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Transcription
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading your recording...';
      case 'transcribing':
        return 'Generating transcript...';
      case 'processing':
        return 'Processing audio...';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'uploading':
        return 'text-blue-600 dark:text-blue-400';
      case 'transcribing':
        return 'text-violet-600 dark:text-violet-400';
      case 'processing':
        return 'text-amber-600 dark:text-amber-400';
      default:
        return 'text-primary';
    }
  };

  return (
    <Card className="border-dashed border-2">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6">
            <Loader2 className={`h-12 w-12 animate-spin ${getStatusColor()}`} />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="h-6 w-6 text-yellow-500 fill-yellow-500 animate-pulse" />
          </div>
        </div>

        {/* Status message */}
        <h3 className="text-2xl font-semibold mb-2">{getStatusMessage()}</h3>

        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          This usually takes a few minutes depending on the length of your recording.
        </p>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="w-full max-w-md space-y-2 mb-4">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress}% complete</span>
              {estimatedTime && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {estimatedTime}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Info message */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-md">
          <p className="text-xs text-muted-foreground">
            You can leave this page and we'll notify you when the transcript is ready.
            Check your email or return to the library to view the completed transcript.
          </p>
        </div>
      </div>
    </Card>
  );
}
