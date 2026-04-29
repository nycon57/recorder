import type { LightweightSupabaseClient } from '@/lib/supabase/types';
import type { Database, Json } from '@/lib/types/database';

type JobRow = Database['public']['Tables']['jobs']['Row'];
type JobStatus = JobRow['status'];
type ClaimedJobRpcRow =
  Database['public']['Functions']['claim_pending_jobs']['Returns'][number];

export interface PrefetchedContent {
  id: string;
  org_id: string;
  title: string | null;
  status: string;
  content_type: string;
  file_type: string | null;
  storage_path_raw: string | null;
  storage_path_processed: string | null;
  file_size: number | null;
}

export type Job = JobRow & {
  content?: PrefetchedContent | null;
};

type JobWithMaybeContent = JobRow & {
  content?: Json | PrefetchedContent | null;
};

export type JobClaimError = {
  message: string;
};

const JOB_WITH_CONTENT_SELECT = `
  *,
  content:content!jobs_content_id_fkey (
    id,
    org_id,
    title,
    status,
    content_type,
    file_type,
    storage_path_raw,
    storage_path_processed,
    file_size
  )
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

function normalizeContent(
  content: Json | PrefetchedContent | null | undefined,
): PrefetchedContent | null {
  if (!isRecord(content)) {
    return null;
  }

  if (
    typeof content.id !== 'string' ||
    typeof content.org_id !== 'string' ||
    typeof content.status !== 'string' ||
    typeof content.content_type !== 'string'
  ) {
    return null;
  }

  return {
    id: content.id,
    org_id: content.org_id,
    title: nullableString(content.title),
    status: content.status,
    content_type: content.content_type,
    file_type: nullableString(content.file_type),
    storage_path_raw: nullableString(content.storage_path_raw),
    storage_path_processed: nullableString(content.storage_path_processed),
    file_size: nullableNumber(content.file_size),
  };
}

function normalizeJob(row: JobWithMaybeContent): Job {
  return {
    ...row,
    content: normalizeContent(row.content),
  };
}

export async function claimPendingJobs(
  supabase: LightweightSupabaseClient,
  batchSize: number,
  claimedAt: Date = new Date(),
): Promise<{ jobs: Job[]; error: JobClaimError | null }> {
  const safeBatchSize = Math.max(0, Math.floor(batchSize));

  if (safeBatchSize === 0) {
    return { jobs: [], error: null };
  }

  const { data, error } = await supabase.rpc('claim_pending_jobs', {
    p_batch_size: safeBatchSize,
    p_claimed_at: claimedAt.toISOString(),
  });

  if (error) {
    return { jobs: [], error };
  }

  return {
    jobs: ((data ?? []) as ClaimedJobRpcRow[]).map((row) =>
      normalizeJob(row as JobWithMaybeContent),
    ),
    error: null,
  };
}

export async function claimJobById(
  supabase: LightweightSupabaseClient,
  jobId: string,
  claimedAt: Date = new Date(),
): Promise<{ job: Job | null; error: JobClaimError | null }> {
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'processing' as JobStatus,
      started_at: claimedAt.toISOString(),
      progress_percent: 0,
      progress_message: 'Starting job...',
    })
    .eq('id', jobId)
    .eq('status', 'pending')
    .select(JOB_WITH_CONTENT_SELECT)
    .maybeSingle();

  if (error) {
    return { job: null, error };
  }

  return {
    job: data ? normalizeJob(data as JobWithMaybeContent) : null,
    error: null,
  };
}
