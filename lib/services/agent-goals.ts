/**
 * Agent Goals Service
 *
 * Query active goals so agent handlers can prioritize work.
 */

import type { Database } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';

export type AgentGoal = Database['public']['Tables']['agent_goals']['Row'];

/**
 * Get active goals for an org, optionally filtered by agent type.
 * Agent handlers call this to decide what to prioritize.
 */
export async function getActiveGoals(
  orgId: string,
  agentType?: string
): Promise<AgentGoal[]> {
  let query = supabaseAdmin
    .from('agent_goals')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('priority', { ascending: true });

  if (agentType) {
    query = query.eq('agent_type', agentType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[getActiveGoals] Error:', error);
    return [];
  }

  return data ?? [];
}

/**
 * Update a goal's current_value. Called by agent handlers after measuring progress.
 */
export async function updateGoalProgress(
  goalId: string,
  currentValue: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('agent_goals')
    .update({
      current_value: currentValue,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId);

  if (error) {
    console.error('[updateGoalProgress] Error:', error);
  }
}
