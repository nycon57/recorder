/**
 * Generate Weekly Digest Job Handler
 *
 * Produces a comprehensive knowledge report for an org covering
 * the past 7 days: new content, trending concepts, knowledge gaps,
 * curator actions, search activity, and agent performance.
 * Uses Gemini to generate a natural-language summary.
 */

import { GoogleGenAI } from '@google/genai';

import { isAgentEnabled } from '@/lib/services/agent-config';
import { withAgentLogging, logAgentAction } from '@/lib/services/agent-logger';
import { getTopConceptsForOrg } from '@/lib/services/concept-extractor';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

import type { ProgressCallback } from '../job-processor';

type Job = Database['public']['Tables']['jobs']['Row'];

const AGENT_TYPE = 'digest';
const LOOKBACK_DAYS = 7;
const MAX_CONTENT_FOR_SUMMARY = 20;
const MAX_CONCEPTS_FOR_SUMMARY = 10;
const MAX_TITLE_LENGTH = 80;

const EMPTY_GAPS: KnowledgeGapsData = { openCount: 0, newCount: 0, topics: [] };

/** Simple pluralization: pluralize(3, 'search', 'es') => 'searches' */
function pluralize(count: number, noun: string, suffix = 's'): string {
  return count === 1 ? noun : noun + suffix;
}

// Lazy-init Gemini client
let genaiClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI {
  if (!genaiClient) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
    }
    genaiClient = new GoogleGenAI({ apiKey });
  }
  return genaiClient;
}

interface DigestStats {
  contentAdded: number;
  conceptsExtracted: number;
  healthScore: number;
  searches: number;
  failedSearches: number;
  curatorDuplicatesFound: number;
  curatorStaleDetected: number;
  agentActionsTotal: number;
  agentSuccessRate: number;
}

interface WeeklyDigest {
  period: { start: string; end: string };
  summary: string;
  stats: DigestStats;
  highlights: string[];
  gaps: string[];
}

export async function handleGenerateWeeklyDigest(
  job: Job,
  progressCallback?: ProgressCallback
): Promise<void> {
  const payload = job.payload as Record<string, unknown>;
  const orgId = (payload.orgId as string) || '';

  if (!orgId) {
    console.warn('[WeeklyDigest] Missing orgId in payload, skipping');
    return;
  }

  if (!(await isAgentEnabled(orgId, AGENT_TYPE))) {
    console.log(`[WeeklyDigest] Digest agent disabled for ${orgId}, skipping`);
    return;
  }

  progressCallback?.(5, 'Digest agent enabled, collecting data...');

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'generate_digest',
      inputSummary: `Generate weekly digest for org ${orgId}`,
    },
    async () => {
      const supabase = createAdminClient();
      const now = new Date();
      const periodEnd = now.toISOString();
      const periodStart = new Date(
        now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000
      ).toISOString();

      // --- Collect data in parallel ---
      progressCallback?.(10, 'Collecting content activity...');

      const [
        contentData,
        conceptData,
        gapsData,
        curatorData,
        searchData,
        agentData,
      ] = await Promise.all([
        collectContentActivity(supabase, orgId, periodStart),
        collectConceptActivity(orgId, periodStart),
        collectKnowledgeGaps(supabase, orgId, periodStart),
        collectCuratorActions(supabase, orgId, periodStart),
        collectSearchActivity(supabase, orgId, periodStart),
        collectAgentActivity(supabase, orgId, periodStart),
      ]);

      progressCallback?.(50, 'Data collected, generating summary...');

      // --- Build stats ---
      const stats: DigestStats = {
        contentAdded: contentData.count,
        conceptsExtracted: conceptData.newCount,
        healthScore: calculateHealthScore(
          contentData.count,
          searchData.total,
          searchData.failed,
          gapsData.openCount
        ),
        searches: searchData.total,
        failedSearches: searchData.failed,
        curatorDuplicatesFound: curatorData.duplicates,
        curatorStaleDetected: curatorData.stale,
        agentActionsTotal: agentData.total,
        agentSuccessRate: agentData.successRate,
      };

      // --- Generate summary via Gemini ---
      progressCallback?.(60, 'Generating AI summary...');

      const { summary, highlights } = await generateDigestSummary({
        contentData,
        conceptData,
        gapsData,
        searchData,
        curatorData,
        agentData,
        stats,
      }).catch((error) => {
        console.error('[WeeklyDigest] Gemini summary failed, using fallback:', error);
        return buildFallbackSummary(stats, contentData, conceptData);
      });

      // --- Compose digest ---
      const digest: WeeklyDigest = {
        period: { start: periodStart, end: periodEnd },
        summary,
        stats,
        highlights,
        gaps: gapsData.topics,
      };

      progressCallback?.(85, 'Storing digest...');

      // Store in agent_activity_log
      await logAgentAction({
        orgId,
        agentType: AGENT_TYPE,
        actionType: 'weekly_digest',
        outputSummary: JSON.stringify(digest),
        outcome: 'success',
        metadata: { digest } as unknown as Json,
      });

      progressCallback?.(100, 'Weekly digest generated');
      console.log(
        `[WeeklyDigest] Generated digest for org ${orgId}: ${stats.contentAdded} content, ${stats.conceptsExtracted} concepts, ${stats.searches} searches`
      );
    }
  );
}

