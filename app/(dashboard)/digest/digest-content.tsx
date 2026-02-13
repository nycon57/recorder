'use client';

import { useCallback, useEffect, useState } from 'react';
import {
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

// ---------- Types ----------

interface DigestStats {
  contentAdded: number;
  conceptsExtracted: number;
  healthScore: number;
  searches: number;
  failedSearches: number;
  curatorDuplicatesFound: number;
  curatorStaleDetected: number;
  agentActionsTotal: number;
  agentSuccessRate: number;
}

interface WeeklyDigest {
  period: { start: string; end: string };
  summary: string;
  stats: DigestStats;
  highlights: string[];
  gaps: string[];
}

interface DigestEntry {
  id: string;
  createdAt: string;
  digest: WeeklyDigest | null;
}

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
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  const yearOpts: Intl.DateTimeFormatOptions = { ...opts, year: 'numeric' };
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', yearOpts)} - ${e.toLocaleDateString('en-US', yearOpts)}`;
  }
  return `${s.toLocaleDateString('en-US', opts)} - ${e.toLocaleDateString('en-US', yearOpts)}`;
}

function formatWeekLabel(createdAt: string): string {
  const d = new Date(createdAt);
  return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------- Sub-components ----------

function ChangeIndicator({
  current,
  previous,
}: {
  current: number;
  previous: number | undefined;
}) {
  if (previous === undefined) return null;
  const change = pctChange(current, previous);
  if (change === null) return null;

  let Icon = Minus;
  let color = '';
  let display = '0';

  if (change > 0) {
    Icon = ArrowUp;
    color = 'text-green-500';
    display = String(change);
  } else if (change < 0) {
    Icon = ArrowDown;
    color = 'text-red-500';
    display = String(Math.abs(change));
  }

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className={`h-3 w-3 ${color}`} aria-hidden />
      <span className={color}>{display}%</span> vs last week
    </span>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  suffix,
  current,
  previous,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  suffix?: string;
  current?: number;
  previous?: number;
}) {
  return (
    <Card>
      <CardContent className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">
              {value}
              {suffix && (
                <span className="text-sm font-normal text-muted-foreground">
                  {suffix}
                </span>
              )}
            </p>
            {current !== undefined && (
              <ChangeIndicator
                current={current}
                previous={previous}
              />
            )}
          </div>
          <div className="rounded-lg bg-muted p-2">
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
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
    <Badge variant={variant}>
      {score}/100 &middot; {label}
    </Badge>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <BookOpen className="h-8 w-8 text-muted-foreground" aria-hidden />
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

export function DigestContent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DigestApiResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDigest, setSelectedDigest] = useState<WeeklyDigest | null>(
    null
  );
  const [selectedPrevious, setSelectedPrevious] = useState<DigestEntry | null>(
    null
  );

  // Fetch initial data (latest + history)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/digest?history=true');
        if (!res.ok) throw new Error('Failed to fetch digest');
        const json = await res.json();
        const payload = json.data as DigestApiResponse;
        if (cancelled) return;
        setData(payload);
        if (payload.latest) {
          setSelectedId(payload.latest.id);
          setSelectedDigest(payload.latest.digest);
          setSelectedPrevious(payload.previous);
        }
      } catch (err) {
        console.error('Failed to load digest:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch a specific historical digest
  const handleSelectDigest = useCallback(
    async (id: string) => {
      if (id === selectedId) return;
      setSelectedId(id);

      // If it's the latest, use cached data
      if (data?.latest && id === data.latest.id) {
        setSelectedDigest(data.latest.digest);
        setSelectedPrevious(data.previous);
        return;
      }

      try {
        const res = await fetch(`/api/digest/${id}`);
        if (!res.ok) throw new Error('Failed to fetch digest');
        const json = await res.json();
        const detail = json.data as DigestDetailResponse;
        setSelectedDigest(detail.digest);
        setSelectedPrevious(detail.previous);
      } catch (err) {
        console.error('Failed to load digest:', err);
      }
    },
    [selectedId, data]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
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
          <CardContent className="px-6 py-6">
            <div className="h-24 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data?.latest || !selectedDigest) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Weekly Digest</h1>
        <EmptyState />
      </div>
    );
  }

  const digest = selectedDigest;
  const prev = selectedPrevious?.digest ?? undefined;
  const history = data.history;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Weekly Digest</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(digest.period.start, digest.period.end)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <HealthScoreBadge score={digest.stats.healthScore} />
          {history && history.length > 1 && (
            <Select value={selectedId ?? ''} onValueChange={handleSelectDigest}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {history.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {formatWeekLabel(item.createdAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" aria-hidden />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {digest.summary}
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Content added"
          value={digest.stats.contentAdded}
          icon={FileText}
          current={digest.stats.contentAdded}
          previous={prev?.stats.contentAdded}
        />
        <StatCard
          title="Concepts extracted"
          value={digest.stats.conceptsExtracted}
          icon={TrendingUp}
          current={digest.stats.conceptsExtracted}
          previous={prev?.stats.conceptsExtracted}
        />
        <StatCard
          title="Searches"
          value={digest.stats.searches}
          icon={Search}
          current={digest.stats.searches}
          previous={prev?.stats.searches}
        />
        <StatCard
          title="Agent actions"
          value={digest.stats.agentActionsTotal}
          icon={Bot}
          current={digest.stats.agentActionsTotal}
          previous={prev?.stats.agentActionsTotal}
        />
      </div>

      {/* Highlights */}
      {digest.highlights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" aria-hidden />
              Highlights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {digest.highlights.map((highlight, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="text-muted-foreground">{highlight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Gaps */}
      {digest.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" aria-hidden />
              Knowledge Gaps
            </CardTitle>
            <CardDescription>
              Topics that need more documentation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {digest.gaps.map((gap, i) => (
                <Badge key={i} variant="outline">
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
            <Bot className="h-5 w-5" aria-hidden />
            Agent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total actions</p>
              <p className="text-lg font-semibold">
                {digest.stats.agentActionsTotal}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Success rate</p>
              <p className="text-lg font-semibold">
                {digest.stats.agentSuccessRate}%
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Duplicates found</p>
              <p className="text-lg font-semibold">
                {digest.stats.curatorDuplicatesFound}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Stale items detected</p>
              <p className="text-lg font-semibold">
                {digest.stats.curatorStaleDetected}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
