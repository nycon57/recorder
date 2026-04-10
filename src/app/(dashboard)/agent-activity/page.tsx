'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Filter,
  Hash,
  Loader2,
  Settings,
  Zap,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentActivityEntry {
  id: string;
  org_id: string;
  agent_type: string;
  action_type: string;
  content_id: string | null;
  content_title: string | null;
  target_entity: string | null;
  target_id: string | null;
  input_summary: string | null;
  output_summary: string | null;
  outcome: 'success' | 'failure' | 'skipped' | 'pending_approval';
  confidence: number | null;
  duration_ms: number | null;
  tokens_used: number | null;
  cost_estimate: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface ActivityStats {
  totalActions: number;
  successRate: number;
  mostActiveAgent: string | null;
  totalTokens: number;
}

interface ActivityResponse {
  data: {
    entries: AgentActivityEntry[];
    stats: ActivityStats;
    hasMore: boolean;
    filters: {
      agentTypes: string[];
      actionTypes: string[];
    };
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const AGENT_LABELS: Record<string, string> = {
  curator: 'Curator',
  gap_intelligence: 'Gap Intel',
  onboarding: 'Onboarding',
  digest: 'Digest',
  workflow_extraction: 'Workflow',
};

const AGENT_COLORS: Record<string, string> = {
  curator: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  gap_intelligence: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  onboarding: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  digest: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  workflow_extraction: 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-400',
};

const OUTCOME_STYLES: Record<string, string> = {
  success: 'bg-green-500/20 text-green-600 dark:text-green-400',
  failure: 'bg-red-500/20 text-red-600 dark:text-red-400',
  skipped: 'bg-gray-500/20 text-gray-500 dark:text-gray-400',
  pending_approval: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
};

const OUTCOME_LABELS: Record<string, string> = {
  success: 'Success',
  failure: 'Failure',
  skipped: 'Skipped',
  pending_approval: 'Pending',
};

function agentLabel(type: string): string {
  return AGENT_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (isToday) return time;

  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
}

const DATE_RANGE_DAYS: Record<string, number | undefined> = {
  today: 0,
  '7d': 7,
  '30d': 30,
};

function getStartDate(range: string): string | undefined {
  const days = DATE_RANGE_DAYS[range];
  if (days == null) return undefined;

  const start = new Date();
  if (days === 0) {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - days);
  }
  return start.toISOString();
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const ALL_VALUE = '__all__';

export default function AgentActivityPage() {
  // Data
  const [entries, setEntries] = useState<AgentActivityEntry[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [agentTypes, setAgentTypes] = useState<string[]>([]);
  const [actionTypes, setActionTypes] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [agentType, setAgentType] = useState('');
  const [actionType, setActionType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [dateRange, setDateRange] = useState('today');

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportStartDate, setExportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [exportEndDate, setExportEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Track entry count in a ref so handleLoadMore stays stable
  const entryCountRef = useRef(0);
  entryCountRef.current = entries.length;

  useEffect(() => {
    document.title = 'Agent Activity - Tribora';
  }, []);

  // Build fetch URL from filter state
  const fetchUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (agentType) params.set('agentType', agentType);
    if (actionType) params.set('actionType', actionType);
    if (outcome) params.set('outcome', outcome);
    const startDate = getStartDate(dateRange);
    if (startDate) params.set('startDate', startDate);
    const qs = params.toString();
    return `/api/agent-activity${qs ? `?${qs}` : ''}`;
  }, [agentType, actionType, outcome, dateRange]);

  // Fetch data on filter change
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setEntries([]);
    setExpandedId(null);

    fetch(fetchUrl, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ActivityResponse) => {
        setEntries(json.data.entries);
        setStats(json.data.stats);
        setHasMore(json.data.hasMore);
        setAgentTypes(json.data.filters.agentTypes);
        setActionTypes(json.data.filters.actionTypes);
        setLoading(false);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('[AgentActivity] Fetch error:', err);
          setError('Failed to load activity. Try refreshing the page.');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [fetchUrl]);

  // Load more handler (uses ref to avoid re-creating on every entries change)
  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    const sep = fetchUrl.includes('?') ? '&' : '?';
    const url = `${fetchUrl}${sep}offset=${entryCountRef.current}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const json: ActivityResponse = await res.json();
      setEntries(prev => [...prev, ...json.data.entries]);
      setHasMore(json.data.hasMore);
    } catch (err) {
      console.error('[AgentActivity] Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchUrl]);

  // Toggle row expansion
  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  // Trigger CSV/JSON export download
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ format: exportFormat });
      params.set('startDate', new Date(exportStartDate).toISOString());
      params.set('endDate', new Date(exportEndDate + 'T23:59:59').toISOString());
      if (agentType) params.set('agentType', agentType);
      if (actionType) params.set('actionType', actionType);

      const res = await fetch(`/api/organizations/agent-audit/export?${params}`);

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After') ?? '60';
        setExportError(`Export rate limit reached. Try again in ${retryAfter} seconds.`);
        return;
      }
      if (!res.ok) {
        setExportError('Export failed. Please try again.');
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('Content-Disposition') ?? '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `agent-audit.${exportFormat}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportOpen(false);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [exportFormat, exportStartDate, exportEndDate, agentType, actionType]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
          <Activity className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <h1 className="text-heading-3 font-outfit tracking-tight">Agent Activity</h1>
          <p className="text-sm text-muted-foreground">
            Chronological feed of agent actions in your organization
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setExportOpen(true); setExportError(null); }}
        >
          <Download className="h-4 w-4" />
          Export Audit Trail
        </Button>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Audit Trail</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="export-format">Format</label>
              <Select value={exportFormat} onValueChange={v => setExportFormat(v as 'csv' | 'json')}>
                <SelectTrigger id="export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="export-start">Start date</label>
              <input
                id="export-start"
                type="date"
                value={exportStartDate}
                onChange={e => setExportStartDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="export-end">End date</label>
              <input
                id="export-end"
                type="date"
                value={exportEndDate}
                onChange={e => setExportEndDate(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {exportError && (
              <p className="text-sm text-red-600 dark:text-red-400">{exportError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Actions"
          value={stats?.totalActions.toLocaleString() ?? '--'}
          icon={<Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          loading={loading}
        />
        <StatCard
          label="Success Rate"
          value={stats ? `${stats.successRate}%` : '--'}
          icon={<Zap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          loading={loading}
        />
        <StatCard
          label="Most Active Agent"
          value={stats?.mostActiveAgent ? agentLabel(stats.mostActiveAgent) : '--'}
          icon={<Cpu className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          loading={loading}
        />
        <StatCard
          label="Tokens Used"
          value={stats ? formatTokens(stats.totalTokens) : '--'}
          icon={<Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
          loading={loading}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />

        <Select value={agentType || ALL_VALUE} onValueChange={v => setAgentType(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Agent Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Agents</SelectItem>
            {agentTypes.map(t => (
              <SelectItem key={t} value={t}>{agentLabel(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionType || ALL_VALUE} onValueChange={v => setActionType(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Actions</SelectItem>
            {actionTypes.map(t => (
              <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={outcome || ALL_VALUE} onValueChange={v => setOutcome(v === ALL_VALUE ? '' : v)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Outcome" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All Outcomes</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
          </SelectContent>
        </Select>

        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[150px]">
            <Clock className="h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Activity Feed */}
      <div className="rounded-lg border border-border/50">
        {loading ? (
          <div className="divide-y divide-border/30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Activity className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">No agent activity yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Enable agents in Organization Settings to get started.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/organization/agents">
                <Settings className="h-4 w-4" />
                Agent Settings
              </Link>
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {entries.map(entry => (
              <ActivityRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => toggleExpand(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  loading: boolean;
}

function StatCard({ label, value, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-7 w-20 animate-pulse rounded bg-muted" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

interface ActivityRowProps {
  entry: AgentActivityEntry;
  expanded: boolean;
  onToggle: () => void;
}

const DEFAULT_BADGE_STYLE = 'bg-gray-500/20 text-gray-500';

function ActivityRow({ entry, expanded, onToggle }: ActivityRowProps) {
  const agentColor = AGENT_COLORS[entry.agent_type] || DEFAULT_BADGE_STYLE;
  const outcomeColor = OUTCOME_STYLES[entry.outcome] || DEFAULT_BADGE_STYLE;
  const outcomeLabel = OUTCOME_LABELS[entry.outcome] || entry.outcome;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent/5 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}

        <span className="w-20 shrink-0 text-muted-foreground tabular-nums">
          {formatTime(entry.created_at)}
        </span>

        <Badge className={`shrink-0 ${agentColor}`}>
          {agentLabel(entry.agent_type)}
        </Badge>

        <span className="text-muted-foreground" aria-hidden="true">&rarr;</span>

        <span className="font-medium truncate">
          {entry.action_type.replace(/_/g, ' ')}
        </span>

        {entry.content_title && (
          <>
            <span className="text-muted-foreground" aria-hidden="true">&rarr;</span>
            <span className="truncate text-muted-foreground">
              &ldquo;{entry.content_title}&rdquo;
            </span>
          </>
        )}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <Badge className={outcomeColor}>{outcomeLabel}</Badge>

          {entry.confidence != null && (
            <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
              {entry.confidence.toFixed(2)}
            </span>
          )}

          {entry.tokens_used != null && (
            <span className="hidden md:inline text-xs text-muted-foreground tabular-nums">
              {entry.tokens_used.toLocaleString()} tok
            </span>
          )}

          <span className="hidden lg:inline text-xs text-muted-foreground tabular-nums w-12 text-right">
            {formatDuration(entry.duration_ms)}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="bg-muted/30 px-4 py-3 ml-7 mr-4 mb-3 rounded-md text-sm space-y-2 border border-border/30">
          {entry.input_summary && (
            <DetailRow label="Input" value={entry.input_summary} />
          )}
          {entry.output_summary && (
            <DetailRow label="Output" value={entry.output_summary} />
          )}
          {entry.error_message && (
            <DetailRow label="Error" value={entry.error_message} className="text-red-500" />
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
            {entry.tokens_used != null && (
              <span>Tokens: {entry.tokens_used.toLocaleString()}</span>
            )}
            {entry.cost_estimate != null && (
              <span>Cost: ${entry.cost_estimate.toFixed(4)}</span>
            )}
            {entry.duration_ms != null && (
              <span>Duration: {formatDuration(entry.duration_ms)}</span>
            )}
            {entry.confidence != null && (
              <span>Confidence: {entry.confidence.toFixed(2)}</span>
            )}
          </div>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Metadata</span>
              <pre className="mt-1 text-xs bg-background/50 p-2 rounded overflow-x-auto max-h-40">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: string;
  className?: string;
}

function DetailRow({ label, value, className }: DetailRowProps) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <p className={className}>{value}</p>
    </div>
  );
}
