'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Download } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Button } from '@/app/components/ui/button';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Badge } from '@/app/components/ui/badge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyticsData {
  period: string;
  totalQueries: number;
  uniqueUsers: number;
  avgLatencyMs: number;
  queriesByDay: { date: string; count: number }[];
  topQuestions: { question: string; count: number }[];
  topApps: { app: string; count: number }[];
  knowledgeGaps: { question: string; count: number }[];
}

type Period = '7d' | '30d' | '90d';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

// ---------------------------------------------------------------------------
// CSV export helper
// ---------------------------------------------------------------------------

function downloadCsv(data: AnalyticsData) {
  const sections: string[] = [];

  // Summary
  sections.push('Summary');
  sections.push(`Total Queries,${data.totalQueries}`);
  sections.push(`Unique Customers,${data.uniqueUsers}`);
  sections.push(`Avg Latency (ms),${data.avgLatencyMs}`);
  sections.push('');

  // Queries by day
  sections.push('Date,Queries');
  for (const row of data.queriesByDay) {
    sections.push(`${row.date},${row.count}`);
  }
  sections.push('');

  // Top questions
  sections.push('Question,Count');
  for (const row of data.topQuestions) {
    // Escape commas and quotes in questions
    const escaped = `"${row.question.replace(/"/g, '""')}"`;
    sections.push(`${escaped},${row.count}`);
  }
  sections.push('');

  // Top apps
  sections.push('App,Count');
  for (const row of data.topApps) {
    sections.push(`${row.app},${row.count}`);
  }
  sections.push('');

  // Knowledge gaps
  sections.push('Knowledge Gap Question,Count');
  for (const row of data.knowledgeGaps) {
    const escaped = `"${row.question.replace(/"/g, '""')}"`;
    sections.push(`${escaped},${row.count}`);
  }

  const blob = new Blob([sections.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vendor-analytics-${data.period}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnalyticsCharts() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendor/analytics?period=${period}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const formatXAxis = (value: string) => {
    try {
      return format(parseISO(value), 'MMM dd');
    } catch {
      return value;
    }
  };

  return (
    <div className="space-y-6">
      {/* Period selector + CSV export */}
      <div className="flex items-center justify-between">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">{PERIOD_LABELS['7d']}</SelectItem>
            <SelectItem value="30d">{PERIOD_LABELS['30d']}</SelectItem>
            <SelectItem value="90d">{PERIOD_LABELS['90d']}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv(data)}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Total Queries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.totalQueries.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {PERIOD_LABELS[period]}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Unique Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.uniqueUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Distinct organizations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.avgLatencyMs.toLocaleString()} ms
            </div>
            <p className="text-xs text-muted-foreground">
              Time to first byte
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Query volume chart */}
      <Card>
        <CardHeader>
          <CardTitle>Query Volume</CardTitle>
          <CardDescription>
            Daily query count for {PERIOD_LABELS[period].toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.queriesByDay.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No query data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.queriesByDay}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={formatXAxis}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  labelFormatter={(value) => formatXAxis(value as string)}
                  formatter={(value: number) => [
                    value.toLocaleString(),
                    'Queries',
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  name="Queries"
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top questions + Top apps side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top questions */}
        <Card>
          <CardHeader>
            <CardTitle>Top Questions</CardTitle>
            <CardDescription>
              Most frequently asked questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.topQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions recorded yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead className="w-20 text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topQuestions.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-xs truncate text-sm">
                        {row.question}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Top apps */}
        <Card>
          <CardHeader>
            <CardTitle>Top Apps</CardTitle>
            <CardDescription>
              Most queried applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.topApps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No app data recorded yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>App</TableHead>
                    <TableHead className="w-20 text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topApps.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">
                        {row.app}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {row.count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Knowledge gaps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Knowledge Gaps
            {data.knowledgeGaps.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {data.knowledgeGaps.length} gap{data.knowledgeGaps.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Questions where neither org nor vendor knowledge matched — consider
            adding documentation for these topics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.knowledgeGaps.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No knowledge gaps detected — great coverage!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead className="w-20 text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.knowledgeGaps.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="max-w-md truncate text-sm">
                      {row.question}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {row.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
