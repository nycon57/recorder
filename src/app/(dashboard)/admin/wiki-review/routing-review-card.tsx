'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckIcon,
  ExternalLink,
  Loader2,
  PencilIcon,
  Route,
  XIcon,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { cn } from '@/lib/utils/cn';

import type { ReviewQueueRoutingItem } from './review-queue';

interface RoutingDecisionInput {
  pageId: string;
  topic: string;
  app: string | null;
  screen: string | null;
}

interface RoutingActionResult {
  ok: boolean;
  error?: string;
}

interface RoutingReviewCardProps {
  item: ReviewQueueRoutingItem;
  onApproveAsProposed?: (
    input: RoutingDecisionInput,
  ) => Promise<RoutingActionResult>;
  onEditAndApply?: (
    input: RoutingDecisionInput,
  ) => Promise<RoutingActionResult>;
  onReject?: (pageId: string) => Promise<RoutingActionResult>;
}

type ViewState =
  | { kind: 'idle' }
  | { kind: 'editing' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

interface RoutingDraft {
  topic: string;
  app: string;
  screen: string;
}

function normalizeOptionalInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function RoutingReviewCard(
  props: Parameters<typeof useRoutingReviewCardImplementation>[0],
) {
  return useRoutingReviewCardImplementation(props);
}

function useRoutingReviewCardImplementation({
  item,
  onApproveAsProposed,
  onEditAndApply,
  onReject,
}: RoutingReviewCardProps) {
  const [view, setView] = React.useState<ViewState>({ kind: 'idle' });
  const [draftOverride, setDraftOverride] = React.useState<RoutingDraft | null>(
    null,
  );
  const draft = draftOverride ?? {
    topic: item.topic,
    app: item.app ?? '',
    screen: item.screen ?? '',
  };

  const actionsReady = Boolean(
    onApproveAsProposed && onEditAndApply && onReject,
  );
  const isSubmitting = view.kind === 'submitting';
  const isEditing = view.kind === 'editing';
  const latestSourceLabel = formatTimestamp(item.latestSourceAt);

  const proposedDecision = React.useMemo<RoutingDecisionInput>(
    () => ({
      pageId: item.pageId,
      topic: item.topic,
      app: item.app,
      screen: item.screen,
    }),
    [item.app, item.pageId, item.screen, item.topic],
  );

  const editedDecision = React.useMemo<RoutingDecisionInput>(
    () => ({
      pageId: item.pageId,
      topic: draft.topic.trim(),
      app: normalizeOptionalInput(draft.app),
      screen: normalizeOptionalInput(draft.screen),
    }),
    [draft.app, draft.screen, draft.topic, item.pageId],
  );

  const handleApprove = async () => {
    if (!onApproveAsProposed) return;

    setView({ kind: 'submitting' });
    const result = await onApproveAsProposed(proposedDecision);
    if (!result.ok) {
      setView({
        kind: 'error',
        message: result.error ?? 'Failed to approve routing',
      });
      return;
    }
    setView({ kind: 'idle' });
  };

  const handleReject = async () => {
    if (!onReject) return;

    setView({ kind: 'submitting' });
    const result = await onReject(item.pageId);
    if (!result.ok) {
      setView({
        kind: 'error',
        message: result.error ?? 'Failed to reject routing',
      });
      return;
    }
    setView({ kind: 'idle' });
  };

  const handleSave = async () => {
    if (!onEditAndApply) return;
    if (!editedDecision.topic) {
      setView({ kind: 'error', message: 'Topic cannot be empty' });
      return;
    }

    setView({ kind: 'submitting' });
    const result = await onEditAndApply(editedDecision);
    if (!result.ok) {
      setView({
        kind: 'error',
        message: result.error ?? 'Failed to save routing',
      });
      return;
    }
    setView({ kind: 'idle' });
  };

  const resetDraft = () => {
    setDraftOverride({
      topic: item.topic,
      app: item.app ?? '',
      screen: item.screen ?? '',
    });
  };

  return (
    <Card data-testid="routing-review-card" className="border-sky-500/30">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{item.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Needs Routing</Badge>
              <Badge variant="outline">App: {item.app ?? 'Unassigned'}</Badge>
              <Badge variant="outline">
                Screen: {item.screen ?? 'Unassigned'}
              </Badge>
              <Badge variant="outline">
                {item.sourceCount} linked{' '}
                {item.sourceCount === 1 ? 'source' : 'sources'}
              </Badge>
            </div>
          </div>
          <Route className="mt-1 size-4 text-sky-600 dark:text-sky-400" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {!actionsReady ? (
          <Alert>
            <AlertTriangle className="size-4" />
            <AlertDescription>
              Routing apply actions will enable once the backend hooks land. The
              review surface is ready for approve, edit, and reject wiring.
            </AlertDescription>
          </Alert>
        ) : null}

        {view.kind === 'error' ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertDescription>{view.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-sky-500/20">
            <CardHeader>
              <CardTitle className="text-sm text-sky-700 dark:text-sky-400">
                Why this needs routing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{item.summary}</p>
              {item.latestSourceId ? (
                <div className="rounded border border-border/60 bg-muted/30 p-3 text-xs">
                  <div className="font-medium text-foreground">
                    Latest linked source
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    {item.latestSourceTitle?.trim() || item.latestSourceId}
                    {item.latestSourceType ? ` · ${item.latestSourceType}` : ''}
                    {latestSourceLabel ? ` · ${latestSourceLabel}` : ''}
                  </div>
                  <Link
                    href={`/library/${item.latestSourceId}`}
                    className="mt-2 inline-flex items-center gap-1 text-sky-700 underline underline-offset-4 dark:text-sky-300"
                  >
                    Open source detail
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No source detail is linked yet. Reviewers can still confirm
                  the route once the backend starts surfacing proposals here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-sm text-emerald-700 dark:text-emerald-400">
                Proposed routing
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!isEditing ? (
                <dl className="space-y-3 text-sm">
                  <div className="rounded border border-border/60 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Topic
                    </dt>
                    <dd className="mt-1">{item.topic || 'Unassigned'}</dd>
                  </div>
                  <div className="rounded border border-border/60 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      App
                    </dt>
                    <dd className="mt-1">{item.app || 'Unassigned'}</dd>
                  </div>
                  <div className="rounded border border-border/60 p-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Screen
                    </dt>
                    <dd className="mt-1">{item.screen || 'Unassigned'}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label
                      htmlFor={`routing-topic-${item.pageId}`}
                      className="text-sm font-medium"
                    >
                      Topic
                    </label>
                    <Input
                      id={`routing-topic-${item.pageId}`}
                      value={draft.topic}
                      onChange={(event) =>
                        setDraftOverride((current) => ({
                          ...(current ?? draft),
                          topic: event.target.value,
                        }))
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor={`routing-app-${item.pageId}`}
                      className="text-sm font-medium"
                    >
                      App
                    </label>
                    <Input
                      id={`routing-app-${item.pageId}`}
                      value={draft.app}
                      onChange={(event) =>
                        setDraftOverride((current) => ({
                          ...(current ?? draft),
                          app: event.target.value,
                        }))
                      }
                      placeholder="hubspot"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor={`routing-screen-${item.pageId}`}
                      className="text-sm font-medium"
                    >
                      Screen
                    </label>
                    <Input
                      id={`routing-screen-${item.pageId}`}
                      value={draft.screen}
                      onChange={(event) =>
                        setDraftOverride((current) => ({
                          ...(current ?? draft),
                          screen: event.target.value,
                        }))
                      }
                      placeholder="record-view"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className={cn('flex flex-wrap gap-2', isEditing && 'justify-end')}>
          {!isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={!actionsReady || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
                Approve as proposed
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  resetDraft();
                  setView({ kind: 'editing' });
                }}
                disabled={isSubmitting}
              >
                <PencilIcon className="size-4" />
                Edit &amp; Apply
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={!actionsReady || isSubmitting}
              >
                <XIcon className="size-4" />
                Reject routing
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetDraft();
                  setView({ kind: 'idle' });
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!actionsReady || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckIcon className="size-4" />
                )}
                Save &amp; Apply
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
