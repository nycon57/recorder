import Link from 'next/link';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/auth';
import {
  Bot,
  Brain,
  GitBranch,
  Newspaper,
  Settings,
  Sparkles,
  UserCheck,
} from 'lucide-react';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { fetchAgentStatusSummary } from '@/lib/services/agent-status';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';

// ---------------------------------------------------------------------------
// Agent icon mapping
// ---------------------------------------------------------------------------

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  curator: Sparkles,
  gap_intelligence: Brain,
  onboarding: UserCheck,
  digest: Newspaper,
  workflow_extraction: GitBranch,
};

function AgentTypeIcon({
  agentType,
  className,
}: {
  agentType: string;
  className?: string;
}) {
  const Icon = AGENT_ICONS[agentType] ?? Bot;
  return <Icon className={className} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-body-sm text-muted-foreground">
      <span className="font-semibold text-foreground">{value}</span>{' '}
      {label}
    </span>
  );
}

const OUTCOME_STYLES: Record<string, { color: string; label: string }> = {
  success: { color: 'bg-accent', label: 'Last action succeeded' },
  failure: { color: 'bg-destructive', label: 'Last action failed' },
};

const DEFAULT_OUTCOME_STYLE = {
  color: 'bg-muted-foreground/30',
  label: 'No recent activity',
};

function OutcomeDot({ outcome }: { outcome: 'success' | 'failure' | null }) {
  const { color, label } = (outcome && OUTCOME_STYLES[outcome]) ?? DEFAULT_OUTCOME_STYLE;
  return (
    <span
      className={`inline-block size-2 rounded-full flex-shrink-0 ${color}`}
      aria-label={label}
    />
  );
}

// ---------------------------------------------------------------------------
// Stat display helpers
// ---------------------------------------------------------------------------

interface StatItem {
  value: string;
  label: string;
}

function StatBar({ items }: { items: StatItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item, i) => (
        <span key={item.label} className="contents">
          {i > 0 && (
            <span className="text-muted-foreground/40 select-none" aria-hidden="true">|</span>
          )}
          <StatChip value={item.value} label={item.label} />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function AgentStatusWidget() {
  const orgId = await getInternalOrgId();
  if (!orgId) return null;

  const data = await fetchAgentStatusSummary(orgId);

  if (data.enabledAgents.length === 0) {
    return (
      <Card className="card-interactive">
        <CardHeader>
          <CardTitle className="text-body-md">Agent Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 rounded-xl bg-muted/50 p-3">
              <Bot className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium">No AI agents enabled</p>
              <p className="mt-1 text-body-sm text-muted-foreground">
                Enable agents to automate knowledge curation, gap detection, and more.
              </p>
              <Link
                href="/settings/organization/agents"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                <Settings className="size-3.5" aria-hidden="true" />
                Enable AI Agents
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { enabledAgents, actionsToday, successRate, activeSessions } = data;

  const stats: StatItem[] = [
    { value: enabledAgents.length.toLocaleString(), label: 'agents active' },
    { value: actionsToday.toLocaleString(), label: 'actions today' },
    { value: successRate !== null ? `${successRate}%` : '\u2014', label: 'success rate' },
    { value: activeSessions.toLocaleString(), label: 'sessions running' },
  ];

  return (
    <Card className="card-interactive">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-body-md">Agent Status</CardTitle>
          <Link
            href="/agent-activity"
            className="text-body-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            View all &rarr;
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <StatBar items={stats} />

        <div
          className="flex flex-wrap gap-2"
          role="list"
          aria-label="Enabled agents"
        >
          {enabledAgents.map((agent) => (
            <div
              key={agent.type}
              role="listitem"
              className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1.5 text-body-sm"
            >
              <AgentTypeIcon
                agentType={agent.type}
                className="size-3.5 text-muted-foreground"
              />
              <span>{agent.name}</span>
              <OutcomeDot outcome={agent.lastOutcome} />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
