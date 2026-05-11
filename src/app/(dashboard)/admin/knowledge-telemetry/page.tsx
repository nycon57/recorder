'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  BarChart3,
  Clock3,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { useFetchWithInterval } from '@/app/hooks/useFetchWithAbort';
import type {
  KnowledgeTelemetryEvent,
  KnowledgeTelemetryEventType,
  KnowledgeTelemetrySince,
  KnowledgeTelemetrySummary,
} from '@/lib/services/knowledge-telemetry';

type KnowledgeTelemetryResponse = {
  filters: {
    since: KnowledgeTelemetrySince;
    limit: number;
    type: KnowledgeTelemetryEventType | 'all';
  };
  summary: KnowledgeTelemetrySummary;
  events: KnowledgeTelemetryEvent[];
};

const SINCE_OPTIONS: Array<{
  value: KnowledgeTelemetrySince;
  label: string;
}> = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

function formatRelativeTime(value: string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function readNumber(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === 'number' ? value : 0;
}

function readStringArray(
  payload: Record<string, unknown>,
  key: string,
): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function MetricCard(props: {
  title: string;
  value: number;
  description: string;
}) {
  const { title, value, description } = props;

  return (
    <Card>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EventCard({ event }: { event: KnowledgeTelemetryEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const query = readString(payload, 'query');
  const app = readString(payload, 'app');
  const screen = readString(payload, 'screen');
  const answerMode = readString(payload, 'answerMode');
  const knowledgeMode = readString(payload, 'knowledgeMode');
  const failureClass = readString(payload, 'failureClass') ?? 'none';
  const vendorRetrievalMode = readString(payload, 'vendorRetrievalMode') ?? 'none';
  const sourceLayers = readStringArray(payload, 'sourceLayers');
  const vendorSourceIds = readStringArray(payload, 'vendorSourceIds');
  const staleVendorCitationsCount = readNumber(payload, 'staleVendorCitationsCount');

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{event.type}</Badge>
            {answerMode ? <Badge variant="outline">{answerMode}</Badge> : null}
            {knowledgeMode ? <Badge variant="outline">{knowledgeMode}</Badge> : null}
            <Badge variant={failureClass === 'none' ? 'outline' : 'destructive'}>
              failure:{failureClass}
            </Badge>
            <Badge variant="outline">retrieval:{vendorRetrievalMode}</Badge>
            {staleVendorCitationsCount > 0 ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700">
                stale:{staleVendorCitationsCount}
              </Badge>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className="space-y-1">
          {query ? (
            <p className="text-sm font-medium">{query}</p>
          ) : app && screen ? (
            <p className="text-sm font-medium">
              {app} / {screen}
            </p>
          ) : (
            <p className="text-sm font-medium">Internal telemetry event</p>
          )}
          <p className="text-xs text-muted-foreground">
            {sourceLayers.length > 0
              ? `Layers: ${sourceLayers.join(', ')}`
              : 'No shared answer layers recorded'}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {vendorSourceIds.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Vendor sources
            </p>
            <p className="text-sm text-muted-foreground">
              {vendorSourceIds.join(', ')}
            </p>
          </div>
        ) : null}

        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
          <div>Org sources: {readNumber(payload, 'orgSourcesCount')}</div>
          <div>
            Vendor training: {readNumber(payload, 'vendorTrainingSourcesCount')}
          </div>
          <div>Vendor sources: {readNumber(payload, 'vendorSourcesCount')}</div>
          <div>Citations: {readNumber(payload, 'citationsCount')}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminKnowledgeTelemetryPage() {
  const [since, setSince] = useState<KnowledgeTelemetrySince>('24h');
  const { data, error, loading, refetch } = useFetchWithInterval<{
    data: KnowledgeTelemetryResponse;
  }>(`/api/admin/knowledge-telemetry?since=${since}&limit=100`, 60000);

  const response = data?.data ?? null;
  const summary = response?.summary ?? null;
  const events = response?.events ?? [];
  const inlineErrorMessage = error
    ? error.message.includes('403')
      ? 'Access denied. System admin privileges required.'
      : error.message
    : null;

  if (loading && !response) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading knowledge telemetry…
          </p>
        </div>
      </div>
    );
  }

  if (inlineErrorMessage && !response) {
    return (
      <div className="trbd-page">
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertDescription>{inlineErrorMessage}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!response || !summary) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Loading knowledge telemetry…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="trbd-page space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="trbd-page-title flex items-center gap-2">
            <BarChart3 className="size-7" />
            Knowledge Telemetry
          </h1>
          <p className="text-muted-foreground">
            Internal rollout visibility for shared vendor answer freshness,
            failure classes, and retrieval-mode mix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SINCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSince(option.value)}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                since === option.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted"
          >
            <RefreshCw className="size-4" />
            Refresh
          </button>
        </div>
      </div>

      {inlineErrorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{inlineErrorMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Events"
          value={summary.total}
          description="Recent internal knowledge telemetry events."
        />
        <MetricCard
          title="Routing Failures"
          value={summary.routingFailures}
          description="Chat or extension requests that failed to resolve cleanly."
        />
        <MetricCard
          title="Stale Answers"
          value={summary.sharedVendorStaleAnswers}
          description="Answers that included stale shared vendor citations."
        />
        <MetricCard
          title="No-Source Failures"
          value={summary.byFailureClass.no_sources}
          description="Requests that completed without shared answer evidence."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4" />
              Failure Classes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>None</span>
              <span>{summary.byFailureClass.none}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>No sources</span>
              <span>{summary.byFailureClass.no_sources}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Route errors</span>
              <span>{summary.byFailureClass.route_error}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Stale vendor answers</span>
              <span>{summary.byFailureClass.stale_vendor_answer}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4" />
              Retrieval Modes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>None</span>
              <span>{summary.byVendorRetrievalMode.none}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Exact</span>
              <span>{summary.byVendorRetrievalMode.exact}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Semantic</span>
              <span>{summary.byVendorRetrievalMode.semantic}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Hybrid</span>
              <span>{summary.byVendorRetrievalMode.hybrid}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers3 className="size-4" />
              Source Layer Use
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Org</span>
              <span>{summary.bySourceLayer.org}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vendor training</span>
              <span>{summary.bySourceLayer.vendor_training}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Vendor docs</span>
              <span>{summary.bySourceLayer.vendor}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Shared-Knowledge Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No telemetry events recorded for the selected time window yet.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
