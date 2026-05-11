/**
 * Shared source lifecycle contract for content processing.
 *
 * Raw source lifecycle stays scoped to intake + processing only:
 * uploading -> uploaded -> transcribing -> transcribed -> doc_generating -> completed/error
 */

export const SOURCE_STATUS = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  TRANSCRIBING: 'transcribing',
  TRANSCRIBED: 'transcribed',
  DOCUMENT_GENERATING: 'doc_generating',
  COMPLETED: 'completed',
  ERROR: 'error',
} as const;

export const SOURCE_STATUS_VALUES = Object.values(SOURCE_STATUS);

export type RecordingStatus =
  (typeof SOURCE_STATUS)[keyof typeof SOURCE_STATUS];
type SourceStatusInput = RecordingStatus | 'failed';
export type SourceStatusDisplayState =
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed';
export type SourceStatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline';
export type SourceLifecycleJobType =
  | 'transcribe'
  | 'extract_audio'
  | 'extract_text_pdf'
  | 'extract_text_docx'
  | 'process_text_note'
  | 'doc_generate'
  | 'generate_embeddings';
export type SourceLifecycleReprocessStep =
  | 'transcribe'
  | 'document'
  | 'embeddings'
  | 'all';

type SourceStatusConfig = {
  label: string;
  displayState: SourceStatusDisplayState;
  color: string;
  badgeColor: string;
  badgeVariant: SourceStatusBadgeVariant;
  active: boolean;
};

const SOURCE_STATUS_CONFIG: Record<RecordingStatus, SourceStatusConfig> = {
  [SOURCE_STATUS.UPLOADING]: {
    label: 'Uploading',
    displayState: 'uploading',
    color: 'bg-blue-500',
    badgeColor: 'bg-blue-500/10 text-blue-700 border-blue-200',
    badgeVariant: 'secondary',
    active: true,
  },
  [SOURCE_STATUS.UPLOADED]: {
    label: 'Uploaded',
    displayState: 'queued',
    color: 'bg-slate-500',
    badgeColor: 'bg-slate-500/10 text-slate-700 border-slate-200',
    badgeVariant: 'outline',
    active: false,
  },
  [SOURCE_STATUS.TRANSCRIBING]: {
    label: 'Processing',
    displayState: 'processing',
    color: 'bg-yellow-500',
    badgeColor: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    badgeVariant: 'outline',
    active: true,
  },
  [SOURCE_STATUS.TRANSCRIBED]: {
    label: 'Processing',
    displayState: 'processing',
    color: 'bg-yellow-500',
    badgeColor: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    badgeVariant: 'outline',
    active: true,
  },
  [SOURCE_STATUS.DOCUMENT_GENERATING]: {
    label: 'Processing',
    displayState: 'processing',
    color: 'bg-yellow-500',
    badgeColor: 'bg-yellow-500/10 text-yellow-700 border-yellow-200',
    badgeVariant: 'outline',
    active: true,
  },
  [SOURCE_STATUS.COMPLETED]: {
    label: 'Ready',
    displayState: 'ready',
    color: 'bg-green-500',
    badgeColor: 'bg-green-500/10 text-green-700 border-green-200',
    badgeVariant: 'default',
    active: false,
  },
  [SOURCE_STATUS.ERROR]: {
    label: 'Failed',
    displayState: 'failed',
    color: 'bg-red-500',
    badgeColor: 'bg-red-500/10 text-red-700 border-red-200',
    badgeVariant: 'destructive',
    active: false,
  },
};

function isCanonicalSourceStatus(status: string): status is RecordingStatus {
  return SOURCE_STATUS_VALUES.includes(status as RecordingStatus);
}

function getSourceStatusConfig(status: string): SourceStatusConfig | null {
  const normalized = normalizeSourceStatus(status);
  return normalized ? SOURCE_STATUS_CONFIG[normalized] : null;
}

export function normalizeSourceStatus(status: string): RecordingStatus | null {
  if (status === 'failed') {
    return SOURCE_STATUS.ERROR;
  }

  return isCanonicalSourceStatus(status) ? status : null;
}

export function getStatusDisplayState(
  status: string,
): SourceStatusDisplayState | null {
  return getSourceStatusConfig(status)?.displayState ?? null;
}

export function getStatusLabel(status: string): string {
  return getSourceStatusConfig(status)?.label ?? status;
}

function getStatusColor(status: string): string {
  return getSourceStatusConfig(status)?.color ?? 'bg-gray-500';
}

export function getStatusBadgeColor(status: string): string {
  return (
    getSourceStatusConfig(status)?.badgeColor ??
    'bg-gray-500/10 text-gray-700 border-gray-200'
  );
}

export function getStatusBadgeVariant(
  status: string,
): SourceStatusBadgeVariant {
  return getSourceStatusConfig(status)?.badgeVariant ?? 'outline';
}

export function isProcessingStatus(status: string): boolean {
  return getSourceStatusConfig(status)?.active ?? false;
}

function isCompletedStatus(status: string): boolean {
  return normalizeSourceStatus(status) === SOURCE_STATUS.COMPLETED;
}

export function isErrorStatus(status: string): boolean {
  return normalizeSourceStatus(status) === SOURCE_STATUS.ERROR;
}

export function getQueuedSourceStatusForJob(
  jobType: SourceLifecycleJobType,
): RecordingStatus | null {
  switch (jobType) {
    case 'transcribe':
    case 'extract_audio':
    case 'extract_text_pdf':
    case 'extract_text_docx':
    case 'process_text_note':
      return SOURCE_STATUS.TRANSCRIBING;
    case 'doc_generate':
      return SOURCE_STATUS.DOCUMENT_GENERATING;
    case 'generate_embeddings':
      return null;
    default:
      return null;
  }
}

export function getQueuedSourceStatusForReprocessStep(
  step: SourceLifecycleReprocessStep,
): RecordingStatus | null {
  switch (step) {
    case 'transcribe':
    case 'all':
      return SOURCE_STATUS.TRANSCRIBING;
    case 'document':
      return SOURCE_STATUS.DOCUMENT_GENERATING;
    case 'embeddings':
      return null;
    default:
      return null;
  }
}
