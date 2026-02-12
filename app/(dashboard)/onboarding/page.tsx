'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Video,
  FileVideo,
  AudioLines,
  FileText,
  FileEdit,
  GraduationCap,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Progress } from '@/app/components/ui/progress';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Badge } from '@/app/components/ui/badge';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import type { ContentType, LearningPathItem } from '@/lib/types/database';
import { staggerContainer, staggerItem, fadeIn } from '@/lib/utils/animations';

/** Map content types to Lucide icons */
const CONTENT_ICONS: Record<ContentType, typeof Video> = {
  recording: Video,
  video: FileVideo,
  audio: AudioLines,
  document: FileText,
  text: FileEdit,
};

const CONTENT_COLORS: Record<ContentType, string> = {
  recording: 'text-purple-600 dark:text-purple-400',
  video: 'text-blue-600 dark:text-blue-400',
  audio: 'text-green-600 dark:text-green-400',
  document: 'text-orange-600 dark:text-orange-400',
  text: 'text-yellow-600 dark:text-yellow-400',
};

const CONTENT_LABELS: Record<ContentType, string> = {
  recording: 'Recording',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  text: 'Text',
};

interface OnboardingPlan {
  id: string;
  plan_status: string;
  learning_path: LearningPathItem[];
  total_items: number | null;
  completed_items: number | null;
  user_name: string | null;
  created_at: string;
}

export default function OnboardingPage() {
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());

  const fetchPlan = useCallback(async (signal: AbortSignal) => {
    try {
      setError(null);
      const response = await fetch('/api/onboarding/plan', { signal });
      if (!response.ok) {
        throw new Error('Failed to load onboarding plan');
      }
      const result = await response.json();
      if (!signal.aborted) {
        setPlan(result.data ?? null);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Error fetching onboarding plan:', err);
      if (!signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to load onboarding plan');
      }
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlan(controller.signal);
    return () => controller.abort();
  }, [fetchPlan]);

  const handleToggleComplete = useCallback(async (contentId: string, completed: boolean) => {
    if (!plan) return;

    setUpdatingItems((prev) => new Set(prev).add(contentId));

    // Optimistic update
    setPlan((prev) => {
      if (!prev) return prev;
      const updatedPath = prev.learning_path.map((item) =>
        item.contentId === contentId
          ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null }
          : item
      );
      const completedCount = updatedPath.filter((item) => item.completed).length;
      const total = prev.total_items ?? updatedPath.length;
      return {
        ...prev,
        learning_path: updatedPath,
        completed_items: completedCount,
        plan_status: completedCount >= total ? 'completed' : 'active',
      };
    });

    try {
      const response = await fetch('/api/onboarding/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentId, completed }),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }

      const result = await response.json();
      setPlan(result.data);
    } catch (err) {
      console.error('Error updating progress:', err);
      // Revert optimistic update on error
      const controller = new AbortController();
      fetchPlan(controller.signal);
    } finally {
      setUpdatingItems((prev) => {
        const next = new Set(prev);
        next.delete(contentId);
        return next;
      });
    }
  }, [plan, fetchPlan]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!plan) {
    return <EmptyState />;
  }

  const totalItems = plan.total_items ?? plan.learning_path.length;
  const completedItems = plan.completed_items ?? 0;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const sortedPath = [...plan.learning_path].sort((a, b) => a.order - b.order);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-heading-3 font-outfit tracking-tight flex items-center gap-3">
          <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
          Onboarding
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your personalized learning path to get up to speed
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {completedItems} of {totalItems} completed
          </span>
          <span className="text-muted-foreground">{progressPercent}%</span>
        </div>
        <Progress value={progressPercent} className="h-3" />
        {plan.plan_status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            All done! You have completed your onboarding plan.
          </div>
        )}
      </div>

      {/* Learning path checklist */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="space-y-2"
        role="list"
        aria-label="Learning path items"
      >
        <AnimatePresence>
          {sortedPath.map((item, index) => {
            const Icon = CONTENT_ICONS[item.contentType] ?? FileText;
            const colorClass = CONTENT_COLORS[item.contentType] ?? 'text-muted-foreground';
            const label = CONTENT_LABELS[item.contentType] ?? item.contentType;
            const isUpdating = updatingItems.has(item.contentId);

            return (
              <motion.div
                key={item.contentId}
                variants={staggerItem}
                role="listitem"
                className={`group relative flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/5 ${
                  item.completed ? 'bg-muted/30 border-muted' : 'border-border'
                }`}
              >
                {/* Checkbox */}
                <div className="pt-0.5">
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) =>
                      handleToggleComplete(item.contentId, checked === true)
                    }
                    disabled={isUpdating}
                    aria-label={`Mark "${item.title}" as ${item.completed ? 'incomplete' : 'complete'}`}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground font-mono">
                      {index + 1}.
                    </span>
                    <Link
                      href={`/library/${item.contentId}`}
                      className={`text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded ${
                        item.completed ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {item.title}
                    </Link>
                    <Badge variant="outline" className="text-xs gap-1 shrink-0">
                      <Icon className={`h-3 w-3 ${colorClass}`} aria-hidden="true" />
                      {label}
                    </Badge>
                    {item.estimatedMinutes > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {item.estimatedMinutes} min
                      </span>
                    )}
                  </div>

                  {item.reason && (
                    <p className={`text-xs leading-relaxed ${
                      item.completed ? 'text-muted-foreground/60' : 'text-muted-foreground'
                    }`}>
                      {item.reason}
                    </p>
                  )}
                </div>

                {/* Link to content */}
                <Link
                  href={`/library/${item.contentId}`}
                  className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`View ${item.title}`}
                  tabIndex={-1}
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

/** Empty state shown when no active onboarding plan exists */
function EmptyState() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="space-y-2 mb-8">
        <h1 className="text-heading-3 font-outfit tracking-tight flex items-center gap-3">
          <GraduationCap className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
          Onboarding
        </h1>
      </div>

      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="show"
      >
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="bg-primary/5 rounded-full p-6 mb-6">
            <GraduationCap className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-3">No onboarding plan yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Your onboarding plan has not been generated yet. Ask an admin or team lead to generate one for you.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
