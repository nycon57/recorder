import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Activity, AudioLines, Bug, Filter, Globe, Wrench } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  listExtensionDebugSessions,
  parseExtensionDebugSessionFilters,
  type ExtensionDebugSessionStatus,
} from '@/lib/services/extension-debug-sessions';
import { requireAdmin } from '@/lib/utils/api';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Extension Session Debug | Tribora',
  description: 'Hidden internal view for extension voice-session debug traces',
};

type PageProps = {
  searchParams: Promise<{
    app?: string;
    host?: string;
    status?: string;
    q?: string;
    limit?: string;
    since?: string;
  }>;
};

const STATUS_OPTIONS: ExtensionDebugSessionStatus[] = [
  'active',
  'completed',
  'failed',
];

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
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

export default async function ExtensionSessionsDebugPage({
  searchParams,
}: PageProps) {
  let orgId: string;
  try {
    const ctx = await requireAdmin();
    orgId = ctx.orgId;
  } catch {
    redirect('/dashboard');
  }

  const filters = parseExtensionDebugSessionFilters(await searchParams);
  const { sessions, availableApps, availableHosts } =
    await listExtensionDebugSessions({
      orgId,
      filters,
    });

  const counts = sessions.reduce(
    (acc, session) => {
      acc[session.status] += 1;
      return acc;
    },
    {
      active: 0,
      completed: 0,
      failed: 0,
    },
  );

  return (
    <div className="trbd-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 trbd-page-title tracking-tight">
            <AudioLines className="h-7 w-7" />
            Extension Session Debug
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            Hidden internal view for full live-session traces, including
            transcripts, tool activity, mic permission flow, and page-context
            checks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/debug/extension-context">Context Checks</Link>
          </Button>
          <Badge variant="outline" className="text-sm">
            {sessions.length} sessions shown
          </Badge>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Sessions</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Activity className="h-5 w-5" />
              {sessions.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{counts.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl">{counts.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Bug className="h-5 w-5" />
              {counts.failed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>
            Narrow the recent debug sessions by app, host, status, and search
            text.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="GET" className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Search</label>
              <Input
                name="q"
                defaultValue={filters.query ?? ''}
                placeholder="message, error, host..."
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">App</label>
              <select
                name="app"
                defaultValue={filters.app ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All apps</option>
                {availableApps.map((app) => (
                  <option key={app} value={app}>
                    {app}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Host</label>
              <select
                name="host"
                defaultValue={filters.host ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All hosts</option>
                {availableHosts.map((host) => (
                  <option key={host} value={host}>
                    {host}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Status</label>
              <select
                name="status"
                defaultValue={filters.status ?? 'all'}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Since</label>
              <select
                name="since"
                defaultValue={filters.since}
                className="bg-background border-primary/40 focus-visible:border-accent/50 focus-visible:ring-accent/20 h-9 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
              >
                <option value="1h">Last hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Limit</label>
              <Input
                type="number"
                name="limit"
                min={10}
                max={200}
                defaultValue={String(filters.limit)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>
            Each session links to a full event timeline grouped by user turn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Turns</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead>Errors</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No debug sessions matched the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(session.startedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {session.app}:{session.screen}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" />
                        {session.host}
                        <span className="truncate">{session.path}</span>
                      </div>
                      {session.assistantPreview && (
                        <p className="mt-1 max-w-xl truncate text-sm text-muted-foreground">
                          {session.assistantPreview}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(session.status)}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{session.turnCount}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Wrench className="h-3.5 w-3.5" />
                        {session.toolCallCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      {session.errorCount > 0 ? (
                        <span className="text-destructive">
                          {session.errorCount}
                        </span>
                      ) : (
                        '0'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/api/admin/debug/extension-sessions/${encodeURIComponent(session.id)}/review`}
                          >
                            JSON
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/admin/debug/extension-sessions/${encodeURIComponent(session.id)}`}
                          >
                            Open
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
