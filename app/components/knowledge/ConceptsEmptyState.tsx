'use client';

import { Brain, Sparkles, Upload, Video, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Button } from '@/app/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/app/components/ui/empty';

/**
 * ConceptsEmptyState - Empty state for when no concepts exist
 *
 * Three variants:
 * 1. No content yet - Guide user to create content
 * 2. Processing - Content exists but concepts are being extracted
 * 3. No concepts found - Content exists but no concepts were detected
 */
interface ConceptsEmptyStateProps {
  variant?: 'no-content' | 'processing' | 'no-concepts';
  contentCount?: number;
  onAddContent?: () => void;
  className?: string;
}

export function ConceptsEmptyState({
  variant = 'no-content',
  contentCount = 0,
  onAddContent,
  className,
}: ConceptsEmptyStateProps) {
  const router = useRouter();

  const handleRecordClick = () => {
    router.push('/record');
  };

  const handleUploadClick = () => {
    router.push('/library?action=upload');
  };

  // Processing state
  if (variant === 'processing') {
    return (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyMedia className="relative mb-2">
            <div className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 p-6">
              <Loader2 className="size-12 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          </EmptyMedia>

          <EmptyTitle>Extracting Concepts</EmptyTitle>

          <EmptyDescription>
            We're analyzing your content and extracting key concepts. This usually takes a few
            minutes after content is processed.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <p className="text-sm text-muted-foreground">
            Concepts will appear here once extraction is complete.
          </p>
        </EmptyContent>
      </Empty>
    );
  }

  // No concepts found in existing content
  if (variant === 'no-concepts') {
    return (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyMedia className="relative mb-2">
            <div className="inline-flex items-center justify-center rounded-full bg-muted p-6">
              <Brain className="size-12 text-muted-foreground" />
            </div>
          </EmptyMedia>

          <EmptyTitle>No Concepts Detected</EmptyTitle>

          <EmptyDescription>
            We analyzed your content but didn't find any specific tools, processes, or technical
            terms to extract. Try adding more detailed or technical content.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleRecordClick} className="gap-2 min-h-[44px]">
              <Video className="size-4" aria-hidden="true" />
              Record Tutorial
            </Button>
            <Button variant="outline" onClick={handleUploadClick} className="gap-2 min-h-[44px]">
              <Upload className="size-4" aria-hidden="true" />
              Upload Content
            </Button>
          </div>
        </EmptyContent>
      </Empty>
    );
  }

  // No content yet (default)
  return (
    <Empty className={className}>
      <EmptyHeader>
        <EmptyMedia className="relative mb-2">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6">
            <Brain className="size-12 text-primary" />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="size-6 text-yellow-500 fill-yellow-500" />
          </div>
        </EmptyMedia>

        <EmptyTitle>Build Your Knowledge Graph</EmptyTitle>

        <EmptyDescription className="max-w-md">
          As you add recordings, videos, and documents, we'll automatically extract key concepts
          like tools, processes, and technical terms—creating a searchable knowledge network.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleRecordClick} className="gap-2 min-h-[44px]">
            <Video className="size-4" aria-hidden="true" />
            Start Recording
          </Button>
          <Button variant="outline" onClick={handleUploadClick} className="gap-2 min-h-[44px]">
            <Upload className="size-4" aria-hidden="true" />
            Upload Files
          </Button>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 pt-8 border-t w-full max-w-2xl" role="list">
          <div className="text-center space-y-1" role="listitem">
            <h4 className="font-medium text-sm">Cross-Reference</h4>
            <p className="text-xs text-muted-foreground">
              Find related content across all your recordings
            </p>
          </div>
          <div className="text-center space-y-1" role="listitem">
            <h4 className="font-medium text-sm">Discover Patterns</h4>
            <p className="text-xs text-muted-foreground">
              See which tools and processes you use most
            </p>
          </div>
          <div className="text-center space-y-1" role="listitem">
            <h4 className="font-medium text-sm">Smart Search</h4>
            <p className="text-xs text-muted-foreground">
              Search by concept to find exactly what you need
            </p>
          </div>
        </div>
      </EmptyContent>
    </Empty>
  );
}

/**
 * ConceptsEmptyStateCompact - Smaller inline empty state
 */
interface ConceptsEmptyStateCompactProps {
  variant?: 'processing' | 'no-concepts';
  className?: string;
}

export function ConceptsEmptyStateCompact({
  variant = 'no-concepts',
  className,
}: ConceptsEmptyStateCompactProps) {
  if (variant === 'processing') {
    return (
      <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
        <Loader2 className="size-4 animate-spin" />
        <span>Extracting concepts...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <Sparkles className="size-4" />
      <span>No concepts detected yet</span>
    </div>
  );
}
