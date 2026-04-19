'use client';

import {
  FolderOpen,
  ArrowRight,
  Video,
  Upload,
  Search,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/app/components/ui/empty';

interface EmptyStateProps {
  onRecordClick?: () => void;
  onUploadClick?: () => void;
}

export function EmptyState({ onRecordClick, onUploadClick }: EmptyStateProps) {
  return (
    <Empty className="border border-border bg-card/60 py-14">
      <EmptyHeader>
        <EmptyMedia className="mb-6 inline-flex rounded-xl border border-border bg-muted/70 p-5">
          <FolderOpen className="size-14 text-muted-foreground" />
        </EmptyMedia>

        <EmptyTitle className="font-[var(--font-heading)] text-3xl font-semibold tracking-tight">
          Start Your Knowledge Hub
        </EmptyTitle>

        <EmptyDescription className="max-w-2xl text-sm text-muted-foreground">
          Record your screen, upload existing material, or create notes. Tribora
          indexes it all so your team can search, review, and reuse decisions
          without repeat explanations.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent className="max-w-3xl">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={onRecordClick} className="gap-2">
            <Video className="size-5" />
            Start Recording
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onUploadClick}
            className="gap-2"
          >
            <Upload className="size-5" />
            Upload Content
          </Button>
        </div>

        <div className="grid gap-3 text-left sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <Video className="mb-3 size-5 text-muted-foreground" />
            <p className="font-medium">Capture</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record workflows and demos with audio, camera, and screen context.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <Search className="mb-3 size-5 text-muted-foreground" />
            <p className="font-medium">Retrieve</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Search by meaning, topic, speaker, and timeframe across all
              assets.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-4">
            <MessageSquare className="mb-3 size-5 text-muted-foreground" />
            <p className="font-medium">Assist</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask the assistant for source-backed answers from your own
              material.
            </p>
          </div>
        </div>
      </EmptyContent>
    </Empty>
  );
}
