import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock3, FileText, GitBranch, Loader2, MessageSquare, Network } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { ContentType, RecordingStatus } from '@/lib/types/database';
import { buildSourceDetailTimeline, type SourceDetailStageState } from '@/lib/services/source-detail';

interface TranscriptArtifact {
  id: string;
  created_at?: string | null;
}

interface DocumentArtifact {
  id: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface WorkflowArtifact {
  id: string;
  title: string | null;
  status: string;
  updated_at: string;
}

interface LinkedKnowledgePageArtifact {
  id: string;
  topic: string | null;
  app: string | null;
  screen: string | null;
  valid_until: string | null;
  updated_at: string;
}

interface SourceDetailProgressPanelProps {
  contentId: string;
  contentType: ContentType | null;
  status: RecordingStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  transcript: TranscriptArtifact | null;
  document: DocumentArtifact | null;
  workflow: WorkflowArtifact | null;
  knowledgePage: LinkedKnowledgePageArtifact | null;
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStateBadgeLabel(state: SourceDetailStageState): string {
  if (state === 'completed') return 'Completed';
  if (state === 'in_progress') return 'In Progress';
  if (state === 'failed') return 'Failed';
  return 'Pending';
}

function getStateBadgeClassName(state: SourceDetailStageState): string {
  if (state === 'completed') return 'bg-green-500/10 text-green-700 border-green-200';
  if (state === 'in_progress') return 'bg-blue-500/10 text-blue-700 border-blue-200';
  if (state === 'failed') return 'bg-red-500/10 text-red-700 border-red-200';
  return 'bg-muted text-muted-foreground border-border';
}

function getStageIcon(state: SourceDetailStageState) {
  if (state === 'completed') return <CheckCircle2 className="size-4 text-green-600" />;
  if (state === 'in_progress') return <Loader2 className="size-4 animate-spin text-blue-600" />;
  if (state === 'failed') return <AlertTriangle className="size-4 text-red-600" />;
  return <Clock3 className="size-4 text-muted-foreground" />;
}

function buildKnowledgeHealthHref(contentId: string, wikiPageId: string): string {
  const params = new URLSearchParams({
    sourceId: contentId,
    wikiPageId,
  });
  return `/knowledge/health?${params.toString()}`;
}

export default function SourceDetailProgressPanel({
  contentId,
  contentType,
  status,
  createdAt,
  updatedAt,
  completedAt,
  transcript,
  document,
  workflow,
  knowledgePage,
}: SourceDetailProgressPanelProps) {
  const timeline = buildSourceDetailTimeline({
    contentType,
    status,
    hasTranscript: !!transcript,
    hasDocument: !!document,
    hasWorkflow: !!workflow,
    hasKnowledgePage: !!knowledgePage,
  });

  const stageTimestamps: Partial<Record<string, string | null>> = {
    upload: formatTimestamp(createdAt),
    transcript: formatTimestamp(transcript?.created_at ?? updatedAt),
    document: formatTimestamp(document?.updated_at ?? document?.created_at ?? updatedAt),
    workflow: formatTimestamp(workflow?.updated_at),
    knowledge: formatTimestamp(knowledgePage?.updated_at ?? completedAt),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Processing &amp; Artifacts</CardTitle>
        <CardDescription>
          Transcript, document, workflow, and compiled-knowledge progress in one place.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="size-4 text-muted-foreground" />
                Transcript
              </span>
              <Badge variant="outline" className={transcript ? 'bg-green-500/10 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'}>
                {transcript ? 'Available' : 'Not available yet'}
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <FileText className="size-4 text-muted-foreground" />
                Document
              </span>
              <Badge variant="outline" className={document ? 'bg-green-500/10 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'}>
                {document ? 'Available' : 'Not available yet'}
              </Badge>
            </div>
          </div>

          {workflow ? (
            <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <GitBranch className="size-4 text-muted-foreground" />
                  Workflow
                </span>
                <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-200">
                  Available
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {workflow.title?.trim() || 'Workflow steps extracted'}
              </p>
              <Link href="#workflow-heading" className="mt-2 inline-flex text-xs text-primary underline underline-offset-2">
                View workflow steps
              </Link>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Network className="size-4 text-muted-foreground" />
                Compiled Knowledge
              </span>
              <Badge
                variant="outline"
                className={
                  knowledgePage
                    ? 'bg-green-500/10 text-green-700 border-green-200'
                    : 'bg-muted text-muted-foreground border-border'
                }
              >
                {knowledgePage ? 'Linked' : 'Not linked yet'}
              </Badge>
            </div>
            {knowledgePage ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {knowledgePage.topic?.trim() || 'Compiled page'} · {knowledgePage.app ?? 'unassigned app'} / {knowledgePage.screen ?? 'unassigned screen'}
                </p>
                <Link
                  href={buildKnowledgeHealthHref(contentId, knowledgePage.id)}
                  className="inline-flex text-xs text-primary underline underline-offset-2"
                >
                  Open in Knowledge Health
                </Link>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                This source has not been linked to a compiled knowledge page yet.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {timeline.map((stage) => (
            <div key={stage.id} className="rounded-lg border border-border/60 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5">{getStageIcon(stage.state)}</span>
                  <div>
                    <p className="text-sm font-medium">{stage.label}</p>
                    <p className="text-xs text-muted-foreground">{stage.description}</p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={getStateBadgeClassName(stage.state)}
                >
                  {getStateBadgeLabel(stage.state)}
                </Badge>
              </div>
              {stageTimestamps[stage.id] ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {stageTimestamps[stage.id]}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
