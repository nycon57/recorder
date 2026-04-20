import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';

import {
  createVendorSourceRegistryService,
  type VendorSourceRow,
} from './vendor-source-registry';
import {
  getTier1VendorAllowlist,
  resolveVendorSourceAdapter,
  type VendorSourceSyncMode,
  type VendorSourceSyncPayload,
} from './vendor-source-adapters';

type JobInsert = Database['public']['Tables']['jobs']['Insert'];

const DEFAULT_FRESHNESS_TARGET_MS = 7 * 24 * 60 * 60 * 1000;
export const FAILED_SOURCE_RETRY_MS = 60 * 60 * 1000;

export interface VendorSourceSyncResult {
  sourceId: string;
  app: string;
  status: 'queued' | 'skipped' | 'unsupported' | 'missing';
  reason?: string;
  jobId?: string;
}

function parseDate(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseFreshnessTargetMs(
  freshnessTarget: string | null | undefined,
): number {
  if (!freshnessTarget?.trim()) {
    return DEFAULT_FRESHNESS_TARGET_MS;
  }

  const pattern = /(\d+)\s*(day|days|hour|hours|minute|minutes)/gi;
  let total = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(freshnessTarget)) !== null) {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('day')) {
      total += amount * 24 * 60 * 60 * 1000;
    } else if (unit.startsWith('hour')) {
      total += amount * 60 * 60 * 1000;
    } else if (unit.startsWith('minute')) {
      total += amount * 60 * 1000;
    }
  }

  return total > 0 ? total : DEFAULT_FRESHNESS_TARGET_MS;
}

export function isVendorSourceDueForSync(
  source: Pick<
    VendorSourceRow,
    'freshness_target' | 'last_attempt_at' | 'last_error' | 'last_success_at'
  >,
  now = new Date(),
  retryBackoffMs = FAILED_SOURCE_RETRY_MS,
): boolean {
  const nowMs = now.getTime();
  const lastAttemptMs = parseDate(source.last_attempt_at);
  const lastSuccessMs = parseDate(source.last_success_at);

  if (source.last_error) {
    if (lastAttemptMs === null) return true;
    return nowMs - lastAttemptMs >= retryBackoffMs;
  }

  if (lastSuccessMs === null) {
    return true;
  }

  const freshnessTargetMs = parseFreshnessTargetMs(source.freshness_target);
  return nowMs - lastSuccessMs >= freshnessTargetMs;
}

export function buildVendorSourceSyncDedupeKey(sourceId: string): string {
  return `ingest_vendor_docs:source:${sourceId}`;
}

export function buildVendorSourceSyncJobInsert(
  source: Pick<VendorSourceRow, 'id'>,
  payload: VendorSourceSyncPayload,
): JobInsert {
  return {
    type: 'ingest_vendor_docs',
    status: 'pending',
    priority: 2,
    dedupe_key: buildVendorSourceSyncDedupeKey(source.id),
    payload: payload as unknown as Json,
  };
}

export function createVendorSourceSyncService(
  supabase = createAdminClient(),
) {
  const registry = createVendorSourceRegistryService(supabase);

  async function ensureAllowedSources(): Promise<VendorSourceRow[]> {
    const allowlist = getTier1VendorAllowlist();

    const ensured = await registry.buildLegacyBackfill();
    for (const source of ensured.candidates) {
      if (!allowlist.includes(source.app)) continue;
      await registry.upsertSource(source);
    }

    const { data, error } = await (supabase
      .from('vendor_doc_sources') as any)
      .select('*')
      .in('app', allowlist)
      .eq('official_source', true)
      .order('app', { ascending: true })
      .order('source_url', { ascending: true });

    if (error) {
      throw new Error(
        `[vendor-source-sync] Failed to list allowed vendor sources: ${error.message}`,
      );
    }

    return (data ?? []) as VendorSourceRow[];
  }

  async function loadSourceById(
    sourceId: string,
  ): Promise<VendorSourceRow | null> {
    const { data, error } = await (supabase
      .from('vendor_doc_sources') as any)
      .select('*')
      .eq('id', sourceId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `[vendor-source-sync] Failed to load vendor source ${sourceId}: ${error.message}`,
      );
    }

    return (data as VendorSourceRow | null) ?? null;
  }

  return {
    ensureAllowedSources,

    async scheduleSources(options?: {
      force?: boolean;
      mode?: VendorSourceSyncMode;
      sourceId?: string;
      /** Audit provenance — system-admin user who initiated this sync (TRIB-146). */
      triggeredByUserId?: string | null;
    }): Promise<VendorSourceSyncResult[]> {
      const force = options?.force ?? false;
      const mode = options?.mode ?? 'scheduled';
      const triggeredByUserId = options?.triggeredByUserId ?? null;
      const now = new Date();
      const attemptedAt = now.toISOString();

      const sources = options?.sourceId
        ? [await loadSourceById(options.sourceId)]
        : await ensureAllowedSources();

      const results: VendorSourceSyncResult[] = [];

      for (const source of sources) {
        if (!source) {
          results.push({
            sourceId: options?.sourceId ?? 'unknown',
            app: 'unknown',
            status: 'missing',
            reason: 'Vendor source was not found',
          });
          continue;
        }

        const adapter = resolveVendorSourceAdapter(source);
        if (!adapter.supported) {
          await registry.recordFailure(source.id, {
            attemptedAt,
            failedAt: attemptedAt,
            errorMessage:
              adapter.reason ??
              `Vendor source ${source.id} cannot be scheduled by the current adapter pack`,
          });

          results.push({
            sourceId: source.id,
            app: source.app,
            status: 'unsupported',
            reason: adapter.reason,
          });
          continue;
        }

        if (!force && !isVendorSourceDueForSync(source, now)) {
          results.push({
            sourceId: source.id,
            app: source.app,
            status: 'skipped',
            reason: 'Source is still fresh and does not need a new sync yet',
          });
          continue;
        }

        const payload = adapter.buildPayload(mode);
        // Plumb audit provenance from the API caller (back-compat: null for scheduled jobs)
        if (triggeredByUserId) {
          payload.triggered_by_user_id = triggeredByUserId;
        }
        const insert = buildVendorSourceSyncJobInsert(source, payload);

        const { data, error } = await (supabase
          .from('jobs') as any)
          .insert(insert)
          .select('id')
          .single();

        if (error) {
          if (error.code === '23505') {
            results.push({
              sourceId: source.id,
              app: source.app,
              status: 'skipped',
              reason: 'A vendor sync job is already pending or processing for this source',
            });
            continue;
          }

          throw new Error(
            `[vendor-source-sync] Failed to enqueue sync job for ${source.id}: ${error.message}`,
          );
        }

        results.push({
          sourceId: source.id,
          app: source.app,
          status: 'queued',
          jobId: data?.id as string | undefined,
        });
      }

      return results;
    },
  };
}
