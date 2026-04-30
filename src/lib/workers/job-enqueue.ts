import type { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type JobInsert = Database['public']['Tables']['jobs']['Insert'];

export interface EnqueueUniqueJobResult {
  inserted: boolean;
  duplicate: boolean;
}

/**
 * Enqueue a job protected by the jobs.dedupe_key unique index. This removes
 * the select-then-insert race from retrying and concurrent workers.
 */
export async function enqueueUniqueJob(
  supabase: SupabaseAdmin,
  job: JobInsert,
  context = 'job',
): Promise<EnqueueUniqueJobResult> {
  if (!job.dedupe_key) {
    throw new Error(`Cannot enqueue unique ${context} without a dedupe_key`);
  }

  const { error } = await supabase.from('jobs').insert(job);

  if (!error) {
    return { inserted: true, duplicate: false };
  }

  if (error.code === '23505') {
    return { inserted: false, duplicate: true };
  }

  throw new Error(`Failed to enqueue ${context}: ${error.message}`);
}
