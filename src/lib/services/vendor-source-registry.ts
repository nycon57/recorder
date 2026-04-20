import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

export type VendorSourceKind =
  | 'documentation'
  | 'developer_docs'
  | 'help_center'
  | 'api_reference'
  | 'release_notes'
  | 'mcp_snapshot';

export type VendorFetchStrategy =
  | 'markdown_export'
  | 'llms_txt'
  | 'static_site'
  | 'official_mcp_snapshot'
  | 'sanctioned_crawl';

export type VendorTermsReviewStatus =
  | 'pending'
  | 'approved'
  | 'restricted'
  | 'rejected';

export interface VendorSourceDraftInput {
  app: string;
  sourceKind: VendorSourceKind;
  sourceUrl: string;
  publisherHostname: string;
  officialSource?: boolean;
  fetchStrategy: VendorFetchStrategy;
  freshnessTarget?: string;
  versionBand?: string[];
  planBand?: string[];
  applicability?: Json;
  termsReviewStatus?: VendorTermsReviewStatus;
}

export interface NormalizedVendorSourceDraft {
  app: string;
  sourceKind: VendorSourceKind;
  sourceUrl: string;
  publisherHostname: string;
  officialSource: true;
  fetchStrategy: VendorFetchStrategy;
  freshnessTarget: string;
  versionBand: string[];
  planBand: string[];
  applicability: Json;
  termsReviewStatus: VendorTermsReviewStatus;
}

export interface LegacyVendorWikiPage {
  id: string;
  app: string;
  screen: string;
  source_url: string | null;
  updated_at: string | null;
}

export interface VendorSourceBackfillResult {
  candidates: NormalizedVendorSourceDraft[];
  unresolvedLegacyPageIds: string[];
}

export interface VendorSourceSuccessPatchInput {
  attemptedAt: string;
  succeededAt: string;
  contentHash: string;
}

export interface VendorSourceFailurePatchInput {
  attemptedAt: string;
  failedAt: string;
  errorMessage: string;
}

export interface VendorSourceLookupInput {
  sourceId?: string;
  app: string;
  sourceUrl: string;
}

export type VendorSourceRow =
  Database['public']['Tables']['vendor_doc_sources']['Row'];
export type VendorSourceInsert =
  Database['public']['Tables']['vendor_doc_sources']['Insert'];
export type VendorSourceUpdate =
  Database['public']['Tables']['vendor_doc_sources']['Update'];

const DEFAULT_FRESHNESS_TARGET = '7 days';

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, '');
}

function derivePublisherHostname(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  const parts = normalized.split('.').filter(Boolean);

  if (parts.length <= 2) {
    return normalized;
  }

  return parts.slice(-2).join('.');
}

function normalizeBand(values: string[] | undefined): string[] {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function normalizeSourceUrl(sourceUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    throw new Error(`Invalid vendor source URL: ${sourceUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Vendor sources must use https URLs');
  }

  parsed.hash = '';
  parsed.search = '';
  return parsed;
}

function isOfficialVendorHost(hostname: string, publisherHostname: string): boolean {
  return hostname === publisherHostname || hostname.endsWith(`.${publisherHostname}`);
}

export function normalizeVendorSourceDraft(
  input: VendorSourceDraftInput
): NormalizedVendorSourceDraft {
  if (input.officialSource === false) {
    throw new Error('Shared vendor knowledge is official-source-only');
  }

  if (!input.publisherHostname?.trim()) {
    throw new Error('Vendor source publisher hostname is required');
  }

  const parsedUrl = normalizeSourceUrl(input.sourceUrl);
  const app = input.app.trim().toLowerCase();
  const publisherHostname = normalizeHostname(input.publisherHostname);
  const sourceHostname = normalizeHostname(parsedUrl.hostname);

  if (!isOfficialVendorHost(sourceHostname, publisherHostname)) {
    throw new Error(
      `Vendor source must resolve to an official vendor host for ${publisherHostname}`
    );
  }

  if (!app) {
    throw new Error('Vendor source app is required');
  }

  return {
    app,
    sourceKind: input.sourceKind,
    sourceUrl: parsedUrl.toString(),
    publisherHostname,
    officialSource: true,
    fetchStrategy: input.fetchStrategy,
    freshnessTarget:
      input.freshnessTarget?.trim() || DEFAULT_FRESHNESS_TARGET,
    versionBand: normalizeBand(input.versionBand),
    planBand: normalizeBand(input.planBand),
    applicability: input.applicability ?? {},
    termsReviewStatus: input.termsReviewStatus ?? 'pending',
  };
}

export function buildLegacyVendorSourceBackfill(
  pages: LegacyVendorWikiPage[]
): VendorSourceBackfillResult {
  const grouped = new Map<string, LegacyVendorWikiPage[]>();
  const unresolvedLegacyPageIds: string[] = [];

  for (const page of pages) {
    if (!page.source_url) {
      unresolvedLegacyPageIds.push(page.id);
      continue;
    }

    const key = `${page.app}::${page.source_url}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(page);
    } else {
      grouped.set(key, [page]);
    }
  }

  const candidates = Array.from(grouped.values()).map((group) => {
    const first = group[0];

    return normalizeVendorSourceDraft({
      app: first.app,
      sourceKind: 'documentation',
      sourceUrl: first.source_url!,
      publisherHostname: derivePublisherHostname(new URL(first.source_url!).hostname),
      fetchStrategy: 'sanctioned_crawl',
      applicability: {
        legacyPageIds: group.map((page) => page.id),
        legacyScreens: Array.from(
          new Set(group.map((page) => page.screen).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b)),
      },
    });
  });

  return {
    candidates,
    unresolvedLegacyPageIds,
  };
}

