'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Maximize2 } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { WorkflowStep, WorkflowStatus, Database } from '@/lib/types/database';

type WorkflowRow = Database['public']['Tables']['workflows']['Row'];

export interface WorkflowViewerProps {
  workflowId: string;
  workflow?: WorkflowRow;
  supersededByContentId?: string | null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-muted/50 text-muted-foreground border-border/50',
  },
  published: {
    label: 'Published',
    className: 'bg-accent/20 text-accent border-accent/30',
  },
  outdated: {
    label: 'Outdated',
    className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted/30 text-muted-foreground border-border/50',
  },
};

export default function WorkflowViewer({
  workflowId,
  workflow: initialWorkflow,
  supersededByContentId: initialSupersededContentId,
}: WorkflowViewerProps) {
  const [workflow, setWorkflow] = useState<WorkflowRow | null>(
    initialWorkflow ?? null
  );
  const [loading, setLoading] = useState(!initialWorkflow);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [supersededContentId, setSupersededContentId] = useState<string | null>(
    initialSupersededContentId ?? null
  );

  useEffect(() => {
    if (initialWorkflow || !workflowId) return;

    let cancelled = false;

    async function fetchWorkflow() {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`);
        if (!response.ok) throw new Error('Failed to load workflow');
        const data = await response.json();
        if (!cancelled) {
          setWorkflow(data.workflow);
          setSupersededContentId(data.supersededByContentId ?? null);
        }
      } catch {
        if (!cancelled) setError('Failed to load workflow');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchWorkflow();
    return () => {
      cancelled = true;
    };
  }, [workflowId, initialWorkflow]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <span className="text-sm">Loading workflow...</span>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <span className="text-sm">{error ?? 'No workflow available'}</span>
      </div>
    );
  }

  const steps = workflow.steps as WorkflowStep[];
  const statusConfig = STATUS_CONFIG[workflow.status];
  const contentId = workflow.content_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="flex-1 min-w-0 truncate text-base font-medium text-foreground">
          {workflow.title}
        </h3>
        <Badge className={cn('shrink-0', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {workflow.status === 'outdated' && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            This workflow may be outdated. A newer version is available.
            {workflow.superseded_by && (
              <>
                {' '}
                <Link
                  href={`/library/${supersededContentId ?? contentId}`}
                  className="underline underline-offset-2 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  View the latest version
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      {steps.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No steps extracted yet.
        </p>
      ) : (
        <ol className="relative space-y-3">
          {steps.map((step, index) => {
            const isActive = activeStep === step.stepNumber;
            const isLast = index === steps.length - 1;

            return (
              <li key={step.stepNumber} className="relative flex gap-4">
                {/* Vertical connector line */}
                {!isLast && (
                  <div
                    className="absolute left-5 top-10 bottom-0 w-px bg-border/50"
                    aria-hidden="true"
                  />
                )}

                {/* Step number bubble — primary interactive element for keyboard/screen readers */}
                <button
                  type="button"
                  onClick={() => setActiveStep(isActive ? null : step.stepNumber)}
                  className={cn(
                    'relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-[border-color,background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none',
                    isActive
                      ? 'border-accent bg-accent/20 text-accent shadow-[0_0_12px_rgba(0,223,130,0.3)]'
                      : 'border-border/50 bg-card text-muted-foreground hover:border-accent/40 hover:text-accent'
                  )}
                  aria-label={`Step ${step.stepNumber}: ${step.title}`}
                  aria-pressed={isActive}
                >
                  {step.stepNumber}
                </button>

                {/* Step card — mouse-accessible click target, not a separate tab stop */}
                <div
                  className={cn(
                    'card-interactive flex-1 cursor-pointer rounded-xl border bg-card p-4 transition-[border-color,box-shadow] duration-200 motion-reduce:transition-none',
                    isActive && 'border-accent/30 shadow-[0_0_15px_rgba(0,223,130,0.12)]'
                  )}
                  onClick={() => setActiveStep(isActive ? null : step.stepNumber)}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <h4 className="min-w-0 flex-1 text-sm font-medium leading-snug text-foreground">
                      {step.title}
                    </h4>
                    {step.timestamp > 0 && (
                      <Link
                        href={`/library/${contentId}?t=${Math.round(step.timestamp)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex shrink-0 items-center gap-1 tabular-nums text-xs text-muted-foreground transition-colors hover:text-accent"
                        title={`Go to ${formatTimestamp(step.timestamp)} in the recording`}
                      >
                        <Clock className="size-3" aria-hidden="true" />
                        {formatTimestamp(step.timestamp)}
                      </Link>
                    )}
                  </div>

                  {step.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  )}

                  {step.screenshotPath && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedImage(step.screenshotPath);
                        }}
                        className="group relative block overflow-hidden rounded-lg border border-border/40 transition-colors duration-200 hover:border-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 motion-reduce:transition-none"
                        aria-label={`Expand screenshot for step ${step.stepNumber}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={step.screenshotPath}
                          alt={`Step ${step.stepNumber}: ${step.title}`}
                          className="block h-auto w-full max-w-[600px] object-contain"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-[background-color] duration-200 group-hover:bg-black/30 motion-reduce:transition-none">
                          <Maximize2
                            className="size-5 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </div>
                      </button>
                    </div>
                  )}

                  {step.uiElements && step.uiElements.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {step.uiElements.map((el, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {el}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Dialog
        open={!!expandedImage}
        onOpenChange={() => setExpandedImage(null)}
      >
        <DialogContent className="max-w-4xl border-border/50 p-2" showCloseButton>
          <DialogTitle className="sr-only">Screenshot preview</DialogTitle>
          {expandedImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={expandedImage}
              alt="Full-size screenshot"
              className="h-auto max-h-[80vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
