'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Zap, Activity, AlertCircle } from 'lucide-react';
import Link from 'next/link';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import { Skeleton } from '@/app/components/ui/skeleton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageData {
  planTier: string;
  creditLimit: number;
  summary: {
    totalCredits: number;
    totalTokens: number;
    actionCount: number;
  };
  byAgent: Array<{
    agentType: string;
    totalCredits: number;
    actionCount: number;
  }>;
  byDay: Array<{
    day: string;
    totalCredits: number;
    actionCount: number;
  }>;
  topContent: Array<{
    contentId: string;
    totalCredits: number;
    actionCount: number;
  }>;
  projectedCredits: number;
  projectedCostUsd: number;
  month: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  curator: 'Curator',
  gap_intelligence: 'Gap Intelligence',
  onboarding: 'Onboarding',
  digest: 'Digest',
  workflow_extraction: 'Workflow',
};

const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: 'Free',
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

function formatCredits(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatCost(usd: number): string {
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

function formatDay(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function UsageLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-[120px]" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-[80px] mb-1" />
              <Skeleton className="h-3 w-[150px]" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-[200px]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[220px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsagePage() {
  const { data, isLoading, error } = useQuery<UsageData>({
    queryKey: ['organization-usage'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/usage');
      if (!res.ok) throw new Error('Failed to load usage data');
      const json = await res.json();
      return json.data;
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return <UsageLoading />;

  if (error || !data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Failed to load usage data.</p>
        </CardContent>
      </Card>
    );
  }

  const { summary, byAgent, byDay, topContent, planTier, creditLimit, projectedCredits, projectedCostUsd, month } = data;
  const planName = PLAN_DISPLAY_NAMES[planTier] ?? planTier;
  const usagePercent = creditLimit > 0 ? Math.min(100, Math.round((summary.totalCredits / creditLimit) * 100)) : 0;
  const isFreePlan = planTier === 'free';

  // Recharts data: bar chart (by agent), line chart (by day)
  const agentChartData = byAgent.map((row) => ({
    name: AGENT_DISPLAY_NAMES[row.agentType] ?? row.agentType,
    credits: Math.round(row.totalCredits),
  }));

  const dayChartData = byDay.map((row) => ({
    day: formatDay(row.day),
    credits: Math.round(row.totalCredits),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">AI Credit Usage</h2>
        <p className="text-muted-foreground mt-1">
          Credit consumption for {month} on the{' '}
          <Badge variant="secondary" className="text-xs">{planName}</Badge>{' '}
          plan.
        </p>
      </div>

      {/* Free plan upgrade prompt */}
      {isFreePlan && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Agent features require a paid plan</p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to Starter or higher to enable AI agents.{' '}
                <Link href="/settings/billing" className="text-primary underline underline-offset-2">
                  View plans
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Credits used this month"
          value={formatCredits(summary.totalCredits)}
          description={creditLimit > 0 ? `of ${formatCredits(creditLimit)} limit` : 'Unlimited'}
          icon={Zap}
        />
        <StatCard
          title="Agent actions"
          value={summary.actionCount.toLocaleString()}
          description="Total actions this month"
          icon={Activity}
        />
        <StatCard
          title="Projected monthly usage"
          value={formatCredits(projectedCredits)}
          description={`≈ ${formatCost(projectedCostUsd)} at current rate`}
          icon={TrendingUp}
        />
      </div>

      {/* Plan limit progress */}
      {creditLimit > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Monthly limit</CardTitle>
            <CardDescription>
              {formatCredits(summary.totalCredits)} of {formatCredits(creditLimit)} credits used
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={usagePercent} className="h-2" aria-label="Credit usage progress" />
            <p className="text-xs text-muted-foreground mt-2">{usagePercent}% consumed</p>
          </CardContent>
        </Card>
      )}

      {/* Credits by agent (bar chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Credits by agent</CardTitle>
          <CardDescription>Consumption breakdown across agent types this month</CardDescription>
        </CardHeader>
        <CardContent>
          {agentChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} credits`, 'Credits']} />
                <Bar dataKey="credits" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No agent activity this month
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily trend (line chart) */}
      <Card>
        <CardHeader>
          <CardTitle>Daily credit trend</CardTitle>
          <CardDescription>Credits consumed per day this month</CardDescription>
        </CardHeader>
        <CardContent>
          {dayChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dayChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} credits`, 'Credits']} />
                <Line
                  type="monotone"
                  dataKey="credits"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">
              No daily activity this month
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top content by usage */}
      {topContent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top content by credit usage</CardTitle>
            <CardDescription>Content items that consumed the most credits this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topContent.map((item, idx) => (
                <div
                  key={item.contentId}
                  className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                    <span className="text-sm font-mono truncate text-muted-foreground">
                      {item.contentId}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="text-sm font-medium">{formatCredits(item.totalCredits)} credits</div>
                    <div className="text-xs text-muted-foreground">{item.actionCount} action{item.actionCount !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
