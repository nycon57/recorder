'use client';

/* global EventSource */

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, ExternalLink, AlertCircle } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import ProcessingStageIndicator, {
  type ProcessingStage,
} from '@/app/components/ProcessingStageIndicator';
import {
  JOB_TYPE_TO_STAGE,
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
  data?: unknown;
  timestamp?: string;
}

function createInitialUploadStages(): ProcessingStage[] {
  return [
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
  ];
}

function applyStageUpdate(
  stages: ProcessingStage[],
  stageId: string,
  updates: Partial<ProcessingStage>,
): ProcessingStage[] {
  const existingIndex = stages.findIndex((stage) => stage.id === stageId);

  if (existingIndex >= 0) {
    const updated = [...stages];
    const currentStage = updated[existingIndex];
    const newLabel = updates.label;
    updated[existingIndex] =
      newLabel && newLabel !== 'Completed'
        ? { ...currentStage, ...updates }
        : {
            ...currentStage,
            ...updates,
            label: currentStage.label,
            benefit: currentStage.benefit,
            sublabel: currentStage.sublabel,
          };
    return updated;
  }

  const stageConfig = getStageConfig(stageId);
  return [
    ...stages,
    {
      id: stageId,
      label: stageConfig?.label || stageId,
      benefit: stageConfig?.benefit,
      sublabel: stageConfig?.sublabel,
      status: 'pending' as const,
      ...updates,
    },
  ];
}

type UploadProgressState = {
  stages: ProcessingStage[];
  currentStep: string;
  overallProgress: number;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  isComplete: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
};

type UploadProgressAction =
  | { type: 'connect' }
  | { type: 'connected' }
  | { type: 'disconnected' }
  | {
      type: 'stage-progress';
      stageId: string;
      updates: Partial<ProcessingStage>;
      isCurrent: boolean;
      progress?: number;
    }
  | { type: 'complete' }
  | { type: 'error'; message: string; currentStep: string }
  | { type: 'timer'; elapsedTime: number; estimatedTimeRemaining?: number };

const initialUploadProgressState: UploadProgressState = {
  stages: createInitialUploadStages(),
  currentStep: 'upload',
  overallProgress: 0,
  elapsedTime: 0,
  estimatedTimeRemaining: undefined,
  isComplete: false,
  error: null,
  connectionStatus: 'connecting',
};

