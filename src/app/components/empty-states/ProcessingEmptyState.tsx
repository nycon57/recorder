'use client';

import { Loader2, Sparkles, Clock, FileText } from 'lucide-react';

import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/app/components/ui/empty';
import { Progress } from '@/app/components/ui/progress';
import { Badge } from '@/app/components/ui/badge';

/**
 * ProcessingEmptyState Component
 *
 * Displayed when content is being processed by AI pipeline
 *
 * Features:
 * - Visual processing indicator
 * - Progress stages
 * - Estimated time remaining
 * - Helpful context about what's happening
 *
 * @refactored - Now uses @shadcn/empty as foundation
 */
interface ProcessingEmptyStateProps {
  title?: string;
  stage?: 'uploading' | 'transcribing' | 'generating' | 'embedding';
  progress?: number;
  estimatedTimeRemaining?: number; // in seconds
}

const STAGE_CONFIG = {
  uploading: {
    label: 'Uploading',
    description: 'Uploading your file to secure storage',
    icon: Loader2,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  transcribing: {
    label: 'Transcribing',
    description: 'Converting speech to text using AI',
    icon: FileText,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  generating: {
    label: 'Generating',
    description: 'Creating summary and documentation',
    icon: Sparkles,
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  embedding: {
    label: 'Indexing',
    description: 'Building semantic search index',
    icon: Sparkles,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
};

export function ProcessingEmptyState({
  title = 'Processing Your Content',
  stage = 'transcribing',
  progress = 0,
  estimatedTimeRemaining,
}: ProcessingEmptyStateProps) {
  const config = STAGE_CONFIG[stage];
  const Icon = config.icon;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  return (
    <Empty className="border-2 py-12">
      <EmptyHeader>
        {/* Animated Icon */}
        <EmptyMedia className={`relative ${config.bgColor} mb-6`}>
          <div className="inline-flex items-center justify-center rounded-full p-6">
            <Icon className={`size-12 ${config.color} ${stage === 'uploading' || stage === 'transcribing' ? 'animate-spin' : 'animate-pulse'}`} />
          </div>
          {/* Pulse effect */}
          <div className={`absolute inset-0 rounded-full ${config.bgColor} animate-ping opacity-20`} />
        </EmptyMedia>

        <EmptyTitle className="text-2xl mb-2">
          {title}
        </EmptyTitle>

        {/* Stage Badge */}
        <Badge variant="secondary" className="mb-2">
          <span className={`w-2 h-2 rounded-full ${config.color} mr-2 animate-pulse`} />
          {config.label}
        </Badge>

        <EmptyDescription className="mb-4 max-w-md">
          {config.description}
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent className="max-w-lg">
        {/* Progress Bar */}
        {progress > 0 && (
          <div className="w-full mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Estimated Time */}
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Clock className="size-4" />
            <span>About {formatTime(estimatedTimeRemaining)} remaining</span>
          </div>
        )}

        {/* Processing Steps */}
        <div className="w-full mt-6">
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(STAGE_CONFIG).map(([key, stepConfig]) => {
              const StepIcon = stepConfig.icon;
              const isActive = key === stage;
              const isPast = Object.keys(STAGE_CONFIG).indexOf(key) < Object.keys(STAGE_CONFIG).indexOf(stage);

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : isPast
                      ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center rounded-md ${
                    isActive ? stepConfig.bgColor : isPast ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                  } p-2`}>
                    <StepIcon className={`size-4 ${
                      isActive ? stepConfig.color : isPast ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                    } ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className={`text-sm font-medium ${
                      isActive ? 'text-foreground' : isPast ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'
                    }`}>
                      {stepConfig.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stepConfig.description}
                    </p>
                  </div>
                  {isPast && (
                    <div className="text-green-600 dark:text-green-400">
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-6 border-t w-full">
          <p className="text-xs text-muted-foreground">
            You can safely leave this page. We'll notify you when processing is complete.
          </p>
        </div>
      </EmptyContent>
    </Empty>
  );
}
