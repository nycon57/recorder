import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

import {
  buildVendorSourceSyncDedupeKey,
  isVendorSourceDueForSync,
} from './vendor-source-sync';
import {
  getVendorSourceSyncBlockReason,
  type VendorSourceRow,
} from './vendor-source-registry';

interface VendorSourcePageCountRow {
  vendor_source_id: string | null;
  page_count: number;
}
interface LegacyVendorSourcePageCountRow {
  vendor_source_id: string | null;
  page_count: number;
}
type VendorSourceJobRow = Pick<
  Database['public']['Tables']['jobs']['Row'],
  'id' | 'status' | 'dedupe_key' | 'created_at' | 'completed_at'
>;

export type VendorSourceOpsStatus =
  | 'healthy'
  | 'syncing'
  | 'blocked'
  | 'stale'
  | 'failing'
  | 'never_synced';

export interface VendorSourceOpsItem {
  id: string;
  app: string;
  status: VendorSourceOpsStatus;
  sourceKind: VendorSourceRow['source_kind'];
  sourceUrl: string;
  normalizedSourceUrl: string;
  publisherHostname: string;
  fetchStrategy: VendorSourceRow['fetch_strategy'];
  officialSource: boolean;
  freshnessTarget: string;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  versionBand: string[];
  planBand: string[];
  applicability: Json;
  termsReviewStatus: VendorSourceRow['terms_review_status'];
  lifecycle: VendorSourceRow['lifecycle'];
  legalReviewedAt: string | null;
  legalReviewedBy: string | null;
  legalReviewReferenceUrl: string | null;
  legalReviewNotes: string | null;
  retiredAt: string | null;
  retiredBy: string | null;
  retirementReason: string | null;
  replacementSourceId: string | null;
  contentHash: string | null;
  latestSyncJobId: string | null;
  latestSyncJobStatus: string | null;
  latestSyncJobCreatedAt: string | null;
  latestSyncJobCompletedAt: string | null;
  corpusPageCount: number;
  legacyPageCount: number;
  activeJobStatus: 'pending' | 'processing' | null;
  isDueForSync: boolean;
  syncBlockReason: string | null;
}

interface VendorSourceOpsSummary {
  totalSources: number;
  appsCovered: number;
  healthySources: number;
  syncingSources: number;
  blockedSources: number;
  staleSources: number;
  failingSources: number;
  neverSyncedSources: number;
  restrictedSources: number;
  pausedSources: number;
  retiredSources: number;
}

export interface VendorSourceOpsSnapshot {
  generatedAt: string;
  summary: VendorSourceOpsSummary;
  sources: VendorSourceOpsItem[];
}

interface VendorSourceOpsSnapshotInput {
  sources: VendorSourceRow[];
  corpusPages: VendorSourcePageCountRow[];
  legacyPages: LegacyVendorSourcePageCountRow[];
  activeJobs: VendorSourceJobRow[];
  generatedAt?: string;
  now?: Date;
}

function setCount(
  map: Map<string, number>,
  key: string | null,
  count: number,
): void {
  if (!key) return;
  map.set(key, count);
}

function getStatusRank(status: VendorSourceOpsStatus): number {
  switch (status) {
    case 'failing':
      return 0;
    case 'stale':
      return 1;
    case 'blocked':
      return 2;
    case 'never_synced':
      return 3;
    case 'syncing':
      return 4;
    case 'healthy':
      return 5;
    default:
      return 5;
  }
}

function resolveActiveJobStatus(
  sourceId: string,
  activeJobsByDedupeKey: Map<string, 'pending' | 'processing'>,
): 'pending' | 'processing' | null {
  return activeJobsByDedupeKey.get(buildVendorSourceSyncDedupeKey(sourceId)) ?? null;
}

function resolveLatestJob(
  sourceId: string,
  latestJobsByDedupeKey: Map<string, VendorSourceJobRow>,
): VendorSourceJobRow | null {
  return latestJobsByDedupeKey.get(buildVendorSourceSyncDedupeKey(sourceId)) ?? null;
}

function normalizeSourceUrlForLedger(sourceUrl: string): string {
  try {
    const parsed = new URL(sourceUrl.trim());
    parsed.hash = '';

    for (const key of Array.from(parsed.searchParams.keys())) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith('utm_') ||
        normalizedKey === 'gclid' ||
        normalizedKey === 'fbclid'
      ) {
        parsed.searchParams.delete(key);
      }
    }

    return parsed.toString();
  } catch {
    return sourceUrl.trim();
  }
}

