'use client';

import * as React from 'react';
import Link from 'next/link';

import {
  AlertTriangle,
  CheckIcon,
  ExternalLink,
  Loader2,
  Route,
  XIcon,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import type { ReviewQueueRoutingApprovalItem } from '@/lib/services/review-queue';

import { approveRoutingReview, rejectRoutingReview } from './actions';

type ViewState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export function RoutingReviewCard({
  item,
}: {
  item: ReviewQueueRoutingApprovalItem;
}) {
  const [view, setView] = React.useState<ViewState>({ kind: 'idle' });
  const [topic, setTopic] = React.useState(item.topic);
  const [app, setApp] = React.useState(item.app ?? '');
  const [screen, setScreen] = React.useState(item.screen ?? '');

  const isSubmitting = view.kind === 'submitting';
  const confidenceLabel =
    typeof item.routeConfidence === 'number'
      ? `${Math.round(item.routeConfidence * 100)}% confidence`
      : null;

  const handleApprove = async () => {
    setView({ kind: 'submitting' });
    const result = await approveRoutingReview({
      approvalId: item.approvalId,
      contentId: item.contentId,
      topic,
      app,
      screen,
    });

    if (!result.ok) {
      setView({
        kind: 'error',
        message: result.error ?? 'Failed to approve routing review',
      });
      return;
    }

    setView({ kind: 'idle' });
  };

  const handleReject = async () => {
    setView({ kind: 'submitting' });
    const result = await rejectRoutingReview({
      approvalId: item.approvalId,
      contentId: item.contentId,
    });

    if (!result.ok) {
      setView({
        kind: 'error',
        message: result.error ?? 'Failed to reject routing review',
      });
      return;
    }

    setView({ kind: 'idle' });
  };

  return (
    <Card className="border-amber-500/30">
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <CardTitle className="text-lg">{item.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Needs Routing</Badge>
              {confidenceLabel ? (
                <Badge variant="outline">{confidenceLabel}</Badge>
              ) : null}
              <span>Topic: {item.topic}</span>
              <span>·</span>
              <span>Source review required before publish</span>
            </div>
          </div>

          <Button asChild variant="outline" size="sm">
            <Link href={item.primaryAction.href}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open source
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">App: {item.app ?? 'Unassigned'}</Badge>
          <Badge variant="outline">Screen: {item.screen ?? 'Unassigned'}</Badge>
          <Badge variant="outline">1 linked source</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {view.kind === 'error' ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{view.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
          {item.routeReason ?? item.summary}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`routing-topic-${item.approvalId}`}>Topic</Label>
            <Input
              id={`routing-topic-${item.approvalId}`}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              disabled={isSubmitting}
              placeholder="lead-routing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`routing-app-${item.approvalId}`}>App</Label>
            <Input
              id={`routing-app-${item.approvalId}`}
              value={app}
              onChange={(event) => setApp(event.target.value)}
              disabled={isSubmitting}
              placeholder="hubspot"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`routing-screen-${item.approvalId}`}>Screen</Label>
            <Input
              id={`routing-screen-${item.approvalId}`}
              value={screen}
              onChange={(event) => setScreen(event.target.value)}
              disabled={isSubmitting}
              placeholder="deal-record"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleApprove} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Route className="h-4 w-4" />
            )}
            <span className="ml-2">Approve &amp; Queue Recompile</span>
          </Button>
          <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XIcon className="h-4 w-4" />
            )}
            <span className="ml-2">Reject</span>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={item.primaryAction.href}>
              <CheckIcon className="mr-2 h-4 w-4" />
              Review source before deciding
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
