/**
 * Agent Memory Service
 *
 * Persistent agent memory with semantic search, importance-based filtering,
 * and automatic embedding generation.
 */

import type { Database, Json } from '@/lib/types/database';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';

/** Agent memory record matching the agent_memory table columns */
export type AgentMemory = Database['public']['Tables']['agent_memory']['Row'];

/**
 * Store or update a memory entry.
 * Upserts by (org_id, agent_type, memory_key) and generates an embedding.
 */
export async function storeMemory(params: {
  orgId: string;
  agentType: string;
  key: string;
  value: string;
  importance?: number;
  metadata?: Json;
  expiresAt?: string;
}): Promise<AgentMemory> {
  const { orgId, agentType, key, value, importance, metadata, expiresAt } = params;

  // Skip embedding for empty strings (tombstones)
  let embedding: number[] | null = null;
  if (value.length > 0) {
    try {
      const result = await generateEmbeddingWithFallback(value, 'RETRIEVAL_DOCUMENT');
      embedding = result.embedding;
    } catch (error) {
      console.error('[AgentMemory] Failed to generate embedding, storing without:', error);
    }
  }

  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .upsert(
      {
        org_id: orgId,
        agent_type: agentType,
        memory_key: key,
        memory_value: value,
        embedding: embedding as any, // pgvector type mismatch
        importance: importance ?? 0.5,
        metadata: metadata ?? {},
        expires_at: expiresAt ?? null,
      },
      { onConflict: 'org_id,agent_type,memory_key' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store memory: ${error.message}`);
  }

  return data as AgentMemory;
}

/**
 * Recall a memory by exact key.
 * Increments access_count and updates last_accessed_at on hit.
 */
export async function recallMemory(params: {
  orgId: string;
  agentType: string;
  key: string;
}): Promise<AgentMemory | null> {
  const { orgId, agentType, key } = params;

  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .select()
    .eq('org_id', orgId)
    .eq('agent_type', agentType)
    .eq('memory_key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    throw new Error(`Failed to recall memory: ${error.message}`);
  }

  if (!data) return null;

  const row = data as AgentMemory;
  const now = new Date().toISOString();
  const newAccessCount = (row.access_count ?? 0) + 1;

  // Increment access_count and update last_accessed_at (best-effort)
  const { error: updateError } = await supabaseAdmin
    .from('agent_memory')
    .update({
      access_count: newAccessCount,
      last_accessed_at: now,
    })
    .eq('id', row.id);

  if (updateError) {
    console.error('[AgentMemory] Failed to update access tracking:', updateError);
    return row; // Return original data if tracking update fails
  }

  return { ...row, access_count: newAccessCount, last_accessed_at: now };
}

/**
 * Semantic search for memories using embedding similarity.
 * Uses cosine distance via match_agent_memories RPC.
 */
export async function searchMemory(params: {
  orgId: string;
  agentType: string;
  query: string;
  limit?: number;
  minImportance?: number;
}): Promise<AgentMemory[]> {
  const { orgId, agentType, query, limit = 10, minImportance = 0 } = params;

  let queryEmbedding: number[];
  try {
    const result = await generateEmbeddingWithFallback(query, 'RETRIEVAL_QUERY');
    queryEmbedding = result.embedding;
  } catch (error) {
    console.error('[AgentMemory] Failed to generate query embedding:', error);
    return [];
  }

  const { data, error } = await supabaseAdmin.rpc('match_agent_memories', {
    query_embedding: queryEmbedding as any, // pgvector type mismatch
    match_org_id: orgId,
    match_agent_type: agentType,
    match_limit: limit,
    min_importance: minImportance,
  });

  if (error) {
    throw new Error(`Failed to search memory: ${error.message}`);
  }

  return (data as AgentMemory[]) ?? [];
}

/**
 * Delete a memory entry by key.
 */
export async function deleteMemory(params: {
  orgId: string;
  agentType: string;
  key: string;
}): Promise<void> {
  const { orgId, agentType, key } = params;

  const { error } = await supabaseAdmin
    .from('agent_memory')
    .delete()
    .eq('org_id', orgId)
    .eq('agent_type', agentType)
    .eq('memory_key', key);

  if (error) {
    throw new Error(`Failed to delete memory: ${error.message}`);
  }
}

/**
 * Delete all expired memories for an organization.
 * Returns the count of deleted rows.
 */
export async function pruneExpiredMemories(orgId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .delete()
    .eq('org_id', orgId)
    .lt('expires_at', new Date().toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to prune expired memories: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * List agent memories with pagination.
 * Ordered by importance DESC then updated_at DESC.
 */
export async function getAgentMemories(params: {
  orgId: string;
  agentType: string;
  limit?: number;
  offset?: number;
}): Promise<AgentMemory[]> {
  const { orgId, agentType, limit = 50, offset = 0 } = params;

  const { data, error } = await supabaseAdmin
    .from('agent_memory')
    .select()
    .eq('org_id', orgId)
    .eq('agent_type', agentType)
    .order('importance', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to get agent memories: ${error.message}`);
  }

  return (data as AgentMemory[]) ?? [];
}