// ---------------------------------------------------------------------------
// Data collection functions
// ---------------------------------------------------------------------------

interface ContentActivityData {
  count: number;
  titles: string[];
}

async function collectContentActivity(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<ContentActivityData> {
  // Use exact count to get accurate total even when more than 100 items exist
  const { data, count, error } = await supabase
    .from('content')
    .select('id, title', { count: 'exact' })
    .eq('org_id', orgId)
    .gte('created_at', since)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[WeeklyDigest] Failed to fetch content activity:', error.message);
    return { count: 0, titles: [] };
  }

  const items = data ?? [];
  return {
    count: count ?? items.length,
    titles: items.map(c => c.title ?? 'Untitled'),
  };
}

interface ConceptActivityData {
  newCount: number;
  topConcepts: { name: string; mentionCount: number }[];
}

async function collectConceptActivity(
  orgId: string,
  since: string
): Promise<ConceptActivityData> {
  try {
    const concepts = await getTopConceptsForOrg(orgId, 100);

    // Filter to concepts first seen in our period
    const sinceDate = new Date(since);
    const newConcepts = concepts.filter(
      c => c.firstSeenAt && c.firstSeenAt >= sinceDate
    );

    const topConcepts = concepts
      .sort((a, b) => b.mentionCount - a.mentionCount)
      .slice(0, MAX_CONCEPTS_FOR_SUMMARY)
      .map(c => ({ name: c.name, mentionCount: c.mentionCount }));

    return {
      newCount: newConcepts.length,
      topConcepts,
    };
  } catch (error) {
    console.warn('[WeeklyDigest] Failed to fetch concept activity:', error);
    return { newCount: 0, topConcepts: [] };
  }
}

interface KnowledgeGapsData {
  openCount: number;
  newCount: number;
  topics: string[];
}

/** Check whether an error indicates the knowledge_gaps table does not exist yet. */
function isTableMissingError(error: { message?: string; code?: string } | Error | unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code: string }).code
    : '';
  return msg.includes('does not exist') || code === '42P01';
}

