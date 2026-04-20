import type { VendorFetchStrategy } from './vendor-source-registry';
import type { VendorSourceRow } from './vendor-source-registry';

export type VendorSourceSyncMode = 'scheduled' | 'manual';

export interface VendorSourceSyncPayload {
  url: string;
  app: string;
  maxPages?: number;
  sourceId: string;
  syncType: VendorSourceSyncMode;
  /** Optional audit field — system-admin user who triggered this job (TRIB-146). */
  triggered_by_user_id?: string | null;
}

export interface VendorSourceAdapterResolution {
  adapterKey: string;
  priorityRank: number;
  supported: boolean;
  reason?: string;
  buildPayload: (mode: VendorSourceSyncMode) => VendorSourceSyncPayload;
}

export const VENDOR_FETCH_PRIORITY: VendorFetchStrategy[] = [
  'markdown_export',
  'llms_txt',
  'static_site',
  'official_mcp_snapshot',
  'sanctioned_crawl',
];

export const DEFAULT_TIER1_VENDOR_ALLOWLIST = [
  'hubspot',
  'jira',
  'notion',
  'salesforce',
  'supabase',
  'vercel',
  'zendesk',
];

const DEFAULT_VENDOR_SYNC_MAX_PAGES = 60;

const TIER1_VENDOR_SYNC_CONFIG: Record<string, { maxPages: number }> = {
  hubspot: { maxPages: 80 },
  jira: { maxPages: 60 },
  notion: { maxPages: 40 },
  salesforce: { maxPages: 80 },
  supabase: { maxPages: 50 },
  vercel: { maxPages: 50 },
  zendesk: { maxPages: 60 },
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  const normalized = values.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );

  return Array.from(
    new Set(normalized.map((value) => value.trim().toLowerCase())),
  ).sort((left, right) => left.localeCompare(right));
}

export function getTier1VendorAllowlist(
  raw = process.env.VENDOR_SYNC_ALLOWLIST,
): string[] {
  if (!raw?.trim()) {
    return [...DEFAULT_TIER1_VENDOR_ALLOWLIST];
  }

  const parsed = uniqueSorted(raw.split(','));
  return parsed.length > 0 ? parsed : [...DEFAULT_TIER1_VENDOR_ALLOWLIST];
}

export function getVendorSourcePriorityRank(
  strategy: VendorFetchStrategy,
): number {
  const rank = VENDOR_FETCH_PRIORITY.indexOf(strategy);
  return rank >= 0 ? rank : VENDOR_FETCH_PRIORITY.length;
}

export function getTier1VendorSyncConfig(app: string): { maxPages: number } {
  return (
    TIER1_VENDOR_SYNC_CONFIG[app.toLowerCase()] ?? {
      maxPages: DEFAULT_VENDOR_SYNC_MAX_PAGES,
    }
  );
}

function buildSupportedAdapter(
  source: VendorSourceRow,
  adapterKey: string,
): VendorSourceAdapterResolution {
  const syncConfig = getTier1VendorSyncConfig(source.app);

  return {
    adapterKey,
    priorityRank: getVendorSourcePriorityRank(source.fetch_strategy),
    supported: true,
    buildPayload: (mode) => ({
      url: source.source_url,
      app: source.app,
      maxPages: syncConfig.maxPages,
      sourceId: source.id,
      syncType: mode,
    }),
  };
}

function buildUnsupportedAdapter(
  source: VendorSourceRow,
  adapterKey: string,
  reason: string,
): VendorSourceAdapterResolution {
  return {
    adapterKey,
    priorityRank: getVendorSourcePriorityRank(source.fetch_strategy),
    supported: false,
    reason,
    buildPayload: () => {
      throw new Error(reason);
    },
  };
}

export function resolveVendorSourceAdapter(
  source: VendorSourceRow,
): VendorSourceAdapterResolution {
  switch (source.fetch_strategy) {
    case 'sanctioned_crawl':
      return buildSupportedAdapter(source, 'html-crawl');
    case 'static_site':
      return buildSupportedAdapter(source, 'static-site');
    case 'markdown_export':
    case 'llms_txt':
    case 'official_mcp_snapshot':
      return buildUnsupportedAdapter(
        source,
        source.fetch_strategy,
        `Vendor fetch strategy ${source.fetch_strategy} is not yet supported by the shared vendor sync worker`,
      );
    default:
      return buildUnsupportedAdapter(
        source,
        'unknown',
        `Unknown vendor fetch strategy ${String(source.fetch_strategy)}`,
      );
  }
}
