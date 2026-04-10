'use client';

/**
 * WikiReviewCard — TRIB-34
 *
 * Client component for a single pending contradiction. Rendered inside the
 * server page for each flagged entry across every page in the review queue.
 *
 * State machine:
 *   - idle: Approve / Reject / Edit & Approve buttons visible.
 *   - editing: textarea + Save / Cancel buttons visible (admin is rewriting
 *     the page body from scratch).
 *   - submitting: buttons disabled, a small spinner runs.
 *   - error: inline alert with the server action's message.
 *
 * The component holds no data state — every mutation calls a server action
 * that mutates the DB and the router auto-refreshes via `revalidatePath`.
 */

import * as React from 'react';
import { CheckIcon, XIcon, PencilIcon, Loader2, AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

import {
  approveContradiction,
  editAndApproveContradiction,
  rejectContradiction,
} from './actions';

export interface WikiReviewCardProps {
  pageId: string;
  logEntryIndex: number;
  topic: string;
  app: string | null;
  screen: string | null;
  currentContent: string;
  detectedAt: string;
  sourceRecordingId: string;
  contradictions: Array<{ old: string; new: string; field?: string }>;
  additions?: string[];
  /** Optional: surfaces the full LLM merge when TRIB-32 persists it. */
  mergedContentPreview?: string | null;
}

const CONTENT_PREVIEW_LIMIT = 400;

type ViewState =
  | { kind: 'idle' }
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export function WikiReviewCard({
  pageId,
  logEntryIndex,
  topic,
  app,
  screen,
  currentContent,
  detectedAt,
  sourceRecordingId,
  contradictions,
  additions,
  mergedContentPreview,
}: WikiReviewCardProps) {
  const [view, setView] = React.useState<ViewState>({ kind: 'idle' });
  const [showFullContent, setShowFullContent] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState(currentContent);

  const isSubmitting = view.kind === 'submitting';
  const isEditing = view.kind === 'editing';

  const contentPreview = React.useMemo(() => {
    if (showFullContent || currentContent.length <= CONTENT_PREVIEW_LIMIT) {
      return currentContent;
    }
    return currentContent.slice(0, CONTENT_PREVIEW_LIMIT) + '…';
  }, [currentContent, showFullContent]);

  const detectedLabel = React.useMemo(() => {
    try {
      return new Date(detectedAt).toLocaleString();
    } catch {
      return detectedAt;
    }
  }, [detectedAt]);

  const handleApprove = async () => {
    setView({ kind: 'submitting' });
    const result = await approveContradiction({ pageId, logEntryIndex });
    if (!result.ok) {
      setView({ kind: 'error', message: result.error ?? 'Failed to approve' });
      return;
    }
    setView({ kind: 'idle' });
  };

  const handleReject = async () => {
    setView({ kind: 'submitting' });
    const result = await rejectContradiction({ pageId, logEntryIndex });
    if (!result.ok) {
      setView({ kind: 'error', message: result.error ?? 'Failed to reject' });
      return;
    }
    setView({ kind: 'idle' });
  };

  const handleEditSave = async () => {
    if (!editedContent.trim()) {
      setView({ kind: 'error', message: 'Edited content cannot be empty' });
      return;
    }
    setView({ kind: 'submitting' });
    const result = await editAndApproveContradiction({
      pageId,
      logEntryIndex,
      editedContent,
    });
    if (!result.ok) {
      setView({ kind: 'error', message: result.error ?? 'Failed to save' });
      return;
    }
    setView({ kind: 'idle' });
  };

  return (
    <Card data-testid="wiki-review-card" className="border-yellow-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{topic}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {app ? <Badge variant="outline">{app}</Badge> : null}
              {screen ? <Badge variant="outline">{screen}</Badge> : null}
              <span className="text-muted-foreground">Detected {detectedLabel}</span>
              <span className="text-muted-foreground">
                · Recording{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                  {sourceRecordingId.slice(0, 8)}
                </code>
              </span>
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-yellow-500/40 text-yellow-700 dark:text-yellow-400">
            {contradictions.length} conflict{contradictions.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {view.kind === 'error' && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{view.message}</AlertDescription>
          </Alert>
        )}

        {/* Side-by-side old vs proposed diff */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-red-500/20">
            <CardHeader>
              <CardTitle className="text-sm text-red-700 dark:text-red-400">
                Current content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {contentPreview}
              </pre>
              {currentContent.length > CONTENT_PREVIEW_LIMIT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowFullContent((prev) => !prev)}
                >
                  {showFullContent ? 'Show less' : 'Show full'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="text-sm text-green-700 dark:text-green-400">
                Proposed changes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mergedContentPreview ? (
                <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                  {mergedContentPreview}
                </pre>
              ) : (
                <div className="space-y-3">
                  {contradictions.map((c, i) => (
                    <div
                      key={`${pageId}-${logEntryIndex}-c-${i}`}
                      className="space-y-1 rounded border border-border/50 p-2"
                    >
                      {c.field && (
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          {c.field}
                        </div>
                      )}
                      <div className="text-xs">
                        <span className="font-medium text-red-700 dark:text-red-400">Old:</span>{' '}
                        <span className="text-muted-foreground line-through">{c.old}</span>
                      </div>
                      <div className="text-xs">
                        <span className="font-medium text-green-700 dark:text-green-400">New:</span>{' '}
                        <span>{c.new}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {additions && additions.length > 0 && (
                <div>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Additions
                  </div>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs">
                    {additions.map((a, i) => (
                      <li key={`${pageId}-${logEntryIndex}-a-${i}`}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit mode textarea */}
        {isEditing && (
          <div className="space-y-2">
            <label
              htmlFor={`edit-${pageId}-${logEntryIndex}`}
              className="text-sm font-medium"
            >
              Edited content
            </label>
            <Textarea
              id={`edit-${pageId}-${logEntryIndex}`}
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[240px] font-mono text-xs"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              Your edits replace the existing page content. The prior row is superseded
              and kept for audit.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className={cn('flex flex-wrap gap-2', isEditing && 'justify-end')}>
          {!isEditing ? (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditedContent(currentContent);
                  setView({ kind: 'editing' });
                }}
                disabled={isSubmitting}
              >
                <PencilIcon className="h-4 w-4" />
                Edit &amp; Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <XIcon className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView({ kind: 'idle' })}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleEditSave}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckIcon className="h-4 w-4" />
                )}
                Save &amp; Approve
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
