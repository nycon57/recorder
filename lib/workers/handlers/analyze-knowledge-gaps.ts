/**
 * Analyze Knowledge Gaps Job Handler
 *
 * Mines search logs, agentic search gaps, and chat conversations
 * to detect knowledge gaps in the org's content library. Groups
 * similar failed queries by topic using embedding similarity
 * clustering and upserts results into the knowledge_gaps table.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import { generateEmbeddingWithFallback } from '@/lib/services/embedding-fallback';
import type { Database, KnowledgeGapSeverity, Json } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

const AGENT_TYPE = 'gap_intelligence';
const LOOKBACK_DAYS = 30;
const MAX_UNIQUE_QUERIES = 200;
const CLUSTER_THRESHOLD = 0.8;
const MERGE_THRESHOLD = 0.9;

/** Phrases that indicate the assistant could not answer. */
const LOW_CONFIDENCE_PATTERNS = [
  'could not find',
  "couldn't find",
  'no relevant',
  "don't have information",
  'unable to find',
  'no results found',
  'no matching content',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw gap signal from any data source. */
interface GapSignal {
  query: string;
  userId: string | null;
  timestamp: string;
  source: 'search_metrics' | 'agentic_search' | 'chat';
}

/** Deduplicated query with aggregate counts and embedding. */
interface EmbeddedAggregate {
  query: string;
  count: number;
  userIds: Set<string>;
  lastSeen: string;
  embedding: number[];
}

/** Scored knowledge gap ready for upsert. */
interface ScoredGap {
  topic: string;
  searchCount: number;
  uniqueSearchers: number;
  lastSearchedAt: string;
  impactScore: number;
  severity: KnowledgeGapSeverity;
  embedding: number[];
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function handleAnalyzeKnowledgeGaps(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const orgId = (payload.orgId as string) || '';

  if (!orgId) {
    console.warn('[AnalyzeKnowledgeGaps] Missing orgId in job payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[AnalyzeKnowledgeGaps] gap_intelligence disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(5, 'Gap intelligence enabled, collecting signals...');

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'analyze_gaps',
      inputSummary: `Analyze knowledge gaps for org ${orgId}`,
    },
    async () => {
      const supabase = createAdminClient();
      const since = new Date(
        Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      // Phase 1: Collect gap signals from all data sources
      progressCallback?.(10, 'Mining search metrics...');
      const searchSignals = await collectSearchMetricGaps(supabase, orgId, since);

      progressCallback?.(20, 'Mining agentic search logs...');
      const agenticSignals = await collectAgenticSearchGaps(supabase, orgId, since);

      progressCallback?.(30, 'Mining chat conversations...');
      const chatSignals = await collectChatGaps(supabase, orgId, since);

      const allSignals = [...searchSignals, ...agenticSignals, ...chatSignals];

      if (allSignals.length === 0) {
        await logAgentAction({
          orgId,
          agentType: AGENT_TYPE,
          actionType: 'analyze_gaps',
          outcome: 'skipped',
          outputSummary: JSON.stringify({ reason: 'insufficient data' }),
        });
        progressCallback?.(100, 'No gap signals found');
        console.log(`[AnalyzeKnowledgeGaps] No data for ${orgId}, skipping`);
        return;
      }

      console.log(
        `[AnalyzeKnowledgeGaps] Collected ${allSignals.length} signals for ${orgId} ` +
          `(search: ${searchSignals.length}, agentic: ${agenticSignals.length}, chat: ${chatSignals.length})`
      );

      // Phase 2: Deduplicate and embed
      progressCallback?.(40, 'Generating embeddings for gap queries...');
      const aggregated = aggregateSignals(allSignals);
      const embedded = await embedAggregates(aggregated);

      if (embedded.length === 0) {
        progressCallback?.(100, 'No queries could be embedded');
        return;
      }

      // Phase 3: Cluster by embedding similarity (>0.8)
      progressCallback?.(60, 'Clustering similar queries...');
      const clusters = clusterByEmbeddingSimilarity(embedded);

      // Phase 4: Score and classify
      progressCallback?.(70, 'Calculating impact scores...');
      const scoredGaps = clusters.map(scoreCluster);

      // Phase 5: Upsert into knowledge_gaps
      progressCallback?.(80, 'Upserting knowledge gaps...');
      const { created, updated } = await upsertKnowledgeGaps(supabase, orgId, scoredGaps);

      progressCallback?.(
        100,
        `Analysis complete: ${scoredGaps.length} gaps (${created} new, ${updated} updated)`
      );
      console.log(
        `[AnalyzeKnowledgeGaps] Complete for ${orgId}: ${scoredGaps.length} gaps (${created} new, ${updated} updated)`
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Data collection: search metrics
// ---------------------------------------------------------------------------

/**
 * Query search_metrics_archive for queries with 0 results or low avg
 * similarity (<0.5). Filters out records with null user_id (bot traffic).
 */
async function collectSearchMetricGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<GapSignal[]> {
  try {
    // Zero-result searches
    const { data: zeroResults } = await supabase
      .from('search_metrics_archive')
      .select('query_text, user_id, search_timestamp')
      .eq('org_id', orgId)
      .eq('sources_found', 0)
      .not('user_id', 'is', null)
      .gte('search_timestamp', since)
      .limit(500);

    // Low-similarity searches (results found but poor quality)
    const { data: lowSimilarity } = await supabase
      .from('search_metrics_archive')
      .select('query_text, user_id, search_timestamp')
      .eq('org_id', orgId)
      .gt('sources_found', 0)
      .lt('avg_similarity', 0.5)
      .not('user_id', 'is', null)
      .gte('search_timestamp', since)
      .limit(500);

    const signals: GapSignal[] = [];

    for (const row of zeroResults ?? []) {
      signals.push({
        query: row.query_text,
        userId: row.user_id,
        timestamp: row.search_timestamp,
        source: 'search_metrics',
      });
    }

    for (const row of lowSimilarity ?? []) {
      signals.push({
        query: row.query_text,
        userId: row.user_id,
        timestamp: row.search_timestamp,
        source: 'search_metrics',
      });
    }

    return signals;
  } catch (error) {
    // Table may not exist; degrade gracefully
    console.warn('[AnalyzeKnowledgeGaps] search_metrics_archive query failed:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data collection: agentic search logs
// ---------------------------------------------------------------------------

/**
 * Query agentic_search_logs for iterations that identified gaps.
 * Filters out records with null user_id.
 */
async function collectAgenticSearchGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<GapSignal[]> {
  try {
    const { data: logs } = await supabase
      .from('agentic_search_logs')
      .select('original_query, user_id, iterations, created_at')
      .eq('org_id', orgId)
      .not('user_id', 'is', null)
      .gte('created_at', since)
      .limit(500);

    if (!logs) return [];

    const signals: GapSignal[] = [];

    for (const log of logs) {
      const iterations = log.iterations as Array<{
        gaps?: string[];
      }> | null;

      if (!iterations) continue;

      const hasGaps = iterations.some(
        (iter) => Array.isArray(iter.gaps) && iter.gaps.length > 0
      );

      if (hasGaps) {
        // Use the original query as the gap signal
        signals.push({
          query: log.original_query as string,
          userId: log.user_id as string,
          timestamp: log.created_at as string,
          source: 'agentic_search',
        });

        // Also add individual gap descriptions as signals
        for (const iter of iterations) {
          for (const gap of iter.gaps ?? []) {
            if (gap && gap.length > 3) {
              signals.push({
                query: gap,
                userId: log.user_id as string,
                timestamp: log.created_at as string,
                source: 'agentic_search',
              });
            }
          }
        }
      }
    }

    return signals;
  } catch (error) {
    console.warn('[AnalyzeKnowledgeGaps] agentic_search_logs query failed:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data collection: chat conversations
// ---------------------------------------------------------------------------

/**
 * Find chat conversations where the assistant responded with low-confidence
 * phrases like "I could not find". Extracts the preceding user message
 * as the gap query.
 */
async function collectChatGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<GapSignal[]> {
  try {
    // Get conversation IDs for this org in the lookback window
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('org_id', orgId)
      .gte('updated_at', since)
      .limit(200);

    if (!conversations?.length) return [];

    const conversationIds = conversations.map((c) => c.id);
    const userMap = new Map(conversations.map((c) => [c.id, c.user_id]));

    // Fetch recent messages from these conversations
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(2000);

    if (!messages?.length) return [];

    // Group messages by conversation for sequential access
    const byConversation = new Map<string, typeof messages>();
    for (const msg of messages) {
      const list = byConversation.get(msg.conversation_id) ?? [];
      list.push(msg);
      byConversation.set(msg.conversation_id, list);
    }

    const signals: GapSignal[] = [];

    for (const [convId, convMessages] of byConversation) {
      const userId = userMap.get(convId) ?? null;
      if (!userId) continue; // Filter bot/system conversations

      for (let i = 0; i < convMessages.length; i++) {
        const msg = convMessages[i];
        if (msg.role !== 'assistant') continue;

        const text = extractTextFromContent(msg.content as Json);
        if (!text) continue;

        const isLowConfidence = LOW_CONFIDENCE_PATTERNS.some((pattern) =>
          text.toLowerCase().includes(pattern)
        );

        if (!isLowConfidence) continue;

        // Find the preceding user message as the gap query
        const userQuery = findPrecedingUserMessage(convMessages, i);
        if (userQuery) {
          signals.push({
            query: userQuery,
            userId,
            timestamp: msg.created_at,
            source: 'chat',
          });
        }
      }
    }

    return signals;
  } catch (error) {
    console.warn('[AnalyzeKnowledgeGaps] chat query failed:', error);
    return [];
  }
}

/** Extract plain text from a chat message content field (Json type). */
function extractTextFromContent(content: Json): string | null {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    // Content blocks format: [{ type: 'text', text: '...' }, ...]
    return content
      .filter(
        (block): block is { type: string; text: string } =>
          typeof block === 'object' &&
          block !== null &&
          'text' in block &&
          typeof (block as Record<string, unknown>).text === 'string'
      )
      .map((block) => block.text)
      .join(' ');
  }

  if (typeof content === 'object' && content !== null && 'text' in content) {
    return String((content as Record<string, unknown>).text);
  }

  return null;
}

/** Find the most recent user message before the given index. */
function findPrecedingUserMessage(
  messages: Array<{ role: string; content: Json }>,
  beforeIndex: number
): string | null {
  for (let i = beforeIndex - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return extractTextFromContent(messages[i].content as Json);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aggregation and embedding
// ---------------------------------------------------------------------------

/** Deduplicate signals by query text, aggregating counts and user IDs. */
function aggregateSignals(
  signals: GapSignal[]
): Array<{ query: string; count: number; userIds: Set<string>; lastSeen: string }> {
  const map = new Map<
    string,
    { query: string; count: number; userIds: Set<string>; lastSeen: string }
  >();

  for (const signal of signals) {
    const key = signal.query.toLowerCase().trim();
    if (!key) continue;

    const existing = map.get(key);

    if (existing) {
      existing.count++;
      if (signal.userId) existing.userIds.add(signal.userId);
      if (signal.timestamp > existing.lastSeen) existing.lastSeen = signal.timestamp;
    } else {
      map.set(key, {
        query: signal.query.trim(),
        count: 1,
        userIds: new Set(signal.userId ? [signal.userId] : []),
        lastSeen: signal.timestamp,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_UNIQUE_QUERIES);
}

/** Generate embeddings for aggregated queries. */
async function embedAggregates(
  aggregates: Array<{ query: string; count: number; userIds: Set<string>; lastSeen: string }>
): Promise<EmbeddedAggregate[]> {
  const results: EmbeddedAggregate[] = [];

  for (const agg of aggregates) {
    try {
      const { embedding } = await generateEmbeddingWithFallback(
        agg.query,
        'RETRIEVAL_QUERY'
      );
      results.push({ ...agg, embedding });
    } catch (error) {
      console.error(
        `[AnalyzeKnowledgeGaps] Embedding failed for "${agg.query.slice(0, 50)}":`,
        error
      );
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

interface Cluster {
  topic: string;
  embedding: number[];
  searchCount: number;
  uniqueSearcherIds: Set<string>;
  lastSearchedAt: string;
  topCount: number; // count of the highest-frequency query in the cluster
}

/** Group queries with >0.8 cosine similarity into clusters. */
function clusterByEmbeddingSimilarity(items: EmbeddedAggregate[]): Cluster[] {
  const clusters: Cluster[] = [];

  for (const item of items) {
    let merged = false;

    for (const cluster of clusters) {
      if (cosineSimilarity(item.embedding, cluster.embedding) > CLUSTER_THRESHOLD) {
        cluster.searchCount += item.count;
        for (const uid of item.userIds) cluster.uniqueSearcherIds.add(uid);
        if (item.lastSeen > cluster.lastSearchedAt) {
          cluster.lastSearchedAt = item.lastSeen;
        }
        // Use the highest-frequency query as the topic label
        if (item.count > cluster.topCount) {
          cluster.topic = item.query;
          cluster.embedding = item.embedding;
          cluster.topCount = item.count;
        }
        merged = true;
        break;
      }
    }

    if (!merged) {
      clusters.push({
        topic: item.query,
        embedding: item.embedding,
        searchCount: item.count,
        uniqueSearcherIds: new Set(item.userIds),
        lastSearchedAt: item.lastSeen,
        topCount: item.count,
      });
    }
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Calculate impact score and severity for a cluster. */
function scoreCluster(cluster: Cluster): ScoredGap {
  const recencyScore = calculateRecencyScore(cluster.lastSearchedAt);
  const impactScore =
    cluster.searchCount * 0.4 +
    cluster.uniqueSearcherIds.size * 0.3 +
    recencyScore * 0.3;

  // Round to two decimal places
  const rounded = Math.round(impactScore * 100) / 100;

  return {
    topic: cluster.topic,
    searchCount: cluster.searchCount,
    uniqueSearchers: cluster.uniqueSearcherIds.size,
    lastSearchedAt: cluster.lastSearchedAt,
    impactScore: rounded,
    severity: calculateSeverity(rounded),
    embedding: cluster.embedding,
  };
}

/**
 * Recency score on a 0-1 scale.
 * 1.0 if the last query was today, decaying linearly to 0 over 30 days.
 */
function calculateRecencyScore(lastSearchedAt: string): number {
  const daysSince =
    (Date.now() - new Date(lastSearchedAt).getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.round((1 - daysSince / LOOKBACK_DAYS) * 100) / 100);
}

function calculateSeverity(impactScore: number): KnowledgeGapSeverity {
  if (impactScore > 8) return 'critical';
  if (impactScore > 5) return 'high';
  if (impactScore > 2) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

/**
 * Upsert scored gaps into knowledge_gaps.
 * If an existing gap has >0.9 embedding similarity, update it.
 * Otherwise insert a new gap.
 */
async function upsertKnowledgeGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  gaps: ScoredGap[]
): Promise<{ created: number; updated: number }> {
  // Fetch existing open gaps for this org
  const { data: existingGaps } = await supabase
    .from('knowledge_gaps')
    .select('id, topic, metadata, search_count, impact_score')
    .eq('org_id', orgId)
    .in('status', ['open', 'acknowledged'])
    .limit(500);

  // Build map of existing gaps with their stored embeddings
  const existingWithEmbeddings: Array<{
    id: string;
    topic: string;
    searchCount: number;
    impactScore: number;
    embedding: number[] | null;
  }> = (existingGaps ?? []).map((g) => ({
    id: g.id,
    topic: g.topic,
    searchCount: g.search_count ?? 0,
    impactScore: g.impact_score ?? 0,
    embedding: extractEmbeddingFromMetadata(g.metadata),
  }));

  let created = 0;
  let updated = 0;

  for (const gap of gaps) {
    const match = findBestMatch(gap.embedding, existingWithEmbeddings);

    if (match) {
      // Update existing gap: combine search counts, recalculate score
      const combinedSearchCount = (match.searchCount || 0) + gap.searchCount;
      const newImpactScore = Math.max(gap.impactScore, match.impactScore);

      await supabase
        .from('knowledge_gaps')
        .update({
          search_count: combinedSearchCount,
          unique_searchers: gap.uniqueSearchers,
          impact_score: newImpactScore,
          severity: calculateSeverity(newImpactScore),
          last_searched_at: gap.lastSearchedAt,
          metadata: { embedding: gap.embedding } as unknown as Json,
        })
        .eq('id', match.id);

      // Update local cache so subsequent gaps can match against it
      match.searchCount = combinedSearchCount;
      match.impactScore = newImpactScore;
      match.embedding = gap.embedding;

      updated++;
    } else {
      // Insert new gap
      const { data: inserted } = await supabase
        .from('knowledge_gaps')
        .insert({
          org_id: orgId,
          topic: gap.topic,
          severity: gap.severity,
          impact_score: gap.impactScore,
          search_count: gap.searchCount,
          unique_searchers: gap.uniqueSearchers,
          last_searched_at: gap.lastSearchedAt,
          status: 'open',
          metadata: { embedding: gap.embedding } as unknown as Json,
        })
        .select('id')
        .single();

      // Add to cache for subsequent dedup
      if (inserted) {
        existingWithEmbeddings.push({
          id: inserted.id,
          topic: gap.topic,
          searchCount: gap.searchCount,
          impactScore: gap.impactScore,
          embedding: gap.embedding,
        });
      }

      created++;
    }
  }

  return { created, updated };
}

/** Extract the stored embedding from a knowledge_gap's metadata field. */
function extractEmbeddingFromMetadata(metadata: Json | null): number[] | null {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    'embedding' in metadata &&
    Array.isArray((metadata as Record<string, unknown>).embedding)
  ) {
    return (metadata as Record<string, unknown>).embedding as number[];
  }
  return null;
}

/**
 * Find the best-matching existing gap with >0.9 cosine similarity.
 * Returns null if no match above threshold.
 */
function findBestMatch(
  embedding: number[],
  existing: Array<{
    id: string;
    topic: string;
    searchCount: number;
    impactScore: number;
    embedding: number[] | null;
  }>
): (typeof existing)[number] | null {
  let bestMatch: (typeof existing)[number] | null = null;
  let bestSimilarity = MERGE_THRESHOLD;

  for (const gap of existing) {
    if (!gap.embedding) continue;

    const similarity = cosineSimilarity(embedding, gap.embedding);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = gap;
    }
  }

  return bestMatch;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
