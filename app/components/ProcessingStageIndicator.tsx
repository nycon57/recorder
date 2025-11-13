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

      {/* Horizontal Stepper - Modern & User-Friendly Design */}
      <div className="w-full">
        {/* Steps Container */}
        <div className="relative flex justify-between items-start gap-0 md:gap-4">
          {stages.map((stage, index) => {
            const isActive = stage.status === 'in_progress';
            const isCompleted = stage.status === 'completed';
            const isError = stage.status === 'error';
            const isPending = stage.status === 'pending';
            const showProgress = isActive && stage.progress !== undefined;
            const emojiIcon = getEmojiIcon(stage);
            const colorConfig = getStageColorConfig(stage);
            const benefit = stage.benefit || '';
            const sublabel = stage.sublabel || '';

            return (
              <React.Fragment key={stage.id}>
                {/* Step Item */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.15, type: 'spring' }}
                  className="flex flex-col items-center flex-1 min-w-0 relative z-10"
                  role="status"
                  aria-label={`${stage.label}. ${benefit}. ${isCompleted ? 'Complete' : isActive ? 'In progress' : isPending ? 'Pending' : 'Error'}`}
                >
                  {/* Icon Circle */}
                  <div className="relative mb-3">
                    <motion.div
                      className={cn(
                        'relative flex size-16 md:size-20 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300',
                        'shadow-lg',
                        getStatusColor(stage),
                        isActive && 'scale-110'
                      )}
                      animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                    >
                      {/* Emoji or Icon */}
                      {emojiIcon ? (
                        <span className="text-3xl md:text-4xl" role="img" aria-hidden="true">
                          {emojiIcon}
                        </span>
                      ) : (
                        <div className="text-white">
                          {getStatusIcon(stage)}
                        </div>
                      )}

                      {/* Animated Ring for Active State */}
                      {isActive && (
                        <motion.div
                          className={cn(
                            'absolute inset-0 rounded-full border-2',
                            colorConfig?.border || 'border-blue-600 dark:border-blue-500'
                          )}
                          initial={{ scale: 1, opacity: 0.6 }}
                          animate={{ scale: 1.4, opacity: 0 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                        />
                      )}

                      {/* Success Celebration */}
                      {isCompleted && (
                        <motion.div
                          className="absolute -top-1 -right-1 bg-white dark:bg-gray-900 rounded-full p-0.5"
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', delay: 0.2 }}
                        >
                          <Check className="size-5 text-green-600 dark:text-green-500" />
                        </motion.div>
                      )}
                    </motion.div>
                  </div>

                  {/* Label & Benefit */}
                  <div className="text-center space-y-1 px-2">
                    <motion.p
                      className={cn(
                        'text-sm md:text-base font-semibold transition-colors',
                        getStageColor(stage)
                      )}
                      layout
                    >
                      {stage.label}
                    </motion.p>

                    {/* Benefit Text */}
                    {benefit && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={cn(
                          'text-xs text-muted-foreground leading-tight',
                          isActive && 'font-medium'
                        )}
                      >
                        {benefit}
                      </motion.p>
                    )}

                    {/* Sublabel */}
                    {sublabel && isActive && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className={cn('text-xs font-medium', colorConfig?.text || 'text-purple-700 dark:text-purple-300')}
                      >
                        {sublabel}
                      </motion.p>
                    )}

                    {/* Progress Bar for Active Stage */}
                    {showProgress && (
                      <motion.div
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        exit={{ opacity: 0, scaleX: 0 }}
                        className="mt-2 w-full max-w-[120px] mx-auto"
                        style={{ transformOrigin: 'left' }}
                      >
                        <Progress
                          value={stage.progress}
                          className={cn('h-1.5', getProgressBarColor(stage), getProgressIndicatorColor(stage))}
                          aria-label={`Progress: ${stage.progress}%`}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {stage.progress?.toFixed(0)}%
                        </p>
                      </motion.div>
                    )}

                    {/* Error Message */}
                    {isError && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-destructive mt-1"
                      >
                        Failed
                      </motion.p>
                    )}
                  </div>
                </motion.div>

                {/* Connector Line */}
                {index < stages.length - 1 && (
                  <div className="flex items-center self-start mt-8 flex-shrink-0 hidden md:flex">
                    <div className="relative w-12 lg:w-20 h-0.5 mx-2">
                      {/* Background Line */}
                      <div className="absolute inset-0 bg-border" />

                      {/* Animated Fill Line */}
                      <motion.div
                        className={cn(
                          'absolute inset-0 transition-colors duration-500',
                          index < currentStageIndex
                            ? 'bg-green-600 dark:bg-green-500'
                            : isActive
                              ? 'bg-gradient-to-r from-purple-600 to-transparent dark:from-purple-500'
                              : 'bg-border'
                        )}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: index < currentStageIndex ? 1 : isActive ? 0.5 : 0 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        style={{ transformOrigin: 'left' }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