function uploadProgressReducer(
  state: UploadProgressState,
  action: UploadProgressAction,
): UploadProgressState {
  switch (action.type) {
    case 'connect': {
      const stages = createInitialUploadStages();
      const firstPendingIndex = stages.findIndex(
        (stage) => stage.status === 'pending',
      );
      if (firstPendingIndex >= 0) {
        stages[firstPendingIndex] = {
          ...stages[firstPendingIndex],
          status: 'in_progress',
          progress: 10,
        };
      }
      return {
        ...initialUploadProgressState,
        stages,
        currentStep: stages[firstPendingIndex]?.id ?? 'upload',
        connectionStatus: 'connecting',
      };
    }
    case 'connected':
      return { ...state, connectionStatus: 'connected' };
    case 'disconnected':
      return { ...state, connectionStatus: 'disconnected' };
    case 'stage-progress': {
      let stages = applyStageUpdate(
        state.stages,
        action.stageId,
        action.updates,
      );
      let currentStep = action.isCurrent ? action.stageId : state.currentStep;

      if (action.updates.status === 'completed') {
        const nextPendingIndex = stages.findIndex(
          (stage) => stage.status === 'pending',
        );
        if (nextPendingIndex >= 0) {
          stages = [...stages];
          stages[nextPendingIndex] = {
            ...stages[nextPendingIndex],
            status: 'in_progress',
            progress: 5,
          };
          currentStep = stages[nextPendingIndex].id;
        }
      }

      return {
        ...state,
        stages,
        currentStep,
        overallProgress: action.progress ?? state.overallProgress,
      };
    }
    case 'complete':
      return {
        ...state,
        stages: state.stages.map((stage) => ({
          ...stage,
          status: 'completed' as const,
          progress: 100,
        })),
        isComplete: true,
        overallProgress: 100,
        connectionStatus: 'disconnected',
      };
    case 'error':
      return {
        ...state,
        error: action.message,
        connectionStatus: 'error',
        stages: applyStageUpdate(state.stages, action.currentStep, {
          status: 'error',
        }),
      };
    case 'timer':
      return {
        ...state,
        elapsedTime: action.elapsedTime,
        estimatedTimeRemaining:
          action.estimatedTimeRemaining ?? state.estimatedTimeRemaining,
      };
  }
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
export default function UploadProgressStep(
  props: Parameters<typeof useUploadProgressStepImplementation>[0],
) {
  return useUploadProgressStepImplementation(props);
}

function useUploadProgressStepImplementation({
  recordingId,
  streamUrl,
  onRetry,
  onCancel,
  onComplete,
}: UploadProgressStepProps) {
  const { push } = useRouter();
  const [state, dispatch] = useReducer(
    uploadProgressReducer,
    initialUploadProgressState,
  );
  const {
    stages,
    currentStep,
    overallProgress,
    elapsedTime,
    estimatedTimeRemaining,
    isComplete,
    error,
    connectionStatus,
  } = state;

  const eventSourceRef = useRef<EventSource | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSSEMessageRef = useRef<((message: SSEMessage) => void) | null>(
    null,
  );
  const progressRef = useRef<number>(0);

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

        dispatch({
          type: 'stage-progress',
          stageId,
          updates: {
            status,
            progress: progress || 50,
            label: displayLabel,
          },
          isCurrent: status === 'in_progress',
          progress,
        });
      }

      // Update overall progress if provided
      if (progress !== undefined) {
        progressRef.current = progress;
      }
    } else if (message.type === 'complete') {
      dispatch({ type: 'complete' });
      progressRef.current = 100;

      // Close EventSource immediately to prevent reconnection loop
      if (eventSourceRef.current) {
        console.log(
          '[UploadProgressStep] Closing SSE connection after completion',
        );
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
      dispatch({ type: 'error', message: errorMsg, currentStep });
    }
  };

  /**
   * Connect to SSE stream (only once on mount)
   */
  useEffect(() => {
    if (!streamUrl) return;

    console.log('[UploadProgressStep] Connecting to SSE:', streamUrl);
    dispatch({ type: 'connect' });

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[UploadProgressStep] SSE connection opened');
      dispatch({ type: 'connected' });
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

    eventSource.onerror = () => {
      // Check if the connection is closed (happens on completion)
      if (eventSource.readyState === EventSource.CLOSED) {
        // Normal closure after completion - not an error
        console.log('[UploadProgressStep] SSE connection closed normally');
        dispatch({ type: 'disconnected' });
      } else if (eventSource.readyState === EventSource.CONNECTING) {
        // Temporary disconnection, browser is auto-reconnecting
        console.log('[UploadProgressStep] SSE reconnecting...');
        // Don't change status to error - this is normal reconnection behavior
      } else {
        // Actual error during connection (readyState === CLOSED but we haven't seen completion)
        console.warn(
          '[UploadProgressStep] SSE connection error (state:',
          eventSource.readyState,
          ')',
        );

        // Only show error if we haven't completed yet
        if (!isComplete) {
          dispatch({
            type: 'error',
            message: 'Connection interrupted. Reconnecting...',
            currentStep,
          });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reconnect if streamUrl changes; other values are read through refs/current state.
  }, [streamUrl]);

  /**
   * Start elapsed time timer
   */
  useEffect(() => {
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

      // Estimate remaining time based on progress (use ref to avoid recreating interval)
      let estimatedTimeRemaining: number | undefined;
      if (progressRef.current > 0 && progressRef.current < 100) {
        const estimatedTotal = (elapsed / progressRef.current) * 100;
        estimatedTimeRemaining = Math.max(
          0,
          Math.ceil(estimatedTotal - elapsed),
        );
      }

      dispatch({ type: 'timer', elapsedTime: elapsed, estimatedTimeRemaining });
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
    push(`/library/${recordingId}`);
  }, [recordingId, push]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">
          Processing Upload
        </h2>
        <p className="text-sm text-muted-foreground">
          Your file is being processed. This may take a few minutes depending on
          file size.
        </p>
      </div>

      {/* Connection Status */}
      {connectionStatus === 'connecting' && (
        <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-x-3">
            <div className="size-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          <div className="flex items-start gap-x-3">
            <CheckCircle2 className="size-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
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
          <div className="flex items-start gap-x-3">
            <XCircle className="size-6 text-destructive flex-shrink-0 mt-0.5" />
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
          <div className="flex items-start gap-x-3">
            <AlertCircle className="size-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
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
            <ExternalLink className="size-4 mr-2" />
            View Content
          </Button>
        )}

        {error && onRetry && (
          <div className="flex gap-x-3">
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
