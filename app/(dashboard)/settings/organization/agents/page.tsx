"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bot, ChevronDown, ChevronRight, Pause } from "lucide-react";

import { Switch } from "@/app/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible";
import { cn } from "@/lib/utils/cn";
import type { PermissionTier } from "@/lib/types/database";

// --- Agent configuration ---

interface AgentAction {
  id: string;
  name: string;
  description: string;
}

interface AgentTypeConfig {
  id: string;
  name: string;
  description: string;
  settingsKey: string;
  actions: AgentAction[];
}

const AGENT_TYPES: AgentTypeConfig[] = [
  {
    id: "curator",
    name: "Curator",
    description: "Organizes and categorizes your knowledge base",
    settingsKey: "curator_enabled",
    actions: [
      { id: "extract_concepts", name: "Extract Concepts", description: "Identify key topics from content" },
      { id: "generate_metadata", name: "Generate Metadata", description: "Create titles and summaries" },
      { id: "suggest_tags", name: "Suggest Tags", description: "Recommend tags based on content" },
      { id: "auto_apply_tags", name: "Auto-Apply Tags", description: "Apply suggested tags automatically" },
      { id: "detect_duplicate", name: "Detect Duplicates", description: "Find duplicate content" },
      { id: "detect_stale", name: "Detect Stale Content", description: "Flag outdated content" },
      { id: "merge_content", name: "Merge Content", description: "Combine duplicate items" },
      { id: "archive_content", name: "Archive Content", description: "Move stale content to archive" },
    ],
  },
  {
    id: "gap_intelligence",
    name: "Gap Intelligence",
    description: "Identifies knowledge gaps and missing documentation",
    settingsKey: "gap_intelligence_enabled",
    actions: [
      { id: "detect_bus_factor", name: "Detect Bus Factor", description: "Find knowledge concentrated in few people" },
      { id: "gap_alert", name: "Gap Alerts", description: "Notify about knowledge gaps" },
      { id: "suggest_merge", name: "Suggest Merge", description: "Recommend merging related content" },
      { id: "publish_external", name: "Publish External", description: "Share knowledge externally" },
    ],
  },
  {
    id: "onboarding",
    name: "Onboarding",
    description: "Guides new team members through your knowledge base",
    settingsKey: "onboarding_enabled",
    actions: [],
  },
  {
    id: "digest",
    name: "Digest",
    description: "Creates periodic summaries of new and updated content",
    settingsKey: "digest_enabled",
    actions: [],
  },
  {
    id: "workflow_extraction",
    name: "Workflow Extraction",
    description: "Discovers and documents recurring processes",
    settingsKey: "workflow_extraction_enabled",
    actions: [],
  },
];

const TIER_LABELS: Record<PermissionTier, string> = {
  auto: "Auto",
  notify: "Notify",
  approve: "Approve",
};

const TIER_DESCRIPTIONS: Record<PermissionTier, string> = {
  auto: "Agent acts immediately",
  notify: "Agent acts and notifies you",
  approve: "Agent requests your approval first",
};

// Default tiers matching lib/services/agent-permissions.ts
const DEFAULT_TIERS: Record<string, PermissionTier> = {
  extract_concepts: "auto",
  generate_metadata: "auto",
  detect_duplicate: "auto",
  detect_stale: "auto",
  suggest_tags: "notify",
  suggest_merge: "notify",
  detect_bus_factor: "notify",
  gap_alert: "notify",
  auto_apply_tags: "approve",
  merge_content: "approve",
  archive_content: "approve",
  publish_external: "approve",
};

// --- API types ---

interface AgentSettings {
  global_agent_enabled: boolean | null;
  curator_enabled: boolean | null;
  gap_intelligence_enabled: boolean | null;
  onboarding_enabled: boolean | null;
  digest_enabled: boolean | null;
  workflow_extraction_enabled: boolean | null;
  [key: string]: unknown;
}

interface AgentPermissionRow {
  agent_type: string;
  action_type: string;
  permission_tier: PermissionTier;
}

// --- Component ---

