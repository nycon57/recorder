import type { ContentType, RecordingStatus } from '@/lib/types/database';

type SourceDetailStageId =
  | 'upload'
  | 'transcript'
  | 'document'
  | 'workflow'
  | 'knowledge';

type SourceDetailStageState =
  | 'completed'
  | 'in_progress'
  | 'pending'
  | 'failed';

export interface SourceDetailStage {
  id: SourceDetailStageId;
  label: string;
  description: string;
  state: SourceDetailStageState;
}

export interface BuildSourceDetailTimelineInput {
  contentType: ContentType | null;
  status: RecordingStatus;
  hasTranscript: boolean;
  hasDocument: boolean;
  hasWorkflow: boolean;
  hasKnowledgePage: boolean;
}

export interface SourceKnowledgePageCandidate {
  id: string;
  topic: string | null;
  app: string | null;
  screen: string | null;
  confidence: number;
  compilation_log: unknown;
  valid_until: string | null;
  updated_at: string;
}

const WORKFLOW_CONTENT_TYPES = new Set<ContentType>(['recording', 'video']);

export function supportsWorkflowExtraction(contentType: ContentType | null): boolean {
  return contentType != null && WORKFLOW_CONTENT_TYPES.has(contentType);
}

function getTranscriptStageLabel(contentType: ContentType | null): string {
  if (contentType === 'document') return 'Text extracted';
  if (contentType === 'text') return 'Note processed';
  return 'Transcript ready';
}

function getDocumentStageLabel(contentType: ContentType | null): string {
  if (contentType === 'document' || contentType === 'text') return 'Summary generated';
  return 'Document generated';
}

function resolveTranscriptStageState(input: BuildSourceDetailTimelineInput): SourceDetailStageState {
  if (input.hasTranscript) return 'completed';
  if (input.status === 'transcribing') return 'in_progress';
  if (input.status === 'transcribed' || input.status === 'doc_generating') return 'in_progress';
  if (input.status === 'error') return 'failed';
  return 'pending';
}

function resolveDocumentStageState(input: BuildSourceDetailTimelineInput): SourceDetailStageState {
  if (input.hasDocument) return 'completed';
  if (input.status === 'doc_generating' || input.status === 'transcribed') return 'in_progress';
  if (input.status === 'error' && input.hasTranscript) return 'failed';
  return 'pending';
}

function resolveWorkflowStageState(input: BuildSourceDetailTimelineInput): SourceDetailStageState {
  if (input.hasWorkflow) return 'completed';
  if (input.status === 'completed' || input.hasDocument) return 'in_progress';
  if (input.status === 'error' && input.hasDocument) return 'failed';
  return 'pending';
}

function resolveKnowledgeStageState(input: BuildSourceDetailTimelineInput): SourceDetailStageState {
  if (input.hasKnowledgePage) return 'completed';
  if (input.status === 'completed' || input.hasDocument) return 'in_progress';
  if (input.status === 'error' && (input.hasDocument || input.hasTranscript)) return 'failed';
  return 'pending';
}

export function buildSourceDetailTimeline(
  input: BuildSourceDetailTimelineInput
): SourceDetailStage[] {
  const stages: SourceDetailStage[] = [
    {
      id: 'upload',
      label: 'Source uploaded',
      description: 'Raw source file is stored and queued for processing.',
      state: 'completed',
    },
    {
      id: 'transcript',
      label: getTranscriptStageLabel(input.contentType),
      description:
        input.contentType === 'document'
          ? 'Extract text content for downstream generation and indexing.'
          : input.contentType === 'text'
            ? 'Normalize text note content for processing and retrieval.'
            : 'Convert source content into transcript text.',
      state: resolveTranscriptStageState(input),
    },
    {
      id: 'document',
      label: getDocumentStageLabel(input.contentType),
      description:
        input.contentType === 'document' || input.contentType === 'text'
          ? 'Generate structured AI summary and insights.'
          : 'Generate structured AI document from the transcript.',
      state: resolveDocumentStageState(input),
    },
  ];

  if (supportsWorkflowExtraction(input.contentType)) {
    stages.push({
      id: 'workflow',
      label: 'Workflow extracted',
      description: 'Extract step-by-step workflow actions from the source.',
      state: resolveWorkflowStageState(input),
    });
  }

  stages.push({
    id: 'knowledge',
    label: 'Compiled knowledge linked',
    description: 'Compile the source output into organization knowledge pages.',
    state: resolveKnowledgeStageState(input),
  });

  return stages;
}

export function resolvePreferredSourceKnowledgePage(
  pages: SourceKnowledgePageCandidate[]
): SourceKnowledgePageCandidate | null {
  if (pages.length === 0) return null;

  const active = pages.filter((page) => page.valid_until == null);
  const candidatePool = active.length > 0 ? active : pages;

  return candidatePool.reduce<SourceKnowledgePageCandidate | null>(
    (latest, candidate) => {
      if (!latest) return candidate;
      const latestTime = Date.parse(latest.updated_at);
      const candidateTime = Date.parse(candidate.updated_at);
      const latestValue = Number.isNaN(latestTime) ? 0 : latestTime;
      const candidateValue = Number.isNaN(candidateTime) ? 0 : candidateTime;
      return candidateValue > latestValue ? candidate : latest;
    },
    null
  );
}
