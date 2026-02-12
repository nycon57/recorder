'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Pause,
  X,
} from 'lucide-react';

import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Switch } from '@/app/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import type { ApprovalStatus, PermissionTier } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface AgentTypeConfig {
  id: string;
  name: string;
  description: string;
  settingsKey: string;
  actions: { id: string; name: string; description: string }[];
}

const AGENT_TYPES: AgentTypeConfig[] = [
  {
    id: 'curator',
    name: 'Curator',
    description: 'Organizes and categorizes your knowledge base',
    settingsKey: 'curator_enabled',
    actions: [
      { id: 'extract_concepts', name: 'Extract Concepts', description: 'Identify key topics from content' },
      { id: 'generate_metadata', name: 'Generate Metadata', description: 'Create titles and summaries' },
      { id: 'suggest_tags', name: 'Suggest Tags', description: 'Recommend tags based on content' },
      { id: 'auto_apply_tags', name: 'Auto-Apply Tags', description: 'Apply suggested tags automatically' },
      { id: 'detect_duplicate', name: 'Detect Duplicates', description: 'Find duplicate content' },
      { id: 'detect_stale', name: 'Detect Stale Content', description: 'Flag outdated content' },
      { id: 'merge_content', name: 'Merge Content', description: 'Combine duplicate items' },
      { id: 'archive_content', name: 'Archive Content', description: 'Move stale content to archive' },
    ],
  },
  {
    id: 'gap_intelligence',
    name: 'Gap Intelligence',
    description: 'Identifies knowledge gaps and missing documentation',
    settingsKey: 'gap_intelligence_enabled',
    actions: [
      { id: 'detect_bus_factor', name: 'Detect Bus Factor', description: 'Find knowledge concentrated in few people' },
      { id: 'gap_alert', name: 'Gap Alerts', description: 'Notify about knowledge gaps' },
      { id: 'suggest_merge', name: 'Suggest Merge', description: 'Recommend merging related content' },
      { id: 'publish_external', name: 'Publish External', description: 'Share knowledge externally' },
    ],
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    description: 'Guides new team members through your knowledge base',
    settingsKey: 'onboarding_enabled',
    actions: [],
  },
  {
    id: 'digest',
    name: 'Digest',
    description: 'Creates periodic summaries of new and updated content',
    settingsKey: 'digest_enabled',
    actions: [],
  },
  {
    id: 'workflow_extraction',
    name: 'Workflow Extraction',
    description: 'Discovers and documents recurring processes',
    settingsKey: 'workflow_extraction_enabled',
    actions: [],
  },
];

const PERMISSION_TIERS: { value: PermissionTier; label: string; description: string }[] = [
  { value: 'auto', label: 'Auto', description: 'Agent acts immediately' },
  { value: 'notify', label: 'Notify', description: 'Agent acts and notifies you' },
  { value: 'approve', label: 'Approve', description: 'Agent requests your approval first' },
];

const DEFAULT_TIERS: Record<string, PermissionTier> = {
  extract_concepts: 'auto',
  generate_metadata: 'auto',
  detect_duplicate: 'auto',
  detect_stale: 'auto',
  suggest_tags: 'notify',
  suggest_merge: 'notify',
  detect_bus_factor: 'notify',
  gap_alert: 'notify',
  auto_apply_tags: 'approve',
  merge_content: 'approve',
  archive_content: 'approve',
  publish_external: 'approve',
};

const AGENT_NAMES: Record<string, string> = {
  curator: 'Curator',
  gap_intelligence: 'Gap Intelligence',
  onboarding: 'Onboarding',
  digest: 'Digest',
  workflow_extraction: 'Workflow Extraction',
};

