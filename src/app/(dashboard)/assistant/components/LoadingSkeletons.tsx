/**
 * Loading Skeleton Components
 *
 * Beautiful skeleton loaders for various chat elements:
 * - Message skeleton
 * - Source skeleton
 * - Reasoning skeleton
 * - Tool call skeleton
 */

'use client';

import { m } from 'motion/react';

import { cn } from '@/lib/utils';
import { Loader } from '@/app/components/ai-elements/loader';
import { Shimmer } from '@/app/components/ai-elements/shimmer';

/**
 * Base Skeleton Component
 */
interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

function Skeleton({ className, animate = true }: SkeletonProps) {
  const baseClass = 'bg-muted dark:bg-muted/60 rounded';

  if (!animate) {
    return <div className={cn(baseClass, 'animate-pulse', className)} />;
  }

  return (
    <m.div
      className={cn(baseClass, className)}
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

/**
 * Message Skeleton
 */
interface MessageSkeletonProps {
  isUser?: boolean;
  showSources?: boolean;
  showReasoning?: boolean;
  className?: string;
}

function MessageSkeleton({
  isUser = false,
  showSources = false,
  showReasoning = false,
  className,
}: MessageSkeletonProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className,
      )}
    >
      {/* Avatar */}
      {!isUser && <Skeleton className="size-8 rounded-full shrink-0" />}

      {/* Content */}
      <div className="max-w-3xl space-y-2 flex-1">
        {/* Sources */}
        {showSources && (
          <div className="bg-muted/50 dark:bg-muted/30 rounded-lg p-3 border border-border dark:border-border/50 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        )}

        {/* Reasoning */}
        {showReasoning && (
          <div className="bg-accent/30 dark:bg-accent/20 rounded-lg p-3 border border-border dark:border-border/50 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={cn(
            'rounded-lg px-4 py-3 space-y-2',
            isUser
              ? 'bg-primary/10 dark:bg-primary/20'
              : 'bg-muted dark:bg-muted/60',
          )}
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>

      {/* User Avatar */}
      {isUser && <Skeleton className="size-8 rounded-full shrink-0" />}
    </m.div>
  );
}

/**
 * Typing Indicator Component
 */
interface TypingIndicatorProps {
  className?: string;
  text?: string;
}

export function TypingIndicator({
  className,
  text = 'AI is thinking',
}: TypingIndicatorProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex gap-1">
        {[
          { id: 'typing-dot-1', delay: 0 },
          { id: 'typing-dot-2', delay: 0.15 },
          { id: 'typing-dot-3', delay: 0.3 },
        ].map((dot) => (
          <m.div
            key={dot.id}
            className="size-2 bg-primary rounded-full"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: dot.delay,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  );
}

/**
 * Shimmer Effect Skeleton
 * Uses ai-elements Shimmer component for text shimmer effect
 */
interface ShimmerSkeletonProps {
  className?: string;
  lines?: number;
  duration?: number;
  spread?: number;
}

export function ShimmerSkeleton({
  className,
  lines = 3,
  duration = 2,
  spread = 2,
}: ShimmerSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 overflow-hidden"
          style={{
            width: i === lines - 1 ? '60%' : '100%',
          }}
        >
          <Shimmer duration={duration} spread={spread} className="block h-full">
            {'\u00A0'.repeat(50)}
          </Shimmer>
        </div>
      ))}
    </div>
  );
}

/**
 * Source Skeleton
 */
function SourceSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="size-3" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-2">
        {['source-line-1', 'source-line-2'].map((skeletonId) => (
          <div key={skeletonId} className="flex items-start gap-2">
            <Skeleton className="size-3 mt-0.5" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Tool Call Skeleton
 */
function ToolCallSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="bg-background p-2 rounded">
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </div>
  );
}

/**
 * Input Skeleton
 */
function InputSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-end gap-2">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="flex-1 h-12 rounded-lg" />
        <Skeleton className="size-10 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Pulse Dot - for active states
 */
interface PulseDotProps {
  className?: string;
  color?: string;
}

function PulseDot({ className, color = 'bg-primary' }: PulseDotProps) {
  return (
    <div className={cn('relative', className)}>
      <m.div
        className={cn('size-2 rounded-full', color)}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [1, 0.8, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <m.div
        className={cn('absolute inset-0 size-2 rounded-full', color)}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

/**
 * Loading Spinner
 * Uses ai-elements Loader component
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeValues = {
    sm: 16,
    md: 24,
    lg: 32,
  };

  return <Loader size={sizeValues[size]} className={className} />;
}

/**
 * Skeleton Grid - for multiple loading items
 */
interface SkeletonGridProps {
  count?: number;
  className?: string;
}

function SkeletonGrid({ count = 3, className }: SkeletonGridProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <MessageSkeleton
          key={i}
          isUser={i % 3 === 0}
          showSources={i % 2 === 0}
          showReasoning={i % 3 === 1}
        />
      ))}
    </div>
  );
}
