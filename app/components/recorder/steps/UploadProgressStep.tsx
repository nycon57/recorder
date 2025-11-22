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
import {
  JOB_TYPE_TO_STAGE,
  SIMPLIFIED_STAGES,
  DETAILED_TO_SIMPLIFIED,
  getStageConfig,
  STATUS_MESSAGES,
} from '@/lib/constants/processing-messages';

interface UploadProgressStepProps {
  recordingId: string;
  streamUrl: string;
  onRetry?: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
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
  onComplete,
}: UploadProgressStepProps) {
  const router = useRouter();

  // Pre-populate ALL expected stages upfront so users see the full pipeline
  const [stages, setStages] = useState<ProcessingStage[]>([
    {
      id: 'upload',
      label: 'Uploading',
      benefit: 'Securely transferring your content',
      status: 'completed',
      progress: 100,
    },
    {
      id: 'extract_text',
      label: 'Extracting text',
      benefit: 'Reading content from your document',
      status: 'pending',
      progress: 0,
    },
    {
      id: 'document',
      label: 'Creating structured content',
      benefit: 'Generating AI-powered summary and insights',
      sublabel: 'This may take 15-30 seconds',
      status: 'pending',
      progress: 0,
    },
    {
      id: 'embeddings',
      label: 'Indexing for search',
      benefit: 'Making your content instantly searchable',
      status: 'pending',
      progress: 0,
    },
    {
      id: 'summary',
      label: 'Finalizing summary',
      benefit: 'Creating quick overview for easy reference',
      sublabel: 'Almost done!',
      status: 'pending',
      progress: 0,
    },
  ]);
  const [currentStep, setCurrentStep] = useState('upload');
  const [overallProgress, setOverallProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>(
    undefined
  ); // DEPRECATED - not shown
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const handleSSEMessageRef = useRef<((message: SSEMessage) => void) | null>(null);
  const progressRef = useRef<number>(0);

  /**
   * Update stage status with user-friendly messaging
   */
  const updateStage = useCallback(
    (stageId: string, updates: Partial<ProcessingStage>) => {
      setStages((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === stageId);

        if (existingIndex >= 0) {
          // Update existing stage - preserve the label/benefit unless explicitly updated
          const updated = [...prev];
          const currentStage = updated[existingIndex];

          // Only update label if it's not a generic "Completed" message
          const newLabel = updates.label;
          if (newLabel && newLabel !== 'Completed') {
            updated[existingIndex] = { ...currentStage, ...updates };
          } else {
            // Keep existing label, just update status/progress
            updated[existingIndex] = {
              ...currentStage,
              ...updates,
              label: currentStage.label, // Preserve original label
              benefit: currentStage.benefit, // Preserve original benefit
              sublabel: currentStage.sublabel, // Preserve original sublabel
            };
          }
          return updated;
        } else {
          // Stage not found - this shouldn't happen with pre-populated stages
          // But handle it gracefully just in case
          const stageConfig = getStageConfig(stageId);
          const newStage: ProcessingStage = {
            id: stageId,
            label: stageConfig?.label || stageId,
            benefit: stageConfig?.benefit,
            sublabel: stageConfig?.sublabel,
            status: 'pending',
            ...updates,
          };

          return [...prev, newStage];
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
        const stageConfig = getStageConfig(stageId);

        // Determine status based on progress
        const status = progress === 100 ? 'completed' : 'in_progress';

        // For completed jobs, use the message if it's not generic "Completed"
        // Otherwise use the stage config label
        let displayLabel = stageConfig?.label || step;
        if (status === 'completed' && msg && msg !== 'Completed') {
          displayLabel = msg;
        } else if (status === 'in_progress' && msg) {
          // For in-progress, show the descriptive message
          displayLabel = msg;
        }

        updateStage(stageId, {
          status,
          progress: progress || 50,
          label: displayLabel,
        });

        // Only set as current step if in progress
        if (status === 'in_progress') {
          setCurrentStep(stageId);
        }

        // CRITICAL: When a stage completes, immediately set the next pending stage to in_progress
        // This prevents the 20-second gap where nothing appears to be happening
        if (status === 'completed') {
          setStages((prev) => {
            const updated = [...prev];
            const nextPendingIndex = updated.findIndex(s => s.status === 'pending');
            if (nextPendingIndex >= 0) {
              console.log(`[UploadProgressStep] Auto-advancing to next stage: ${updated[nextPendingIndex].id}`);
              updated[nextPendingIndex] = {
                ...updated[nextPendingIndex],
                status: 'in_progress',
                progress: 5, // Show minimal progress to indicate it's starting
              };
              setCurrentStep(updated[nextPendingIndex].id);
            }
            return updated;
          });
        }
      }

      // Update overall progress if provided
      if (progress !== undefined) {
        setOverallProgress(progress);
        progressRef.current = progress;
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
      progressRef.current = 100;
      setConnectionStatus('disconnected');

      // Close EventSource immediately to prevent reconnection loop
      if (eventSourceRef.current) {
        console.log('[UploadProgressStep] Closing SSE connection after completion');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Notify parent that upload is complete
      if (onComplete) {
        onComplete();
      }

      // Don't auto-redirect - let user click button to view content
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

    // Immediately set the first stage after upload to in_progress
    // This ensures users see activity right away
    setStages((prev) => {
      const updated = [...prev];
      // Find first pending stage (should be extract_text)
      const firstPendingIndex = updated.findIndex(s => s.status === 'pending');
      if (firstPendingIndex >= 0) {
        updated[firstPendingIndex] = {
          ...updated[firstPendingIndex],
          status: 'in_progress',
          progress: 10, // Show some initial progress
        };
        setCurrentStep(updated[firstPendingIndex].id);
      }
      return updated;
    });

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
      // Check if the connection is closed (happens on completion)
      if (eventSource.readyState === EventSource.CLOSED) {
        // Normal closure after completion - not an error
        console.log('[UploadProgressStep] SSE connection closed normally');
        setConnectionStatus('disconnected');
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Temporary disconnection, browser is auto-reconnecting
        console.log('[UploadProgressStep] SSE reconnecting...');
        // Don't change status to error - this is normal reconnection behavior
      } else {
        // Actual error during connection (readyState === CLOSED but we haven't seen completion)
        console.warn('[UploadProgressStep] SSE connection error (state:', eventSource.readyState, ')');

        // Only show error if we haven't completed yet
        if (!isComplete) {
          setConnectionStatus('error');
          setError('Connection interrupted. Reconnecting...');
        }
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

      // Estimate remaining time based on progress (use ref to avoid recreating interval)
      if (progressRef.current > 0 && progressRef.current < 100) {
        const estimatedTotal = (elapsed / progressRef.current) * 100;
        const remaining = Math.max(0, Math.ceil(estimatedTotal - elapsed));
        setEstimatedTimeRemaining(remaining);
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []); // Empty deps - timer runs once and uses ref for current progress

  /**
   * Handle manual redirect
   */
  const handleViewRecording = useCallback(() => {
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
              {STATUS_MESSAGES.connecting}
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
                {STATUS_MESSAGES.complete.title}
              </p>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                {STATUS_MESSAGES.complete.description}
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
              <p className="text-base font-semibold text-destructive">
                {STATUS_MESSAGES.error.title}
              </p>
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
                {STATUS_MESSAGES.longRunning.title}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {STATUS_MESSAGES.longRunning.description}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-center pt-4">
        {isComplete && (
          <Button
            onClick={handleViewRecording}
            size="lg"
            className="min-w-[200px]"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Content
          </Button>
        )}

        {error && onRetry && (
          <div className="flex space-x-3">
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
