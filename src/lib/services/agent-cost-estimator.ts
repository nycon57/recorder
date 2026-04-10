export interface CostEstimate {
  estimatedTokens: number;
  estimatedCostUsd: number;
  breakdown: string;
}

/**
 * Per-token blended average cost (input + output) in USD.
 * Based on Gemini 2.0 Flash: $0.10/1M input + $0.40/1M output → blended average $0.25/1M.
 */
const COST_PER_TOKEN_USD = 0.00000025;

interface ActionCostProfile {
  tokens: number;
  breakdown: string;
}

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

const UNKNOWN_ACTION_PROFILE: ActionCostProfile = {
  tokens: 5000,
  breakdown: 'Unknown action type — using maximum estimate',
};

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

export function estimateMonthlyAgentCost(contentCount: number): {
  estimatedMonthlyCostUsd: number;
  breakdown: string;
} {
  if (contentCount <= 0) {
    return { estimatedMonthlyCostUsd: 0, breakdown: '$0.00 estimated' };
  }

  const perContentTokens =
    (ACTION_PROFILES.generate_metadata.tokens +
      ACTION_PROFILES.auto_categorize.tokens +
      ACTION_PROFILES.detect_duplicate.tokens) *
    contentCount;

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
