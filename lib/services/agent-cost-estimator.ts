/**
 * Agent Action Cost Estimator
 *
 * Estimates token usage and USD cost for agent actions.
 * Uses Gemini Flash pricing as the baseline model for all agent operations.
 *
 * Pricing reference (Gemini 2.0 Flash):
 *   Input:  $0.10 per 1M tokens  ($0.0000001 per token)
 *   Output: $0.40 per 1M tokens  ($0.0000004 per token)
 *   Blended: ~$0.002 per 1000 tokens (conservative estimate)
 */

export interface CostEstimate {
  estimatedTokens: number;
  estimatedCostUsd: number;
  breakdown: string;
}

/** Per-token blended cost (input + output) in USD */
const COST_PER_TOKEN_USD = 0.000002;

interface ActionCostProfile {
  tokens: number;
  breakdown: string;
}

/**
 * Known action types and their estimated token profiles.
 * Each entry includes the total token count and a human-readable breakdown.
 */
const ACTION_PROFILES: Record<string, ActionCostProfile> = {
  generate_metadata: {
    tokens: 500,
    breakdown: '~300 input tokens (transcript excerpt) + ~200 output tokens (title, description) using Gemini Flash',
  },
  auto_categorize: {
    tokens: 1000,
    breakdown: '~500 input tokens (concept context) + ~500 output tokens (tag suggestions) using Gemini Flash',
  },
  detect_duplicate: {
    tokens: 200,
    breakdown: '~150 input tokens (embeddings + metadata) + ~50 output tokens (similarity verdict) using Gemini Flash',
  },
  analyze_gaps: {
    tokens: 2000,
    breakdown: '~1200 input tokens (search logs + chat queries) + ~800 output tokens (gap analysis) using Gemini Flash',
  },
  generate_onboarding_plan: {
    tokens: 3000,
    breakdown: '~1800 input tokens (concept graph + content catalog) + ~1200 output tokens (sequenced learning path) using Gemini Flash',
  },
  // Additional known actions mapped to the closest profile
  extract_concepts: {
    tokens: 800,
    breakdown: '~500 input tokens (transcript chunk) + ~300 output tokens (concept list) using Gemini Flash',
  },
  suggest_tags: {
    tokens: 1000,
    breakdown: '~500 input tokens (concept context) + ~500 output tokens (tag suggestions) using Gemini Flash',
  },
  auto_apply_tags: {
    tokens: 1000,
    breakdown: '~500 input tokens (concept context) + ~500 output tokens (tag application) using Gemini Flash',
  },
  detect_stale: {
    tokens: 400,
    breakdown: '~300 input tokens (content metadata + timestamps) + ~100 output tokens (staleness verdict) using Gemini Flash',
  },
  merge_content: {
    tokens: 1500,
    breakdown: '~900 input tokens (two content items) + ~600 output tokens (merged result) using Gemini Flash',
  },
  archive_content: {
    tokens: 300,
    breakdown: '~200 input tokens (content metadata) + ~100 output tokens (archive decision) using Gemini Flash',
  },
  suggest_merge: {
    tokens: 1500,
    breakdown: '~900 input tokens (content pair) + ~600 output tokens (merge suggestion) using Gemini Flash',
  },
  detect_bus_factor: {
    tokens: 1200,
    breakdown: '~800 input tokens (authorship data) + ~400 output tokens (bus factor report) using Gemini Flash',
  },
  gap_alert: {
    tokens: 800,
    breakdown: '~500 input tokens (gap data) + ~300 output tokens (alert details) using Gemini Flash',
  },
  publish_external: {
    tokens: 2000,
    breakdown: '~1200 input tokens (content body) + ~800 output tokens (formatted export) using Gemini Flash',
  },
};

/** Conservative fallback for unknown action types */
const UNKNOWN_ACTION_PROFILE: ActionCostProfile = {
  tokens: 5000,
  breakdown: 'Unknown action type — using maximum estimate',
};

/**
 * Estimate the token usage and cost for an agent action.
 *
 * @param agentType - The agent performing the action (e.g. 'curator')
 * @param actionType - The specific action (e.g. 'auto_categorize')
 * @param _metadata - Reserved for future per-invocation adjustments
 */
export async function estimateActionCost(
  agentType: string,
  actionType: string,
  _metadata?: Record<string, unknown>,
): Promise<CostEstimate> {
  const profile = ACTION_PROFILES[actionType] ?? UNKNOWN_ACTION_PROFILE;

  return {
    estimatedTokens: profile.tokens,
    estimatedCostUsd: parseFloat((profile.tokens * COST_PER_TOKEN_USD).toFixed(6)),
    breakdown: profile.breakdown,
  };
}

/**
 * Estimate the aggregate monthly agent cost for an org based on content volume.
 *
 * Assumes each content item triggers one round of: generate_metadata,
 * auto_categorize, and detect_duplicate per month. Gap analysis and
 * onboarding run once per month regardless of volume.
 *
 * @param contentCount - Number of content items in the org
 */
export function estimateMonthlyAgentCost(contentCount: number): {
  estimatedMonthlyCostUsd: number;
  breakdown: string;
} {
  if (contentCount <= 0) {
    return { estimatedMonthlyCostUsd: 0, breakdown: '$0.00 estimated' };
  }

  // Per-content actions (run once per item per month)
  const perContentTokens =
    (ACTION_PROFILES.generate_metadata.tokens +
      ACTION_PROFILES.auto_categorize.tokens +
      ACTION_PROFILES.detect_duplicate.tokens) *
    contentCount;

  // Fixed monthly actions
  const fixedTokens =
    ACTION_PROFILES.analyze_gaps.tokens +
    ACTION_PROFILES.generate_onboarding_plan.tokens;

  const totalTokens = perContentTokens + fixedTokens;
  const totalCost = totalTokens * COST_PER_TOKEN_USD;

  return {
    estimatedMonthlyCostUsd: parseFloat(totalCost.toFixed(2)),
    breakdown: `${contentCount} content items × 1,700 tokens/item + 5,000 fixed tokens = ~${totalTokens.toLocaleString()} tokens/month`,
  };
}
