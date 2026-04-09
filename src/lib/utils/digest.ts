/**
 * Shared digest types and utilities for parsing agent_activity_log metadata.
 */

// ---------- Shared Types ----------

export interface DigestStats {
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

export interface WeeklyDigest {
  period: { start: string; end: string };
  summary: string;
  stats: DigestStats;
  highlights: string[];
  gaps: string[];
}

export interface DigestEntry {
  id: string;
  createdAt: string;
  digest: WeeklyDigest | null;
}

// ---------- Helpers ----------

/** Safely extract the digest object from an agent_activity_log metadata column. */
export function extractDigest(metadata: unknown): WeeklyDigest | null {
  const meta = metadata as Record<string, unknown> | null;
  return (meta?.digest as WeeklyDigest) ?? null;
}

/** Map a raw agent_activity_log row into a typed DigestEntry. */
export function toDigestEntry(row: {
  id: string;
  metadata: unknown;
  created_at: string;
}): DigestEntry {
  return {
    id: row.id,
    createdAt: row.created_at,
    digest: extractDigest(row.metadata),
  };
}
