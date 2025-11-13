'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Clock, AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { Progress } from '@/app/components/ui/progress';
import { getStageConfig, type ProcessingStageConfig } from '@/lib/constants/processing-messages';

export interface ProcessingStage {
  id: string;
  label: string;
  status: 'completed' | 'in_progress' | 'pending' | 'error';
  progress?: number; // 0-100
  benefit?: string; // User benefit text
  sublabel?: string; // Additional context
}

interface ProcessingStageIndicatorProps {
  currentStep: string;
  progress: number;
  stages: ProcessingStage[];
  elapsedTime?: number; // in seconds
  estimatedTimeRemaining?: number; // in seconds (DEPRECATED - not shown per user preference)
  className?: string;
  /** Use simplified 3-step view (recommended for non-technical users) */
  simplified?: boolean;
}

export default function ProcessingStageIndicator({
  currentStep,
  progress,
  stages,
  elapsedTime,
  estimatedTimeRemaining, // DEPRECATED - not shown per user preference
  className,
  simplified = false,
}: ProcessingStageIndicatorProps) {
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  // Get stage configuration from centralized config
  const getStageColorConfig = (stage: ProcessingStage): ProcessingStageConfig['color'] | undefined => {
    const config = getStageConfig(stage.id);
    return config?.color;
  };

  // Get stage-specific colors (with fallback to original logic)
  const getStageColor = (stage: ProcessingStage) => {
    if (stage.status === 'completed') {
      return 'text-green-600 dark:text-green-500';
    }
    if (stage.status === 'error') {
      return 'text-destructive';
    }
    if (stage.status === 'pending') {
      return 'text-muted-foreground';
    }

    // Use color config from centralized messages
    const colorConfig = getStageColorConfig(stage);
    if (colorConfig) {
      return colorConfig.icon;
    }

    // Fallback to original colors
    return 'text-blue-600 dark:text-blue-500';
  };

  const getStatusIcon = (stage: ProcessingStage) => {
    const colorClass = getStageColor(stage);

    switch (stage.status) {
      case 'completed':
        return (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Check className={cn('size-6', colorClass)} aria-label="Completed" />
          </motion.div>
        );
      case 'in_progress':
        return (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className={cn('size-6', colorClass)} aria-label="In progress" />
          </motion.div>
        );
      case 'pending':
        return <Clock className={cn('size-6', colorClass)} aria-label="Pending" />;
      case 'error':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.3 }}
          >
            <AlertCircle className={cn('size-6', colorClass)} aria-label="Error" />
          </motion.div>
        );
    }
  };

  const getStatusColor = (stage: ProcessingStage) => {
    if (stage.status === 'completed') {
      return 'bg-green-600 dark:bg-green-500';
    }
    if (stage.status === 'error') {
      return 'bg-destructive';
    }
    if (stage.status === 'pending') {
      return 'bg-muted';
    }

    // Use color config from centralized messages
    const colorConfig = getStageColorConfig(stage);
    if (colorConfig) {
      return colorConfig.bg;
    }

    // Fallback
    return 'bg-blue-600 dark:bg-blue-500';
  };

  const getProgressBarColor = (stage: ProcessingStage) => {
    // Use lighter background for progress bars
    const colorConfig = getStageColorConfig(stage);
    if (colorConfig) {
      // Extract color name from config (e.g., "blue" from "text-blue-600")
      const match = colorConfig.bg.match(/(blue|purple|indigo|violet|green|amber)-/);
      if (match) {
        const color = match[1];
        return `bg-${color}-100 dark:bg-${color}-950`;
      }
    }

    return 'bg-blue-100 dark:bg-blue-950';
  };

  const getProgressIndicatorColor = (stage: ProcessingStage) => {
    // Use indicator color from config
    const colorConfig = getStageColorConfig(stage);
    if (colorConfig) {
      const match = colorConfig.bg.match(/(blue|purple|indigo|violet|green|amber)-/);
      if (match) {
        const color = match[1];
        return `[&>div]:bg-${color}-600 dark:[&>div]:bg-${color}-500`;
      }
    }

    return '[&>div]:bg-blue-600 dark:[&>div]:bg-blue-500';
  };

  const currentStageIndex = stages.findIndex((stage) => stage.id === currentStep);

  // Get emoji icon from config if available
  const getEmojiIcon = (stage: ProcessingStage): string | undefined => {
    const config = getStageConfig(stage.id);
    return config?.icon;
  };

  return (
    <div className={cn('space-y-6', className)} role="region" aria-label="Processing stages">
      {/* Time Display - Only Elapsed Time (per user preference) */}
      {elapsedTime !== undefined && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center text-sm"
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            <span>
              Elapsed time: <span className="font-medium text-foreground">{formatTime(elapsedTime)}</span>
            </span>
          </div>
        </motion.div>
      )}

      {/* Stages */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {stages.map((stage, index) => {
            const isActive = stage.status === 'in_progress';
            const showProgress = isActive && stage.progress !== undefined;

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="flex items-start gap-4">
                  {/* Icon Circle */}
                  <div
                    className={cn(
                      'relative flex size-12 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-300',
                      getStatusColor(stage.status)
                    )}
                  >
                    {getStatusIcon(stage)}

                    {/* Animated Ring for Active State */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-blue-600 dark:border-blue-500"
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.3, opacity: 0 }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1">
                    <motion.p
                      className={cn('text-base font-semibold transition-colors', getStageColor(stage))}
                      layout
                    >
                      {stage.label}
                    </motion.p>

                    {/* Progress Bar */}
                    {showProgress && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2"
                      >
                        <Progress
                          value={stage.progress}
                          className={cn('h-2', getProgressBarColor(stage), getProgressIndicatorColor(stage))}
                          aria-label={`Progress: ${stage.progress}%`}
                        />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{stage.progress?.toFixed(0)}% complete</p>
                          {stage.progress && stage.progress > 0 && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="flex items-center gap-1 text-xs font-medium"
                            >
                              <Sparkles
                                className={cn('size-3', getStageColor(stage))}
                                aria-hidden="true"
                              />
                              <span className={getStageColor(stage)}>Processing</span>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Error Message */}
                    {stage.status === 'error' && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-2 text-sm text-destructive"
                      >
                        Processing failed at this stage
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div className="absolute left-6 top-12 h-6 w-px">
                    <motion.div
                      className={cn(
                        'h-full w-full transition-colors duration-500',
                        index < currentStageIndex ? 'bg-green-600 dark:bg-green-500' : 'bg-border'
                      )}
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: index * 0.1 + 0.2, duration: 0.3 }}
                      style={{ transformOrigin: 'top' }}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
