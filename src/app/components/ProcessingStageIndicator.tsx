'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Upload, FileText, Sparkles, Search, FileCheck } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { getStageConfig } from '@/lib/constants/processing-messages';

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
  className?: string;
  simplified?: boolean;
  elapsedTime?: number;
  estimatedTimeRemaining?: number;
}

// Map stage IDs to Lucide icons
const STAGE_ICONS: Record<string, React.ComponentType<any>> = {
  upload: Upload,
  extract_text: FileText,
  document: Sparkles,
  embeddings: Search,
  complete: FileCheck,
};

/**
 * Processing Stage Indicator with flat icons and loader rings
 */
export default function ProcessingStageIndicator({
  currentStep,
  progress,
  stages,
  className,
  simplified = false,
  elapsedTime,
  estimatedTimeRemaining,
}: ProcessingStageIndicatorProps) {
  // Get icon for stage
  const getStageIcon = (stageId: string) => {
    return STAGE_ICONS[stageId] || FileText;
  };

  return (
    <div className={cn('w-full space-y-2', className)} role="region" aria-label="Processing stages">
      <AnimatePresence mode="popLayout">
        {stages.map((stage, index) => {
          const isActive = stage.status === 'in_progress';
          const isCompleted = stage.status === 'completed';
          const isPending = stage.status === 'pending';
          const IconComponent = getStageIcon(stage.id);

          return (
            <motion.div
              key={stage.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={{ opacity: 0, x: 20 }}
              transition={{
                layout: { duration: 0.3 },
                opacity: { duration: 0.2 },
                x: { duration: 0.3 },
              }}
              className={cn(
                'relative flex items-center gap-3 rounded-lg border px-4 py-3 transition-all',
                isActive && 'border-primary/30 bg-primary/5',
                isCompleted && 'border-border/50 bg-muted/30',
                isPending && 'border-border/30 bg-background opacity-60'
              )}
            >
              {/* Icon with loader ring */}
              <div className="relative flex-shrink-0">
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="flex size-10 items-center justify-center rounded-full bg-primary/10"
                  >
                    <Check className="size-5 text-primary" strokeWidth={2.5} />
                  </motion.div>
                )}

                {isActive && (
                  <div className="relative flex size-10 items-center justify-center">
                    {/* Spinning loader ring */}
                    <svg
                      className="absolute inset-0 size-10 -rotate-90"
                      viewBox="0 0 40 40"
                    >
                      <circle
                        cx="20"
                        cy="20"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-border/30"
                      />
                      <motion.circle
                        cx="20"
                        cy="20"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="text-primary"
                        initial={{ strokeDasharray: '0 113' }}
                        animate={{
                          strokeDasharray: ['0 113', '85 113', '85 113'],
                          rotate: [0, 0, 360],
                        }}
                        transition={{
                          strokeDasharray: {
                            duration: 1.5,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          },
                          rotate: {
                            duration: 2,
                            repeat: Infinity,
                            ease: 'linear',
                          },
                        }}
                      />
                    </svg>

                    {/* Static icon in center */}
                    <IconComponent className="size-5 text-primary" strokeWidth={2} />
                  </div>
                )}

                {isPending && (
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <IconComponent className="size-5 text-muted-foreground/40" strokeWidth={2} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive && 'text-foreground',
                    isCompleted && 'text-muted-foreground',
                    isPending && 'text-muted-foreground/60'
                  )}
                >
                  {stage.label}
                </div>

                {/* Show benefit only for active stage */}
                {isActive && stage.benefit && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-0.5 text-xs text-muted-foreground/70"
                  >
                    {stage.benefit}
                  </motion.div>
                )}
              </div>

              {/* Status indicator */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-shrink-0"
                >
                  <div className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="size-1 rounded-full bg-primary"
                        animate={{
                          opacity: [0.3, 1, 0.3],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.2,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