export default function AgentsSettingsPage() {
  const queryClient = useQueryClient();
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({
    curator: true, // First agent expanded by default
  });

  // Fetch agent settings (global + per-agent toggles)
  const { data: settings, isLoading: settingsLoading } = useQuery<AgentSettings>({
    queryKey: ["agent-settings"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/agent-settings");
      if (!res.ok) throw new Error("Failed to load agent settings");
      const json = await res.json();
      return json.data;
    },
  });

  // Fetch agent permissions (per-action tiers)
  const { data: permissions, isLoading: permissionsLoading } = useQuery<AgentPermissionRow[]>({
    queryKey: ["agent-permissions"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/agent-permissions");
      if (!res.ok) throw new Error("Failed to load agent permissions");
      const json = await res.json();
      return json.data;
    },
  });

  // Mutation: update agent settings (toggles)
  const settingsMutation = useMutation({
    mutationFn: async (updates: Record<string, boolean>) => {
      const res = await fetch("/api/organizations/agent-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update setting");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["agent-settings"] });
      const field = Object.keys(variables)[0];
      if (field === "global_agent_enabled") {
        toast.success(variables[field] ? "All agents resumed" : "All agents paused");
      } else {
        toast.success("Agent setting updated");
      }
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["agent-settings"] });
      toast.error(error.message);
    },
  });

  // Mutation: update permission tier
  const permissionMutation = useMutation({
    mutationFn: async (payload: { agent_type: string; action_type: string; permission_tier: PermissionTier }) => {
      const res = await fetch("/api/organizations/agent-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update permission");
      }
      return res.json();
    },
    onMutate: async (payload) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["agent-permissions"] });
      const previous = queryClient.getQueryData<AgentPermissionRow[]>(["agent-permissions"]);

      queryClient.setQueryData<AgentPermissionRow[]>(["agent-permissions"], (old) => {
        if (!old) return old;
        const idx = old.findIndex(
          (p) => p.agent_type === payload.agent_type && p.action_type === payload.action_type,
        );
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], permission_tier: payload.permission_tier };
          return updated;
        }
        return [...old, payload];
      });

      return { previous };
    },
    onSuccess: () => {
      toast.success("Permission updated");
    },
    onError: (error: Error, _vars, context) => {
      // Revert optimistic update
      if (context?.previous) {
        queryClient.setQueryData(["agent-permissions"], context.previous);
      }
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-permissions"] });
    },
  });

  // Loading state
  if (settingsLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-flex h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-muted-foreground">Loading agent settings...</p>
        </div>
      </div>
    );
  }

  const globalEnabled = settings?.global_agent_enabled ?? true;

  function getPermissionTier(agentType: string, actionType: string): PermissionTier {
    const row = permissions?.find(
      (p) => p.agent_type === agentType && p.action_type === actionType,
    );
    return row?.permission_tier ?? DEFAULT_TIERS[actionType] ?? "notify";
  }

  function isAgentEnabled(settingsKey: string): boolean {
    return (settings?.[settingsKey] as boolean | null) ?? false;
  }

  function toggleExpanded(agentId: string) {
    setExpandedAgents((prev) => ({ ...prev, [agentId]: !prev[agentId] }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-normal">Agents</h2>
        <p className="text-muted-foreground mt-1">
          Control what AI agents do automatically, what they notify about, and what requires your approval.
        </p>
      </div>

      {/* Global toggle */}
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
          />
        </CardHeader>
      </Card>

      {/* Global disabled banner */}
      {!globalEnabled && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <Pause className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          All agents are paused. Individual settings are preserved but inactive until you re-enable agents.
        </div>
      )}

      {/* Tier legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["auto", "notify", "approve"] as PermissionTier[]).map((tier) => (
          <span key={tier} className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">{TIER_LABELS[tier]}:</span>
            {TIER_DESCRIPTIONS[tier]}
          </span>
        ))}
      </div>

      {/* Agent sections */}
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
                    <CollapsibleTrigger className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity">
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
                    />
                  </div>

                  {/* Enable prompt when disabled */}
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
                                {(["auto", "notify", "approve"] as PermissionTier[]).map((tier) => (
                                  <SelectItem key={tier} value={tier}>
                                    {TIER_LABELS[tier]}
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
  );
}
