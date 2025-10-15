'use client';

import { FileText, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Progress } from '@/app/components/ui/progress';

/**
 * NoDocumentState Component
 *
 * Empty state for AI-generated documents
 * Shows when document is being generated or generation failed
 */
interface NoDocumentStateProps {
  status?: 'pending' | 'generating' | 'failed';
  progress?: number;
  onRetry?: () => void;
  onGenerate?: () => void;
}

export function NoDocumentState({
  status = 'generating',
  progress = 0,
  onRetry,
  onGenerate,
}: NoDocumentStateProps) {
  if (status === 'failed') {
    return (
      <Card className="border-dashed border-2 border-destructive/50">
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Document Generation Failed</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            We couldn't generate the AI document for this recording. This might be due to transcript quality or temporary service issues.
          </p>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Generation
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (status === 'pending') {
    return (
      <Card className="border-dashed border-2">
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6 mb-4">
            <FileText className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No AI Document Yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Generate an AI-powered summary document from this recording's transcript.
            The document will include key insights, action items, and structured notes.
          </p>
          {onGenerate && (
            <Button onClick={onGenerate}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Document
            </Button>
          )}
        </div>
      </Card>
    );
  }

  // Generating state
  return (
    <Card className="border-dashed border-2">
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Animated icon */}
        <div className="relative mb-6">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <div className="absolute -top-1 -right-1 animate-bounce">
            <Sparkles className="h-6 w-6 text-yellow-500 fill-yellow-500" />
          </div>
        </div>

        {/* Status message */}
        <h3 className="text-2xl font-semibold mb-2">Generating AI Document...</h3>

        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          Our AI is analyzing the transcript and creating a structured document with key insights, summaries, and action items.
        </p>

        {/* Progress bar */}
        {progress > 0 && (
          <div className="w-full max-w-md space-y-2 mb-4">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">{progress}% complete</p>
          </div>
        )}

        {/* Processing steps */}
        <div className="mt-6 space-y-3 max-w-md text-left">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-primary-foreground font-semibold">1</span>
            </div>
            <div>
              <p className="text-sm font-medium">Analyzing transcript</p>
              <p className="text-xs text-muted-foreground">Extracting key topics and themes</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className="h-6 w-6 rounded-full bg-muted-foreground/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-muted-foreground font-semibold">2</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Generating content</p>
              <p className="text-xs text-muted-foreground">Creating structured notes</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
            <div className="h-6 w-6 rounded-full bg-muted-foreground/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs text-muted-foreground font-semibold">3</span>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Formatting document</p>
              <p className="text-xs text-muted-foreground">Adding final touches</p>
            </div>
          </div>
        </div>

        {/* Info message */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-md">
          <p className="text-xs text-muted-foreground">
            This typically takes 30-60 seconds. You can leave this page and the document will be ready when you return.
          </p>
        </div>
      </div>
    </Card>
  );
}
