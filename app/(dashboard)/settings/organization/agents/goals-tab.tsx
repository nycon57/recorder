'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus,
  Pause,
  Play,
  Pencil,
  Target,
  Clock,
  Users,
  Sparkles,
  Settings2,
} from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Progress } from '@/app/components/ui/progress';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/app/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/lib/utils/cn';
import type { AgentGoalType, AgentGoalStatus } from '@/lib/types/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentGoal {
  id: string;
  org_id: string;
  agent_type: string;
  goal_description: string;
  goal_type: AgentGoalType;
  target_metric: string | null;
  target_value: number | null;
  current_value: number | null;
  status: AgentGoalStatus;
  priority: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface GoalTemplate {
  id: string;
  label: string;
  description: string;
  goal_type: AgentGoalType;
  agent_type: string;
  target_metric: string;
  default_target: number;
  icon: React.ComponentType<{ className?: string }>;
}

const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'freshness',
    label: 'Content freshness',
    description: 'Keep all content less than {X} days old',
    goal_type: 'freshness',
    agent_type: 'curator',
    target_metric: 'max_content_age_days',
    default_target: 90,
    icon: Clock,
  },
  {
    id: 'coverage',
    label: 'Knowledge coverage',
    description: 'Ensure {X}% of topics have at least 2 contributors',
    goal_type: 'coverage',
    agent_type: 'gap_intelligence',
    target_metric: 'bus_factor_coverage_pct',
    default_target: 80,
    icon: Users,
  },
  {
    id: 'quality',
    label: 'Knowledge health',
    description: 'Maintain knowledge health score above {X}',
    goal_type: 'quality',
    agent_type: 'curator',
    target_metric: 'health_score',
    default_target: 80,
    icon: Sparkles,
  },
];

