'use client';

import { AlertCircle, RefreshCw, Trash2, LifeBuoy, FileWarning } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

/**
 * ProcessingError Component
 *
 * Error state for recording/content processing failures
 * Shows when transcription, document generation, or embedding creation fails
 */
interface ProcessingErrorProps {
  stage?: 'transcription' | 'document_generation' | 'embeddings' | 'frame_extraction' | 'unknown';
  errorMessage?: string;
  recordingId?: string;
  onReprocess?: () => void;
  onDelete?: () => void;
  onContactSupport?: () => void;
}

export function ProcessingError({
  stage = 'unknown',
  errorMessage,
  recordingId,
  onReprocess,
  onDelete,
  onContactSupport,
}: ProcessingErrorProps) {
  const getStageDetails = () => {
    const stageDetails: Record<string, { title: string; message: string; tips: string[] }> = {
      transcription: {
        title: 'Transcription Failed',
        message: 'We could not transcribe the audio from this recording.',
        tips: [
          'The audio quality might be too low',
          'The audio format might not be supported',
          'There might have been background noise interference',
          'Try re-recording with better audio quality',
        ],
      },
      document_generation: {
        title: 'Document Generation Failed',
        message: 'We could not generate an AI document from the transcript.',
        tips: [
          'The transcript might be too short or low quality',
          'There might be a temporary issue with the AI service',
          'Try reprocessing the recording',
          'Contact support if the issue persists',
        ],
      },
      embeddings: {
        title: 'Search Indexing Failed',
        message: 'We could not create search embeddings for this content.',
        tips: [
          'The content might be in an unsupported format',
          'There might be a temporary service issue',
          'The content will still be accessible but not searchable',
          'Try reprocessing to fix search functionality',
        ],
      },
      frame_extraction: {
        title: 'Frame Extraction Failed',
        message: 'We could not extract video frames for visual search.',
        tips: [
          'The video codec might not be supported',
          'The video file might be corrupted',
          'Visual search will not be available for this recording',
          'Try re-uploading with a different format',
        ],
      },
      unknown: {
        title: 'Processing Failed',
        message: errorMessage || 'An unknown error occurred while processing this content.',
        tips: [
          'Try reprocessing the recording',
          'Check that the file format is supported',
          'Contact support if the issue persists',
        ],
      },
    };

    return stageDetails[stage] || stageDetails.unknown;
  };

  const details = getStageDetails();

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <div className="p-6 space-y-4">
        {/* Error header */}
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3">
              <FileWarning className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-xl font-semibold text-destructive">
              {details.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              Recording ID: {recordingId || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Error message */}
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Details</AlertTitle>
          <AlertDescription>{details.message}</AlertDescription>
        </Alert>

        {/* Troubleshooting tips */}
        <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            What you can try:
          </h4>
          <ul className="space-y-1.5">
            {details.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground mt-1">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {onReprocess && (
            <Button onClick={onReprocess} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reprocess Recording
            </Button>
          )}
          {onContactSupport && (
            <Button onClick={onContactSupport} variant="outline">
              <LifeBuoy className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          )}
          {onDelete && (
            <Button onClick={onDelete} variant="destructive" className="ml-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Recording
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
