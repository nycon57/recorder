/**
 * Onboarding Engagement Analysis
 *
 * After an onboarding plan is completed, analyzes engagement data with Gemini
 * and stores insights in agent memory for refining future plans.
 */

import { GoogleGenAI } from '@google/genai';

import { storeMemory, recallMemory } from '@/lib/services/agent-memory';
import { withAgentLogging } from '@/lib/services/agent-logger';
import { detectPII, logPIIDetection } from '@/lib/utils/security';
import type { LearningPathItem, EngagementData, Json } from '@/lib/types/database';

const AGENT_TYPE = 'onboarding';

function sanitize(input: string, maxLength = 200): string {
  return input
    .replace(/["""''`]/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .substring(0, maxLength)
    .trim();
}

/** Sanitize and redact PII from user-generated text before sending to LLM */
function redactPII(text: string): string {
  const result = detectPII(text);
  if (result.hasPII) {
    logPIIDetection('onboarding-engagement-prompt', result.types);
  }
  return result.redacted;
}

function getSampleCount(metadata: unknown): number {
  if (
    metadata !== null &&
    typeof metadata === 'object' &&
    'sampleCount' in metadata &&
    typeof (metadata as { sampleCount: unknown }).sampleCount === 'number'
  ) {
    return (metadata as { sampleCount: number }).sampleCount;
  }
  return 0;
}

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

interface AnalysisInput {
  orgId: string;
  planId: string;
  userRole: string | null;
  learningPath: LearningPathItem[];
  engagementData: EngagementData;
  totalItems: number;
  completedItems: number;
}

/**
 * Analyze engagement after an onboarding plan is completed (or abandoned).
 * Stores insights in agent memory keyed by `onboarding_analysis:{orgId}:{role}`.
 */
export async function analyzeOnboardingEngagement(input: AnalysisInput): Promise<void> {
  const { orgId, planId, userRole, learningPath, engagementData, totalItems, completedItems } = input;
  const roleKey = userRole ?? 'general';
  const memoryKey = `onboarding_analysis:${orgId}:${roleKey}`;

  const completionRate = totalItems > 0 ? completedItems / totalItems : 0;
  const isLowEngagement = completionRate < 0.2;
  const importance = isLowEngagement ? 0.5 : 0.8;

  await withAgentLogging(
    {
      orgId,
      agentType: AGENT_TYPE,
      actionType: 'analyze_engagement',
      inputSummary: `Analyze engagement for plan ${planId} (${completedItems}/${totalItems} items, role: ${roleKey})`,
    },
    async () => {
      const genai = getGenAIClient();

      const viewedMap = new Map(
        engagementData.viewedContent.map((v) => [v.contentId, v]),
      );

      const itemSummaries = learningPath.map((item) => {
        const view = viewedMap.get(item.contentId);
        const timeSpent = view?.durationSec ?? 0;
        const ratio = item.estimatedMinutes > 0
          ? timeSpent / (item.estimatedMinutes * 60)
          : 0;

        return {
          title: redactPII(sanitize(item.title)),
          contentType: item.contentType,
          completed: item.completed,
          estimatedMin: item.estimatedMinutes,
          actualSec: timeSpent,
          timeRatio: Math.round(ratio * 100) / 100,
          skipped: !item.completed && timeSpent < 10,
        };
      });

      // Redact PII from user-generated engagement data before sending to LLM
      const redactedSearchQueries = engagementData.searchQueries.map((q) => redactPII(sanitize(q)));
      const redactedChatQuestions = engagementData.chatQuestions.map((q) => redactPII(sanitize(q, 500)));

      const prompt = `You are an onboarding optimization analyst. Analyze this onboarding plan engagement data and provide actionable insights for improving future plans.

**Role:** ${roleKey}
**Completion rate:** ${completedItems}/${totalItems} (${Math.round(completionRate * 100)}%)

**Learning path items:**
${itemSummaries.map((s, i) => `${i + 1}. "${s.title}" [${s.contentType}] — completed: ${s.completed}, estimated: ${s.estimatedMin}min, actual: ${Math.round(s.actualSec / 60)}min, time ratio: ${s.timeRatio}, skipped: ${s.skipped}`).join('\n')}

**Search queries from the user:** ${redactedSearchQueries.length > 0 ? redactedSearchQueries.join(', ') : 'none'}
**Chat questions asked:** ${redactedChatQuestions.length > 0 ? redactedChatQuestions.join('; ') : 'none'}

Provide a JSON object with these fields:
{
  "skippedTopics": ["topics that were consistently skipped or had very low engagement"],
  "highEngagementTopics": ["topics that had high time spent or generated questions"],
  "missingTopics": ["topics searched for but not in the plan"],
  "orderingInsights": ["suggestions for reordering, e.g. 'Setup items are always completed first'"],
  "summary": "2-3 sentence summary of key findings"
}`;

      try {
        const result = await genai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
          config: { temperature: 0.3, maxOutputTokens: 1024 },
        });

        const responseText = result.text ?? '';
        const analysis = parseAnalysisResponse(responseText);

        if (!analysis) {
          console.warn('[OnboardingEngagement] Failed to parse Gemini analysis');
          return;
        }

        let existingMemory = null;
        try {
          existingMemory = await recallMemory({
            orgId,
            agentType: AGENT_TYPE,
            key: memoryKey,
          });
        } catch (recallError) {
          console.warn('[OnboardingEngagement] Failed to recall prior memory:', recallError);
        }

        const mergedInsights = existingMemory
          ? mergeInsights(existingMemory.memory_value, analysis)
          : JSON.stringify(analysis);

        await storeMemory({
          orgId,
          agentType: AGENT_TYPE,
          key: memoryKey,
          value: mergedInsights,
          importance,
          metadata: {
            planId,
            completionRate: Math.round(completionRate * 100),
            analyzedAt: new Date().toISOString(),
            sampleCount: existingMemory
              ? getSampleCount(existingMemory.metadata) + 1
              : 1,
          } as Json,
        });

        console.log(
          `[OnboardingEngagement] Analysis stored for ${memoryKey} (importance: ${importance})`,
        );
      } catch (error) {
        console.error('[OnboardingEngagement] Gemini analysis failed:', error);
      }
    },
  );
}

interface AnalysisResult {
  skippedTopics: string[];
  highEngagementTopics: string[];
  missingTopics: string[];
  orderingInsights: string[];
  summary: string;
}

function parseAnalysisResponse(text: string): AnalysisResult | null {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object') return null;

    return {
      skippedTopics: Array.isArray(parsed.skippedTopics) ? parsed.skippedTopics.filter((item: unknown) => typeof item === 'string') : [],
      highEngagementTopics: Array.isArray(parsed.highEngagementTopics) ? parsed.highEngagementTopics.filter((item: unknown) => typeof item === 'string') : [],
      missingTopics: Array.isArray(parsed.missingTopics) ? parsed.missingTopics.filter((item: unknown) => typeof item === 'string') : [],
      orderingInsights: Array.isArray(parsed.orderingInsights) ? parsed.orderingInsights.filter((item: unknown) => typeof item === 'string') : [],
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    };
  } catch {
    return null;
  }
}

function mergeInsights(existingValue: string, newAnalysis: AnalysisResult): string {
  try {
    const existing = JSON.parse(existingValue) as AnalysisResult;

    const dedup = (arr: string[]) => [...new Set(arr)];

    return JSON.stringify({
      skippedTopics: dedup([...existing.skippedTopics, ...newAnalysis.skippedTopics]),
      highEngagementTopics: dedup([...existing.highEngagementTopics, ...newAnalysis.highEngagementTopics]),
      missingTopics: dedup([...existing.missingTopics, ...newAnalysis.missingTopics]),
      orderingInsights: dedup([...existing.orderingInsights, ...newAnalysis.orderingInsights]),
      summary: newAnalysis.summary,
    } satisfies AnalysisResult);
  } catch {
    return JSON.stringify(newAnalysis);
  }
}
