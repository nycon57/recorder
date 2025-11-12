'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import ProcessingStageIndicator, {
  type ProcessingStage,
} from '@/app/components/ProcessingStageIndicator';
import { cn } from '@/lib/utils';

interface UploadProgressStepProps {
  recordingId: string;
  streamUrl: string;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * SSE Message Types
 */
interface SSEMessage {
  type: 'log' | 'progress' | 'complete' | 'error';
  message?: string;
  step?: string;
  progress?: number;
  data?: any;
  timestamp?: string;
}

/**
 * Job type to stage mapping
 */
const JOB_TYPE_TO_STAGE: Record<string, string> = {
  extract_audio: 'extract_audio',
  transcribe: 'transcribe',
  doc_generate: 'document',
  generate_embeddings: 'embeddings',
  extract_text_pdf: 'extract_text',
  extract_text_docx: 'extract_text',
  process_text_note: 'process_text',
};

/**
 * Stage labels
 */
const STAGE_LABELS: Record<string, string> = {
  upload: 'Uploading file',
  extract_audio: 'Extracting audio',
  transcribe: 'Transcribing content',
  extract_text: 'Extracting text',
  process_text: 'Processing text',
  document: 'Generating document',
  embeddings: 'Creating embeddings',
  complete: 'Complete',
};

/**
 * Step 3: Upload Progress with Real-Time Updates
 *
 * Features:
 * - SSE connection for real-time progress
 * - Detailed progress stages with ProcessingStageIndicator
 * - Elapsed time and ETA tracking
 * - Auto-redirect to /library/[id] on completion
 * - Error handling and retry logic
 */
export default function UploadProgressStep({
  recordingId,
  streamUrl,
  onRetry,
  onCancel,
}: UploadProgressStepProps) {
  const router = useRouter();
  const [stages, setStages] = useState<ProcessingStage[]>([
    { id: 'upload', label: 'Uploading file', status: 'completed', progress: 100 },
  ]);
  const [currentStep, setCurrentStep] = useState('upload');
  const [overallProgress, setOverallProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>(
    undefined
  );
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSSEMessageRef = useRef<((message: SSEMessage) => void) | null>(null);

  /**
   * Update stage status
   */
  const updateStage = useCallback(
    (stageId: string, updates: Partial<ProcessingStage>) => {
      setStages((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === stageId);

        if (existingIndex >= 0) {
          // Update existing stage
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...updates };
          return updated;
        } else {
          // Add new stage
          return [
            ...prev,
            {
              id: stageId,
              label: STAGE_LABELS[stageId] || stageId,
              status: 'pending',
              ...updates,
            } as ProcessingStage,
          ];
        }
      });
    },
    []
  );

  /**
   * Handle SSE messages (stored in ref to prevent reconnections)
   */
  handleSSEMessageRef.current = (message: SSEMessage) => {
    console.log('[UploadProgressStep] SSE message:', message);

    if (message.type === 'log') {
      // Log messages provide context but don't update stages
      console.log('[UploadProgressStep] Log:', message.message);
    } else if (message.type === 'progress') {
      const { step, progress, message: msg } = message;

      if (step) {
        // Map job type to stage ID
        const stageId = JOB_TYPE_TO_STAGE[step] || step;

        updateStage(stageId, {
          status: 'in_progress',
          progress: progress || 50,
          label: msg || STAGE_LABELS[stageId] || step,
        });

        setCurrentStep(stageId);
      }

      // Update overall progress if provided
      if (progress !== undefined) {
        setOverallProgress(progress);
      }
    } else if (message.type === 'complete') {
      // Mark all stages as completed
      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          status: 'completed',
          progress: 100,
        }))
      );

      setIsComplete(true);
      setOverallProgress(100);
      setConnectionStatus('disconnected');

      // Auto-redirect after 3 seconds
      redirectTimeoutRef.current = setTimeout(() => {
        router.push(`/library/${recordingId}`);
      }, 3000);
    } else if (message.type === 'error') {
      const errorMsg = message.message || 'An error occurred during processing';
      setError(errorMsg);
      setConnectionStatus('error');

      // Mark current stage as error
      if (currentStep) {
        updateStage(currentStep, { status: 'error' });
      }
    }
  };

  /**
   * Connect to SSE stream (only once on mount)
   */
  useEffect(() => {
    if (!streamUrl) return;

    console.log('[UploadProgressStep] Connecting to SSE:', streamUrl);
    setConnectionStatus('connecting');

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[UploadProgressStep] SSE connection opened');
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Use ref to avoid reconnections when handler changes
        if (handleSSEMessageRef.current) {
          handleSSEMessageRef.current(data);
        }
      } catch (err) {
        console.error('[UploadProgressStep] Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[UploadProgressStep] SSE error:', err);

      // Check if the connection is closed (happens on completion)
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log('[UploadProgressStep] SSE connection closed');
        setConnectionStatus('disconnected');
      } else {
        setConnectionStatus('error');
        setError('Lost connection to server. Retrying...');
      }
    };

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [streamUrl]); // Only reconnect if streamUrl changes

  /**
   * Start elapsed time timer
   */
  useEffect(() => {
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(elapsed);

      // Estimate remaining time based on progress
      if (overallProgress > 0 && overallProgress < 100) {
        const estimatedTotal = (elapsed / overallProgress) * 100;
        const remaining = Math.max(0, Math.ceil(estimatedTotal - elapsed));
        setEstimatedTimeRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [overallProgress]);

  /**
   * Cleanup redirect timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Handle manual redirect
   */
  const handleViewRecording = useCallback(() => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    router.push(`/library/${recordingId}`);
  }, [recordingId, router]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">Processing Upload</h2>
        <p className="text-sm text-muted-foreground">
          Your file is being processed. This may take a few minutes depending on file
          size.
        </p>
      </div>

      {/* Connection Status */}
      {connectionStatus === 'connecting' && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Connecting to processing server...
            </p>
          </div>
        </Card>
      )}

      {/* Processing Stages */}
      <Card className="p-6">
        <ProcessingStageIndicator
          currentStep={currentStep}
          progress={overallProgress}
          stages={stages}
          elapsedTime={elapsedTime}
          estimatedTimeRemaining={estimatedTimeRemaining}
        />
      </Card>

      {/* Success Message */}
      {isComplete && !error && (
        <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-green-900 dark:text-green-100">
                Processing Complete!
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Your content is ready and has been added to your library. Redirecting in 3
                seconds...
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-6 bg-destructive/10 border-destructive/20">
          <div className="flex items-start space-x-3">
            <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-destructive">Processing Failed</p>
              <p className="mt-1 text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Warning for long processing */}
      {!isComplete && !error && elapsedTime > 180 && (
        <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-900 dark:text-amber-100 font-medium">
                Taking longer than expected
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Large files may take several minutes to process. You can close this window
                and check back later in your library.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        {!isComplete && !error && (
          <Button variant="outline" onClick={onCancel} disabled={connectionStatus === 'connecting'}>
            Close
          </Button>
        )}

        {isComplete && (
          <Button
            onClick={handleViewRecording}
            className="flex-1 max-w-xs mx-auto"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View in Library
          </Button>
        )}

        {error && onRetry && (
          <div className="flex space-x-3 ml-auto">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={onRetry}>Retry Upload</Button>
          </div>
        )}
      </div>
    </div>
  );
}
