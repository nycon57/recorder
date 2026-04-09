import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Files,
  Lock,
  RefreshCw,
  Settings,
} from 'lucide-react';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchKnowledgeHealth } from '@/lib/services/knowledge-health';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ScoreStyle {
  stroke: string;
  textClass: string;
}

function scoreStyle(score: number): ScoreStyle {
  if (score >= 80) return { stroke: 'rgb(0, 223, 130)', textClass: 'text-accent' };
  if (score >= 50) return { stroke: 'rgb(245, 158, 11)', textClass: 'text-amber-500' };
  return { stroke: 'rgb(239, 68, 68)', textClass: 'text-destructive' };
}

function CircularProgress({ score }: { score: number }) {
  const { stroke } = scoreStyle(score);
  const arc = (score / 100) * CIRCUMFERENCE;

  return (
    <svg
      viewBox="0 0 120 120"
      width={96}
      height={96}
      aria-label={`Health score: ${score} out of 100`}
      role="img"
    >
      {/* Background track */}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-muted-foreground/20"
      />
      {/* Progress arc — starts from 12 o'clock */}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${arc} ${CIRCUMFERENCE}`}
        transform="rotate(-90 60 60)"
      />
    </svg>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  heading: string;
  description: string;
  linkHref: string;
  linkIcon: React.ReactNode;
  linkLabel: string;
}

function EmptyState({ icon, heading, description, linkHref, linkIcon, linkLabel }: EmptyStateProps) {
  return (
    <Card className="card-interactive">
      <CardHeader>
        <CardTitle className="text-body-md">Knowledge Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 rounded-xl bg-muted/50 p-3">
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{heading}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>
            <Link
              href={linkHref}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {linkIcon}
              {linkLabel}
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MetricRowProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}

function MetricRow({ icon, label, value, href }: MetricRowProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="text-muted-foreground" aria-hidden="true">{icon}</span>
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value.toLocaleString()}</span>
    </Link>
  );
}

async function getInternalOrgId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) return null;

  const { data } = await supabaseAdmin
    .from('users')
    .select('org_id')
    .eq('clerk_id', session.user.id)
    .maybeSingle();

  return data?.org_id ?? null;
}

export async function KnowledgeHealthWidget() {
  const orgId = await getInternalOrgId();
  if (!orgId) return null;

  const data = await fetchKnowledgeHealth(orgId);

  if (!data.curatorEnabled) {
    return (
      <EmptyState
        icon={<Lock className="size-6 text-muted-foreground" aria-hidden="true" />}
        heading="Enable Knowledge Agents to see health metrics"
        description="Turn on the Knowledge Curator to track duplicates, stale content, and concept coverage."
        linkHref="/settings/organization/agents"
        linkIcon={<Settings className="size-3.5" aria-hidden="true" />}
        linkLabel="Go to Agent Settings"
      />
    );
  }

  if (!data.hasContent) {
    return (
      <EmptyState
        icon={<BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />}
        heading="Add content to see knowledge health metrics"
        description="Upload recordings, documents, or notes to start tracking your knowledge health."
        linkHref="/library"
        linkIcon={<Files className="size-3.5" aria-hidden="true" />}
        linkLabel="Go to Library"
      />
    );
  }

  const { healthScore } = data;
  const { textClass } = scoreStyle(healthScore);

  return (
    <Card className="card-interactive">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-body-md">Knowledge Health</CardTitle>
          <Link
            href="/agent-activity"
            className="text-body-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          {/* Circular progress indicator */}
          <div className="flex flex-shrink-0 flex-col items-center gap-1">
            <div className="relative">
              <CircularProgress score={healthScore} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-xl font-bold font-outfit ${textClass}`}>
                  {healthScore}
                </span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <span className="text-body-xs text-muted-foreground">Health Score</span>
          </div>

          {/* Metric list */}
          <div className="flex-1 min-w-0">
            <MetricRow
              icon={<Files className="size-3.5" />}
              label="Total items"
              value={data.totalItems}
              href="/library"
            />
            <MetricRow
              icon={<CalendarDays className="size-3.5" />}
              label="Added this week"
              value={data.itemsThisWeek}
              href="/library"
            />
            <MetricRow
              icon={<CalendarDays className="size-3.5" />}
              label="Added this month"
              value={data.itemsThisMonth}
              href="/library"
            />
            <MetricRow
              icon={<AlertTriangle className="size-3.5" />}
              label="Duplicate alerts"
              value={data.duplicateAlerts}
              href="/agent-activity?action=detect_duplicate"
            />
            <MetricRow
              icon={<RefreshCw className="size-3.5" />}
              label="Stale items"
              value={data.staleAlerts}
              href="/agent-activity?action=detect_stale"
            />
            <MetricRow
              icon={<BookOpen className="size-3.5" />}
              label="Unique concepts"
              value={data.uniqueConcepts}
              href="/knowledge"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
