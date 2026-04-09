'use client';

import { Check, Monitor, Circle, Play, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

export type RecordingStep = 'setup' | 'ready' | 'recording' | 'review';

interface RecordingStepsProps {
  currentStep: RecordingStep;
  className?: string;
}

const steps = [
  { id: 'setup', label: 'Setup', icon: Monitor, description: 'Configure your recording' },
  { id: 'ready', label: 'Ready', icon: Circle, description: 'Screen shared' },
  { id: 'recording', label: 'Recording', icon: Play, description: 'Capturing content' },
  { id: 'review', label: 'Review', icon: Upload, description: 'Save or discard' },
] as const;

const stepOrder: Record<RecordingStep, number> = {
  setup: 0,
  ready: 1,
  recording: 2,
  review: 3,
};

/**
 * RecordingSteps - Visual step indicator for the recording workflow
 * Shows users their progress through Setup → Ready → Recording → Review
 */
export function RecordingSteps({ currentStep, className }: RecordingStepsProps) {
  const currentIndex = stepOrder[currentStep];

  return (
    <div className={cn('w-full', className)}>
      {/* Mobile: Compact indicator */}
      <div className="flex sm:hidden items-center justify-center gap-2 py-2">
        <span className="text-sm font-medium text-foreground">
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-sm text-muted-foreground">
          {steps[currentIndex].label}
        </span>
      </div>

      {/* Desktop: Full step indicator */}
      <nav aria-label="Recording progress" className="hidden sm:block">
        <ol className="flex items-center justify-center gap-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <li key={step.id} className="flex items-center">
                {/* Step indicator */}
                <div className="flex items-center">
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200',
                      isCompleted && 'bg-primary border-primary text-primary-foreground',
                      isCurrent && 'border-primary bg-primary/10 text-primary',
                      isPending && 'border-muted-foreground/30 text-muted-foreground/50'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="size-4" aria-hidden="true" />
                    ) : (
                      <Icon className="size-4" aria-hidden="true" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'ml-2 text-sm font-medium transition-colors',
                      isCompleted && 'text-primary',
                      isCurrent && 'text-foreground',
                      isPending && 'text-muted-foreground/50'
                    )}
                  >
                    {step.label}
                  </span>
                </div>

                {/* Connector line (except for last step) */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-12 h-0.5 mx-3 transition-colors',
                      index < currentIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
