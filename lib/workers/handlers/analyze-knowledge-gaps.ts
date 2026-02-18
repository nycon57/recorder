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

/** Patterns used to detect unanswerable chat queries. */
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

/** A single failed-query event from search, agentic search, or chat. */
interface GapSignal {
  query: string;
  userId: string | null;
  timestamp: string;
  source: 'search_metrics' | 'agentic_search' | 'chat';
}

/** Aggregated query with frequency, users, and embedding for clustering. */
interface EmbeddedAggregate {
  query: string;
  count: number;
  userIds: Set<string>;
  lastSeen: string;
  embedding: number[];
}

/** Clustered gap with impact score and severity classification. */
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
    console.warn('[AnalyzeKnowledgeGaps] Missing orgId, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[AnalyzeKnowledgeGaps] gap_intelligence disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(5, 'Collecting gap signals...');

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
          outputSummary: 'No gap signals found — insufficient data',
        });
        progressCallback?.(100, 'No gap signals found');
        console.log(`[AnalyzeKnowledgeGaps] No data for ${orgId}, skipping`);
        return;
      }

      console.log(
        `[AnalyzeKnowledgeGaps] Collected ${allSignals.length} signals for ${orgId} ` +
          `(search: ${searchSignals.length}, agentic: ${agenticSignals.length}, chat: ${chatSignals.length})`
      );

      progressCallback?.(40, 'Generating embeddings for gap queries...');
      const aggregated = aggregateSignals(allSignals);
      const embedded = await embedAggregates(aggregated);

      if (embedded.length === 0) {
        progressCallback?.(100, 'No queries could be embedded');
        return;
      }

      progressCallback?.(60, 'Clustering similar queries...');
      const clusters = clusterByEmbeddingSimilarity(embedded);

      progressCallback?.(70, 'Calculating impact scores...');
      const scoredGaps = clusters.map(scoreCluster);

      progressCallback?.(80, 'Upserting knowledge gaps...');
      const { created, updated } = await upsertKnowledgeGaps(supabase, orgId, scoredGaps);

      progressCallback?.(90, 'Running bus factor analysis...');
      try {
        await busFactorAnalysis(supabase, orgId);
      } catch (busFactorError) {
        // Bus factor failure must not fail the main gap analysis job.
        console.error('[AnalyzeKnowledgeGaps] Bus factor analysis failed:', busFactorError);
      }

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

