'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Brain, BookOpen, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
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

interface UserMemoryTopic {
  pageId: string;
  topic: string;
  app: string | null;
  screen: string | null;
  lastInteraction: string;
  interactionCount: number;
}

export function UserMemoryTab() {
  const queryClient = useQueryClient();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const {
    data: topics = [],
    isLoading,
    error,
  } = useQuery<UserMemoryTopic[]>({
    queryKey: ['user-memory'],
    queryFn: async () => {
      const res = await fetch('/api/extension/user-memory');
      if (!res.ok) throw new Error('Failed to fetch memory');
      const json = await res.json();
      return json.data?.topics ?? [];
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/extension/user-memory', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to clear history');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-memory'] });
      toast.success('Learning history cleared');
      setClearDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to clear learning history');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="size-5" />
          AI Memory
        </CardTitle>
        <CardDescription>
          Topics the AI has shown you from your organization&apos;s knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-destructive">
              Failed to load learning history
            </p>
          </div>
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              No learning history yet
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm">
              As you interact with the AI extension, topics you&apos;ve been shown
              will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Interactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((topic) => (
                  <TableRow key={topic.pageId}>
                    <TableCell className="font-medium">
                      {topic.topic}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {topic.app && (
                          <Badge variant="secondary" className="text-xs">
                            {topic.app}
                          </Badge>
                        )}
                        {topic.screen && (
                          <Badge variant="outline" className="text-xs">
                            {topic.screen}
                          </Badge>
                        )}
                        {!topic.app && !topic.screen && (
                          <span className="text-xs text-muted-foreground">
                            --
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(topic.lastInteraction), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {topic.interactionCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end">
              <AlertDialog
                open={clearDialogOpen}
                onOpenChange={setClearDialogOpen}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Clear All History
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear learning history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your AI learning history.
                      The AI will no longer remember which topics it has shown
                      you. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={clearMutation.isPending}
                    >
                      {clearMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : null}
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