export function buildVendorSourceSuccessPatch({
  attemptedAt,
  succeededAt,
  contentHash,
}: VendorSourceSuccessPatchInput) {
  return {
    last_attempt_at: attemptedAt,
    last_success_at: succeededAt,
    content_hash: contentHash,
    last_error: null,
    updated_at: succeededAt,
  };
}

export function buildVendorSourceFailurePatch({
  attemptedAt,
  failedAt,
  errorMessage,
}: VendorSourceFailurePatchInput) {
  return {
    last_attempt_at: attemptedAt,
    last_error: errorMessage,
    updated_at: failedAt,
  };
}

export function hashVendorSourcePages(
  pages: Array<{ screen: string; contentHash: string }>
): string | null {
  if (pages.length === 0) {
    return null;
  }

  return pages
    .map((page) => `${page.screen}:${page.contentHash}`)
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

function toInsertRow(
  source: NormalizedVendorSourceDraft,
  timestamp: string
): VendorSourceInsert {
  return {
    app: source.app,
    source_kind: source.sourceKind,
    source_url: source.sourceUrl,
    publisher_hostname: source.publisherHostname,
    official_source: source.officialSource,
    fetch_strategy: source.fetchStrategy,
    freshness_target: source.freshnessTarget,
    version_band: source.versionBand,
    plan_band: source.planBand,
    applicability: source.applicability,
    terms_review_status: source.termsReviewStatus,
    updated_at: timestamp,
  };
}

export function createVendorSourceRegistryService(
  supabase = createAdminClient()
) {
  return {
    async upsertSource(
      input: VendorSourceDraftInput
    ): Promise<VendorSourceRow> {
      const normalized = normalizeVendorSourceDraft(input);
      const timestamp = new Date().toISOString();
      const row = toInsertRow(normalized, timestamp);

      const { data, error } = await (supabase
        .from('vendor_doc_sources') as any)
        .upsert(row, { onConflict: 'app,source_url' })
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(
          `[vendor-source-registry] Failed to upsert source ${normalized.app} ${normalized.sourceUrl}: ${error?.message ?? 'missing row'}`
        );
      }

      return data as VendorSourceRow;
    },

    async findSourceForIngestion({
      sourceId,
      app,
      sourceUrl,
    }: VendorSourceLookupInput): Promise<VendorSourceRow | null> {
      if (sourceId) {
        const { data, error } = await (supabase
          .from('vendor_doc_sources') as any)
          .select('*')
          .eq('id', sourceId)
          .maybeSingle();

        if (error) {
          throw new Error(
            `[vendor-source-registry] Failed to load source ${sourceId}: ${error.message}`
          );
        }

        return (data as VendorSourceRow | null) ?? null;
      }

      const normalized = normalizeVendorSourceDraft({
        app,
        sourceKind: 'documentation',
        sourceUrl,
        publisherHostname: derivePublisherHostname(new URL(sourceUrl).hostname),
        fetchStrategy: 'sanctioned_crawl',
      });

      const { data, error } = await (supabase
        .from('vendor_doc_sources') as any)
        .select('*')
        .eq('app', normalized.app)
        .eq('source_url', normalized.sourceUrl)
        .maybeSingle();

      if (error) {
        throw new Error(
          `[vendor-source-registry] Failed to find source for ${normalized.app}: ${error.message}`
        );
      }

      return (data as VendorSourceRow | null) ?? null;
    },

    async recordAttempt(sourceId: string, attemptedAt: string): Promise<void> {
      const patch: VendorSourceUpdate = {
        last_attempt_at: attemptedAt,
        last_error: null,
        updated_at: attemptedAt,
      };

      const { error } = await (supabase
        .from('vendor_doc_sources') as any)
        .update(patch)
        .eq('id', sourceId);

      if (error) {
        throw new Error(
          `[vendor-source-registry] Failed to record attempt for ${sourceId}: ${error.message}`
        );
      }
    },

    async recordSuccess(
      sourceId: string,
      input: VendorSourceSuccessPatchInput
    ): Promise<void> {
      const patch: VendorSourceUpdate = buildVendorSourceSuccessPatch(input);

      const { error } = await (supabase
        .from('vendor_doc_sources') as any)
        .update(patch)
        .eq('id', sourceId);

      if (error) {
        throw new Error(
          `[vendor-source-registry] Failed to record success for ${sourceId}: ${error.message}`
        );
      }
    },

    async recordFailure(
      sourceId: string,
      input: VendorSourceFailurePatchInput
    ): Promise<void> {
      const patch: VendorSourceUpdate = buildVendorSourceFailurePatch(input);

      const { error } = await (supabase
        .from('vendor_doc_sources') as any)
        .update(patch)
        .eq('id', sourceId);

      if (error) {
        throw new Error(
          `[vendor-source-registry] Failed to record failure for ${sourceId}: ${error.message}`
        );
      }
    },

    async buildLegacyBackfill(): Promise<VendorSourceBackfillResult> {
      const { data, error } = await (supabase
        .from('vendor_wiki_pages') as any)
        .select('id, app, screen, source_url, updated_at');

      if (error) {
        throw new Error(
          `[vendor-source-registry] Failed to inspect legacy vendor pages: ${error.message}`
        );
      }

      return buildLegacyVendorSourceBackfill(
        (data ?? []) as LegacyVendorWikiPage[]
      );
    },
  };
}
