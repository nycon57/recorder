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

  const getStepStatus = (): PipelineStep[] => {
    const steps: PipelineStep[] = [
      {
        id: 'upload',
        label: 'Upload Complete',
        status: 'completed',
        timestamp: recording.created_at,
      },
    ];

    // Transcription step
    if (recording.status === 'error') {
      steps.push({
        id: 'transcribe',
        label: 'Transcription Failed',
        status: 'error',
      });
    } else if (hasTranscript || recording.status === 'completed') {
      steps.push({
        id: 'transcribe',
        label: 'Transcribed',
        status: 'completed',
        timestamp: recording.updated_at,
      });
    } else if (recording.status === 'transcribing') {
      steps.push({
        id: 'transcribe',
        label: 'Transcribing',
        status: 'in_progress',
      });
    } else {
      steps.push({
        id: 'transcribe',
        label: 'Transcription Pending',
        status: 'pending',
      });
    }

    // Document generation step
    if (recording.status === 'error' && hasTranscript) {
      steps.push({
        id: 'document',
        label: 'Document Generation Failed',
        status: 'error',
      });
    } else if (hasDocument || recording.status === 'completed') {
      steps.push({
        id: 'document',
        label: 'Document Generated',
        status: 'completed',
        timestamp: recording.updated_at,
      });
    } else if (recording.status === 'doc_generating') {
      steps.push({
        id: 'document',
        label: 'Generating Document',
        status: 'in_progress',
      });
    } else if (hasTranscript) {
      steps.push({
        id: 'document',
        label: 'Document Generation Pending',
        status: 'pending',
      });
    }

    // Embeddings step
    if (recording.status === 'completed') {
      steps.push({
        id: 'embeddings',
        label: 'Embeddings Created',
        status: 'completed',
        timestamp: recording.completed_at || recording.updated_at,
      });
    } else if (hasDocument) {
      steps.push({
        id: 'embeddings',
        label: 'Creating Embeddings',
        status: 'in_progress',
      });
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
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => handleRetry('transcribe')}>
                    Reprocess Transcription
                  </DropdownMenuItem>
                  {hasTranscript && (
                    <DropdownMenuItem onClick={() => handleRetry('document')}>
                      Reprocess Document
                    </DropdownMenuItem>
                  )}
                  {hasDocument && (
                    <DropdownMenuItem onClick={() => handleRetry('embeddings')}>
                      Reprocess Embeddings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleRetry('all')}>
                    Reprocess All Steps
                  </DropdownMenuItem>
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
