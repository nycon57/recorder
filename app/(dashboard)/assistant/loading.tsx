import { Bot } from 'lucide-react';

import { Skeleton } from '@/app/components/ui/skeleton';

/**
 * Assistant Loading State
 * Matches the chat interface layout with skeletons
 */
export default function AssistantLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-9 w-40 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {/* Empty state */}
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="w-16 h-16 mx-auto mb-4 text-muted animate-pulse" />
          <Skeleton className="h-6 w-32 mx-auto mb-2" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border pt-4">
        <div className="flex gap-2">
          <Skeleton className="flex-1 h-12" />
          <Skeleton className="h-12 w-24" />
        </div>
      </div>
    </div>
  );
}
