'use client';

import { useCallback, useReducer } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookOpen,
  Bot,
  FileText,
  Lightbulb,
  Minus,
  Search,
  TrendingUp,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import type { DigestEntry, WeeklyDigest } from '@/lib/utils/digest';

// ---------- Client-Only Types ----------

interface HistoryItem {
  id: string;
  createdAt: string;
  period: { start: string; end: string } | null;
}

interface DigestApiResponse {
  latest: DigestEntry | null;
  previous: DigestEntry | null;
  history: HistoryItem[] | null;
}

interface DigestDetailResponse {
  id: string;
  createdAt: string;
  digest: WeeklyDigest | null;
  previous: DigestEntry | null;
}

// ---------- Helpers ----------

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const baseOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  const withYear: Intl.DateTimeFormatOptions = { ...baseOpts, year: 'numeric' };

  const startOpts =
    startDate.getFullYear() !== endDate.getFullYear() ? withYear : baseOpts;
  return `${startDate.toLocaleDateString('en-US', startOpts)} - ${endDate.toLocaleDateString('en-US', withYear)}`;
}

function formatWeekLabel(createdAt: string): string {
  const date = new Date(createdAt);
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------- Sub-components ----------

interface ChangeIndicatorProps {
  current: number;
  previous: number | undefined;
}

function ChangeIndicator({ current, previous }: ChangeIndicatorProps) {
  if (previous === undefined) return null;
  const change = pctChange(current, previous);
  if (change === null) return null;

  let Icon = Minus;
  let colorClass = '';
  if (change > 0) {
    Icon = ArrowUp;
    colorClass = 'text-green-500';
  } else if (change < 0) {
    Icon = ArrowDown;
    colorClass = 'text-red-500';
  }

  const sign = change > 0 ? '+' : change < 0 ? '-' : '';
  const direction = change > 0 ? 'Up' : change < 0 ? 'Down' : 'No change';

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <span className="sr-only">{direction}</span>
      <Icon className={`size-3 ${colorClass}`} aria-hidden />
      <span className={colorClass}>
        {sign}
        {Math.abs(change)}%
      </span>{' '}
      vs last week
    </span>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  previous?: number;
}

function StatCard({ title, value, icon: Icon, previous }: StatCardProps) {
  return (
    <Card>
      <CardContent className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <ChangeIndicator current={value} previous={previous} />
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className="size-5 text-muted-foreground" aria-hidden />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getHealthLevel(score: number): {
  variant: 'default' | 'secondary' | 'destructive';
  label: string;
} {
  if (score >= 70) return { variant: 'default', label: 'Healthy' };
  if (score >= 40) return { variant: 'secondary', label: 'Moderate' };
  return { variant: 'destructive', label: 'Needs Attention' };
}

function HealthScoreBadge({ score }: { score: number }) {
  const { variant, label } = getHealthLevel(score);

  return (
    <Badge
      variant={variant}
      aria-label={`Health score: ${score} out of 100, ${label}`}
    >
      {score}/100 &middot; {label}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <BookOpen className="size-8 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-xl font-semibold mb-2">No digests yet</h2>
      <p className="text-muted-foreground max-w-md">
        Your first weekly digest will be generated next Monday. Enable the
        Knowledge Digest agent in Settings to get started.
      </p>
    </div>
  );
}

// ---------- Main Component ----------

type DigestState = {
  switching: boolean;
  selectedIdOverride: string | null;
  selectedDigestOverride: WeeklyDigest | null;
  selectedPreviousOverride: DigestEntry | null;
};

type DigestAction =
  | { type: 'select-start'; id: string }
  | {
      type: 'select-loaded';
      digest: WeeklyDigest;
      previous: DigestEntry | null;
    }
  | { type: 'select-latest' }
  | { type: 'select-error'; previousId: string | null };

const initialDigestState: DigestState = {
  switching: false,
  selectedIdOverride: null,
  selectedDigestOverride: null,
  selectedPreviousOverride: null,
};

function digestReducer(state: DigestState, action: DigestAction): DigestState {
  switch (action.type) {
    case 'select-start':
      return { ...state, selectedIdOverride: action.id, switching: true };
    case 'select-loaded':
      return {
        ...state,
        selectedDigestOverride: action.digest,
        selectedPreviousOverride: action.previous,
        switching: false,
      };
    case 'select-latest':
      return initialDigestState;
    case 'select-error':
      return {
        ...state,
        selectedIdOverride: action.previousId,
        switching: false,
      };
  }
}

export function DigestContent() {
  const [state, dispatch] = useReducer(digestReducer, initialDigestState);
  const {
    switching,
    selectedIdOverride,
    selectedDigestOverride,
    selectedPreviousOverride,
  } = state;
  const {
    data: digestData,
    isLoading: loading,
    error,
  } = useQuery<DigestApiResponse, Error>({
    queryKey: ['digest', 'history'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/digest?history=true', { signal });
      if (!res.ok) throw new Error('Failed to load digest data');
      const json = await res.json();
      return json.data as DigestApiResponse;
    },
  });
  const data = digestData ?? null;
  const selectedId = selectedIdOverride ?? data?.latest?.id ?? null;
  const selectedDigest = selectedDigestOverride ?? data?.latest?.digest ?? null;
  const selectedPrevious = selectedPreviousOverride ?? data?.previous ?? null;

  // Fetch a specific historical digest
  const handleSelectDigest = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      const previousId = selectedId;
      dispatch({ type: 'select-start', id });

      // If it's the latest, use cached data
      if (data?.latest && id === data.latest.id) {
        dispatch({ type: 'select-latest' });
        return;
      }

      try {
        const res = await fetch(`/api/digest/${id}`);
        if (!res.ok) throw new Error('Failed to fetch digest');
        const json = await res.json();
        const detail = json.data as DigestDetailResponse;
        if (!detail.digest) {
          throw new Error('Digest response did not include digest data');
        }
        dispatch({
          type: 'select-loaded',
          digest: detail.digest,
          previous: detail.previous,
        });
      } catch (err) {
        console.error('Failed to load digest:', err);
        // Revert to previous selection so the UI stays consistent
        dispatch({ type: 'select-error', previousId });
      }
    },
    [data, selectedId],
  );

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading digest">
        <h1 className="text-2xl font-semibold">Weekly Digest</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="px-6 py-4">
                <div className="h-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="h-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Weekly Digest</h1>
        <Card role="alert">
          <CardContent className="flex items-center gap-3 px-6 py-8">
            <AlertCircle
              className="size-5 text-destructive shrink-0"
              aria-hidden
            />
            <p className="text-muted-foreground">
              Unable to load digest. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.latest || !selectedDigest) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Weekly Digest</h1>
        <EmptyState />
      </div>
    );
  }

  const prevStats = selectedPrevious?.digest?.stats;

  return (
    <div className="space-y-6" aria-live="polite" aria-busy={switching}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Weekly Digest</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(
              selectedDigest.period.start,
              selectedDigest.period.end,
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HealthScoreBadge score={selectedDigest.stats.healthScore} />
          {data.history && data.history.length > 1 && (
            <Select value={selectedId ?? ''} onValueChange={handleSelectDigest}>
              <SelectTrigger
                className="w-[220px]"
                aria-label="Select digest week"
              >
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {data.history.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {formatWeekLabel(item.createdAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Digest content -- fades while switching between weeks */}
      <div
        className={`space-y-6 transition-opacity ${switching ? 'opacity-50' : ''}`}
      >
        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="size-5" aria-hidden />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">
              {selectedDigest.summary}
            </p>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Content added"
            value={selectedDigest.stats.contentAdded}
            icon={FileText}
            previous={prevStats?.contentAdded}
          />
          <StatCard
            title="Concepts extracted"
            value={selectedDigest.stats.conceptsExtracted}
            icon={TrendingUp}
            previous={prevStats?.conceptsExtracted}
          />
          <StatCard
            title="Searches"
            value={selectedDigest.stats.searches}
            icon={Search}
            previous={prevStats?.searches}
          />
          <StatCard
            title="Agent actions"
            value={selectedDigest.stats.agentActionsTotal}
            icon={Bot}
            previous={prevStats?.agentActionsTotal}
          />
        </div>

        {/* Highlights */}
        {selectedDigest.highlights.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5" aria-hidden />
                Highlights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {selectedDigest.highlights.map((highlight, i) => (
                  <li
                    key={JSON.stringify(highlight)}
                    className="flex items-start gap-2"
                  >
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{highlight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Knowledge Gaps */}
        {selectedDigest.gaps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="size-5" aria-hidden />
                Knowledge Gaps
              </CardTitle>
              <CardDescription>
                Topics that need more documentation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {selectedDigest.gaps.map((gap, i) => (
                  <Badge key={JSON.stringify(gap)} variant="outline">
                    {gap}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="size-5" aria-hidden />
              Agent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ['Total actions', selectedDigest.stats.agentActionsTotal],
                  ['Success rate', `${selectedDigest.stats.agentSuccessRate}%`],
                  [
                    'Duplicates found',
                    selectedDigest.stats.curatorDuplicatesFound,
                  ],
                  [
                    'Stale items detected',
                    selectedDigest.stats.curatorStaleDetected,
                  ],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="space-y-1">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-lg font-semibold tabular-nums">{val}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* end switching wrapper */}
    </div>
  );
}