/** Collect zero-result and low-similarity searches. Filters out bot traffic (null user_id). */
async function collectSearchMetricGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<GapSignal[]> {
  try {
    const { data: zeroResults } = await supabase
      .from('search_metrics_archive')
      .select('query_text, user_id, search_timestamp')
      .eq('org_id', orgId)
      .eq('sources_found', 0)
      .not('user_id', 'is', null)
      .gte('search_timestamp', since)
      .limit(500);

    const { data: lowSimilarity } = await supabase
      .from('search_metrics_archive')
      .select('query_text, user_id, search_timestamp')
      .eq('org_id', orgId)
      .gt('sources_found', 0)
      .lt('avg_similarity', 0.5)
      .not('user_id', 'is', null)
      .gte('search_timestamp', since)
      .limit(500);

    return [...(zeroResults ?? []), ...(lowSimilarity ?? [])].map((row) => ({
      query: row.query_text,
      userId: row.user_id,
      timestamp: row.search_timestamp,
      source: 'search_metrics' as const,
    }));
  } catch (error) {
    console.warn('[AnalyzeKnowledgeGaps] search_metrics_archive query failed:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data collection: agentic search logs
// ---------------------------------------------------------------------------

/** Collect queries from agentic_search_logs where iterations identified gaps. */
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

    return logs.flatMap((log) => {
      const iterations = log.iterations as Array<{ gaps?: string[] }> | null;
      if (!iterations) return [];

      const hasGaps = iterations.some(
        (iter) => Array.isArray(iter.gaps) && iter.gaps.length > 0
      );
      if (!hasGaps) return [];

      // Original query as the primary gap signal
      const primary: GapSignal = {
        query: log.original_query as string,
        userId: log.user_id as string,
        timestamp: log.created_at as string,
        source: 'agentic_search',
      };

      // Individual gap descriptions as additional signals
      const gapSignals: GapSignal[] = iterations.flatMap((iter) =>
        (iter.gaps ?? [])
          .filter((gap) => gap && gap.length > 3)
          .map((gap) => ({
            query: gap,
            userId: log.user_id as string,
            timestamp: log.created_at as string,
            source: 'agentic_search' as const,
          }))
      );

      return [primary, ...gapSignals];
    });
  } catch (error) {
    console.warn('[AnalyzeKnowledgeGaps] agentic_search_logs query failed:', error);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Data collection: chat conversations
// ---------------------------------------------------------------------------

/** Collect user queries from chats where the assistant gave low-confidence responses. */
async function collectChatGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<GapSignal[]> {
  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, user_id')
      .eq('org_id', orgId)
      .gte('updated_at', since)
      .limit(200);

    if (!conversations?.length) return [];

    const conversationIds = conversations.map((c) => c.id);
    const userMap = new Map(conversations.map((c) => [c.id, c.user_id]));

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('id, conversation_id, role, content, created_at')
      .in('conversation_id', conversationIds)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(2000);

    if (!messages?.length) return [];

    const byConversation = new Map<string, typeof messages>();
    for (const msg of messages) {
      const list = byConversation.get(msg.conversation_id) ?? [];
      list.push(msg);
      byConversation.set(msg.conversation_id, list);
    }

    const signals: GapSignal[] = [];

    for (const [convId, convMessages] of byConversation) {
      const userId = userMap.get(convId) ?? null;
      if (!userId) continue;

      for (let i = 0; i < convMessages.length; i++) {
        const msg = convMessages[i];
        if (msg.role !== 'assistant') continue;

        const text = extractTextFromContent(msg.content as Json);
        if (!text) continue;

        const isLowConfidence = LOW_CONFIDENCE_PATTERNS.some((pattern) =>
          text.toLowerCase().includes(pattern)
        );

        if (!isLowConfidence) continue;

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

/** Extract plain text from chat message content. */
function extractTextFromContent(content: Json): string | null {
  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
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

/** Find preceding user message. */
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

/** Deduplicate signals by query text, aggregate counts and users. */
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

/** Generate embeddings for aggregated queries, skipping failures. */
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

/** Group queries by embedding similarity into clusters. */
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
        // Use highest-frequency query as topic label
        if (item.count > cluster.topCount) {
          cluster.topic = item.query;
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

/** Score a cluster: impact_score = (count * 0.4) + (users * 0.3) + (recency * 0.3). */
function scoreCluster(cluster: Cluster): ScoredGap {
  const recencyScore = calculateRecencyScore(cluster.lastSearchedAt);
  const impactScore =
    cluster.searchCount * 0.4 +
    cluster.uniqueSearcherIds.size * 0.3 +
    recencyScore * 0.3;

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

/** Recency score (0-1) decaying linearly over the lookback period. */
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

/** Upsert gaps: update existing gaps with high embedding similarity, insert new ones. */
async function upsertKnowledgeGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  gaps: ScoredGap[]
): Promise<{ created: number; updated: number }> {
  const { data: existingGaps } = await supabase
    .from('knowledge_gaps')
    .select('id, topic, metadata, search_count, impact_score')
    .eq('org_id', orgId)
    .in('status', ['open', 'acknowledged'])
    .limit(500);

  const existingWithEmbeddings: Array<{
    id: string;
    topic: string;
    searchCount: number;
    impactScore: number;
    uniqueSearchers: number;
    embedding: number[] | null;
  }> = (existingGaps ?? []).map((g) => ({
    id: g.id,
    topic: g.topic,
    searchCount: g.search_count ?? 0,
    impactScore: g.impact_score ?? 0,
    uniqueSearchers: 0,
    embedding: extractEmbeddingFromMetadata(g.metadata),
  }));

  let created = 0;
  let updated = 0;

  const toUpdate: Array<{ match: (typeof existingWithEmbeddings)[number]; gap: ScoredGap }> = [];
  const toInsert: ScoredGap[] = [];

  for (const gap of gaps) {
    const match = findBestMatch(gap.embedding, existingWithEmbeddings);
    if (match) {
      toUpdate.push({ match, gap });
    } else {
      toInsert.push(gap);
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('knowledge_gaps')
      .insert(
        toInsert.map((gap) => ({
          org_id: orgId,
          topic: gap.topic,
          severity: gap.severity,
          impact_score: gap.impactScore,
          search_count: gap.searchCount,
          unique_searchers: gap.uniqueSearchers,
          last_searched_at: gap.lastSearchedAt,
          status: 'open' as const,
          metadata: { embedding: gap.embedding } as unknown as Json,
        }))
      )
      .select('id, topic, search_count, impact_score, metadata');

    if (insertError) {
      console.error('[AnalyzeKnowledgeGaps] Batch insert failed:', insertError);
    } else if (inserted) {
      created = inserted.length;
      for (const row of inserted) {
        existingWithEmbeddings.push({
          id: row.id,
          topic: row.topic,
          searchCount: row.search_count ?? 0,
          impactScore: row.impact_score ?? 0,
          uniqueSearchers: 0,
          embedding: extractEmbeddingFromMetadata(row.metadata),
        });
      }
    }
  }

  for (const { match, gap } of toUpdate) {
    const combinedSearchCount = match.searchCount + gap.searchCount;
    const newImpactScore = Math.max(gap.impactScore, match.impactScore);
    const combinedUniqueSearchers = Math.max(match.uniqueSearchers ?? 0, gap.uniqueSearchers ?? 0);

    const { error: updateError } = await supabase
      .from('knowledge_gaps')
      .update({
        search_count: combinedSearchCount,
        unique_searchers: combinedUniqueSearchers,
        impact_score: newImpactScore,
        severity: calculateSeverity(newImpactScore),
        last_searched_at: gap.lastSearchedAt,
        metadata: { embedding: gap.embedding } as unknown as Json,
      })
      .eq('id', match.id);

    if (updateError) {
      console.error(`[AnalyzeKnowledgeGaps] Failed to update gap ${match.id}:`, updateError);
      continue;
    }

    match.searchCount = combinedSearchCount;
    match.impactScore = newImpactScore;
    match.uniqueSearchers = combinedUniqueSearchers;
    match.embedding = gap.embedding;
    updated++;
  }

  return { created, updated };
}

/** Extract embedding array from metadata, or null. */
function extractEmbeddingFromMetadata(metadata: Json | null): number[] | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const embedding = (metadata as Record<string, unknown>).embedding;
  return Array.isArray(embedding) ? (embedding as number[]) : null;
}

/** Find best-matching existing gap above merge threshold, or null. */
function findBestMatch(
  embedding: number[],
  existing: Array<{
    id: string;
    topic: string;
    searchCount: number;
    impactScore: number;
    uniqueSearchers: number;
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
// Bus Factor Analysis
// ---------------------------------------------------------------------------

/**
 * Identifies concepts where all content mentions come from a single user.
 * Creates or updates 'bus_factor' knowledge gaps for at-risk concepts.
 *
 * Skipped entirely for orgs with fewer than 3 active users — bus factor
 * analysis is meaningless for solo users or very small teams.
 */
async function busFactorAnalysis(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<void> {
  const { count: activeUserCount } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (!activeUserCount || activeUserCount < 3) {
    await logAgentAction({
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'detect_bus_factor',
      outcome: 'skipped',
      outputSummary: 'org has fewer than 3 active users',
    });
    console.log(
      `[AnalyzeKnowledgeGaps] Bus factor skipped for ${orgId}: fewer than 3 active users`
    );
    return;
  }

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'detect_bus_factor',
      inputSummary: `Bus factor analysis for org ${orgId} (${activeUserCount} active users)`,
    },
    async () => {
      // concept_mentions is not in generated DB types — cast to concrete shape below.
      const { data: rawMentions, error: mentionsError } = await supabase
        .from('concept_mentions')
        .select('concept_id, content_id')
        .eq('org_id', orgId)
        .limit(5000);

      if (mentionsError) {
        console.warn('[AnalyzeKnowledgeGaps] concept_mentions query failed:', mentionsError);
        return;
      }

      if (!rawMentions?.length) return;

      const mentions = rawMentions as { concept_id: string; content_id: string }[];
      const uniqueContentIds = [...new Set(mentions.map((m) => m.content_id))];
      const contentUserMap = new Map<string, string>();
      const BATCH = 100;

      for (let i = 0; i < uniqueContentIds.length; i += BATCH) {
        const batch = uniqueContentIds.slice(i, i + BATCH);
        const { data: rows } = await supabase
          .from('content')
          .select('id, created_by')
          .in('id', batch)
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .in('status', ['completed', 'transcribed']);

        for (const row of rows ?? []) {
          contentUserMap.set(row.id, row.created_by);
        }
      }

      // Group mentions by concept_id, tracking unique contributors and count.
      const conceptUsers = new Map<string, Set<string>>();
      const conceptCounts = new Map<string, number>();

      for (const { content_id: contentId, concept_id: conceptId } of mentions) {
        const userId = contentUserMap.get(contentId);
        if (!userId) continue;

        if (!conceptUsers.has(conceptId)) conceptUsers.set(conceptId, new Set());
        conceptUsers.get(conceptId)!.add(userId);
        conceptCounts.set(conceptId, (conceptCounts.get(conceptId) ?? 0) + 1);
      }

      // Keep only concepts with exactly one contributor — the bus factor signal.
      const singleExpert: Array<{
        conceptId: string;
        expertUserId: string;
        mentionCount: number;
      }> = [];
      for (const [conceptId, userSet] of conceptUsers) {
        if (userSet.size === 1) {
          singleExpert.push({
            conceptId,
            expertUserId: [...userSet][0],
            mentionCount: conceptCounts.get(conceptId) ?? 0,
          });
        }
      }

      if (!singleExpert.length) {
        console.log(`[AnalyzeKnowledgeGaps] No bus factor risks found for ${orgId}`);
        return;
      }

      const conceptIds = singleExpert.map((s) => s.conceptId);
      // knowledge_concepts is not in generated DB types — cast to concrete shape.
      const { data: rawConceptRows } = await supabase
        .from('knowledge_concepts')
        .select('id, name')
        .eq('org_id', orgId)
        .in('id', conceptIds);
      const conceptRows = (rawConceptRows ?? []) as { id: string; name: string }[];
      const conceptNameMap = new Map<string, string>(conceptRows.map((c) => [c.id, c.name]));

      const expertIds = [...new Set(singleExpert.map((s) => s.expertUserId))];
      const { data: userRows } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('org_id', orgId)
        .in('id', expertIds);
      const userDisplayName = new Map<string, string>(
        (userRows ?? []).map((u) => [u.id, u.name ?? u.email])
      );

      const { data: existingGaps } = await supabase
        .from('knowledge_gaps')
        .select('id, metadata')
        .eq('org_id', orgId)
        .in('status', ['open', 'acknowledged']);

      const existingByConceptId = new Map<string, string>(); // conceptId → gap id
      for (const gap of existingGaps ?? []) {
        const meta = gap.metadata as Record<string, unknown> | null;
        if (meta?.gapType === 'bus_factor' && typeof meta.conceptId === 'string') {
          existingByConceptId.set(meta.conceptId, gap.id);
        }
      }

      let updated = 0;
      const toInsert: Array<{
        org_id: string;
        topic: string;
        description: string;
        severity: KnowledgeGapSeverity;
        status: string;
        metadata: Json;
      }> = [];

      for (const { conceptId, expertUserId, mentionCount } of singleExpert) {
        const conceptName = conceptNameMap.get(conceptId);
        if (!conceptName) continue;

        const userName = userDisplayName.get(expertUserId) ?? expertUserId;
        // 5+ mentions = well-documented by one person, therefore high-risk.
        const severity: KnowledgeGapSeverity = mentionCount >= 5 ? 'high' : 'medium';
        const topic = `${conceptName} (single expert)`;
        const description =
          `Only ${userName} has recorded content about ${conceptName}. ` +
          `Consider having another team member document this topic.`;
        const metadata: Json = {
          gapType: 'bus_factor',
          expertUserId,
          conceptId,
          mentionCount,
        };

        const existingId = existingByConceptId.get(conceptId);
        if (existingId) {
          // Updates must be per-row: each gap has unique topic/description/severity.
          const { error } = await supabase
            .from('knowledge_gaps')
            .update({ topic, description, severity, metadata })
            .eq('id', existingId);
          if (!error) updated++;
        } else {
          toInsert.push({ org_id: orgId, topic, description, severity, status: 'open', metadata });
        }
      }

      // Batch-insert new gaps in a single round trip.
      let created = 0;
      if (toInsert.length) {
        const { error } = await supabase.from('knowledge_gaps').insert(toInsert);
        created = error ? 0 : toInsert.length;
      }

      console.log(
        `[AnalyzeKnowledgeGaps] Bus factor: ${singleExpert.length} at-risk concepts, ` +
          `${created} new gaps, ${updated} updated`
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  if (a.length !== b.length) {
    console.warn(
      `[AnalyzeKnowledgeGaps] Embedding dimension mismatch: ${a.length} vs ${b.length}`
    );
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA * normB);
  return denom === 0 ? 0 : dot / denom;
}
