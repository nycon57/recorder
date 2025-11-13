'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

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
  /** Use simplified 3-step view (recommended for non-technical users) */
  simplified?: boolean;
}

export default function ProcessingStageIndicator({
  currentStep,
  progress,
  stages,
  className,
  simplified = false,
}: ProcessingStageIndicatorProps) {
  // Get emoji icon from config if available
  const getEmojiIcon = (stage: ProcessingStage): string | undefined => {
    const config = getStageConfig(stage.id);
    return config?.icon;
  };

  // Separate stages by status
  const completedStages = stages.filter((stage) => stage.status === 'completed');
  const activeStage = stages.find((stage) => stage.status === 'in_progress');

  return (
    <div className={cn('w-full space-y-6', className)} role="region" aria-label="Processing stages">
      {/* Completed Steps - Compact List */}
      {completedStages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-2"
        >
          {completedStages.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-2 text-sm text-muted-foreground"
              role="status"
              aria-label={`${stage.label} complete`}
            >
              <div className="flex-shrink-0 rounded-full bg-[#2fb861]/10 p-1">
                <Check className="size-3 text-[#2fb861]" strokeWidth={3} />
              </div>
              <span className="font-medium">{stage.label}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Active Step - Featured Card */}
      {activeStage && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, type: 'spring', stiffness: 200, damping: 20 }}
          className="rounded-2xl border-2 border-[#2fb861]/20 bg-card p-8 shadow-lg shadow-[#2fb861]/5"
          role="status"
          aria-label={`${activeStage.label} in progress. ${activeStage.benefit || ''}`}
        >
          <div className="flex flex-col items-center gap-6 text-center">
            {/* Icon/Emoji */}
            <motion.div
              className="relative"
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {getEmojiIcon(activeStage) ? (
                <span className="text-6xl drop-shadow-sm" role="img" aria-hidden="true">
                  {getEmojiIcon(activeStage)}
                </span>
              ) : (
                <div className="rounded-full bg-[#2fb861]/10 p-4">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="size-8 text-[#2fb861]" strokeWidth={2.5} />
                  </motion.div>
                </div>
              )}

              {/* Subtle pulsing ring */}
              <motion.div
                className="absolute inset-0 -z-10 rounded-full border-2 border-[#2fb861]/20"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            </motion.div>

            {/* Step Label */}
            <div className="space-y-2">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">
                {activeStage.label}
              </h3>

              {/* Benefit Description */}
              {activeStage.benefit && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm leading-relaxed text-muted-foreground"
                >
                  {activeStage.benefit}
                </motion.p>
              )}
            </div>

            {/* Minimal Loading Indicator */}
            <motion.div
              className="flex gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="size-2 rounded-full bg-[#2fb861]"
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: 'easeInOut',
                  }}
                  aria-hidden="true"
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