const ACTION_NAMES: Record<string, string> = {
  auto_apply_tags: 'Auto-Apply Tags',
  merge_content: 'Merge Content',
  archive_content: 'Archive Content',
  publish_external: 'Publish External',
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  expired: { label: 'Expired', variant: 'secondary' },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentSettings {
  global_agent_enabled: boolean | null;
  [key: string]: unknown;
}

interface AgentPermissionRow {
  agent_type: string;
  action_type: string;
  permission_tier: PermissionTier;
}

interface ApprovalRow {
  id: string;
  org_id: string;
  agent_type: string;
  action_type: string;
  content_id: string | null;
  description: string;
  proposed_action: Record<string, unknown>;
  status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  expires_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentsSettingsPage() {
  const queryClient = useQueryClient();
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({
    curator: true,
  });
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // --- Queries ---

  const { data: settings, isLoading: settingsLoading } = useQuery<AgentSettings>({
    queryKey: ['agent-settings'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/agent-settings');
      if (!res.ok) throw new Error('Failed to load agent settings');
      const json = await res.json();
      return json.data;
    },
  });

  const { data: permissions, isLoading: permissionsLoading } = useQuery<AgentPermissionRow[]>({
    queryKey: ['agent-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/agent-permissions');
      if (!res.ok) throw new Error('Failed to load agent permissions');
      const json = await res.json();
      return json.data;
    },
  });

  const { data: approvals, isLoading: approvalsLoading } = useQuery<ApprovalRow[]>({
    queryKey: ['agent-approvals'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/agent-approvals');
      if (!res.ok) throw new Error('Failed to load approvals');
      const json = await res.json();
      return json.data;
    },
  });

  // --- Mutations ---

  const settingsMutation = useMutation({
    mutationFn: async (updates: Record<string, boolean>) => {
      const res = await fetch('/api/organizations/agent-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update setting');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      const field = Object.keys(variables)[0];
      if (field === 'global_agent_enabled') {
        toast.success(variables[field] ? 'All agents resumed' : 'All agents paused');
      } else {
        toast.success('Agent setting updated');
      }
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      toast.error(error.message);
    },
  });

  const permissionMutation = useMutation({
    mutationFn: async (payload: { agent_type: string; action_type: string; permission_tier: PermissionTier }) => {
      const res = await fetch('/api/organizations/agent-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update permission');
      }
      return res.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ['agent-permissions'] });
      const previous = queryClient.getQueryData<AgentPermissionRow[]>(['agent-permissions']);

      queryClient.setQueryData<AgentPermissionRow[]>(['agent-permissions'], (old) => {
        if (!old) return old;
        const idx = old.findIndex(
          (p) => p.agent_type === payload.agent_type && p.action_type === payload.action_type,
        );
        if (idx < 0) return old;
        const updated = [...old];
        updated[idx] = { ...updated[idx], permission_tier: payload.permission_tier };
        return updated;
      });

      return { previous };
    },
    onSuccess: () => {
      toast.success('Permission updated');
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['agent-permissions'], context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-permissions'] });
    },
  });

  const approvalMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'approved' | 'rejected'; rejection_reason?: string }) => {
      const res = await fetch(`/api/organizations/agent-approvals/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: payload.action, rejection_reason: payload.rejection_reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to review approval');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-approvals'] });
      toast.success(variables.action === 'approved' ? 'Action approved' : 'Action rejected');
      setRejectingId(null);
      setRejectionReason('');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // --- Loading state ---

  if (settingsLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status">
        <div className="text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  // --- Helpers ---

  const globalEnabled = settings?.global_agent_enabled ?? true;
  const pendingCount = approvals?.filter(a => a.status === 'pending').length ?? 0;

  function getPermissionTier(agentType: string, actionType: string): PermissionTier {
    const row = permissions?.find(
      (p) => p.agent_type === agentType && p.action_type === actionType,
    );
    return row?.permission_tier ?? DEFAULT_TIERS[actionType] ?? 'notify';
  }

  function isAgentEnabled(settingsKey: string): boolean {
    return (settings?.[settingsKey] as boolean | null) ?? false;
  }

  function toggleExpanded(agentId: string): void {
    setExpandedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  }

  function formatRelativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function formatExpiresIn(dateStr: string): string {
    const diff = new Date(dateStr).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  }

  // --- Render ---

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Agents</h2>
        <p className="text-muted-foreground mt-1">
          Control what AI agents do automatically, what they notify about, and what requires your approval.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-base font-medium">Enable all agents</CardTitle>
            <CardDescription>
              Master switch for all AI agent activity in your organization
            </CardDescription>
          </div>
          <Switch
            checked={globalEnabled}
            onCheckedChange={(checked) =>
              settingsMutation.mutate({ global_agent_enabled: checked })
            }
            disabled={settingsMutation.isPending}
            aria-label="Enable all agents"
          />
        </CardHeader>
      </Card>

      {!globalEnabled && (
        <Alert variant="warning">
          <Pause className="h-4 w-4" />
          <AlertDescription>
            All agents are paused. Individual settings are preserved but inactive until you re-enable agents.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-1.5">
            Approval Queue
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {PERMISSION_TIERS.map((tier) => (
                <span key={tier.value} className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{tier.label}:</span>
                  {tier.description}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              {AGENT_TYPES.map((agent) => {
                const enabled = isAgentEnabled(agent.settingsKey);
                const isExpanded = expandedAgents[agent.id] ?? false;
                const disabled = !globalEnabled || !enabled;

                return (
                  <Collapsible
                    key={agent.id}
                    open={isExpanded}
                    onOpenChange={() => toggleExpanded(agent.id)}
                  >
                    <Card className={cn(disabled && "opacity-60")}>
                      <CardHeader className="pb-0">
                        <div className="flex items-center justify-between">
                          <CollapsibleTrigger
                            className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${agent.name} settings`}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <Bot className="h-4 w-4" aria-hidden="true" />
                                <span className="text-sm font-medium">{agent.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                                {agent.description}
                              </p>
                            </div>
                          </CollapsibleTrigger>

                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) =>
                              settingsMutation.mutate({ [agent.settingsKey]: checked })
                            }
                            disabled={settingsMutation.isPending || !globalEnabled}
                            aria-label={`Enable ${agent.name} agent`}
                          />
                        </div>

                        {!enabled && globalEnabled && (
                          <p className="text-xs text-muted-foreground ml-6 mt-1">
                            Enable this agent to configure its permissions.
                          </p>
                        )}
                      </CardHeader>

                      <CollapsibleContent>
                        <CardContent className="pt-4">
                          {agent.actions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No configurable actions yet. Actions will appear here as this agent gains capabilities.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {agent.actions.map((action) => (
                                <div
                                  key={action.id}
                                  className={cn(
                                    "flex items-center justify-between rounded-md px-3 py-2 transition-colors",
                                    disabled ? "bg-muted/30" : "bg-muted/50",
                                  )}
                                >
                                  <div className="min-w-0 flex-1 mr-4">
                                    <div className="text-sm">{action.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {action.description}
                                    </div>
                                  </div>
                                  <Select
                                    value={getPermissionTier(agent.id, action.id)}
                                    onValueChange={(value) =>
                                      permissionMutation.mutate({
                                        agent_type: agent.id,
                                        action_type: action.id,
                                        permission_tier: value as PermissionTier,
                                      })
                                    }
                                    disabled={disabled}
                                  >
                                    <SelectTrigger className="w-[120px]" aria-label={`Permission tier for ${action.name}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PERMISSION_TIERS.map((tier) => (
                                        <SelectItem key={tier.value} value={tier.value}>
                                          {tier.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Approval Queue Tab */}
        <TabsContent value="approvals">
          <div className="space-y-4">
            {approvalsLoading ? (
              <div className="flex items-center justify-center py-12" role="status">
                <div className="text-center">
                  <div className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" aria-hidden="true" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading approvals...</p>
                </div>
              </div>
            ) : !approvals?.length ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No pending approvals. Actions requiring approval will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              approvals.map((approval) => {
                const statusCfg = STATUS_CONFIG[approval.status];
                const isPending = approval.status === 'pending';
                const isRejecting = rejectingId === approval.id;

                return (
                  <Card key={approval.id} className={cn(!isPending && 'opacity-60')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {AGENT_NAMES[approval.agent_type] ?? approval.agent_type}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {ACTION_NAMES[approval.action_type] ?? approval.action_type}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{approval.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span>Created {formatRelativeTime(approval.created_at)}</span>
                            {isPending && (
                              <span>Expires in {formatExpiresIn(approval.expires_at)}</span>
                            )}
                            {approval.reviewed_at && (
                              <span>Reviewed {formatRelativeTime(approval.reviewed_at)}</span>
                            )}
                          </div>
                          {approval.rejection_reason && (
                            <p className="text-xs text-destructive mt-1">
                              Reason: {approval.rejection_reason}
                            </p>
                          )}
                        </div>

                        {isPending && !isRejecting && (
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => approvalMutation.mutate({ id: approval.id, action: 'approved' })}
                              disabled={approvalMutation.isPending}
                              aria-label="Approve this action"
                            >
                              <Check className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRejectingId(approval.id)}
                              disabled={approvalMutation.isPending}
                              aria-label="Reject this action"
                            >
                              <X className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>

                    {isRejecting && (
                      <CardContent className="pt-0">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label htmlFor={`reject-reason-${approval.id}`} className="text-xs text-muted-foreground mb-1 block">
                              Rejection reason (optional)
                            </label>
                            <textarea
                              id={`reject-reason-${approval.id}`}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              rows={2}
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Why is this action being rejected?"
                            />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                approvalMutation.mutate({
                                  id: approval.id,
                                  action: 'rejected',
                                  rejection_reason: rejectionReason || undefined,
                                })
                              }
                              disabled={approvalMutation.isPending}
                            >
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectionReason('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
