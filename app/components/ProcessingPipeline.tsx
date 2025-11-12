'use client';

import * as React from 'react';
import { Check, Loader2, Clock, AlertCircle, RotateCw } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';

import ReprocessStreamModal from './ReprocessStreamModal';

interface Recording {
  id: string;
  title?: string | null;
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'doc_generating' | 'completed' | 'error';
  content_type?: 'recording' | 'video' | 'audio' | 'document' | 'text' | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface ProcessingPipelineProps {
  recording: Recording;
  hasTranscript: boolean;
  hasDocument: boolean;
  onReprocess?: (step: string) => void;
}

type StepStatus = 'completed' | 'in_progress' | 'pending' | 'error';

interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  timestamp?: string;
}

export default function ProcessingPipeline({
  recording,
  hasTranscript,
  hasDocument,
  onReprocess,
}: ProcessingPipelineProps) {
  const [reprocessModalOpen, setReprocessModalOpen] = React.useState(false);
  const [reprocessStep, setReprocessStep] = React.useState<'transcribe' | 'document' | 'embeddings' | 'all'>('all');

  // Content-type-aware pipeline configurations
  const getPipelineConfig = () => {
    const contentType = recording.content_type || 'recording';

    switch (contentType) {
      case 'video':
        return {
          step1: { id: 'extract', label: 'Extract Audio', inProgressLabel: 'Extracting audio...', failedLabel: 'Audio Extraction Failed' },
          step2: { id: 'transcribe', label: 'Transcribed', inProgressLabel: 'Transcribing...', failedLabel: 'Transcription Failed' },
          step3: { id: 'document', label: 'Document Generated', inProgressLabel: 'Generating document...', failedLabel: 'Document Generation Failed' },
          step4: { id: 'embeddings', label: 'Ready to search', inProgressLabel: 'Creating embeddings...', failedLabel: 'Embedding Failed' },
        };
      case 'audio':
        return {
          step1: { id: 'transcribe', label: 'Transcribed', inProgressLabel: 'Transcribing audio...', failedLabel: 'Transcription Failed' },
          step2: { id: 'document', label: 'Document Generated', inProgressLabel: 'Generating document...', failedLabel: 'Document Generation Failed' },
          step3: { id: 'embeddings', label: 'Ready to search', inProgressLabel: 'Creating embeddings...', failedLabel: 'Embedding Failed' },
        };
      case 'document':
        return {
          step1: { id: 'extract_text', label: 'Text Extracted', inProgressLabel: 'Extracting text...', failedLabel: 'Text Extraction Failed' },
          step2: { id: 'document', label: 'Summary Generated', inProgressLabel: 'Generating summary...', failedLabel: 'Summary Generation Failed' },
          step3: { id: 'embeddings', label: 'Ready to search', inProgressLabel: 'Creating embeddings...', failedLabel: 'Embedding Failed' },
        };
      case 'text':
        return {
          step1: { id: 'process', label: 'Note Processed', inProgressLabel: 'Processing note...', failedLabel: 'Processing Failed' },
          step2: { id: 'document', label: 'Summary Generated', inProgressLabel: 'Generating summary...', failedLabel: 'Summary Generation Failed' },
          step3: { id: 'embeddings', label: 'Ready to search', inProgressLabel: 'Creating embeddings...', failedLabel: 'Embedding Failed' },
        };
      default: // 'recording'
        return {
          step1: { id: 'transcribe', label: 'Transcribed', inProgressLabel: 'Transcribing...', failedLabel: 'Transcription Failed' },
          step2: { id: 'document', label: 'Document Generated', inProgressLabel: 'Generating document...', failedLabel: 'Document Generation Failed' },
          step3: { id: 'embeddings', label: 'Ready to search', inProgressLabel: 'Creating embeddings...', failedLabel: 'Embedding Failed' },
        };
    }
  };

  const getStepStatus = (): PipelineStep[] => {
    const steps: PipelineStep[] = [
      {
        id: 'upload',
        label: 'Upload Complete',
        status: 'completed',
        timestamp: recording.created_at,
      },
    ];

    const config = getPipelineConfig();
    const configSteps = Object.values(config);

    // Step 1 (extract/transcribe/extract_text/process)
    const step1 = configSteps[0];
    if (recording.status === 'error') {
      steps.push({
        id: step1.id,
        label: step1.failedLabel,
        status: 'error',
      });
    } else if (hasTranscript || recording.status === 'completed') {
      steps.push({
        id: step1.id,
        label: step1.label,
        status: 'completed',
        timestamp: recording.updated_at,
      });
    } else if (recording.status === 'transcribing') {
      steps.push({
        id: step1.id,
        label: step1.inProgressLabel,
        status: 'in_progress',
      });
    } else {
      steps.push({
        id: step1.id,
        label: step1.inProgressLabel.replace('...', ''),
        status: 'pending',
      });
    }

    // Step 2 (document/summary) - only if step 1 has content
    if (configSteps.length > 1 && (hasTranscript || recording.status === 'completed' || recording.status === 'error')) {
      const step2 = configSteps[1];
      if (recording.status === 'error' && hasTranscript) {
        steps.push({
          id: step2.id,
          label: step2.failedLabel,
          status: 'error',
        });
      } else if (hasDocument || recording.status === 'completed') {
        steps.push({
          id: step2.id,
          label: step2.label,
          status: 'completed',
          timestamp: recording.updated_at,
        });
      } else if (recording.status === 'doc_generating') {
        steps.push({
          id: step2.id,
          label: step2.inProgressLabel,
          status: 'in_progress',
        });
      } else if (hasTranscript) {
        steps.push({
          id: step2.id,
          label: step2.inProgressLabel.replace('...', ''),
          status: 'pending',
        });
      }
    }

    // Step 3 (embeddings) - only if step 2 has content
    if (configSteps.length > 2 && (hasDocument || recording.status === 'completed')) {
      const step3 = configSteps[2];
      if (recording.status === 'completed') {
        steps.push({
          id: step3.id,
          label: step3.label,
          status: 'completed',
          timestamp: recording.completed_at || recording.updated_at,
        });
      } else if (hasDocument) {
        steps.push({
          id: step3.id,
          label: step3.inProgressLabel,
          status: 'in_progress',
        });
      }
    }

    // Step 4 (embeddings for video with 4 steps)
    if (configSteps.length > 3 && (hasDocument || recording.status === 'completed')) {
      const step4 = configSteps[3];
      if (recording.status === 'completed') {
        steps.push({
          id: step4.id,
          label: step4.label,
          status: 'completed',
          timestamp: recording.completed_at || recording.updated_at,
        });
      } else if (hasDocument) {
        steps.push({
          id: step4.id,
          label: step4.inProgressLabel,
          status: 'in_progress',
        });
      }
    }

    return steps;
  };

  const steps = getStepStatus();
  const canStartProcessing = recording.status === 'uploaded';
  const hasError = recording.status === 'error';

  const handleStartProcessing = async () => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startProcessing: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to start processing');
      }

      // Refresh the page to show updated status
      window.location.reload();
    } catch (error) {
      console.error('Error starting processing:', error);
    }
  };

  const handleRetry = async (step: string) => {
    // Map step to reprocess modal format
    const stepMap: Record<string, 'transcribe' | 'document' | 'embeddings' | 'all'> = {
      transcribe: 'transcribe',
      document: 'document',
      embeddings: 'embeddings',
      all: 'all',
    };

    const mappedStep = stepMap[step] || 'all';
    setReprocessStep(mappedStep);
    setReprocessModalOpen(true);

    // Also call onReprocess if provided
    if (onReprocess) {
      onReprocess(step);
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'completed':
        return <Check className="size-5 text-green-600 dark:text-green-500" />;
      case 'in_progress':
        return <Loader2 className="size-5 text-blue-600 dark:text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="size-5 text-muted-foreground" />;
      case 'error':
        return <AlertCircle className="size-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Processing Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(step.status)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      step.status === 'completed' && 'text-foreground',
                      step.status === 'in_progress' && 'text-blue-600 dark:text-blue-500',
                      step.status === 'pending' && 'text-muted-foreground',
                      step.status === 'error' && 'text-destructive'
                    )}
                  >
                    {step.label}
                  </p>
                  {step.status === 'error' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetry(step.id)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
                {step.timestamp && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(step.timestamp)}
                  </p>
                )}
              </div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="absolute left-[34px] w-px h-4 bg-border mt-8" />
              )}
            </div>
          ))}

          {/* Start Processing Button */}
          {canStartProcessing && (
            <div className="pt-2">
              <Button
                onClick={handleStartProcessing}
                className="w-full"
              >
                Start Processing
              </Button>
            </div>
          )}

          {/* Error Message */}
          {hasError && (
            <div className="pt-2">
              <div className="bg-destructive/10 dark:bg-destructive/20 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive">
                  Processing failed. Please retry or contact support if the issue persists.
                </p>
              </div>
            </div>
          )}

          {/* Reprocess Button */}
          {(hasTranscript || hasDocument || recording.status === 'completed') && (
            <div className="pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    <RotateCw className="size-4 mr-2" />
                    Reprocess
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {(() => {
                    const contentType = recording.content_type || 'recording';
                    const config = getPipelineConfig();

                    // Get step labels based on content type
                    const step1Label = contentType === 'video' ? 'Audio Extraction' :
                                      contentType === 'document' ? 'Text Extraction' :
                                      contentType === 'text' ? 'Note Processing' : 'Transcription';

                    const step2Label = contentType === 'document' || contentType === 'text' ? 'Summary' : 'Document';

                    return (
                      <>
                        <DropdownMenuItem onClick={() => handleRetry(Object.values(config)[0].id)}>
                          Regenerate {step1Label}
                        </DropdownMenuItem>
                        {hasTranscript && (
                          <DropdownMenuItem onClick={() => handleRetry('document')}>
                            Regenerate {step2Label}
                          </DropdownMenuItem>
                        )}
                        {hasDocument && (
                          <DropdownMenuItem onClick={() => handleRetry('embeddings')}>
                            Regenerate Embeddings
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleRetry('all')}>
                          Reprocess Everything
                        </DropdownMenuItem>
                      </>
                    );
                  })()}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>

      {/* Reprocess Stream Modal */}
      <ReprocessStreamModal
        open={reprocessModalOpen}
        onOpenChange={setReprocessModalOpen}
        recordingId={recording.id}
        step={reprocessStep}
        recordingTitle={recording.title || undefined}
      />
    </Card>
  );
}
