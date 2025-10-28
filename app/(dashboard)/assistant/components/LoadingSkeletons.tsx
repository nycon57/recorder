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

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Base Skeleton Component
 */
interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export function Skeleton({ className, animate = true }: SkeletonProps) {
  const baseClass = 'bg-muted dark:bg-muted/60 rounded animate-pulse';

  if (!animate) {
    return <div className={cn(baseClass, className)} />;
  }

  return (
    <motion.div
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

export function MessageSkeleton({
  isUser = false,
  showSources = false,
  showReasoning = false,
  className,
}: MessageSkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {/* Avatar */}
      {!isUser && (
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      )}

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
            isUser ? 'bg-primary/10 dark:bg-primary/20' : 'bg-muted dark:bg-muted/60'
          )}
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      )}
    </motion.div>
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
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-primary rounded-full"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
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
 */
interface ShimmerSkeletonProps {
  className?: string;
  lines?: number;
}

export function ShimmerSkeleton({
  className,
  lines = 3,
}: ShimmerSkeletonProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <motion.div
          key={i}
          className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted dark:from-muted/60 dark:via-muted/30 dark:to-muted/60 rounded overflow-hidden"
          style={{
            width: i === lines - 1 ? '60%' : '100%',
          }}
        >
          <motion.div
            className="h-full w-full bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent"
            animate={{
              x: ['-100%', '100%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

/**
 * Source Skeleton
 */
export function SourceSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-3 w-3" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <Skeleton className="h-3 w-3 mt-0.5" />
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
export function ToolCallSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3" />
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
export function InputSkeleton() {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-end gap-2">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="flex-1 h-12 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
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

export function PulseDot({ className, color = 'bg-primary' }: PulseDotProps) {
  return (
    <div className={cn('relative', className)}>
      <motion.div
        className={cn('w-2 h-2 rounded-full', color)}
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
      <motion.div
        className={cn('absolute inset-0 w-2 h-2 rounded-full', color)}
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
 */
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({
  size = 'md',
  className,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  return (
    <motion.div
      className={cn('border-2 border-primary dark:border-primary/80 border-t-transparent rounded-full', sizeClasses[size], className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

/**
 * Skeleton Grid - for multiple loading items
 */
interface SkeletonGridProps {
  count?: number;
  className?: string;
}

export function SkeletonGrid({ count = 3, className }: SkeletonGridProps) {
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