async function collectKnowledgeGaps(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<KnowledgeGapsData> {
  try {
    // Query new gaps created in the period
    const { data: newGaps, error: newError } = await supabase
      .from('knowledge_gaps')
      .select('id, topic, status')
      .eq('org_id', orgId)
      .gte('created_at', since);

    if (newError) {
      if (isTableMissingError(newError)) {
        console.log('[WeeklyDigest] knowledge_gaps table not available, omitting gaps');
        return EMPTY_GAPS;
      }
      throw newError;
    }

    // Query all open gaps
    const { data: openGaps, error: openError } = await supabase
      .from('knowledge_gaps')
      .select('id')
      .eq('org_id', orgId)
      .eq('status', 'open');

    const openCount = openError ? 0 : (openGaps?.length ?? 0);
    const newItems = newGaps ?? [];

    return {
      openCount,
      newCount: newItems.length,
      topics: newItems
        .filter(g => g.status === 'open')
        .map(g => g.topic)
        .slice(0, 10),
    };
  } catch (error) {
    if (isTableMissingError(error)) {
      console.log('[WeeklyDigest] knowledge_gaps table not available, omitting gaps');
      return EMPTY_GAPS;
    }
    console.warn('[WeeklyDigest] Failed to fetch knowledge gaps:', error);
    return EMPTY_GAPS;
  }
}

interface CuratorActivityData {
  duplicates: number;
  stale: number;
}

async function collectCuratorActions(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<CuratorActivityData> {
  const { data, error } = await supabase
    .from('agent_activity_log')
    .select('action_type')
    .eq('org_id', orgId)
    .eq('agent_type', 'curator')
    .eq('outcome', 'success')
    .gte('created_at', since);

  if (error) {
    console.warn('[WeeklyDigest] Failed to fetch curator actions:', error.message);
    return { duplicates: 0, stale: 0 };
  }

  const actions = data ?? [];
  return {
    duplicates: actions.filter(a => a.action_type === 'detect_duplicate').length,
    stale: actions.filter(a => a.action_type === 'detect_staleness').length,
  };
}

interface SearchActivityData {
  total: number;
  failed: number;
  topQueries: string[];
}

async function collectSearchActivity(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<SearchActivityData> {
  const { data, error } = await supabase
    .from('search_analytics')
    .select('query, results_count')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) {
    console.warn('[WeeklyDigest] Failed to fetch search activity:', error.message);
    return { total: 0, failed: 0, topQueries: [] };
  }

  const searches = data ?? [];
  const failed = searches.filter(s => (s.results_count ?? 0) === 0).length;

  // Top queries by frequency
  const queryCounts = new Map<string, number>();
  for (const s of searches) {
    const q = s.query.toLowerCase().trim();
    queryCounts.set(q, (queryCounts.get(q) ?? 0) + 1);
  }
  const topQueries = [...queryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([q]) => q);

  return { total: searches.length, failed, topQueries };
}

interface AgentActivityData {
  total: number;
  successRate: number;
}

async function collectAgentActivity(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  since: string
): Promise<AgentActivityData> {
  const { data, error } = await supabase
    .from('agent_activity_log')
    .select('outcome')
    .eq('org_id', orgId)
    .gte('created_at', since);

  if (error) {
    console.warn('[WeeklyDigest] Failed to fetch agent activity:', error.message);
    return { total: 0, successRate: 0 };
  }

  const actions = data ?? [];
  const total = actions.length;
  if (total === 0) return { total: 0, successRate: 0 };

  const successes = actions.filter(a => a.outcome === 'success').length;
  return {
    total,
    successRate: Math.round((successes / total) * 100),
  };
}

// ---------------------------------------------------------------------------
// Health score calculation
// ---------------------------------------------------------------------------

function calculateHealthScore(
  contentAdded: number,
  totalSearches: number,
  failedSearches: number,
  openGaps: number
): number {
  // Base score of 50, adjusted by activity signals
  let score = 50;

  // Content activity (+up to 20)
  score += Math.min(20, contentAdded * 2);

  // Search success rate (+up to 20)
  if (totalSearches > 0) {
    const successRate = (totalSearches - failedSearches) / totalSearches;
    score += Math.round(successRate * 20);
  }

  // Knowledge gaps penalty (-up to 15)
  score -= Math.min(15, openGaps * 3);

  // Search volume bonus (+up to 10)
  score += Math.min(10, Math.floor(totalSearches / 10));

  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Gemini summary generation
// ---------------------------------------------------------------------------

interface SummaryInput {
  contentData: ContentActivityData;
  conceptData: ConceptActivityData;
  gapsData: KnowledgeGapsData;
  searchData: SearchActivityData;
  curatorData: CuratorActivityData;
  agentData: AgentActivityData;
  stats: DigestStats;
}

async function generateDigestSummary(
  input: SummaryInput
): Promise<{ summary: string; highlights: string[] }> {
  const genai = getGenAIClient();

  // Truncate individual titles and limit count for large orgs
  const truncatedTitles = input.contentData.titles.map(t =>
    t.length > MAX_TITLE_LENGTH ? t.slice(0, MAX_TITLE_LENGTH) + '...' : t
  );
  const titleList =
    input.contentData.count > MAX_CONTENT_FOR_SUMMARY
      ? truncatedTitles.slice(0, MAX_CONTENT_FOR_SUMMARY).join(', ') +
        ` (and ${input.contentData.count - MAX_CONTENT_FOR_SUMMARY} more)`
      : truncatedTitles.join(', ');

  const conceptList = input.conceptData.topConcepts
    .map(c => `${c.name} (${c.mentionCount} mentions)`)
    .join(', ');

  const prompt = `You are a knowledge management assistant. Generate a concise weekly digest summary for a team's knowledge base.

**Activity this week:**
- New content added: ${input.contentData.count}${titleList ? ` — ${titleList}` : ''}
- New concepts extracted: ${input.conceptData.newCount}
- Top concepts: ${conceptList || 'none'}
- Knowledge gaps (open): ${input.gapsData.openCount}${input.gapsData.topics.length > 0 ? ` — topics: ${input.gapsData.topics.join(', ')}` : ''}
- New knowledge gaps detected: ${input.gapsData.newCount}
- Curator actions: ${input.curatorData.duplicates} duplicates found, ${input.curatorData.stale} stale items detected
- Searches: ${input.searchData.total} total, ${input.searchData.failed} failed${input.searchData.topQueries.length > 0 ? ` — top queries: ${input.searchData.topQueries.join(', ')}` : ''}
- Agent actions: ${input.agentData.total} total, ${input.agentData.successRate}% success rate
- Knowledge health score: ${input.stats.healthScore}/100

**Instructions:**
1. Write a 2-3 sentence natural-language summary paragraph highlighting key insights.
2. Provide 2-5 highlight bullet points about notable trends or items needing attention.
3. If there is no activity, note that and suggest the team record recent processes.

Return ONLY valid JSON:
{"summary": "...", "highlights": ["...", "..."]}`;

  const result = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
    config: { temperature: 0.4, maxOutputTokens: 1024 },
  });

  const responseText = result.text ?? '';
  return parseDigestResponse(responseText);
}

function parseDigestResponse(
  responseText: string
): { summary: string; highlights: string[] } {
  try {
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.summary === 'string' && Array.isArray(parsed.highlights)) {
      return {
        summary: parsed.summary,
        highlights: parsed.highlights.filter(
          (h: unknown): h is string => typeof h === 'string'
        ),
      };
    }
  } catch (parseError) {
    console.warn('[WeeklyDigest] Failed to parse Gemini response:', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      responsePreview: responseText.slice(0, 200),
    });
  }
  throw new Error('Failed to parse Gemini digest response');
}

