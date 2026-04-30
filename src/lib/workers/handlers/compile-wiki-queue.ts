import type { createClient as createAdminClient } from '@/lib/supabase/admin';

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

interface EnqueueCompileWikiArgs {
  recordingId: string;
  orgId: string;
  sourceType?: string | null;
  source?: string;
}

/**
 * Queue Wiki compilation after first-party content produces a transcript or
 * document. The jobs table dedupe key keeps this safe across retrying workers.
 */
export async function enqueueCompileWikiJob(
  supabase: SupabaseAdmin,
  args: EnqueueCompileWikiArgs,
): Promise<void> {
  const { recordingId, orgId, sourceType = null, source = 'CompileWikiQueue' } = args;
  const dedupeKey = `compile_wiki:${recordingId}`;

  const { error } = await supabase.from('jobs').insert({
    type: 'compile_wiki',
    status: 'pending',
    payload: { recordingId, contentId: recordingId, orgId, sourceType },
    dedupe_key: dedupeKey,
    priority: 2, // JOB_PRIORITY.NORMAL
  });

  if (error) {
    if (error.code === '23505') {
      console.log(
        `[${source}] compile_wiki already queued for ${recordingId} (dedupe_key=${dedupeKey})`,
      );
      return;
    }

    throw new Error(`Failed to enqueue compile_wiki job: ${error.message}`);
  }

  console.log(
    `[${source}] Enqueued compile_wiki job for ${recordingId} (dedupe_key=${dedupeKey})`,
  );
}
