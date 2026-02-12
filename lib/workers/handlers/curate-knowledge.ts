/**
 * Curate Knowledge Job Handler
 *
 * Runs curator sub-tasks (categorize, detect duplicates, detect staleness)
 * against content created since the last curator run.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];
type SessionState = Database['public']['Tables']['agent_sessions']['Update']['state'];

const AGENT_TYPE = 'curator';

/** Sub-task definition: action key, human label, and stub implementation. */
interface SubTask {
  actionType: string;
  label: string;
  run: (contentId: string, orgId: string) => Promise<void>;
}

const SUB_TASKS: SubTask[] = [
  {
    actionType: 'categorize_content',
    label: 'Categorize content',
    run: async (contentId, orgId) => {
      console.log(`[CurateKnowledge] TODO: categorizeContent for ${contentId} (org: ${orgId})`);
    },
  },
  {
    actionType: 'detect_duplicates',
    label: 'Check duplicates for content',
    run: async (contentId, orgId) => {
      console.log(`[CurateKnowledge] TODO: detectDuplicates for ${contentId} (org: ${orgId})`);
    },
  },
  {
    actionType: 'detect_staleness',
    label: 'Check staleness for content',
    run: async (contentId, orgId) => {
      console.log(`[CurateKnowledge] TODO: detectStaleness for ${contentId} (org: ${orgId})`);
    },
  },
];

export async function handleCurateKnowledge(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const orgId = (payload.orgId as string) || '';

  if (!orgId) {
    console.warn('[CurateKnowledge] Missing orgId in job payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[CurateKnowledge] Curator disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(10, 'Curator enabled, loading session...');

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Get or create a curator session
  const { data: existingSession, error: sessionError } = await supabase
    .from('agent_sessions')
    .select()
    .eq('org_id', orgId)
    .eq('agent_type', AGENT_TYPE)
    .in('session_status', ['active', 'paused'])
    .order('last_active_at', { ascending: false })
    .limit(1)
    .single();

  // PGRST116 = no rows found (expected when no session exists)
  if (sessionError && sessionError.code !== 'PGRST116') {
    throw new Error(`Failed to query curator session: ${sessionError.message}`);
  }

  let sessionId: string;
  let lastProcessedAt: string | null;

  if (existingSession) {
    sessionId = existingSession.id;
    lastProcessedAt =
      (existingSession.state as { lastProcessedAt?: string | null })?.lastProcessedAt ?? null;

    await supabase
      .from('agent_sessions')
      .update({ session_status: 'active', last_active_at: now })
      .eq('id', sessionId);
  } else {
    lastProcessedAt = null;

    const { data: newSession, error: createError } = await supabase
      .from('agent_sessions')
      .insert({
        org_id: orgId,
        agent_type: AGENT_TYPE,
        session_status: 'active',
        goal: 'Curate and organize knowledge base content',
        state: { lastProcessedAt: null } as unknown as SessionState,
        started_at: now,
        last_active_at: now,
      })
      .select('id')
      .single();

    if (createError || !newSession) {
      throw new Error(`Failed to create curator session: ${createError?.message}`);
    }

    sessionId = newSession.id;
  }

  progressCallback?.(20, 'Fetching new content...');

  // Fetch content created since the last successful run
  let contentQuery = supabase
    .from('content')
    .select('id, created_at')
    .eq('org_id', orgId)
    .in('status', ['completed', 'transcribed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (lastProcessedAt) {
    contentQuery = contentQuery.gt('created_at', lastProcessedAt);
  }

  const { data: newContent, error: contentError } = await contentQuery;

  if (contentError) {
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'curate_knowledge',
      outcome: 'failure',
      errorMessage: `Failed to fetch new content: ${contentError.message}`,
    });
    throw new Error(`Failed to fetch new content: ${contentError.message}`);
  }

  if (newContent.length === 0) {
    await supabase
      .from('agent_sessions')
      .update({ last_active_at: now })
      .eq('id', sessionId);

    progressCallback?.(100, 'No new content to process');
    console.log(`[CurateKnowledge] No new content for ${orgId} since ${lastProcessedAt ?? 'beginning'}`);
    return;
  }

  console.log(`[CurateKnowledge] Found ${newContent.length} new content items for ${orgId}`);

  const totalItems = newContent.length;

  for (let i = 0; i < totalItems; i++) {
    const item = newContent[i];
    const progressPercent = 30 + Math.round((i / totalItems) * 60);
    progressCallback?.(progressPercent, `Processing item ${i + 1} of ${totalItems}...`);

    try {
      for (const task of SUB_TASKS) {
        await withAgentLogging(
          {
            orgId,
            agentType: AGENT_TYPE,
            actionType: task.actionType,
            contentId: item.id,
            inputSummary: `${task.label} ${item.id}`,
          },
          () => task.run(item.id, orgId)
        );
      }

      // Checkpoint: advance lastProcessedAt so retries skip this item
      await supabase
        .from('agent_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          state: { lastProcessedAt: item.created_at } as unknown as SessionState,
        })
        .eq('id', sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[CurateKnowledge] Error processing content ${item.id}: ${errorMessage}`);

      await logAgentAction({
        orgId,
        agentType: AGENT_TYPE,
        actionType: 'curate_knowledge',
        contentId: item.id,
        outcome: 'failure',
        errorMessage,
      });

      throw error;
    }
  }

  progressCallback?.(100, 'Knowledge curation complete');
  console.log(`[CurateKnowledge] Curation complete for ${orgId} — processed ${totalItems} items`);
}
