import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowLeft,
  AudioLines,
  Bot,
  Globe,
  Mic,
  User,
  Wrench,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  getExtensionDebugSessionTimeline,
  type ExtensionDebugSessionEvent,
  type ExtensionDebugSessionStatus,
} from '@/lib/services/extension-debug-sessions';
import { requireAdmin } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function statusVariant(status: ExtensionDebugSessionStatus) {
  switch (status) {
    case 'failed':
      return 'destructive';
    case 'completed':
      return 'secondary';
    case 'active':
    default:
      return 'outline';
  }
}

function eventLabel(event: ExtensionDebugSessionEvent): string {
  switch (event.eventType) {
    case 'session_start_requested':
      return 'Session start requested';
    case 'session_started':
      return 'Session connected';
    case 'session_ended':
      return 'Session ended';
    case 'session_error':
      return 'Session error';
    case 'mic_permission_opened':
      return 'Mic permission opened';
    case 'mic_permission_granted':
      return 'Mic permission granted';
    case 'mic_permission_denied':
      return 'Mic permission denied';
    case 'mic_permission_resumed':
      return 'Mic permission resumed';
    case 'page_context_checked':
      return 'Page context checked';
    case 'contextual_update_sent':
      return 'Context pushed';
    case 'user_message':
      return 'User said';
    case 'assistant_message':
      return 'Assistant replied';
    case 'tool_call_started':
      return 'Tool started';
    case 'tool_call_completed':
      return 'Tool completed';
    default:
      return event.eventType;
  }
}

function eventIcon(event: ExtensionDebugSessionEvent) {
  switch (event.eventType) {
    case 'user_message':
      return <User className="h-4 w-4" />;
    case 'assistant_message':
      return <Bot className="h-4 w-4" />;
    case 'tool_call_started':
    case 'tool_call_completed':
      return <Wrench className="h-4 w-4" />;
    case 'contextual_update_sent':
      return <AudioLines className="h-4 w-4" />;
    case 'mic_permission_opened':
    case 'mic_permission_granted':
    case 'mic_permission_denied':
    case 'mic_permission_resumed':
      return <Mic className="h-4 w-4" />;
    default:
      return <AudioLines className="h-4 w-4" />;
  }
}

function EventCard({ event }: { event: ExtensionDebugSessionEvent }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          {eventIcon(event)}
          {eventLabel(event)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatTimestamp(event.occurredAt)}
        </div>
      </div>

      {event.messageText && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {event.messageText}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {event.toolName && (
          <Badge variant="outline">tool: {event.toolName}</Badge>
        )}
        {event.selector && (
          <Badge variant="outline" className="max-w-full truncate">
            {event.selector}
          </Badge>
        )}
        {event.label && <Badge variant="outline">label: {event.label}</Badge>}
        {event.action && (
          <Badge variant="outline">action: {event.action}</Badge>
        )}
        {event.app && <Badge variant="outline">{event.app}</Badge>}
        {event.screen && <Badge variant="outline">{event.screen}</Badge>}
      </div>

      {(event.resultText || event.error || event.pageSummary) && (
        <div className="mt-3 space-y-2 text-sm">
          {event.resultText && (
            <div>
              <span className="font-medium">Result:</span> {event.resultText}
            </div>
          )}
          {event.error && (
            <div className="text-destructive">
              <span className="font-medium">Error:</span> {event.error}
            </div>
          )}
          {event.pageSummary && (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">Page:</span>{' '}
              {event.pageSummary}
            </div>
          )}
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Raw event payload
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs">
          {JSON.stringify(event, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export default async function ExtensionSessionDetailPage({
  params,
}: PageProps) {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const { sessionId } = await params;
  const timeline = await getExtensionDebugSessionTimeline({
    orgId,
    sessionId,
  });

  if (!timeline || !timeline.summary) {
    notFound();
  }

  const { summary } = timeline;

  return (
    <div className="trbd-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
            <Link href="/admin/debug/extension-sessions">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sessions
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 trbd-page-title tracking-tight">
            <AudioLines className="h-7 w-7" />
            Session {summary.id}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {summary.app}:{summary.screen} on {summary.host}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/api/admin/debug/extension-sessions/${encodeURIComponent(summary.id)}/review`}
            >
              Review JSON
            </Link>
          </Button>
          <Badge variant={statusVariant(summary.status)} className="text-sm">
            {summary.status}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Started</CardDescription>
            <CardTitle className="text-base font-normal leading-6">
              {formatTimestamp(summary.startedAt)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Turns</CardDescription>
            <CardTitle className="text-2xl">{summary.turnCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Tool Calls</CardDescription>
            <CardTitle className="text-2xl">{summary.toolCallCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Errors</CardDescription>
            <CardTitle className="text-2xl">{summary.errorCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
          <CardDescription>
            High-level metadata for this debug session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            {summary.host}
            <span>{summary.path}</span>
          </div>
          {summary.conversationId && (
            <div>
              <span className="font-medium">Conversation:</span>{' '}
              {summary.conversationId}
            </div>
          )}
          {summary.assistantPreview && (
            <div>
              <span className="font-medium">Latest assistant reply:</span>{' '}
              {summary.assistantPreview}
            </div>
          )}
          {summary.latestError && (
            <div className="text-destructive">
              <span className="font-medium">Latest error:</span>{' '}
              {summary.latestError}
            </div>
          )}
        </CardContent>
      </Card>

      {timeline.nonTurnEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Session Events</CardTitle>
            <CardDescription>
              Lifecycle, mic permission, and page-context events outside a
              specific user turn.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeline.nonTurnEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {timeline.turns.map((turn, index) => (
          <Card key={turn.id}>
            <CardHeader>
              <CardTitle>Turn {index + 1}</CardTitle>
              <CardDescription>
                {turn.userMessage?.messageText ?? 'No captured user utterance'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {turn.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