const STATUS_CONFIG: Record<AgentGoalStatus, { label: string; variant: string }> = {
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  achieved: { label: 'Achieved', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
};

const GOAL_TYPE_LABELS: Record<AgentGoalType, string> = {
  freshness: 'Freshness',
  coverage: 'Coverage',
  quality: 'Quality',
  custom: 'Custom',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeProgress(goal: AgentGoal): number {
  if (!goal.target_value || goal.target_value === 0) return 0;
  if (goal.current_value == null) return 0; // No measurement yet

  const current = goal.current_value;

  // For freshness goals, lower current is better (days old < target)
  if (goal.goal_type === 'freshness') {
    if (current <= 0) return 100;
    if (current >= goal.target_value) return 0;
    return Math.round(((goal.target_value - current) / goal.target_value) * 100);
  }

  // For coverage/quality, higher current is better
  return Math.min(100, Math.round((current / goal.target_value) * 100));
}

function progressLabel(goal: AgentGoal): string {
  const current = goal.current_value ?? 0;
  const target = goal.target_value;

  if (goal.goal_type === 'freshness') {
    return `Oldest content: ${Math.round(current)} days (target: < ${target} days)`;
  }
  if (goal.goal_type === 'coverage') {
    return `Coverage: ${Math.round(current)}% (target: ${target}%)`;
  }
  if (goal.goal_type === 'quality') {
    return `Health score: ${Math.round(current)} (target: ${target})`;
  }
  if (target) {
    return `${Math.round(current)} / ${target}`;
  }
  return `Current: ${Math.round(current)}`;
}

function templateDescription(template: GoalTemplate, value: number): string {
  return template.description.replace('{X}', String(value));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GoalsTab() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<AgentGoal | null>(null);

  // Form state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [targetValue, setTargetValue] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customAgentType, setCustomAgentType] = useState('curator');
  const [customMetric, setCustomMetric] = useState('');

  // Edit form
  const [editTargetValue, setEditTargetValue] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // --- Queries ---

  const { data: goals, isLoading, isError } = useQuery<AgentGoal[]>({
    queryKey: ['agent-goals'],
    queryFn: async () => {
      const res = await fetch('/api/organizations/agent-goals');
      if (!res.ok) throw new Error('Failed to load goals');
      const json = await res.json();
      return json.data;
    },
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/organizations/agent-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create goal');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals'] });
      toast.success('Goal created');
      resetAddForm();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/organizations/agent-goals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update goal');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-goals'] });
      toast.success('Goal updated');
      setEditingGoal(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // --- Handlers ---

  function resetAddForm() {
    setShowAddDialog(false);
    setSelectedTemplate('');
    setTargetValue('');
    setCustomDescription('');
    setCustomAgentType('curator');
    setCustomMetric('');
  }

  function handleCreate() {
    if (selectedTemplate === 'custom') {
      if (!customDescription.trim()) return;
      createMutation.mutate({
        agent_type: customAgentType,
        goal_description: customDescription,
        goal_type: 'custom',
        target_metric: customMetric || null,
        target_value: targetValue ? Number(targetValue) : null,
      });
      return;
    }

    const template = GOAL_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (!template || !targetValue) return;

    const value = Number(targetValue);
    createMutation.mutate({
      agent_type: template.agent_type,
      goal_description: templateDescription(template, value),
      goal_type: template.goal_type,
      target_metric: template.target_metric,
      target_value: value,
    });
  }

  function handleToggleStatus(goal: AgentGoal) {
    const newStatus = goal.status === 'active' ? 'paused' : 'active';
    updateMutation.mutate({ id: goal.id, status: newStatus });
  }

  function openEditDialog(goal: AgentGoal) {
    setEditingGoal(goal);
    setEditTargetValue(goal.target_value?.toString() ?? '');
    setEditDescription(goal.goal_description);
  }

  function handleSaveEdit() {
    if (!editingGoal) return;
    updateMutation.mutate({
      id: editingGoal.id,
      goal_description: editDescription,
      target_value: editTargetValue ? Number(editTargetValue) : null,
    });
  }

  // --- Loading ---

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <div className="text-center">
          <div className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" aria-hidden="true" />
          <p className="mt-2 text-sm text-muted-foreground">Loading goals...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-destructive">
            Failed to load goals. Please refresh the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeGoals = goals?.filter((g) => g.status === 'active') ?? [];
  const otherGoals = goals?.filter((g) => g.status !== 'active') ?? [];

  // --- Render ---

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Set goals to direct what agents prioritize. Agents query active goals and adjust behavior accordingly.
        </p>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
          Add Goal
        </Button>
      </div>

      {/* Active Goals */}
      {activeGoals.length === 0 && otherGoals.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted-foreground">
              No goals set. Add a goal from a template or create a custom one.
            </p>
          </CardContent>
        </Card>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-3">
          {activeGoals.map((goal) => {
            const pct = computeProgress(goal);
            const statusCfg = STATUS_CONFIG[goal.status];
            return (
              <Card key={goal.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusCfg.variant as 'default'}>{statusCfg.label}</Badge>
                        <Badge variant="outline">{GOAL_TYPE_LABELS[goal.goal_type]}</Badge>
                      </div>
                      <p className="text-sm mt-1.5">{goal.goal_description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(goal)}
                        aria-label="Edit goal"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleStatus(goal)}
                        disabled={updateMutation.isPending}
                        aria-label={goal.status === 'active' ? 'Pause goal' : 'Resume goal'}
                      >
                        {goal.status === 'active' ? (
                          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {goal.target_value != null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progressLabel(goal)}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} aria-label={`Goal progress: ${pct}%`} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Paused / Achieved / Failed Goals */}
      {otherGoals.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground mt-4">Inactive goals</h3>
          {otherGoals.map((goal) => {
            const pct = computeProgress(goal);
            const statusCfg = STATUS_CONFIG[goal.status];
            return (
              <Card key={goal.id} className="opacity-60">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusCfg.variant as 'default'}>{statusCfg.label}</Badge>
                        <Badge variant="outline">{GOAL_TYPE_LABELS[goal.goal_type]}</Badge>
                      </div>
                      <p className="text-sm mt-1.5">{goal.goal_description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {(goal.status === 'paused' || goal.status === 'failed') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(goal)}
                          disabled={updateMutation.isPending}
                          aria-label="Resume goal"
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {goal.target_value != null && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{progressLabel(goal)}</span>
                        <span>{pct}%</span>
                      </div>
                      <Progress value={pct} aria-label={`Goal progress: ${pct}%`} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Goal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) resetAddForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Goal</DialogTitle>
            <DialogDescription>
              Choose a template or create a custom goal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template Selection */}
            <div className="space-y-2">
              {GOAL_TEMPLATES.map((template) => {
                const Icon = template.icon;
                const isSelected = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      'flex items-start gap-3 w-full rounded-lg border p-3 text-left transition-colors',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setTargetValue(String(template.default_target));
                    }}
                  >
                    <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <div className="text-sm font-medium">{template.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {templateDescription(template, template.default_target)}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Custom option */}
              <button
                type="button"
                className={cn(
                  'flex items-start gap-3 w-full rounded-lg border p-3 text-left transition-colors',
                  selectedTemplate === 'custom'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setSelectedTemplate('custom')}
              >
                <Settings2 className="h-5 w-5 mt-0.5 text-muted-foreground" aria-hidden="true" />
                <div>
                  <div className="text-sm font-medium">Custom goal</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Define your own goal with a custom description
                  </div>
                </div>
              </button>
            </div>

            {/* Template target value */}
            {selectedTemplate && selectedTemplate !== 'custom' && (
              <div>
                <label htmlFor="target-value" className="text-sm font-medium">
                  Target value
                </label>
                <Input
                  id="target-value"
                  type="number"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  className="mt-1"
                  min={1}
                />
                {targetValue && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {templateDescription(
                      GOAL_TEMPLATES.find((t) => t.id === selectedTemplate)!,
                      Number(targetValue)
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Custom goal fields */}
            {selectedTemplate === 'custom' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="custom-description" className="text-sm font-medium">
                    Goal description
                  </label>
                  <Textarea
                    id="custom-description"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe what you want agents to achieve..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="custom-agent" className="text-sm font-medium">
                      Agent type
                    </label>
                    <Select value={customAgentType} onValueChange={setCustomAgentType}>
                      <SelectTrigger id="custom-agent" className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="curator">Curator</SelectItem>
                        <SelectItem value="gap_intelligence">Gap Intelligence</SelectItem>
                        <SelectItem value="onboarding">Onboarding</SelectItem>
                        <SelectItem value="digest">Digest</SelectItem>
                        <SelectItem value="workflow_extraction">Workflow Extraction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="custom-target" className="text-sm font-medium">
                      Target value (optional)
                    </label>
                    <Input
                      id="custom-target"
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="mt-1"
                      placeholder="e.g. 90"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="custom-metric" className="text-sm font-medium">
                    Target metric (optional)
                  </label>
                  <Input
                    id="custom-metric"
                    value={customMetric}
                    onChange={(e) => setCustomMetric(e.target.value)}
                    className="mt-1"
                    placeholder="e.g. response_time_hours"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetAddForm}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !selectedTemplate ||
                (selectedTemplate !== 'custom' && !targetValue) ||
                (selectedTemplate === 'custom' && !customDescription.trim())
              }
            >
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => { if (!open) setEditingGoal(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>
              Update the goal description or target value.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label htmlFor="edit-description" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div>
              <label htmlFor="edit-target" className="text-sm font-medium">
                Target value
              </label>
              <Input
                id="edit-target"
                type="number"
                value={editTargetValue}
                onChange={(e) => setEditTargetValue(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGoal(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
