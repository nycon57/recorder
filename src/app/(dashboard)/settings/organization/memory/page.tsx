'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Brain, Search, Timer, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/app/components/ui/alert-dialog';

interface AgentMemoryEntry {
  id: string;
  org_id: string;
  agent_type: string;
  memory_key: string;
  memory_value: string;
  importance: number;
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AgentMemoryResponse {
  memories: AgentMemoryEntry[];
  agentTypes: string[];
  total: number;
}

function ImportanceBadge({ importance }: { importance: number }) {
  const pct = Math.round(importance * 100);
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' =
    'secondary';

  if (importance > 0.7) {
    variant = 'default';
  } else if (importance <= 0.4) {
    variant = 'destructive';
  }

  return <Badge variant={variant}>{pct}%</Badge>;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export default function AgentMemoryPage() {
  const queryClient = useQueryClient();

  const [agentTypeFilter, setAgentTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset offset when filters change — handled inline via onValueChange

  const {
    data,
    isLoading,
    error,
  } = useQuery<AgentMemoryResponse>({
    queryKey: [
      'agent-memories',
      { agentType: agentTypeFilter, search: debouncedSearch, limit, offset },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (agentTypeFilter !== 'all') {
        params.set('agent_type', agentTypeFilter);
      }
      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await fetch(
        `/api/organizations/agent-memory?${params.toString()}`
      );
      if (!res.ok) throw new Error('Failed to fetch agent memories');
      const json = await res.json();
      return json.data;
    },
  });

  const memories = data?.memories ?? [];
  const agentTypes = data?.agentTypes ?? [];
  const total = data?.total ?? 0;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/organizations/agent-memory/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete memory');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-memories'] });
      toast.success('Memory entry deleted');
    },
    onError: () => {
      toast.error('Failed to delete memory entry');
    },
  });

  const pruneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/organizations/agent-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prune_expired' }),
      });
      if (!res.ok) throw new Error('Failed to prune memories');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agent-memories'] });
      const pruned = data?.data?.pruned ?? 0;
      toast.success(`Pruned ${pruned} expired ${pruned === 1 ? 'entry' : 'entries'}`);
    },
    onError: () => {
      toast.error('Failed to prune expired memories');
    },
  });

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + limit, total);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-normal flex items-center gap-2">
          <Brain className="size-6" />
          Agent Memory
        </h2>
        <p className="text-muted-foreground mt-1">
          View and manage persistent memory entries stored by AI agents
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Select value={agentTypeFilter} onValueChange={(val) => { setAgentTypeFilter(val); setOffset(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All agent types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agent types</SelectItem>
            {agentTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search keys or values..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="sm:ml-auto">
          <Button
            variant="outline"
            onClick={() => pruneMutation.mutate()}
            disabled={pruneMutation.isPending}
          >
            {pruneMutation.isPending ? (
              <Loader2 className="size-4 animate-spin mr-2" />
            ) : (
              <Timer className="size-4 mr-2" />
            )}
            Prune Expired
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-destructive">
                Failed to load agent memories
              </p>
            </div>
          ) : memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Brain className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                No memory entries found
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {debouncedSearch || agentTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Agent memories will appear here as agents store information'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Value</TableHead>
                  <TableHead>Importance</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Accesses
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Last Accessed
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Expires
                  </TableHead>
                  <TableHead className="w-[60px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memories.map((memory) => (
                  <TableRow key={memory.id}>
                    <TableCell
                      className="font-medium max-w-[200px]"
                      title={memory.memory_key}
                    >
                      {truncate(memory.memory_key, 40)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {memory.agent_type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="hidden md:table-cell text-muted-foreground max-w-[250px]"
                      title={memory.memory_value}
                    >
                      {truncate(memory.memory_value, 60)}
                    </TableCell>
                    <TableCell>
                      <ImportanceBadge importance={memory.importance} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell tabular-nums">
                      {memory.access_count}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {memory.last_accessed_at
                        ? formatDistanceToNow(
                            new Date(memory.last_accessed_at),
                            { addSuffix: true }
                          )
                        : '--'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {memory.expires_at
                        ? formatDistanceToNow(new Date(memory.expires_at), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete memory entry?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the memory entry
                              &quot;{truncate(memory.memory_key, 50)}&quot;. The
                              agent will no longer have access to this
                              information. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(memory.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + limit >= total}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
