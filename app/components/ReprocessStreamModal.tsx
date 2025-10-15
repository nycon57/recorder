'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronDown,
  ChevronUp,
  Terminal,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Zap,
  Activity
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';

import { cn } from '@/lib/utils/cn';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
import ProcessingStageIndicator, { ProcessingStage } from './ProcessingStageIndicator';
import StreamingTextDisplay from './StreamingTextDisplay';
import ErrorRecoveryPanel, { ProcessingError } from './ErrorRecoveryPanel';

interface ReprocessStreamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingId: string;
  step: 'transcribe' | 'document' | 'embeddings' | 'all';
  recordingTitle?: string;
  mode?: 'reprocess' | 'finalize'; // Mode determines which endpoint to use
}

interface StreamEvent {
  type: 'progress' | 'log' | 'transcript_chunk' | 'document_chunk' | 'error' | 'complete' | 'heartbeat';
  step?: 'transcribe' | 'document' | 'embeddings' | 'all';
  progress?: number;
  message: string;
  data?: any;
  timestamp: string;
}

export default function ReprocessStreamModal({
  open,
  onOpenChange,
  recordingId,
  step,
  recordingTitle,
  mode = 'reprocess', // Default to reprocess for backward compatibility
}: ReprocessStreamModalProps) {
  const router = useRouter();
  const [currentStage, setCurrentStage] = React.useState<string>('transcribe');
  const [stages, setStages] = React.useState<ProcessingStage[]>([
    { id: 'transcribe', label: 'Transcribing Audio', status: 'in_progress', progress: 0 },
    { id: 'document', label: 'Generating Document', status: 'pending', progress: 0 },
    { id: 'embeddings', label: 'Creating Embeddings', status: 'pending', progress: 0 },
  ]);
  const [streamingText, setStreamingText] = React.useState('');
  const [contentType, setContentType] = React.useState<'transcript' | 'document'>('transcript');
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [error, setError] = React.useState<ProcessingError | null>(null);
  const [completed, setCompleted] = React.useState(false);
  const [startTime, setStartTime] = React.useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = React.useState<number | undefined>(undefined);
  const [charCount, setCharCount] = React.useState(0);
  const [processingSpeed, setProcessingSpeed] = React.useState(0);
  const eventSourceRef = React.useRef<EventSource | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastChunkTimeRef = React.useRef<number>(Date.now());
  const chunkCountRef = React.useRef<number>(0);

  // Update elapsed time
  React.useEffect(() => {
    if (!completed && !error) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTime, completed, error]);

  // Initialize SSE connection
  React.useEffect(() => {
    if (!open || !recordingId) return;

    const connectSSE = () => {
      try {
        setStartTime(Date.now());
        setElapsedTime(0);
        setCompleted(false);
        setError(null);
        setStreamingText('');
        setLogs([]);

        // Construct URL based on mode
        const url = mode === 'finalize'
          ? `/api/recordings/${recordingId}/finalize/stream?startProcessing=true`
          : `/api/recordings/${recordingId}/reprocess/stream?step=${step}`;

        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Connected to processing stream`]);
        };

        // Listen for all SSE events via message event
        eventSource.onmessage = (event) => {
          try {
            const streamEvent: StreamEvent = JSON.parse(event.data);
            handleStreamEvent(streamEvent);
          } catch (err) {
            console.error('Failed to parse SSE event:', err);
          }
        };

        eventSource.onerror = (err) => {
          console.error('EventSource error:', err);
          handleError({
            type: 'network',
            message: 'Connection to server lost. Please check your network and try again.',
            timestamp: new Date().toISOString(),
          });
          eventSource.close();
        };
      } catch (err) {
        console.error('Failed to connect:', err);
        handleError({
          type: 'network',
          message: 'Failed to establish connection. Please try again.',
          timestamp: new Date().toISOString(),
        });
      }
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [open, recordingId, step]);

  const handleStreamEvent = (event: StreamEvent) => {
    const timestamp = new Date().toLocaleTimeString();

    switch (event.type) {
      case 'progress':
        // Update stage status and progress
        if (event.step) {
          setCurrentStage(event.step);
          setStages((prev) =>
            prev.map((stage) => {
              if (stage.id === event.step) {
                return {
                  ...stage,
                  status: 'in_progress' as ProcessingStage['status'],
                  progress: event.progress || stage.progress,
                };
              }
              // Mark previous stages as completed
              const currentIndex = prev.findIndex((s) => s.id === event.step);
              const stageIndex = prev.findIndex((s) => s.id === stage.id);
              if (stageIndex < currentIndex && stage.status !== 'completed') {
                return { ...stage, status: 'completed' as ProcessingStage['status'], progress: 100 };
              }
              return stage;
            })
          );
        }
        if (event.message) {
          setLogs((prev) => [...prev, `[${timestamp}] ${event.message}`]);
        }
        break;

      case 'transcript_chunk':
        // Handle transcript streaming
        setIsStreaming(true);
        setContentType('transcript');
        setStreamingText((prev) => prev + event.message);
        setCharCount((prev) => prev + event.message.length);

        // Calculate processing speed
        const now = Date.now();
        const timeDelta = (now - lastChunkTimeRef.current) / 1000; // seconds
        if (timeDelta > 0) {
          const charsPerSecond = event.message.length / timeDelta;
          setProcessingSpeed((prev) => prev * 0.7 + charsPerSecond * 0.3); // Smoothed average
        }
        lastChunkTimeRef.current = now;
        chunkCountRef.current += 1;
        break;

      case 'document_chunk':
        // Handle document streaming
        setIsStreaming(true);
        setContentType('document');
        setStreamingText((prev) => prev + event.message);
        setCharCount((prev) => prev + event.message.length);

        // Calculate processing speed for documents
        const docNow = Date.now();
        const docTimeDelta = (docNow - lastChunkTimeRef.current) / 1000;
        if (docTimeDelta > 0) {
          const charsPerSecond = event.message.length / docTimeDelta;
          setProcessingSpeed((prev) => prev * 0.7 + charsPerSecond * 0.3);
        }
        lastChunkTimeRef.current = docNow;
        chunkCountRef.current += 1;
        break;

      case 'log':
        setLogs((prev) => [...prev, `[${timestamp}] ${event.message}`]);
        break;

      case 'complete':
        setCompleted(true);
        setIsStreaming(false);
        setStages((prev) =>
          prev.map((stage) => ({
            ...stage,
            status: stage.status === 'in_progress' || stage.status === 'completed' ? 'completed' : stage.status,
            progress: stage.status === 'in_progress' || stage.status === 'completed' ? 100 : stage.progress,
          }))
        );
        setLogs((prev) => [...prev, `[${timestamp}] ✓ ${event.message}`]);

        // Trigger confetti celebration
        if (typeof window !== 'undefined') {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#3b82f6', '#8b5cf6'],
          });
        }

        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        break;

      case 'error':
        handleError({
          type: 'api',
          message: event.message,
          timestamp: event.timestamp,
          details: event.data?.details,
        });
        break;

      case 'heartbeat':
        // Keep connection alive, no action needed
        break;
    }
  };

  const handleError = (error: ProcessingError) => {
    setError(error);
    setIsStreaming(false);
    setStages((prev) =>
      prev.map((stage) => {
        if (stage.status === 'in_progress') {
          return { ...stage, status: 'error' as ProcessingStage['status'] };
        }
        return stage;
      })
    );
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ✗ Error: ${error.message}`]);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const handleRetry = () => {
    setError(null);
    setCompleted(false);
    // Re-trigger SSE connection
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 100);
  };

  const handleViewRecording = () => {
    router.push(`/recordings/${recordingId}`);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    onOpenChange(false);
  };

  // Get stage colors for gradient backgrounds
  const getStageGradient = () => {
    if (completed) {
      return 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20';
    }
    if (error) {
      return 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20';
    }
    switch (currentStage) {
      case 'transcribe':
        return 'bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 dark:from-blue-950/20 dark:via-cyan-950/20 dark:to-sky-950/20';
      case 'document':
        return 'bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 dark:from-purple-950/20 dark:via-violet-950/20 dark:to-fuchsia-950/20';
      case 'embeddings':
        return 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/20 dark:via-yellow-950/20 dark:to-orange-950/20';
      default:
        return 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/20 dark:via-gray-950/20 dark:to-zinc-950/20';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        {/* Animated Background Gradient */}
        <motion.div
          className={cn('absolute inset-0 -z-10 transition-all duration-1000', getStageGradient())}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Header */}
        <DialogHeader className="relative px-6 pt-6 pb-4 border-b backdrop-blur-sm bg-background/80">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={!completed && !error ? { rotate: 360 } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  {completed ? (
                    <CheckCircle2 className="size-5 text-green-600 dark:text-green-500" />
                  ) : error ? (
                    <X className="size-5 text-destructive" />
                  ) : currentStage === 'transcribe' ? (
                    <Activity className="size-5 text-blue-600 dark:text-blue-500" />
                  ) : currentStage === 'document' ? (
                    <Sparkles className="size-5 text-purple-600 dark:text-purple-500" />
                  ) : (
                    <Zap className="size-5 text-amber-600 dark:text-amber-500" />
                  )}
                </motion.div>
                <DialogTitle className="text-xl font-semibold">
                  {completed ? 'Processing Complete' : error ? 'Processing Failed' : 'Processing Recording'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm">
                {recordingTitle || `Recording ${recordingId}`}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="size-8 p-0"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Live Stats Bar */}
          {!completed && !error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-6 text-xs text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <Activity className="size-3.5 animate-pulse" aria-hidden="true" />
                <span>Live</span>
              </div>
              {processingSpeed > 0 && (
                <div className="flex items-center gap-1.5">
                  <Zap className="size-3.5" aria-hidden="true" />
                  <span>{Math.round(processingSpeed)} chars/sec</span>
                </div>
              )}
              {charCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  <span>{charCount.toLocaleString()} chars</span>
                </div>
              )}
            </motion.div>
          )}
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-6">
          <div className="space-y-8">
            {/* Error State */}
            {error && (
              <ErrorRecoveryPanel
                error={error}
                onRetry={handleRetry}
                onCancel={handleClose}
              />
            )}

            {/* Success State */}
            {completed && !error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-lg border-2 border-green-600 dark:border-green-500 bg-green-50 dark:bg-green-950/30 p-6 text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-green-600 dark:bg-green-500 text-white"
                >
                  <CheckCircle2 className="size-8" />
                </motion.div>
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                  Processing Completed Successfully!
                </h3>
                <p className="mt-2 text-sm text-green-800 dark:text-green-200">
                  Your recording has been reprocessed and is ready to view.
                </p>
                <Button onClick={handleViewRecording} className="mt-4" aria-label="View recording">
                  <ExternalLink className="size-4 mr-2" />
                  View Recording
                </Button>
              </motion.div>
            )}

            {/* Processing Stages */}
            {!error && !completed && (
              <ProcessingStageIndicator
                currentStep={currentStage}
                progress={stages.find((s) => s.id === currentStage)?.progress || 0}
                stages={stages}
                elapsedTime={elapsedTime}
              />
            )}

            {/* Streaming Content */}
            {streamingText && !error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {contentType === 'transcript' ? (
                      <>
                        <Activity className="size-4 text-blue-600 dark:text-blue-500" />
                        <span>Live Transcript</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-purple-600 dark:text-purple-500" />
                        <span>Generated Document</span>
                      </>
                    )}
                  </h3>
                  {processingSpeed > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <Zap className="size-3 text-amber-500" aria-hidden="true" />
                      <span>{Math.round(processingSpeed)} chars/sec</span>
                    </motion.div>
                  )}
                </div>
                <StreamingTextDisplay
                  text={streamingText}
                  isStreaming={isStreaming}
                  language={contentType === 'document' ? 'markdown' : 'plain'}
                />
              </motion.div>
            )}

            {/* Server Logs */}
            {logs.length > 0 && (
              <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
                <div className="rounded-lg border bg-muted/50">
                  <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <Terminal className="size-4" aria-hidden="true" />
                      <span>Server Logs ({logs.length})</span>
                    </div>
                    {logsOpen ? (
                      <ChevronUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="size-4" aria-hidden="true" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-[200px] border-t bg-background">
                      <div className="p-4 font-mono text-xs space-y-1">
                        {logs.map((log, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.02 * index }}
                            className="text-muted-foreground"
                          >
                            {log}
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!error && !completed && (
          <div className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Processing in progress...</span>
              <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Cancel processing">
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