// ---------------------------------------------------------------------------
// Fallback summary (when Gemini is unavailable)
// ---------------------------------------------------------------------------

function buildFallbackSummary(
  stats: DigestStats,
  contentData: ContentActivityData,
  conceptData: ConceptActivityData
): { summary: string; highlights: string[] } {
  if (stats.contentAdded === 0 && stats.searches === 0) {
    return {
      summary:
        'No new content was added this week. Consider recording recent processes to keep your knowledge base current.',
      highlights: [
        'No new content recorded this week',
        'Knowledge base may be going stale without fresh recordings',
      ],
    };
  }

  const parts: string[] = [];

  if (stats.contentAdded > 0) {
    parts.push(`Your team added ${stats.contentAdded} ${pluralize(stats.contentAdded, 'recording')} this week`);
  }

  if (stats.conceptsExtracted > 0) {
    const verb = stats.conceptsExtracted === 1 ? 'was' : 'were';
    parts.push(`${stats.conceptsExtracted} new ${pluralize(stats.conceptsExtracted, 'concept')} ${verb} extracted`);
  }

  if (stats.searches > 0) {
    parts.push(`${stats.searches} ${pluralize(stats.searches, 'search', 'es')} were performed`);
  }

  const summary =
    parts.join('. ') +
    `. Knowledge health score: ${stats.healthScore}/100.`;

  const highlights: string[] = [];

  if (stats.contentAdded > 0 && contentData.titles.length > 0) {
    highlights.push(`${stats.contentAdded} new ${pluralize(stats.contentAdded, 'recording')} added`);
  }

  if (conceptData.topConcepts.length > 0) {
    highlights.push(`Top concept: ${conceptData.topConcepts[0].name}`);
  }

  if (stats.failedSearches > 0) {
    highlights.push(`${stats.failedSearches} ${pluralize(stats.failedSearches, 'search', 'es')} returned no results`);
  }

  return { summary, highlights };
}
