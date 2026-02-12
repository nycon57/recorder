/**
 * Curate Knowledge Job Handler
 *
 * Execution framework for the Knowledge Curator Agent.
 * Runs sub-tasks (categorize, detect duplicates, detect staleness)
 * against new content created since the last curator run.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import type { Database } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'] & {
  content?: {
    id: string;
    org_id: string;
    title: string | null;
    status: string;
    content_type: string;
    file_type: string | null;
    storage_path_raw: string | null;
    storage_path_processed: string | null;
    file_size: number | null;
  } | null;
};

const AGENT_TYPE = 'curator';

interface CuratorSessionState {
  lastProcessedAt: string | null;
}

// ─── Stubbed Sub-Tasks ───────────────────────────────────────────────────────

/** Categorize content into knowledge domains. TODO: implement with LLM. */
async function categorizeContent(contentId: string, orgId: string): Promise<void> {
  console.log(`[CurateKnowledge] TODO: categorizeContent for ${contentId} (org: ${orgId})`);
}

/** Detect duplicate or near-duplicate content. TODO: implement with embeddings. */
async function detectDuplicates(contentId: string, orgId: string): Promise<void> {
  console.log(`[CurateKnowledge] TODO: detectDuplicates for ${contentId} (org: ${orgId})`);
}

/** Detect stale content that may need updating. TODO: implement with date/usage heuristics. */
async function detectStaleness(contentId: string, orgId: string): Promise<void> {
  console.log(`[CurateKnowledge] TODO: detectStaleness for ${contentId} (org: ${orgId})`);
}

// ─── Main Handler ────────────────────────────────────────────────────────────

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

  // Step 1: Check if curator agent is enabled for this org
  const enabled = await isAgentEnabled(orgId, AGENT_TYPE);
  if (!enabled) {
    console.log(`[CurateKnowledge] Curator disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(10, 'Curator enabled, resuming session...');

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Step 2: Get or create a curator session for this org
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
  let sessionState: CuratorSessionState;

  if (existingSession) {
    sessionId = existingSession.id;
    sessionState = (existingSession.state as CuratorSessionState) ?? { lastProcessedAt: null };

    await supabase
      .from('agent_sessions')
      .update({ session_status: 'active', last_active_at: now })
      .eq('id', sessionId);
  } else {
    sessionState = { lastProcessedAt: null };

    const { data: newSession, error: createError } = await supabase
      .from('agent_sessions')
      .insert({
        org_id: orgId,
        agent_type: AGENT_TYPE,
        session_status: 'active',
        goal: 'Curate and organize knowledge base content',
        state: sessionState as unknown as Database['public']['Tables']['agent_sessions']['Insert']['state'],
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

  // Step 3: Get new content since last run
  let contentQuery = supabase
    .from('content')
    .select('id, created_at')
    .eq('org_id', orgId)
    .in('status', ['completed', 'transcribed'])
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (sessionState.lastProcessedAt) {
    contentQuery = contentQuery.gt('created_at', sessionState.lastProcessedAt);
  }

  const { data: newContent, error: contentError } = await contentQuery;

  if (contentError) {
    // Log the DB error and bail without updating lastProcessedAt
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'curate_knowledge',
      outcome: 'failure',
      errorMessage: `Failed to fetch new content: ${contentError.message}`,
    });
    throw new Error(`Failed to fetch new content: ${contentError.message}`);
  }

  if (!newContent || newContent.length === 0) {
    // No new content — update last_active_at but skip sub-tasks
    await supabase
      .from('agent_sessions')
      .update({ last_active_at: now })
      .eq('id', sessionId);

    progressCallback?.(100, 'No new content to process');
    console.log(`[CurateKnowledge] No new content for ${orgId} since ${sessionState.lastProcessedAt ?? 'beginning'}`);
    return;
  }

  console.log(`[CurateKnowledge] Found ${newContent.length} new content items for ${orgId}`);

  // Step 4: Process each new content item with sub-tasks
  const totalItems = newContent.length;

  for (let i = 0; i < totalItems; i++) {
    const item = newContent[i];
    const progressPercent = 30 + Math.round((i / totalItems) * 60);
    progressCallback?.(progressPercent, `Processing item ${i + 1} of ${totalItems}...`);

    try {
      await withAgentLogging(
        {
          orgId,
          agentType: AGENT_TYPE,
          actionType: 'categorize_content',
          contentId: item.id,
          inputSummary: `Categorize content ${item.id}`,
        },
        () => categorizeContent(item.id, orgId)
      );

      await withAgentLogging(
        {
          orgId,
          agentType: AGENT_TYPE,
          actionType: 'detect_duplicates',
          contentId: item.id,
          inputSummary: `Check duplicates for content ${item.id}`,
        },
        () => detectDuplicates(item.id, orgId)
      );

      await withAgentLogging(
        {
          orgId,
          agentType: AGENT_TYPE,
          actionType: 'detect_staleness',
          contentId: item.id,
          inputSummary: `Check staleness for content ${item.id}`,
        },
        () => detectStaleness(item.id, orgId)
      );

      // Update lastProcessedAt after each successful item to prevent
      // re-processing on partial failure (idempotent checkpoint)
      await supabase
        .from('agent_sessions')
        .update({
          last_active_at: new Date().toISOString(),
          state: { lastProcessedAt: item.created_at } as unknown as Database['public']['Tables']['agent_sessions']['Update']['state'],
        })
        .eq('id', sessionId);
    } catch (error) {
      // Log failure for this item; lastProcessedAt already reflects the
      // last successful item, so only this item and later ones will retry.
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

  // Step 5: All items processed — finalize session
  progressCallback?.(95, 'Finalizing session...');

  await supabase
    .from('agent_sessions')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', sessionId);

  progressCallback?.(100, 'Knowledge curation complete');
  console.log(`[CurateKnowledge] Curation complete for ${orgId} — processed ${totalItems} items`);
}
