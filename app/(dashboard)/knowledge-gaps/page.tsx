'use client';

import { Fragment, useState, useEffect } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle,
  X,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { useFetchWithAbort } from '@/app/hooks/useFetchWithAbort';
import { ColoredBadge } from '@/app/components/ui/colored-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Input } from '@/app/components/ui/input';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
};

interface KnowledgeGap {
  id: string;
  org_id: string;
  topic: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact_score: number | null;
  search_count: number | null;
  unique_searchers: number | null;
  last_searched_at: string | null;
  related_concept_ids: string[] | null;
  suggested_action: string | null;
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  resolved_by_content_id: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface DismissState {
  open: boolean;
  gapId: string | null;
  reason: string;
}

interface ResolveState {
  open: boolean;
  gapId: string | null;
  contentId: string;
}

const DISMISS_INITIAL: DismissState = { open: false, gapId: null, reason: '' };
const RESOLVE_INITIAL: ResolveState = { open: false, gapId: null, contentId: '' };

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

async function patchGap(id: string, body: Record<string, unknown>) {
  const response = await fetch(`/api/knowledge-gaps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<{ data: { gap: KnowledgeGap; resolvedContentTitle: string | null } }>;
}

export default function KnowledgeGapsPage() {
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dismiss, setDismiss] = useState<DismissState>(DISMISS_INITIAL);
  const [resolve, setResolve] = useState<ResolveState>(RESOLVE_INITIAL);

  useEffect(() => {
    document.title = 'Knowledge Gaps - Tribora';
  }, []);

  const { loading, refetch } = useFetchWithAbort<{ data: { gaps: KnowledgeGap[] } }>(
    '/api/knowledge-gaps',
    {
      onSuccess: (data) => setGaps(data.data.gaps),
      onError: (err) => {
        console.error('Failed to fetch knowledge gaps:', err);
        toast.error('Failed to load knowledge gaps');
      },
    }
  );

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAcknowledge(id: string) {
    setActionLoading(id);
    try {
      await patchGap(id, { status: 'acknowledged' });
      toast.success('Gap acknowledged');
      refetch();
    } catch {
      toast.error('Failed to acknowledge gap');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDismiss() {
    if (!dismiss.gapId) return;
    setActionLoading(dismiss.gapId);
    try {
      await patchGap(dismiss.gapId, {
        status: 'dismissed',
        rejection_reason: dismiss.reason.trim() || null,
      });
      toast.success('Gap dismissed');
      setDismiss(DISMISS_INITIAL);
      refetch();
    } catch {
      toast.error('Failed to dismiss gap');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve() {
    if (!resolve.gapId) return;
    setActionLoading(resolve.gapId);
    try {
      const body: Record<string, unknown> = { status: 'resolved' };
      const trimmedContentId = resolve.contentId.trim();
      if (trimmedContentId) body.resolved_by_content_id = trimmedContentId;

      const result = await patchGap(resolve.gapId, body);
      const linkedTitle = result.data.resolvedContentTitle;

      if (linkedTitle) {
        toast.success(`Gap resolved — linked to "${linkedTitle}"`);
      } else {
        toast.success('Gap marked as resolved');
      }

      setResolve(RESOLVE_INITIAL);
      refetch();
    } catch {
      toast.error('Failed to resolve gap');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-8 p-4 md:p-8">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div>
          <h1 className="text-heading-3 font-outfit tracking-tight">Knowledge Gaps</h1>
          <p className="text-muted-foreground">
            Topics your team searches for but lacks documentation — ranked by impact
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Gaps</CardTitle>
          <CardDescription>Highest impact first. Click a row to expand details.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted motion-safe:animate-pulse rounded" />
              ))}
            </div>
          ) : gaps.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground max-w-sm">
                No knowledge gaps detected yet. Gaps appear as your team searches for topics with
                insufficient content.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Topic</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="text-center">Impact</TableHead>
                  <TableHead className="text-center">Searches</TableHead>
                  <TableHead className="text-center">Searchers</TableHead>
                  <TableHead>Last Searched</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Suggested Action</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gaps.map((gap) => (
                  <Fragment key={gap.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      tabIndex={0}
                      role="button"
                      aria-expanded={expandedRows.has(gap.id)}
                      aria-label={`${gap.topic} — click to ${expandedRows.has(gap.id) ? 'collapse' : 'expand'} details`}
                      onClick={() => toggleRow(gap.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleRow(gap.id);
                        }
                      }}
                    >
                      <TableCell className="w-8 pr-0">
                        {expandedRows.has(gap.id) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{gap.topic}</TableCell>
                      <TableCell>
                        <ColoredBadge
                          color={SEVERITY_COLORS[gap.severity] ?? '#6b7280'}
                          size="sm"
                        >
                          {gap.severity}
                        </ColoredBadge>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {gap.impact_score != null ? gap.impact_score.toFixed(1) : '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {gap.search_count ?? '—'}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {gap.unique_searchers ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(gap.last_searched_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={gap.status === 'acknowledged' ? 'secondary' : 'outline'}>
                          {gap.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-48 text-sm text-muted-foreground">
                        <span className="line-clamp-1">{gap.suggested_action ?? '—'}</span>
                      </TableCell>
                      {/* Action buttons — stop propagation so they don't toggle the row */}
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {gap.status === 'open' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Acknowledge this knowledge gap"
                              onClick={() => handleAcknowledge(gap.id)}
                              disabled={actionLoading === gap.id}
                            >
                              <CheckCircle className="h-4 w-4" aria-hidden="true" />
                              <span className="hidden lg:inline">Acknowledge</span>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Dismiss this knowledge gap"
                            onClick={() => setDismiss({ open: true, gapId: gap.id, reason: '' })}
                            disabled={actionLoading === gap.id}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden lg:inline">Dismiss</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Mark this knowledge gap as resolved"
                            onClick={() => setResolve({ open: true, gapId: gap.id, contentId: '' })}
                            disabled={actionLoading === gap.id}
                          >
                            <CheckCheck className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden lg:inline">Resolved</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expandable detail row */}
                    {expandedRows.has(gap.id) && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={10} className="px-8 py-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            {gap.description && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Description
                                </p>
                                <p className="text-sm">{gap.description}</p>
                              </div>
                            )}

                            {gap.suggested_action && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Resolution Suggestions
                                </p>
                                <p className="text-sm">{gap.suggested_action}</p>
                              </div>
                            )}

                            {gap.related_concept_ids && gap.related_concept_ids.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Related Concepts
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {gap.related_concept_ids.length} concept
                                  {gap.related_concept_ids.length === 1 ? '' : 's'} linked
                                </p>
                              </div>
                            )}

                            {gap.metadata && 'bus_factor' in gap.metadata && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                    Bus Factor Details
                                  </p>
                                  <pre className="text-xs bg-muted rounded p-2 overflow-auto whitespace-pre-wrap">
                                    {JSON.stringify(gap.metadata.bus_factor, null, 2)}
                                  </pre>
                                </div>
                              )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dismiss.open}
        onOpenChange={(open) => {
          if (!open) setDismiss(DISMISS_INITIAL);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss Knowledge Gap</DialogTitle>
            <DialogDescription>
              Provide a reason for dismissing this gap, or dismiss without one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dismiss-reason">Reason (optional)</Label>
            <Textarea
              id="dismiss-reason"
              placeholder="e.g. Not relevant to our team's work..."
              value={dismiss.reason}
              onChange={(e) => setDismiss((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDismiss(DISMISS_INITIAL)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDismiss}
              disabled={actionLoading !== null}
            >
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={resolve.open}
        onOpenChange={(open) => {
          if (!open) setResolve(RESOLVE_INITIAL);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Resolved</DialogTitle>
            <DialogDescription>
              Optionally link the content item that fills this knowledge gap for traceability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resolve-content-id">Content item ID (optional)</Label>
            <Input
              id="resolve-content-id"
              placeholder="Paste a content item UUID..."
              value={resolve.contentId}
              onChange={(e) => setResolve((prev) => ({ ...prev, contentId: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolve(RESOLVE_INITIAL)}
            >
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={actionLoading !== null}>
              Mark as Resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
