import { supabaseAdmin } from '@/lib/supabase/admin';

import {
  isVendorSourceQueryable,
  type VendorSourceRow,
} from './vendor-source-registry';

type SupabaseLike = Pick<typeof supabaseAdmin, 'from'>;

export interface VendorSourceBackedRow {
  vendor_source_id?: string | null;
}

type QueryabilitySourceRow = Pick<
  VendorSourceRow,
  'id' | 'lifecycle' | 'retired_at' | 'terms_review_status' | 'official_source'
>;

export async function filterQueryableVendorSourceRows<
  T extends VendorSourceBackedRow,
>(rows: T[], supabase: SupabaseLike = supabaseAdmin): Promise<T[]> {
  const sourceIds = Array.from(
    new Set(
      rows.flatMap((__item, __index, __array) => {
        const __mapped = __item.vendor_source_id;
        return typeof __mapped === 'string' && __mapped.length > 0
          ? [__mapped]
          : [];
      }),
    ),
  );

  if (sourceIds.length === 0) {
    return rows;
  }

  const { data, error } = await (
    supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('vendor_doc_sources') as any
  )
    .select('id, lifecycle, retired_at, terms_review_status, official_source')
    .in('id', sourceIds);

  if (error) {
    throw new Error(
      `Failed to load vendor source queryability: ${error.message}`,
    );
  }

  const queryableSourceIds = new Set(
    ((data ?? []) as QueryabilitySourceRow[]).flatMap(
      (__item, __index, __array) =>
        isVendorSourceQueryable(__item) ? [__item.id] : [],
    ),
  );

  return rows.filter((row) => {
    const sourceId = row.vendor_source_id;
    return !sourceId || queryableSourceIds.has(sourceId);
  });
}