export function buildVendorSourceOpsSnapshot({
  sources,
  corpusPages,
  legacyPages,
  activeJobs,
  generatedAt = new Date().toISOString(),
  now = new Date(),
}: VendorSourceOpsSnapshotInput): VendorSourceOpsSnapshot {
  const corpusPagesBySourceId = new Map<string, number>();
  const legacyPagesBySourceId = new Map<string, number>();
  const activeJobsByDedupeKey = new Map<string, 'pending' | 'processing'>();
  const latestJobsByDedupeKey = new Map<string, VendorSourceJobRow>();

  for (const page of corpusPages) {
    setCount(corpusPagesBySourceId, page.vendor_source_id, page.page_count);
  }

  for (const page of legacyPages) {
    setCount(legacyPagesBySourceId, page.vendor_source_id, page.page_count);
  }

  for (const job of activeJobs) {
    if (job.dedupe_key && !latestJobsByDedupeKey.has(job.dedupe_key)) {
      latestJobsByDedupeKey.set(job.dedupe_key, job);
    }

    if (
      job.dedupe_key &&
      (job.status === 'pending' || job.status === 'processing')
    ) {
      activeJobsByDedupeKey.set(job.dedupe_key, job.status);
    }
  }

  const items: VendorSourceOpsItem[] = sources
    .map((source) => {
      const activeJobStatus = resolveActiveJobStatus(
        source.id,
        activeJobsByDedupeKey,
      );
      const latestSyncJob = resolveLatestJob(source.id, latestJobsByDedupeKey);
      const isDueForSync = isVendorSourceDueForSync(source, now);
      const syncBlockReason = getVendorSourceSyncBlockReason(source);

      let status: VendorSourceOpsStatus;
      if (syncBlockReason) {
        status = 'blocked';
      } else if (activeJobStatus) {
        status = 'syncing';
      } else if (source.last_error) {
        status = 'failing';
      } else if (!source.last_success_at) {
        status = 'never_synced';
      } else if (isDueForSync) {
        status = 'stale';
      } else {
        status = 'healthy';
      }

      return {
        id: source.id,
        app: source.app,
        status,
        sourceKind: source.source_kind,
        sourceUrl: source.source_url,
        normalizedSourceUrl: normalizeSourceUrlForLedger(source.source_url),
        publisherHostname: source.publisher_hostname,
        fetchStrategy: source.fetch_strategy,
        officialSource: source.official_source,
        freshnessTarget: source.freshness_target,
        lastSuccessfulSyncAt: source.last_success_at,
        lastAttemptAt: source.last_attempt_at,
        lastError: source.last_error,
        versionBand: source.version_band,
        planBand: source.plan_band,
        applicability: source.applicability,
        termsReviewStatus: source.terms_review_status,
        lifecycle: source.lifecycle,
        legalReviewedAt: source.legal_reviewed_at,
        legalReviewedBy: source.legal_reviewed_by,
        legalReviewReferenceUrl: source.legal_review_reference_url,
        legalReviewNotes: source.legal_review_notes,
        retiredAt: source.retired_at,
        retiredBy: source.retired_by,
        retirementReason: source.retirement_reason,
        replacementSourceId: source.replacement_source_id,
        contentHash: source.content_hash,
        latestSyncJobId: latestSyncJob?.id ?? null,
        latestSyncJobStatus: latestSyncJob?.status ?? null,
        latestSyncJobCreatedAt: latestSyncJob?.created_at ?? null,
        latestSyncJobCompletedAt: latestSyncJob?.completed_at ?? null,
        corpusPageCount: corpusPagesBySourceId.get(source.id) ?? 0,
        legacyPageCount: legacyPagesBySourceId.get(source.id) ?? 0,
        activeJobStatus,
        isDueForSync,
        syncBlockReason,
      };
    })
    .sort((left, right) => {
      const statusDelta = getStatusRank(left.status) - getStatusRank(right.status);
      if (statusDelta !== 0) return statusDelta;

      const appDelta = left.app.localeCompare(right.app);
      if (appDelta !== 0) return appDelta;

      return left.sourceUrl.localeCompare(right.sourceUrl);
    });

  const appsCovered = new Set(items.map((item) => item.app)).size;

  return {
    generatedAt,
    summary: {
      totalSources: items.length,
      appsCovered,
      healthySources: items.filter((item) => item.status === 'healthy').length,
      syncingSources: items.filter((item) => item.status === 'syncing').length,
      staleSources: items.filter((item) => item.status === 'stale').length,
      failingSources: items.filter((item) => item.status === 'failing').length,
      blockedSources: items.filter((item) => item.status === 'blocked').length,
      neverSyncedSources: items.filter((item) => item.status === 'never_synced')
        .length,
      restrictedSources: items.filter(
        (item) => item.termsReviewStatus === 'restricted',
      ).length,
      pausedSources: items.filter((item) => item.lifecycle === 'paused').length,
      retiredSources: items.filter((item) => item.lifecycle === 'retired').length,
    },
    sources: items,
  };
}

export function createVendorSourceOpsService(supabase = createAdminClient()) {
  return {
    async getSnapshot(): Promise<VendorSourceOpsSnapshot> {
      const [sourcesResult, corpusPagesResult, legacyPagesResult, jobsResult] =
        await Promise.all([
          supabase
            .from('vendor_doc_sources')
            .select('*')
            .order('app', { ascending: true })
            .order('source_url', { ascending: true }),
          supabase
            .from('vendor_corpus_page_counts')
            .select('vendor_source_id, page_count'),
          supabase
            .from('vendor_wiki_page_counts')
            .select('vendor_source_id, page_count'),
          supabase
            .from('jobs')
            .select('id, status, dedupe_key, created_at, completed_at')
            .eq('type', 'ingest_vendor_docs')
            .order('created_at', { ascending: false })
            .limit(500),
        ]);

      if (sourcesResult.error) {
        throw new Error(
          `[vendor-source-ops] Failed to load vendor sources: ${sourcesResult.error.message}`,
        );
      }

      if (corpusPagesResult.error) {
        throw new Error(
          `[vendor-source-ops] Failed to load vendor corpus page counts: ${corpusPagesResult.error.message}`,
        );
      }

      if (legacyPagesResult.error) {
        throw new Error(
          `[vendor-source-ops] Failed to load legacy vendor page counts: ${legacyPagesResult.error.message}`,
        );
      }

      if (jobsResult.error) {
        throw new Error(
          `[vendor-source-ops] Failed to load vendor sync jobs: ${jobsResult.error.message}`,
        );
      }

      return buildVendorSourceOpsSnapshot({
        sources: sourcesResult.data ?? [],
        corpusPages: corpusPagesResult.data ?? [],
        legacyPages: legacyPagesResult.data ?? [],
        activeJobs: jobsResult.data ?? [],
      });
    },
  };
}
